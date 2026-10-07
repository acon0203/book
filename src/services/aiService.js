import { storageService } from './storageService';
import aiModelsDb from '../data/ai-models-db.json';
import { useStore } from '../store';

// Google AI Studio에서 지원하는 실제 활성 모델 목록 조회
async function fetchGoogleActiveModels(apiKey) {
  try {
    const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const models = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    console.log('[Google AI Studio] 🔍 현재 API 키로 사용 가능한 모델 목록:', models);
    return models;
  } catch (err) {
    console.warn('[Google AI Studio] 모델 목록 조회 실패:', err);
    return null;
  }
}

// 단일 Gemini / Gemma 모델 호출 (15초 타임아웃 지원)
async function callGeminiSingle(apiKey, modelId, prompt, systemPrompt = '') {
  const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(cleanKey)}`;
  
  const isGemma = modelId.toLowerCase().startsWith('gemma');

  // Gemma 모델은 system_instruction 필드를 지원하지 않아 500 에러를 유발하므로 본문 프롬프트에 병합
  let userText = prompt;
  if (isGemma && systemPrompt) {
    userText = `[역할 및 집필 지침]:\n${systemPrompt}\n\n[요청 내용]:\n${prompt}`;
  }

  const body = {
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  // Gemma는 system_instruction 필드를 지원하지 않으므로 Gemini 모델에만 추가
  if (systemPrompt && !isGemma) {
    body.system_instruction = { parts: [{ text: systemPrompt }] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20초 타임아웃

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    let finalResponse = response;
    let data = await finalResponse.json();

    // 503 Service Unavailable (High Demand) 시 1초 대기 후 1회 즉시 재시도
    if (finalResponse.status === 503) {
      console.warn(`[AI Engine] ⚡ 503 순간 혼잡 감지 ➔ 1.2초 후 1회 재시도 중...`);
      await new Promise(r => setTimeout(r, 1200));
      try {
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          body: JSON.stringify(body)
        });
        if (retryRes.ok) {
          data = await retryRes.json();
          finalResponse = retryRes;
        }
      } catch (e) {
        // 재시도 실패 시 기존 에러 흐름 유지
      }
    }

    if (!finalResponse.ok) {
      const errorMsg = data.error?.message || 'Gemini API 호출에 실패했습니다.';
      const isOverloadedOrQuota = (
        finalResponse.status === 404 ||
        finalResponse.status === 429 ||
        finalResponse.status === 503 ||
        finalResponse.status === 500 ||
        finalResponse.status === 502 ||
        finalResponse.status === 504 ||
        errorMsg.includes('not found') ||
        errorMsg.includes('high demand') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        errorMsg.includes('QUOTA') ||
        errorMsg.includes('Rate limit') ||
        data.error?.status === 'RESOURCE_EXHAUSTED' ||
        data.error?.status === 'UNAVAILABLE' ||
        data.error?.status === 'NOT_FOUND'
      );
      let userFriendlyMsg = errorMsg;
      if (finalResponse.status === 500 || errorMsg.includes('Internal error')) {
        userFriendlyMsg = `구글 서버 내부 오류(500): 구글 AI Studio에서 [${modelId}] 모델 서빙이 일시 불안정합니다.`;
      } else if (finalResponse.status === 503 || errorMsg.includes('high demand') || errorMsg.includes('overloaded')) {
        userFriendlyMsg = `구글 서버 트래픽 일시 과부하(503): 사용자가 몰려 응답이 지연되고 있습니다.`;
      } else if (finalResponse.status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('QUOTA')) {
        userFriendlyMsg = `무료 일일 사용량 한도 도달: 넉넉한 일일 500회 모델(Gemini 3.5 Flash Lite)로 변경을 권장합니다.`;
      }
      const error = new Error(userFriendlyMsg);
      error.rawMessage = errorMsg;
      error.status = finalResponse.status;
      error.isFallbackable = isOverloadedOrQuota;
      error.reason = finalResponse.status === 404 ? 'not_found' : (finalResponse.status === 503 || errorMsg.includes('high demand') ? 'overload' : 'quota');
      error.modelId = modelId;
      throw error;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    storageService.incrementAiCount();
    return text;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('응답 지연(20초 타임아웃)');
      timeoutErr.isFallbackable = true;
      timeoutErr.reason = 'timeout';
      timeoutErr.modelId = modelId;
      throw timeoutErr;
    }
    throw err;
  }
}

// 스마트 자동 전환(캐스케이드) 엔진
async function callGeminiWithCascade(apiKey, prompt, systemPrompt = '') {
  if (!apiKey) throw new Error('Google AI Studio API Key가 설정되지 않았습니다. 설정 화면에서 키를 입력해주세요.');

  const config = storageService.getConfig();
  const selectedModelId = config.geminiModel || 'smart_cascade';
  const availableModels = aiModelsDb.models;

  // 백그라운드로 실제 구글 API에서 지원하는 모델 목록 조회 및 로깅
  fetchGoogleActiveModels(apiKey).catch(() => {});

  // [원칙 1]: 사용자가 특정 단일 모델을 지정한 경우 (스마트 자동 전환이 아닌 경우)
  // 다른 모델로 멋대로 넘어가지 않고 오직 해당 모델만 실행!
  if (selectedModelId !== 'smart_cascade') {
    const targetModel = availableModels.find(m => m.id === selectedModelId) || { id: selectedModelId, name: selectedModelId };
    console.log(`[AI Engine] 🎯 단일 고정 모델 단독 호출: ${targetModel.name} (${targetModel.id})`);
    try {
      return await callGeminiSingle(apiKey, targetModel.id, prompt, systemPrompt);
    } catch (err) {
      console.error(`[AI Engine] ❌ 고정 모델 [${targetModel.name}] 호출 실패:`, err);
      err.fixedModelName = targetModel.name;
      err.isFixedModelFailure = true;
      throw err;
    }
  }

  // [원칙 2]: ⭐ 스마트 자동 전환 모드일 때만 순차적 캐스케이드 Fallback 실행
  let candidateModels = [...availableModels];
  let lastError = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const currentModel = candidateModels[i];
    const nextModel = candidateModels[i + 1];

    try {
      console.log(`[AI Engine] 🚀 [스마트 전환] 시도 중: ${currentModel.name} (${currentModel.id})`);
      const result = await callGeminiSingle(apiKey, currentModel.id, prompt, systemPrompt);
      return result;
    } catch (err) {
      lastError = err;

      // 429(한도 소진), 503(서버 혼잡/High Demand), 타임아웃, 404 감지 시 다음 모델로 즉시 바통 터치
      if (err.isFallbackable && nextModel) {
        const reasonText = err.reason === 'overload' 
          ? '구글 서버 혼잡(High Demand)' 
          : err.reason === 'timeout' 
            ? '응답 지연' 
            : err.reason === 'not_found'
              ? '엔드포인트 미지원'
              : '일일 한도 소진';
            
        console.warn(`[AI 스마트 전환] ⚡ ${currentModel.name} ${reasonText} ➔ ${nextModel.name} 자동 전환`);
        
        // 1~2초 동안만 뜨고 자동 사라지는 부드러운 알림 토스트 (duration: 2000ms)
        try {
          useStore.getState().showToast(
            `⚡ ${currentModel.name} ${reasonText} ➔ ${nextModel.name}로 자동 전환`, 
            'info', 
            2000
          );
        } catch (e) {
          // store 접근 안전 방어
        }
        continue; // 다음 모델로 즉시 재시도
      }

      // 키 인증 실패(400 API key not valid) 등 복구 불가능한 에러는 즉시 throw
      if (!err.isFallbackable) {
        throw err;
      }
    }
  }

  // 모든 모델이 소진된 경우
  throw new Error(`모든 무료 AI 모델 시도가 완료되었으나 응답을 받지 못했습니다. (원인: ${lastError?.message})`);
}

async function callOpenAI(apiKey, prompt, systemPrompt = '') {
  if (!apiKey) throw new Error('OpenAI API Key가 설정되지 않았습니다. 설정 화면에서 키를 입력해주세요.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt || '당신은 베스트셀러 전자책 전문 작가이자 편집자입니다.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenAI API 호출에 실패했습니다.');
  }

  storageService.incrementAiCount();
  return data.choices?.[0]?.message?.content || '';
}

export const aiService = {
  // 공통 호출 라우터
  generateText: async (prompt, systemPrompt = '') => {
    const config = storageService.getConfig();
    const provider = config.selectedProvider || 'gemini';

    if (provider === 'openai') {
      return callOpenAI(config.openaiApiKey, prompt, systemPrompt);
    }
    // 기본은 Gemini / Gemma (스마트 자동 전환 엔진)
    return callGeminiWithCascade(config.geminiApiKey, prompt, systemPrompt);
  },

  // 1. AI 목차 기획
  generateOutline: async ({ title, subtitle, targetAudience, genre, chapterCount = 5, sectionsPerChapter = 3, extraPrompt = '' }) => {
    const systemPrompt = `당신은 출판 기획 전문가입니다. 전자책 주제에 맞추어 독자의 몰입을 이끄는 체계적인 목차 트리를 JSON으로만 답변하세요. 마크다운 기호 없이 순수 JSON만 반환해야 합니다.`;
    const prompt = `도서 제목: ${title}
부제/의도: ${subtitle}
독자층: ${targetAudience}
분야: ${genre}
요청 챕터 수: ${chapterCount}개
챕터당 소목차 수: ${sectionsPerChapter}개
추가 요구: ${extraPrompt}

아래 형식의 JSON 배열로만 응답하세요:
[
  {
    "title": "1장 제목",
    "sections": [
      { "title": "1.1 소목차 제목" },
      { "title": "1.2 소목차 제목" }
    ]
  }
]`;

    const raw = await aiService.generateText(prompt, systemPrompt);
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  },

  // 2. AI 소목차 본문 집필 (초고 생성 에이전트)
  generateSectionContent: async ({
    bookTitle,
    bookSubtitle,
    chapterTitle,
    sectionTitle,
    keywords = '',
    instruction = '',
    tone = 'practical',
    targetLength = 'standard',
    existingContent = '',
    referenceNotes = '',
    targetAudience = '',
    genre = ''
  }) => {
    const TONE_GUIDES = {
      practical: '실무와 실생활에 즉시 활용 가능한 실전 가이드형 어조 (체크리스트, 액션 플랜, 핵심 요약 포함)',
      story: '생생한 경험담과 에피소드를 흥미진진하게 풀어내는 스토리텔링형 어조',
      friendly: '독자와 친근하게 소통하며 동기부여를 주는 따뜻한 에세이 및 코칭형 어조',
      academic: '논리정연하고 신뢰감 있는 깊이 있는 전문 분석/해설형 어조'
    };

    const LENGTH_GUIDES = {
      compact: '핵심만 간결하고 명확하게 약 800~1,000자 내외로 작성',
      standard: '완성도 높은 한 편의 알찬 글로 약 1,500~2,000자 내외로 작성',
      deep: '상세한 사례, 깊이 있는 설명, 풍부한 세부 팁을 포함하여 약 2,500~3,500자 분량으로 작성'
    };

    const systemPrompt = `당신은 대한민국 최고의 베스트셀러 전자책 전문 집필 에이전트(Ghostwriter)입니다.
독자가 끝까지 흥미를 잃지 않고 실질적인 지식과 영감을 얻을 수 있도록 매력적인 문장으로 원고를 완성합니다.
마크다운 서식(소제목 ###, 글머리 기호 -, 번호 매기기 1., 인용문 >, 핵심 강조 **굵게**)을 시각적으로 가독성 높게 활용하세요.`;

    const prompt = `[도서 기본 정보]
- 도서명: ${bookTitle}
${bookSubtitle ? `- 부제: ${bookSubtitle}\n` : ''}${genre ? `- 분야/장르: ${genre}\n` : ''}${targetAudience ? `- 목표 독자층: ${targetAudience} (※ 중요: 이 독자층의 눈높이와 니즈에 맞추어 용어와 설명 난이도를 최적화하세요)\n` : ''}- 현재 챕터: ${chapterTitle}
- 작성할 소목차: ${sectionTitle}

[집필 핵심 지침]
${keywords ? `- 핵심 키워드/소재: ${keywords}\n` : ''}${instruction ? `- 작가 특별 명령어/지시어: ${instruction}\n` : ''}- 집필 톤 & 스타일: ${TONE_GUIDES[tone] || TONE_GUIDES.practical}
- 분량 목표: ${LENGTH_GUIDES[targetLength] || LENGTH_GUIDES.standard}

${referenceNotes ? `[참고자료/작가 메모]\n${referenceNotes}\n` : ''}
${existingContent ? `[기존 작성된 본문 (이 내용과 중복되지 않고 자연스럽게 이어지도록 집필)]\n${existingContent}\n` : ''}
위 지침을 충실히 반영하여 바로 출판 가능한 수준의 완성도 높은 소목차 본문 원고를 작성해 주세요.`;

    const content = await aiService.generateText(prompt, systemPrompt);
    return { content };
  },

  // 3. AI 문장 교정 / 첨삭
  polishContent: async ({ originalText, preset = 'expand', customInstruction = '' }) => {
    const PRESET_INSTRUCTIONS = {
      expand: '원문의 핵심 의미를 유지하면서, 독자의 이해를 돕기 위해 구체적인 사례와 상세한 묘사를 덧붙여 풍부하게 살을 붙여주세요.',
      clear: '문맥의 흐름을 매끄럽게 다듬고, 불필요한 군더더기를 없애 문장의 완성도(윤문)를 극대화하세요.',
      grammar: '맞춤법, 띄어쓰기, 어색한 어휘, 오탈자를 정확한 한국어 어법에 맞게 교정하세요.',
      concise: '핵심 요점만 직관적으로 파악할 수 있도록 간결하고 명료하게 요약 정돈하세요.',
      friendly: '독자와 친근하게 대화하는 듯한 부드럽고 다정한 구어체 어조로 변환하세요.'
    };

    const instruction = customInstruction || PRESET_INSTRUCTIONS[preset] || PRESET_INSTRUCTIONS.clear;
    const systemPrompt = `당신은 문장 교정 및 윤문 전문가입니다. 다른 설명 없이 오직 교정된 최종 결과 문장만 반환하세요.`;
    const prompt = `[교정 지침]
${instruction}

[원문]
${originalText}`;

    const polishedText = await aiService.generateText(prompt, systemPrompt);
    return { polishedText: polishedText.trim() };
  }
};
