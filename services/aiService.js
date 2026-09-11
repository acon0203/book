import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * 범용 LLM 호출 함수 (Gemini / Gemma-Studio / Ollama / OpenAI / Anthropic)
 */
async function callLLM({ provider, model, prompt, systemPrompt = '', config }) {
  // 1. Google AI Studio (Gemini & Gemma 2)
  if (provider === 'gemini' || provider === 'gemma-studio') {
    const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini/Gemma API 키가 설정되지 않았습니다. 환경 설정에서 Google AI Studio API 키를 등록해 주세요.');
    }

    const targetModel = model || (provider === 'gemma-studio' ? 'gemma-2-9b-it' : 'gemini-1.5-flash');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const contents = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: `[시스템 지침]\n${systemPrompt}` }] });
      contents.push({ role: 'model', parts: [{ text: '시스템 지침을 이해했습니다. 이에 맞추어 수행하겠습니다.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API 호출 실패 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('AI로부터 유효한 텍스트 응답을 받지 못했습니다.');
    return text;
  }

  // 2. Ollama (로컬 무료 Gemma 2 등)
  if (provider === 'ollama') {
    const baseUrl = config.ollamaUrl || 'http://localhost:11434';
    const targetModel = model || config.ollamaModel || 'gemma2:9b';

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          stream: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama 호출 실패 (${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.message?.content || '';
    } catch (err) {
      throw new Error(`로컬 Ollama 연결 실패 (${baseUrl}): ${err.message}. Ollama가 실행 중인지 확인하세요.`);
    }
  }

  // 3. OpenAI
  if (provider === 'openai') {
    const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 환경 설정에서 키를 등록해 주세요.');
    }
    const openai = new OpenAI({ apiKey });
    const targetModel = model || 'gpt-4o-mini';

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const completion = await openai.chat.completions.create({
      model: targetModel,
      messages
    });

    return completion.choices?.[0]?.message?.content || '';
  }

  // 4. Anthropic
  if (provider === 'anthropic') {
    const apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API 키가 설정되지 않았습니다. 환경 설정에서 키를 등록해 주세요.');
    }
    const anthropic = new Anthropic({ apiKey });
    const targetModel = model || 'claude-3-5-sonnet-20241022';

    const message = await anthropic.messages.create({
      model: targetModel,
      max_tokens: 4000,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: prompt }]
    });

    return message.content?.[0]?.text || '';
  }

  throw new Error(`지원하지 않는 AI 플랫폼입니다: ${provider}`);
}

/**
 * JSON 파싱 안전 헬퍼
 */
function extractJson(text) {
  let clean = text.trim();
  if (clean.includes('```')) {
    const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) clean = match[1].trim();
  }
  return JSON.parse(clean);
}

/**
 * 1. 도서 목차 트리 AI 자동 기획 (Outline Generator)
 */
export async function generateBookOutline({
  topic,
  genre = 'practical',
  targetAudience = '',
  chapterCount = 4,
  tone = 'professional',
  vaultReferences = '',
  config
}) {
  const systemPrompt = `당신은 10년 차 베스트셀러 출판 전문 기획자이자 편집자입니다.
주제와 독자 타깃을 분석하여 완독률이 높고 체계적인 도서의 대목차 및 소목차 구조를 기획합니다.
응답은 반드시 마크다운 기호 없이 순수 유효한 JSON 형식으로만 출력해야 합니다.`;

  let genreGuide = '';
  if (genre === 'practical') {
    genreGuide = `[장르: 실용/노하우 가이드북]
- 챕터 구조: 문제 제기 및 원리 ➔ 단계별 실전 실행법 ➔ 흔한 시행착오와 해결 팁 ➔ 수익화/심화 확장.
- 각 소목차는 독자가 바로 행동에 옮길 수 있도록 구체적인 액션 지침을 담아야 합니다.`;
  } else if (genre === 'essay') {
    genreGuide = `[장르: 에세이/인문/성찰]
- 챕터 구조: 도입(일상의 발견) ➔ 갈등과 사유 ➔ 깨달음 ➔ 여운과 위로.
- 각 소목차는 서정적이고 사색을 자극하는 문학적 제목으로 구성합니다.`;
  } else {
    genreGuide = `[장르: 업무 매뉴얼/학습서]
- 챕터 구조: 표준 절차, 개념 정의, 단계별 실습, 트러블슈팅.`;
  }

  let refText = '';
  if (vaultReferences) {
    refText = `\n\n[참고 자료 금고 내용]:\n${vaultReferences}\n위 참고 자료의 주요 개념과 핵심 요소를 목차 구조에 적극 반영하세요.`;
  }

  const prompt = `
책 주제: "${topic}"
타깃 독자: "${targetAudience || '일반 독자'}"
원하는 챕터 수: 약 ${chapterCount}개 챕터 (각 챕터당 2~3개의 소목차 포함)
문체/어조: ${tone}
${genreGuide}
${refText}

위 조건을 바탕으로 전문적인 전자책 목차 트리 JSON을 생성해 주세요.
응답 JSON 스키마 예시:
{
  "title": "도서 메인 제목 (독자의 시선을 사로잡는 타이틀)",
  "subtitle": "부제목 (구체적인 혜택이나 내용을 설명하는 부제)",
  "chapters": [
    {
      "order": 1,
      "title": "제1장. 대챕터 제목",
      "summary": "이 챕터가 다루는 핵심 주제 및 목적 (1-2문장)",
      "sections": [
        {
          "order": 1,
          "title": "1-1. 소목차 제목",
          "points": "이 소목차에서 반드시 다룰 핵심 포인트 요약 (본문 집필 시 가이드가 됨)"
        },
        {
          "order": 2,
          "title": "1-2. 소목차 제목",
          "points": "핵심 포인트 요약"
        }
      ]
    }
  ]
}
`.trim();

  const rawResponse = await callLLM({
    provider: config.selectedProvider || 'gemini',
    model: config.selectedModel,
    prompt,
    systemPrompt,
    config
  });

  return extractJson(rawResponse);
}

/**
 * 2. 소목차 본문 집필 및 살 붙이기 (Section Content Generator)
 */
export async function generateSectionContent({
  bookTitle,
  genre = 'practical',
  targetAudience = '',
  chapterTitle,
  chapterSummary = '',
  sectionTitle,
  sectionPoints = '',
  previousContext = '',
  vaultReferences = '',
  tone = 'professional',
  detailLevel = 'detailed',
  config
}) {
  const systemPrompt = `당신은 지식과 노하우를 명쾌하게 전달하는 전문 작가입니다.
주어진 책의 전체 맥락과 앞선 내용의 흐름을 해치지 않으면서, 해당 소목차의 본문을 풍부하고 흡입력 있게 집필합니다.
마크다운 서식을 활용하여 가독성을 극대화하세요.`;

  let toneInstruction = '';
  if (tone === 'friendly') {
    toneInstruction = '친근하고 다정한 대화체(~해요, ~해보세요, ~했습니다 문체)를 사용하세요.';
  } else if (tone === 'professional') {
    toneInstruction = '신뢰감 있고 논리정연한 전문 칼럼니스트 문체(~다, ~이다, ~합니다 문체)를 사용하세요.';
  } else {
    toneInstruction = '진솔하고 사색적인 문학적 어조를 유지하세요.';
  }

  let formatInstruction = '';
  if (genre === 'practical') {
    formatInstruction = `
- 실용서 특성에 맞추어 본문 중간에 독자가 바로 써먹을 수 있는 팁 박스를 삽입하세요:
  > 💡 **핵심 팁**: [구체적인 팁 내용]
- 실전 체크리스트나 단계별 프로세스(1단계, 2단계...)를 포함하여 실행력을 높이세요.`;
  }

  let lengthGuidance = '공백 제외 약 1,200~1,800자 내외로 본문을 풍성하게 전개하세요.';
  if (detailLevel === 'concise') {
    lengthGuidance = '핵심만 콤팩트하게 공백 제외 약 800자 내외로 작성하세요.';
  } else if (detailLevel === 'ultra') {
    lengthGuidance = '매우 상세하고 구체적인 사례를 곁들여 공백 제외 2,500자 이상의 심화 챕터로 작성하세요.';
  }

  let refText = '';
  if (vaultReferences) {
    refText = `\n\n[참고 자료 금고]:\n${vaultReferences}\n(위 자료의 수치, 팩트, 인사이트를 본문에 녹여내세요.)`;
  }

  let prevText = '';
  if (previousContext) {
    prevText = `\n\n[앞선 내용 흐름 (맥락 유지용 요약)]:\n${previousContext}\n(위 앞선 내용과 중복 설명은 피하고 자연스럽게 이어지도록 전개하세요.)`;
  }

  const prompt = `
[도서 정보]
- 도서명: ${bookTitle}
- 독자 타깃: ${targetAudience}
- 대챕터: ${chapterTitle} (개요: ${chapterSummary})
- 현재 집필할 소목차: ${sectionTitle}
- 소목차 핵심 포인트: ${sectionPoints}

[집필 지침]
- 어조: ${toneInstruction}
- 분량: ${lengthGuidance}
${formatInstruction}
${prevText}
${refText}

소목차 제목(# ${sectionTitle})을 최상단에 두고, 가독성 높은 소제목(###), 인용구(>), 불릿 포인트를 적절히 섞어 완성도 높은 마크다운 원고를 작성해 주세요.
설명이나 인사말 없이 순수 마크다운 본문만 출력하세요.
`.trim();

  const content = await callLLM({
    provider: config.selectedProvider || 'gemini',
    model: config.selectedModel,
    prompt,
    systemPrompt,
    config
  });

  return content.trim();
}

/**
 * 3. 본문 문장 다듬기 및 살 붙이기 (Polish / Expand)
 */
export async function polishContent({
  text,
  instruction = '문장을 더욱 매끄럽고 풍부하게 다듬어주세요.',
  tone = 'professional',
  config
}) {
  const prompt = `
아래 주어진 원고 텍스트를 지시 사항에 따라 교정 및 퇴고해 주세요.

[요청 사항]
${instruction}
(원고 어조: ${tone})

[원본 텍스트]
${text}

오직 다듬어진 마크다운 텍스트만 깔끔하게 출력해 주세요. 부가적인 해설이나 인사말은 생략하세요.
`.trim();

  const result = await callLLM({
    provider: config.selectedProvider || 'gemini',
    model: config.selectedModel,
    prompt,
    systemPrompt: '당신은 최고의 출판 편집자입니다. 문맥을 정돈하고 표현을 풍부하게 만듭니다.',
    config
  });

  return result.trim();
}
