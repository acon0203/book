import React, { useState } from 'react';
import './Admin.css';
import { useStore } from '../store';
import { 
  ShieldCheck, Cpu, Play, Save, RotateCcw, 
  BookOpen, Feather, FileText, Sparkles, Key, 
  BarChart3, RefreshCw, CheckCircle, Database, Layers,
  Activity, Users, Zap, CheckSquare
} from 'lucide-react';
import { DEFAULT_ADMIN_CONFIG, DEFAULT_EDITOR_PERSONA } from '../config/personaDefaults';
import { aiService } from '../services/aiService';
import { calcAuthorStats } from '../utils/authorStats';

export default function Admin() {
  const { showToast, books = [], user, syncStatus, lastSyncedAt } = useStore();

  // 1. 관리자 설정 상태 (로컬스토리지 캐싱)
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_ai_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_ADMIN_CONFIG,
          ...parsed,
          commonPersonas: {
            ...DEFAULT_ADMIN_CONFIG.commonPersonas,
            ...(parsed.commonPersonas || {})
          },
          editorPersona: {
            ...DEFAULT_EDITOR_PERSONA,
            ...(parsed.editorPersona || {})
          }
        };
      }
    } catch (e) {
      console.warn('[Admin] Failed to parse admin_ai_config:', e);
    }
    return DEFAULT_ADMIN_CONFIG;
  });

  // 2. 활성 집필 뼈대 탭 ('novel' | 'essay' | 'nonfiction') - 3대 순수 집필 뼈대만 유지
  const [activePersonaTab, setActivePersonaTab] = useState('novel');

  // 3. 관리자 전용 독립 API 키 임시 상태
  const [adminApiKeyInput, setAdminApiKeyInput] = useState(config.adminApiKey || '');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // 4. [집필 엔진] 플레이그라운드 테스트 상태
  const [testPrompt, setTestPrompt] = useState('비 오는 늦은 밤, 불 꺼진 서점 골목길에서의 우연한 만남');
  const [isGenerating, setIsGenerating] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [resultMeta, setResultMeta] = useState(null);

  // 5. [출판 총괄 편집 엔진] 전용 플레이그라운드 테스트 상태
  const [editorTestInput, setEditorTestInput] = useState('어제 밤에 비가 너무 많이 내려서 우산을 썼음에도 불구하고 옷이 완전히 다 젖어버렸는데 그 와중에 서점 문이 닫혀 있어서 매우 절망스러웠다.');
  const [isEditorTesting, setIsEditorTesting] = useState(false);
  const [editorTestResult, setEditorTestResult] = useState('');
  const [editorResultMeta, setEditorResultMeta] = useState(null);

  // 현재 활성 집필 뼈대 정보
  const currentPersonaData = config.commonPersonas[activePersonaTab] || {};

  // 설정 저장 (집필 페르소나 + 독립 편집 페르소나 일괄 보존)
  const handleSaveConfig = () => {
    try {
      const newCfg = { ...config, adminApiKey: adminApiKeyInput.trim() };
      setConfig(newCfg);
      localStorage.setItem('admin_ai_config', JSON.stringify(newCfg));
      showToast('AI 집필 뼈대 및 편집 페르소나 설정이 성공적으로 저장되었습니다.', 'success');
    } catch (e) {
      showToast('설정 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 관리자 키 별도 저장
  const handleSaveAdminApiKey = () => {
    setIsSavingKey(true);
    try {
      const trimmed = adminApiKeyInput.trim();
      const newCfg = { ...config, adminApiKey: trimmed };
      setConfig(newCfg);
      localStorage.setItem('admin_ai_config', JSON.stringify(newCfg));
      showToast('관리자 전용 API 키가 안전하게 보관되었습니다.', 'success');
    } catch (e) {
      showToast('API 키 저장 실패', 'error');
    } finally {
      setTimeout(() => setIsSavingKey(false), 500);
    }
  };

  // 기본값 초기화
  const handleResetDefaults = () => {
    if (window.confirm('모든 집필 페르소나와 편집 페르소나 설정을 시스템 기본값으로 초기화하시겠습니까?')) {
      setConfig(DEFAULT_ADMIN_CONFIG);
      setAdminApiKeyInput('');
      localStorage.setItem('admin_ai_config', JSON.stringify(DEFAULT_ADMIN_CONFIG));
      showToast('시스템 기본값으로 복원되었습니다.', 'info');
    }
  };

  // 집필 뼈대 프롬프트 수정
  const handlePersonaChange = (tabKey, value) => {
    setConfig(prev => ({
      ...prev,
      commonPersonas: {
        ...prev.commonPersonas,
        [tabKey]: {
          ...prev.commonPersonas[tabKey],
          systemPrompt: value
        }
      }
    }));
  };

  // 집필 뼈대별 독립 Temperature 조절
  const handleTemperatureChange = (tabKey, tempVal) => {
    setConfig(prev => ({
      ...prev,
      commonPersonas: {
        ...prev.commonPersonas,
        [tabKey]: {
          ...prev.commonPersonas[tabKey],
          temperature: parseFloat(tempVal)
        }
      }
    }));
  };

  // [독립 분리] 편집 페르소나 프롬프트 수정
  const handleEditorPromptChange = (value) => {
    setConfig(prev => ({
      ...prev,
      editorPersona: {
        ...(prev.editorPersona || DEFAULT_EDITOR_PERSONA),
        systemPrompt: value
      }
    }));
  };

  // [독립 분리] 편집 페르소나 Temperature 조절
  const handleEditorTemperatureChange = (tempVal) => {
    setConfig(prev => ({
      ...prev,
      editorPersona: {
        ...(prev.editorPersona || DEFAULT_EDITOR_PERSONA),
        temperature: parseFloat(tempVal)
      }
    }));
  };

  // 플레이그라운드 즉석 테스트 실행 (100% 실전 aiService 파이프라인)
  const handleRunTest = async () => {
    if (!testPrompt.trim()) {
      showToast('테스트할 상황이나 문장을 입력해주세요.', 'warning');
      return;
    }

    try {
      setIsGenerating(true);
      setTestResult('');
      setResultMeta(null);

      const startTime = performance.now();
      const systemPrompt = currentPersonaData.systemPrompt || '';
      const temperature = currentPersonaData.temperature || 0.75;
      const modelId = config.activeModel || 'smart_cascade';

      const result = await aiService.generateWithCustomSettings({
        systemPrompt,
        userPrompt: testPrompt,
        temperature,
        modelId,
        customApiKey: adminApiKeyInput.trim() || undefined
      });

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

      setTestResult(result || '결과가 비어있습니다.');
      setResultMeta({
        elapsed: `${elapsed}초`,
        model: modelId === 'smart_cascade' ? '스마트 자동 전환' : modelId,
        tokens: (result || '').length
      });
      showToast('테스트 문장 생성이 완료되었습니다.', 'success');
    } catch (err) {
      console.error('[Admin Playground] Error:', err);
      setTestResult(`[오류 발생]: ${err.message || 'API 호출에 실패했습니다. 유효한 API 키가 등록되어 있는지 확인해주세요.'}`);
      showToast('테스트 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // [출판 총괄 편집 엔진] 전용 즉석 문장 교정 테스트 실행
  const handleRunEditorTest = async () => {
    if (!editorTestInput.trim()) {
      showToast('교정 테스트할 문장을 입력해주세요.', 'warning');
      return;
    }

    try {
      setIsEditorTesting(true);
      setEditorTestResult('');
      setEditorResultMeta(null);

      const startTime = performance.now();
      const editorData = config.editorPersona || DEFAULT_EDITOR_PERSONA;
      const systemPrompt = editorData.systemPrompt || DEFAULT_EDITOR_PERSONA.systemPrompt;
      const temperature = editorData.temperature !== undefined ? editorData.temperature : 0.35;
      const modelId = config.activeModel || 'smart_cascade';

      const userPrompt = `다음 원고 문장을 출판 단행본 수준으로 정밀 교정/윤문하고, 교정된 최종 완성 문장만 출력하십시오:\n\n${editorTestInput.trim()}`;

      const result = await aiService.generateWithCustomSettings({
        systemPrompt,
        userPrompt,
        temperature,
        modelId,
        customApiKey: adminApiKeyInput.trim() || undefined
      });

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

      setEditorTestResult(result || '결과가 비어있습니다.');
      setEditorResultMeta({
        elapsed: `${elapsed}초`,
        model: modelId === 'smart_cascade' ? '스마트 자동 전환' : modelId,
        tokens: (result || '').length
      });
      showToast('문장 교정 테스트가 완료되었습니다.', 'success');
    } catch (err) {
      console.error('[Admin Editor Playground] Error:', err);
      setEditorTestResult(`[오류 발생]: ${err.message || 'API 호출에 실패했습니다.'}`);
      showToast('교정 테스트 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsEditorTesting(false);
    }
  };

  // KPI 통계 산출 (플랫폼 전체 지표)
  const stats = calcAuthorStats(books);
  const totalCharacters = books.reduce((acc, b) => {
    let bChars = 0;
    b.chapters?.forEach(c => {
      c.sections?.forEach(s => {
        bChars += (s.content ? s.content.trim().length : 0);
      });
    });
    return acc + bChars;
  }, 0);

  const editorData = config.editorPersona || DEFAULT_EDITOR_PERSONA;

  return (
    <div className="admin-page">
      {/* 1. 상단 관리자 타이틀 헤더 */}
      <header className="admin-header">
        <div>
          <div className="admin-badge">
            <ShieldCheck size={14} />
            <span>플랫폼 관제실 (Local Admin)</span>
          </div>
          <h1 className="admin-main-title">AI 공통 페르소나 & 플랫폼 KPI 관제</h1>
          <p className="admin-sub-desc">
            3대 집필 뼈대와 독립 출판 편집 페르소나의 품질 표준을 조율하고 즉석에서 검증하며, 플랫폼 종합 지표를 모니터링합니다.
          </p>
        </div>

        <div className="admin-header-actions">
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={handleResetDefaults}
            title="기본값 복원"
          >
            <RotateCcw size={13} />
            <span>기본값 복원</span>
          </button>
          <button 
            type="button" 
            className="btn btn-primary btn-sm" 
            onClick={handleSaveConfig}
            title="설정 저장"
          >
            <Save size={13} />
            <span>설정 저장</span>
          </button>
        </div>
      </header>

      {/* 2. 대형 통합 카드: AI 집필 엔진 페르소나 (3대 뼈대 & 실시간 창작 시험장) */}
      <section className="admin-card-unified">
        <div className="unified-card-header">
          <div className="card-header-left-group">
            <Cpu size={20} className="text-primary-icon" />
            <div>
              <h2>AI 집필 엔진 페르소나 & 실시간 플레이그라운드 관제</h2>
              <p className="card-sub-desc">소설, 에세이, 비문학 3대 출판 뼈대와 집필 창의성을 조율하고 즉석에서 문장 생성 품질을 검증합니다.</p>
            </div>
          </div>
          <span className="card-status-badge">Authoring Engine</span>
        </div>

        <div className="unified-2col-layout">
          {/* [좌측 서브패널]: 3대 뼈대 프롬프트 & 독립 파라미터 조율 */}
          <div className="control-subpanel">
            
            {/* 1) 관리자 전용 독립 API 키 */}
            <div className="admin-apikey-row">
              <label className="subpanel-section-title">
                <Key size={14} className="text-primary-icon" />
                <span>관리자 전용 Google AI Studio API Key (독립 관리)</span>
              </label>
              <div className="apikey-input-group">
                <input 
                  type="password"
                  className="admin-input-text"
                  placeholder="AIzaSy... (미입력 시 서재 관리의 기본 키로 자동 fallback)"
                  value={adminApiKeyInput}
                  onChange={(e) => setAdminApiKeyInput(e.target.value)}
                />
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveAdminApiKey}
                  disabled={isSavingKey}
                >
                  {isSavingKey ? '저장됨' : '키 등록'}
                </button>
              </div>
              <span className="apikey-sub-hint">
                {adminApiKeyInput ? '✓ 관리자 전용 API 키가 활성화되었습니다.' : 'ℹ️ 미입력 시 서재 관리의 기존 등록 키가 적용됩니다.'}
              </span>
            </div>

            {/* 2) 구동 모델 선택 (서재 관리와 100% 동일한 안정 모델) */}
            <div className="admin-model-selector-row">
              <label className="subpanel-section-title">
                <Layers size={14} className="text-primary-icon" />
                <span>AI 구동 모델 선택</span>
              </label>
              <select 
                className="admin-select"
                value={config.activeModel || 'smart_cascade'}
                onChange={(e) => setConfig({ ...config, activeModel: e.target.value })}
              >
                <option value="smart_cascade">
                  ⭐ [스마트 자동 전환] 3.8 Flash 우선 ➔ 한도 소진 시 3.5 Lite ➔ 3.1 Lite ➔ Gemma 순차 전환 (권장)
                </option>
                <optgroup label="플래그십 모델">
                  <option value="gemini-3.8-flash">🚀 Gemini 3.8 Flash (최신 플래그십)</option>
                  <option value="gemini-3.7-flash">✨ Gemini 3.7 Flash (고지능 추론)</option>
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash (안정화 플래그십)</option>
                </optgroup>
                <optgroup label="Lite 대용량 모델">
                  <option value="gemini-3.5-flash-lite">⚡ Gemini 3.5 Flash Lite (초고속 대용량)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (대용량 보조)</option>
                </optgroup>
                <optgroup label="Gemma 차세대 오픈 모델">
                  <option value="gemma-4-31b-it">Gemma 4 31B (Google 차세대 오픈 모델)</option>
                  <option value="gemma-4-26b-a4b-it">Gemma 4 26B (Google 경량 모델)</option>
                </optgroup>
              </select>
            </div>

            {/* 3) 3대 출판 서사 뼈대 선택 탭 (순수 집필 엔진) */}
            <div>
              <label className="subpanel-section-title">
                <Database size={14} className="text-primary-icon" />
                <span>3대 출판 서사 뼈대 (Base-Up Writing Engine)</span>
              </label>
              <div className="persona-nav-tabs">
                <button 
                  type="button"
                  className={`persona-tab-button ${activePersonaTab === 'novel' ? 'active' : ''}`}
                  onClick={() => setActivePersonaTab('novel')}
                >
                  <BookOpen size={14} />
                  <span>1. 소설/서사</span>
                </button>
                <button 
                  type="button"
                  className={`persona-tab-button ${activePersonaTab === 'essay' ? 'active' : ''}`}
                  onClick={() => setActivePersonaTab('essay')}
                >
                  <Feather size={14} />
                  <span>2. 시/에세이</span>
                </button>
                <button 
                  type="button"
                  className={`persona-tab-button ${activePersonaTab === 'nonfiction' ? 'active' : ''}`}
                  onClick={() => setActivePersonaTab('nonfiction')}
                >
                  <FileText size={14} />
                  <span>3. 지식/비문학</span>
                </button>
              </div>
            </div>

            <div className="genre-desc-pill">
              <strong>{currentPersonaData.name || '집필 페르소나'}</strong>: {currentPersonaData.description || '서사 집필 베이스'}
            </div>

            {/* 4) 시스템 프롬프트 에디터 */}
            <div className="persona-prompt-editor-box">
              <label className="subpanel-section-title" style={{ fontSize: '0.8rem', margin: 0 }}>
                시스템 프롬프트 (System Instruction)
              </label>
              <textarea 
                className="prompt-textarea"
                rows={9}
                value={currentPersonaData.systemPrompt || ''}
                onChange={(e) => handlePersonaChange(activePersonaTab, e.target.value)}
                placeholder="시스템 지시문을 입력하세요..."
              />
            </div>

            {/* 5) 장르별 독립 창의성(Temperature) 슬라이더 */}
            <div className="genre-temp-slider-box">
              <div className="temp-label-row">
                <span className="temp-title">
                  [{currentPersonaData.name}] 전용 창의성 수치 (Temperature)
                </span>
                <span className="temp-val-badge">
                  {currentPersonaData.temperature !== undefined ? currentPersonaData.temperature : 0.75}
                </span>
              </div>
              <input 
                type="range"
                min="0.2"
                max="1.1"
                step="0.05"
                value={currentPersonaData.temperature !== undefined ? currentPersonaData.temperature : 0.75}
                onChange={(e) => handleTemperatureChange(activePersonaTab, e.target.value)}
                className="temp-range-slider"
              />
              <p className="temp-guide-hint">
                {activePersonaTab === 'novel' && '💡 소설/웹소설: 0.75~0.85 권장 (다채로운 장면 비유와 독창적 어휘 허용)'}
                {activePersonaTab === 'essay' && '💡 시/에세이: 0.70~0.80 권장 (작가의 내면 감성과 섬세한 호흡 유지)'}
                {activePersonaTab === 'nonfiction' && '💡 지식/비문학: 0.50~0.60 권장 (명확하고 신뢰성 높은 두괄식 논리 유지)'}
              </p>
            </div>

          </div>

          {/* [우측 서브패널]: 즉석 플레이그라운드 시험장 (소제목 & 즉석 대조) */}
          <div className="playground-subpanel">
            <div className="playground-state-band">
              <div className="state-pill-left">
                현재 대조 기준: <strong>[{currentPersonaData.name}]</strong>
              </div>
              <div className="state-tags">
                <span className="tag-badge">Temp: {currentPersonaData.temperature || 0.75}</span>
                <span className="tag-badge">
                  {config.activeModel === 'smart_cascade' ? '스마트 전환' : config.activeModel}
                </span>
              </div>
            </div>

            <div className="test-input-group">
              <label className="subpanel-section-title" style={{ margin: 0 }}>
                <Sparkles size={14} className="text-primary-icon" />
                <span>시험 문맥 입력 (상황 / 줄거리 / 소재)</span>
              </label>
              <textarea 
                className="test-textarea"
                rows={3}
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="테스트할 상황이나 꼭지 제목을 입력하세요..."
              />
              <button 
                type="button"
                className="btn-run-generate"
                onClick={handleRunTest}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={15} className="admin-spin" />
                    <span>실시간 문장 생성 중...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>즉석 문장 테스트 생성</span>
                  </>
                )}
              </button>
            </div>

            {/* 실시간 생성 결과 출력창 */}
            <div className="test-result-viewport-box">
              <div className="result-viewport-header">
                <span>실시간 원고 출력 결과</span>
                {resultMeta && (
                  <div className="result-meta-tags">
                    <span className="meta-chip">소요: {resultMeta.elapsed}</span>
                    <span className="meta-chip">{resultMeta.model}</span>
                    <span className="meta-chip">{resultMeta.tokens}자</span>
                  </div>
                )}
              </div>
              <div className="result-text-scroll-area">
                {testResult ? (
                  <div className="result-pre-text">{testResult}</div>
                ) : (
                  <div className="result-empty-placeholder">
                    <p>좌측에서 뼈대 규칙을 수정한 후 [즉석 문장 테스트 생성]을 누르면,</p>
                    <p><strong>[{currentPersonaData.name}]</strong> 뼈대와 <strong>[Temp {currentPersonaData.temperature || 0.75}]</strong>가 반영된 원고가 즉시 출력됩니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. [신설 독립 카드 섹션] 출판 총괄 편집 페르소나 (교정 & 윤문 감수 엔진) */}
      <section className="admin-card-unified admin-card-editor">
        <div className="unified-card-header">
          <div className="card-header-left-group">
            <Sparkles size={20} className="text-primary-icon" />
            <div>
              <h2>출판 총괄 편집 페르소나 & 문장 교정 관제 (Editor-in-Chief Engine)</h2>
              <p className="card-sub-desc">
                단행본 수석 편집장의 시선으로 비문, 중복 표현, 어색한 어휘를 교정하고 가독성과 문체 일관성을 감수하는 독립 엔진입니다.
              </p>
            </div>
          </div>
          <span className="card-status-badge editor-engine-badge">Independent Editorial Engine</span>
        </div>

        <div className="unified-2col-layout">
          {/* [좌측 서브패널]: 편집 페르소나 지침 & 정밀 파라미터 조율 */}
          <div className="control-subpanel">
            <div className="editor-persona-banner">
              <CheckSquare size={16} className="text-primary-icon" />
              <div>
                <strong>{editorData.name || '출판 총괄 편집장 / 교정·윤문'}</strong>
                <p>{editorData.description || '문장 교정, 비문 탈락, 가독성 개선, 서사 및 목차 피드백 전용'}</p>
              </div>
            </div>

            {/* 편집 시스템 프롬프트 에디터 */}
            <div className="persona-prompt-editor-box">
              <label className="subpanel-section-title" style={{ fontSize: '0.8rem', margin: 0 }}>
                편집장 시스템 지침 (Editorial System Instruction)
              </label>
              <textarea 
                className="prompt-textarea"
                rows={9}
                value={editorData.systemPrompt || ''}
                onChange={(e) => handleEditorPromptChange(e.target.value)}
                placeholder="편집장 교정 지시문을 입력하세요..."
              />
            </div>

            {/* 편집 전용 정밀 창의성(Temperature) 슬라이더 */}
            <div className="genre-temp-slider-box">
              <div className="temp-label-row">
                <span className="temp-title">
                  [출판 총괄 편집장] 전용 정밀도 수치 (Temperature)
                </span>
                <span className="temp-val-badge">
                  {editorData.temperature !== undefined ? editorData.temperature : 0.35}
                </span>
              </div>
              <input 
                type="range"
                min="0.1"
                max="0.7"
                step="0.05"
                value={editorData.temperature !== undefined ? editorData.temperature : 0.35}
                onChange={(e) => handleEditorTemperatureChange(e.target.value)}
                className="temp-range-slider"
              />
              <p className="temp-guide-hint">
                💡 교정/교열: 0.30~0.40 권장 (원문의 맥락과 작가의 의도를 왜곡하지 않고 단정하고 정확한 완성 문장으로 정제)
              </p>
            </div>
          </div>

          {/* [우측 서브패널]: 즉석 문장 교정 & 윤문 시험장 */}
          <div className="playground-subpanel">
            <div className="playground-state-band">
              <div className="state-pill-left">
                현재 대조 기준: <strong>[{editorData.name || '출판 총괄 편집장'}]</strong>
              </div>
              <div className="state-tags">
                <span className="tag-badge">Temp: {editorData.temperature !== undefined ? editorData.temperature : 0.35}</span>
                <span className="tag-badge">
                  {config.activeModel === 'smart_cascade' ? '스마트 전환' : config.activeModel}
                </span>
              </div>
            </div>

            <div className="test-input-group">
              <label className="subpanel-section-title" style={{ margin: 0 }}>
                <CheckSquare size={14} className="text-primary-icon" />
                <span>교정 대상 원고 입력 (거친 초고 / 비문 / 만연체 문장)</span>
              </label>
              <textarea 
                className="test-textarea"
                rows={3}
                value={editorTestInput}
                onChange={(e) => setEditorTestInput(e.target.value)}
                placeholder="교정할 원고 문장이나 거친 초고 단락을 입력하세요..."
              />
              <button 
                type="button"
                className="btn-run-generate"
                onClick={handleRunEditorTest}
                disabled={isEditorTesting}
              >
                {isEditorTesting ? (
                  <>
                    <RefreshCw size={15} className="admin-spin" />
                    <span>원고 교정 및 윤문 감수 중...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>즉석 문장 교정/감수 테스트</span>
                  </>
                )}
              </button>
            </div>

            {/* 실시간 교정 결과 출력창 */}
            <div className="test-result-viewport-box">
              <div className="result-viewport-header">
                <span>실시간 교정 및 윤문 결과</span>
                {editorResultMeta && (
                  <div className="result-meta-tags">
                    <span className="meta-chip">소요: {editorResultMeta.elapsed}</span>
                    <span className="meta-chip">{editorResultMeta.model}</span>
                    <span className="meta-chip">{editorResultMeta.tokens}자</span>
                  </div>
                )}
              </div>
              <div className="result-text-scroll-area">
                {editorTestResult ? (
                  <div className="result-pre-text">{editorTestResult}</div>
                ) : (
                  <div className="result-empty-placeholder">
                    <p>좌측에서 편집장 지침을 수정한 후 [즉석 문장 교정/감수 테스트]를 누르면,</p>
                    <p>설정된 편집 지침과 <strong>[정밀 Temp {editorData.temperature !== undefined ? editorData.temperature : 0.35}]</strong>가 반영된 교정본이 즉시 출력됩니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 하단 신설 섹션: 📊 플랫폼 종합 KPI 통계 관제소 */}
      <section className="admin-card-kpi">
        <div className="unified-card-header">
          <div className="card-header-left-group">
            <BarChart3 size={20} className="text-primary-icon" />
            <div>
              <h2>플랫폼 종합 KPI & 운영 상태 모니터링</h2>
              <p className="card-sub-desc">서재의 전체 집필 데이터 볼륨 및 동기화 무결성을 한눈에 점검합니다.</p>
            </div>
          </div>
          <span className="card-status-badge">Platform Health: 100%</span>
        </div>

        {/* 4대 핵심 지표 그리드 */}
        <div className="kpi-stat-grid-4">
          <div className="kpi-metric-tile">
            <div className="metric-label-row">
              <BookOpen size={15} />
              <span>총 기획 도서</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number">{books.length}</span>
              <span className="metric-unit">권</span>
            </div>
            <span className="metric-sub-note">서재 보관 프로젝트</span>
          </div>

          <div className="kpi-metric-tile">
            <div className="metric-label-row">
              <Layers size={15} />
              <span>총 집필 챕터</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number">{stats.totalChapters || 0}</span>
              <span className="metric-unit">장</span>
            </div>
            <span className="metric-sub-note">완료: {stats.completedChapters || 0}장</span>
          </div>

          <div className="kpi-metric-tile">
            <div className="metric-label-row">
              <FileText size={15} />
              <span>총 누적 집필량</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number">{totalCharacters.toLocaleString()}</span>
              <span className="metric-unit">자</span>
            </div>
            <span className="metric-sub-note">원고지 약 {Math.round(totalCharacters / 200)}매</span>
          </div>

          <div className="kpi-metric-tile">
            <div className="metric-label-row">
              <Activity size={15} />
              <span>클라우드 동기화 상태</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number" style={{ fontSize: '1.25rem', color: syncStatus === 'synced' ? 'var(--success)' : 'var(--primary)' }}>
                {syncStatus === 'synced' ? '최신 동기화' : syncStatus === 'syncing' ? '동기화 중' : '로컬 보존'}
              </span>
            </div>
            <span className="metric-sub-note">
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleDateString('ko-KR') : '동기화 이력 없음'}
            </span>
          </div>
        </div>

        {/* 세부 인프라 진단 바 */}
        <div className="kpi-diagnostics-row">
          <div className="diag-sub-box">
            <h4>인증 & 세션 보안 현황</h4>
            <div className="diag-list">
              <div className="diag-list-item">
                <span>접속 권한</span>
                <strong style={{ color: 'var(--primary)' }}>관리자 (Local Developer Mode)</strong>
              </div>
              <div className="diag-list-item">
                <span>로그인 계정</span>
                <span>{user ? user.email : '로컬 프리패스 접속 중'}</span>
              </div>
              <div className="diag-list-item">
                <span>저장 아키텍처</span>
                <span>로컬 우선(Local-First) + Firestore 비동기 스냅샷</span>
              </div>
            </div>
          </div>

          <div className="diag-sub-box">
            <h4>AI 모델 파이프라인 가동률</h4>
            <div className="diag-list">
              <div className="diag-list-item">
                <span>기본 라우팅 엔진</span>
                <strong>Google AI Studio Cascade Engine</strong>
              </div>
              <div className="diag-list-item">
                <span>페르소나 뼈대 규격</span>
                <span>3대 출판 뼈대 (소설 / 에세이 / 비문학)</span>
              </div>
              <div className="diag-list-item">
                <span>안전망 (Fallback)</span>
                <span>429 자동 스위칭 (Gemma 4 31B 백업)</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
