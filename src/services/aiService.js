import { storageService } from './storageService';
import aiModelsDb from '../data/ai-models-db.json';
import bestsellerDb from '../data/bestseller-db.json';
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

// 단일 Gemini / Gemma 모델 호출
async function callGeminiSingle(apiKey, modelId, prompt, systemPrompt = '') {
  const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  const isGemma = modelId.toLowerCase().startsWith('gemma');

  // Blog 프로젝트에서 검증된 정식 안정화 엔드포인트(v1) 사용 (Gemma 모델은 v1 정식 엔드포인트로 호출)
  const apiVersion = isGemma ? 'v1' : 'v1beta';
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  // Gemma 모델은 system_instruction 필드를 지원하지 않으므로 본문 프롬프트에 자연스럽게 병합
  let userText = prompt;
  if (isGemma && systemPrompt) {
    userText = `[역할 및 집필 지침]:\n${systemPrompt}\n\n[요청 내용]:\n${prompt}`;
  }

  // Gemma는 Blog 프로젝트처럼 구글 API 공식 필수 최소 규격(contents: [{ parts: [{ text }] }])으로 순수 전송
  const body = isGemma
    ? {
        contents: [{ parts: [{ text: userText }] }]
      }
    : {
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192
        },
        ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {})
      };

  const controller = new AbortController();
  // Gemma 31B 등 거대 모델의 장문 초고 생성을 위해 충분한 60초 타임아웃 보장
  const timeoutMs = isGemma ? 60000 : 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

    // 500 (Internal Error) 및 503 (High Demand) 시 1.5초 대기 후 1회 지수 백오프 즉시 재시도
    if (finalResponse.status === 500 || finalResponse.status === 503) {
      console.warn(`[AI Engine] ⚡ ${finalResponse.status} 일시 서버 혼잡/오류 감지 [${modelId}] ➔ 1.5초 후 1회 자동 재시도 중...`);
      await new Promise(r => setTimeout(r, 1500));
      try {
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          body: JSON.stringify(body)
        });
        const retryData = await retryRes.json();
        if (retryRes.ok) {
          console.log(`[AI Engine] ✨ [${modelId}] 재시도 성공!`);
          data = retryData;
          finalResponse = retryRes;
        } else {
          data = retryData;
          finalResponse = retryRes;
        }
      } catch (e) {
        // 재시도 실패 시 기존 에러 흐름 유지
      }
    }

    if (!finalResponse.ok) {
      console.error(`[AI Engine] ❌ Google API 상세 응답 오류 [${modelId} HTTP ${finalResponse.status}]:`, data.error || data);
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
      const timeoutErr = new Error(`응답 지연(${timeoutMs / 1000}초 타임아웃)`);
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
  if (selectedModelId !== 'smart_cascade') {
    const targetModel = availableModels.find(m => m.id === selectedModelId) || { id: selectedModelId, name: selectedModelId };
    console.log(`[AI Engine] 🎯 단일 고정 모델 단독 호출: ${targetModel.name} (${targetModel.id})`);
    try {
      return await callGeminiSingle(apiKey, targetModel.id, prompt, systemPrompt);
    } catch (err) {
      console.error(`[AI Engine] ❌ 고정 모델 [${targetModel.name}] 호출 실패:`, err);

      // 만약 고정 모델이 Gemma 4 31B인데 구글 서버 500/503 오류가 지속된 경우:
      // 동일 Gemma 제품군의 고속/안정화 모델인 Gemma 4 26B로 즉시 자동 안전망 연결!
      if (targetModel.id === 'gemma-4-31b-it' && (err.status === 500 || err.status === 503 || err.reason === 'timeout')) {
        console.warn(`[AI Engine] 🛡️ Gemma 4 31B 서버 일시 오류 감지 ➔ 동일 패밀리 [Gemma 4 26B (gemma-4-26b-a4b-it)]로 자동 백업 시도...`);
        try {
          useStore.getState().showToast('⚡ Gemma 4 31B 구글 서버 오류 ➔ Gemma 4 26B로 자동 연결 중...', 'info', 2500);
          return await callGeminiSingle(apiKey, 'gemma-4-26b-a4b-it', prompt, systemPrompt);
        } catch (backupErr) {
          console.error('[AI Engine] Gemma 4 26B 백업 호출도 실패:', backupErr);
        }
      }

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

  // 0. 목차 번호 접두사 자동 정제 (1장, 제1장, 1.1 등 중복 방지)
  cleanOutlineTitle: (text) => {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();
    // 반복 적용하여 1장. 1장. 또는 1.1 1.1 처럼 여러 번 붙은 경우도 모두 제거
    for (let i = 0; i < 3; i++) {
      cleaned = cleaned
        .replace(/^(제\s*\d+\s*장[\.\:\s-]*|\d+\s*장[\.\:\s-]*|Chapter\s*\d+[\.\:\s-]*|Ch\s*\d+[\.\:\s-]*)/i, '')
        .replace(/^(\d+[\.\-_]\d+[\.\:\s-]*|\d+[\.\:\s-]+)/, '')
        .trim();
    }
    return cleaned || text.trim();
  },

  // 1. AI 목차 기획
  generateOutline: async ({ title, subtitle, targetAudience, genre, chapterCount = 5, sectionsPerChapter = 3, extraPrompt = '' }) => {
    const systemPrompt = `당신은 대한민국 최고의 베스트셀러 출판 기획자입니다. 전자책 주제에 맞추어 독자의 몰입을 이끄는 체계적인 목차 트리를 JSON으로만 답변하세요. 마크다운 기호 없이 순수 JSON만 반환해야 합니다.`;
    const prompt = `도서 제목: ${title}
부제/의도: ${subtitle}
독자층: ${targetAudience}
분야: ${genre}
요청 챕터 수: ${chapterCount}개
챕터당 소목차 수: ${sectionsPerChapter}개
추가 요구: ${extraPrompt}

[중요 지침]:
- 각 title에는 "1장", "제1장", "1.1", "1-1" 같은 번호 접두사를 '절대로' 붙이지 마세요!
- 순수한 텍스트 제목(예: "바이브 코딩의 패러다임 전환", "비전공자가 마주한 기회")만 입력하세요.

아래 형식의 JSON 배열로만 응답하세요:
[
  {
    "title": "챕터 핵심 제목 (번호 없이 순수 제목만)",
    "sections": [
      { "title": "소목차 핵심 제목 (번호 없이 순수 제목만)" },
      { "title": "소목차 핵심 제목 (번호 없이 순수 제목만)" }
    ]
  }
]`;

    const raw = await aiService.generateText(prompt, systemPrompt);
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return parsed.map(c => ({
      title: aiService.cleanOutlineTitle(c.title),
      sections: (c.sections || []).map(s => ({
        title: aiService.cleanOutlineTitle(s.title)
      }))
    }));
  },

  // 1-1. AI 총괄 편집장 (Book Editor-in-Chief) 전역 대화형 에이전트
  consultEditorChief: async ({ book, message, history = [], vaultNotes = [] }) => {
    const cleanFn = aiService.cleanOutlineTitle;
    const outlineSummary = (book.chapters || []).map((c, i) => {
      const secList = (c.sections || []).map((s, j) => `    ${i + 1}.${j + 1} ${cleanFn(s.title)}`).join('\n');
      return `[제 ${i + 1}장: ${cleanFn(c.title)}]\n${secList || '    (소목차 없음)'}`;
    }).join('\n\n');

    const vaultSummary = vaultNotes.length > 0
      ? vaultNotes.map((v, i) => `[자료 ${i + 1}] 제목: ${v.title}\n내용: ${v.content || ''}\n태그: ${(v.tags || []).join(', ')}`).join('\n---\n')
      : '(자료 금고에 등록된 메모 없음)';

    // 장르에 해당하는 베스트셀러 규격 데이터 매칭
    const matchedGenreKey = Object.keys(bestsellerDb.genres || {}).find(k => {
      const g = bestsellerDb.genres[k];
      return g.name === book.genre || book.genre?.includes(g.name) || k === book.genre;
    }) || 'essay';
    const bestsellerInfo = bestsellerDb.genres?.[matchedGenreKey] || null;
    const bestsellerGuide = bestsellerInfo
      ? `\n[출판사 베스트셀러 25권 표본 및 핵심 성공 요건 DB (${bestsellerInfo.name})]
- 분야 대표 베스트셀러: ${bestsellerInfo.sampleBooks?.map(b => `《${b.title}》`).join(', ') || ''}
- 베스트셀러가 반드시 갖추는 핵심 성공 요건:
  1. 명확한 결핍과 문제 정의: 타깃 독자가 시간과 비용을 지불하고서라도 해결하고 싶은 절박한 문제인가?
  2. 초반 3초 후킹과 호기심 유발: 프롤로그와 1장에서 독자를 사로잡는 강력한 오프닝이 있는가?
  3. 독점적이고 차별화된 해결책: 남들과 똑같은 뻔한 이야기가 아닌 저자만의 독창적 관점이나 실전 프레임워크가 있는가?
  4. 단계적 실행력과 적용성: 읽고 나서 독자가 '지금 당장 무엇을 해야 할지' 명확한 행동 지침을 얻는가?
  5. 매력적인 카피라이팅과 제목: 호기심과 구매욕을 즉각 자극하는 소제목 구조인가?
- 출판 노하우 팁: ${bestsellerInfo.promptTip || ''}\n`
      : '';

    const systemPrompt = `당신은 출판계에서 20년 경력을 가진 밀리언셀러 총괄 책임 편집장(Editor-in-Chief)입니다.
작가의 책을 처음부터 끝까지 총괄하며, 책의 기획 의도와 타깃 독자를 지키고, 목차 구조와 챕터의 유기적 흐름을 완벽하게 다듬어주는 든든한 파트너입니다.
존중과 프로페셔널함을 담은 다정하고 명확한 어조로 작가와 대화하세요.

[현재 작업 중인 도서 정보]
- 도서명: ${book.title}
- 부제: ${book.subtitle || '없음'}
- 타깃 독자: ${book.targetAudience || '일반 독자'}
- 장르/분야: ${book.genre || '실용'}

[현재 전체 목차 트리]
${outlineSummary}

[자료 금고 메모]
${vaultSummary}
${bestsellerGuide}
[★ 베스트셀러와 비교 요청 시 안내 지침 ★]:
단순한 분량이나 챕터 개수 같은 형식적 규격 비교가 아니라, 해당 분야의 베스트셀러들이 반드시 갖추는 '핵심 성공 요건(독자 결핍 공략, 초반 후킹, 차별화된 솔루션, 실전 적용성, 카피라이팅 매력도)'을 우리 책의 목차와 기획이 실질적으로 충족하고 있는지 날카롭고 깊이 있게 비교·진단하고, 베스트셀러 반열에 오르기 위한 구체적인 보완 포인트를 조언해 주세요.

[★ 목차 수정/병합/추가/재구성 요청 처리 규칙 ★]:
작가가 "1장과 2장을 합쳐줘", "소제목 바꿔줘", "새 챕터 추가해줘", "목차 재구성해줘" 등 목차 변경을 지시하거나 요청하는 경우:
1. 답변 본문에 편집장의 생각과 변경 이유를 친절하게 설명하세요.
2. 그리고 답변 맨 마지막에 반드시 아래 형식의 특수 코드 블록(JSON)을 정확히 첨부하세요:
\`\`\`restructure_json
{
  "explanation": "편집장의 변경 사유 요약 (1~2줄)",
  "chapters": [
    {
      "title": "챕터 제목 (1장, 제1장 같은 번호 없이 순수 제목만)",
      "sections": [
        { "title": "소목차 제목 (1.1 같은 번호 없이 순수 제목만)" }
      ]
    }
  ]
}
\`\`\`
이렇게 작성하면 시스템이 자동으로 [원클릭 목차 반영] 버튼을 생성하여 작가의 책에 즉시 적용할 수 있게 돕습니다.
목차 변경이 아닌 일반 질문이나 조언, 진단, 서문 요청인 경우에는 일반 마크다운 텍스트로 자연스럽게 답변하세요.`;

    // 최근 대화 맥락 구성 (최대 6개 턴)
    let historyContext = '';
    if (history && history.length > 0) {
      historyContext = history.slice(-6).map(m => `${m.role === 'user' ? '작가' : '편집장'}: ${m.content}`).join('\n\n') + '\n\n';
    }

    const fullPrompt = `${historyContext}작가: ${message}\n\n편집장:`;

    const raw = await aiService.generateText(fullPrompt, systemPrompt);

    // restructure_json 특수 블록 추출
    let restructureData = null;
    const jsonMatch = raw.match(/```restructure_json([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        restructureData = {
          explanation: parsed.explanation || '목차가 개편되었습니다.',
          chapters: (parsed.chapters || []).map(c => ({
            title: cleanFn(c.title),
            sections: (c.sections || []).map(s => ({
              title: cleanFn(s.title)
            }))
          }))
        };
      } catch (e) {
        console.warn('restructure_json parsing error:', e);
      }
    }

    // 화면 표출용 텍스트에서 restructure_json 코드 블록은 깔끔하게 제거
    const displayContent = raw.replace(/```restructure_json[\s\S]*?```/, '').trim();

    return {
      content: displayContent,
      restructureData
    };
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
