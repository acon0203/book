import React, { useEffect, useState } from 'react';
import './Settings.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { Save, Cloud, Download, RefreshCw, CheckCircle, LogIn, HelpCircle, ShieldCheck, Lock } from 'lucide-react';

export default function Settings() {
  const { 
    books, showToast, user, loginWithGoogle, syncStatus, syncToCloud, restoreFromCloud, lastSyncedAt,
    setView, activeBook 
  } = useStore();
  const [config, setConfig] = useState({
    selectedProvider: 'gemini',
    geminiModel: 'smart_cascade',
    geminiApiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma2:9b',
    openaiApiKey: '',
    anthropicApiKey: ''
  });
  const [savedApiKey, setSavedApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
    bookService.getConfig().then(cfg => {
      let model = cfg.geminiModel || 'smart_cascade';
      if (model === 'gemma-4-31b') model = 'gemma-4-31b-it';
      if (model === 'gemma-4-26b') model = 'gemma-4-26b-a4b-it';
      setConfig(prev => ({ ...prev, ...cfg, geminiModel: model }));
      setSavedApiKey(cfg.geminiApiKey || '');
    }).catch(console.error);
  }, []);

  // 전체 설정 저장
  const handleSave = async () => {
    try {
      setIsSaving(true);
      await bookService.saveConfig(config);
      setSavedApiKey(config.geminiApiKey || '');
      showToast('전체 환경 설정이 저장되었습니다.', 'success');
    } catch (err) {
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // API 키 전용 즉각 저장 핸들러
  const handleSaveApiKey = async (customVal = null) => {
    const keyToSave = customVal !== null ? customVal : (config.geminiApiKey || '');
    if (!keyToSave.trim()) {
      showToast('API 키를 입력해주세요.', 'info');
      return;
    }
    try {
      setIsSavingKey(true);
      const updatedConfig = { ...config, geminiApiKey: keyToSave.trim() };
      await bookService.saveConfig(updatedConfig);
      setSavedApiKey(keyToSave.trim());
      showToast('✨ Google AI API 키가 안전하게 저장되었습니다!', 'success');
    } catch (err) {
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setTimeout(() => setIsSavingKey(false), 400);
    }
  };

  const handleApiKeyChange = (e) => {
    const val = e.target.value.trim();
    setConfig(prev => ({ ...prev, geminiApiKey: val }));
  };

  // 포커스 아웃(onBlur) 시 자동 보존 (사용자가 저장을 깜빡해도 날아가지 않음)
  const handleApiKeyBlur = async () => {
    if (config.geminiApiKey && config.geminiApiKey !== savedApiKey) {
      const updatedConfig = { ...config, geminiApiKey: config.geminiApiKey.trim() };
      await bookService.saveConfig(updatedConfig);
      setSavedApiKey(config.geminiApiKey.trim());
      showToast('✓ API 키가 자동 보존되었습니다.', 'info', 1500);
    }
  };

  // AI 모델 변경 즉시 자동 저장
  const handleModelChange = async (e) => {
    const nextModel = e.target.value;
    const updated = { ...config, geminiModel: nextModel };
    setConfig(updated);
    await bookService.saveConfig(updated);
    showToast('✓ AI 동작 방식이 저장되었습니다.', 'success', 1500);
  };

  // 원고 저장 모드 변경 즉시 자동 저장
  const handleSaveModeChange = async (autoCloudSync) => {
    const updated = { ...config, autoCloudSyncOnSave: autoCloudSync };
    setConfig(updated);
    await bookService.saveConfig(updated);
    showToast(autoCloudSync ? '✓ 자동 클라우드 백업 모드로 저장되었습니다.' : '✓ 로컬 전용 저장 모드로 저장되었습니다.', 'info', 1500);
  };

  const handleCloudRestoreConfirm = () => {
    if (window.confirm('클라우드에서 최신 데이터를 복원하시겠습니까?\n현재 로컬 데이터가 클라우드 백업 데이터로 덮어씌워집니다.')) {
      restoreFromCloud();
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <h1>환경 설정</h1>
          <p>사용할 AI 모델(Gemini, Ollama, OpenAI, Claude) 및 클라우드 백업을 관리합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          <Save size={16} />
          <span>{isSaving ? '저장 중...' : '설정 저장'}</span>
        </button>
      </header>

      <div className="settings-body">
        {/* 1. 클라우드 동기화 & 백업 (Firestore) */}
        <div className="settings-card">
          <div className="card-header-flex">
            <div>
              <h3>☁️ 클라우드 동기화 & 백업 (Google Firestore)</h3>
              <p className="card-sub-desc">
                집필 중인 원고와 도서, 자료 금고 데이터를 구글 클라우드에 안전하게 보관하고 다른 기기에서 복원합니다.
              </p>
            </div>
            {user && (
              <span className="cloud-badge-status">
                <CheckCircle size={14} className="badge-icon-green" />
                <span>계정 연결됨 ({user.email})</span>
              </span>
            )}
          </div>

          <div className="cloud-action-row">
            {user ? (
              <div className="cloud-buttons-group">
                <button 
                  className="btn btn-outline" 
                  onClick={() => syncToCloud(true)} 
                  disabled={syncStatus === 'syncing'}
                >
                  <RefreshCw size={15} className={syncStatus === 'syncing' ? 'spin-icon' : ''} />
                  <span>{syncStatus === 'syncing' ? '클라우드에 백업 중...' : '지금 클라우드에 백업'}</span>
                </button>

                <button 
                  className="btn btn-outline" 
                  onClick={handleCloudRestoreConfirm} 
                  disabled={syncStatus === 'syncing'}
                >
                  <Download size={15} />
                  <span>클라우드에서 데이터 복원</span>
                </button>

                {lastSyncedAt && (
                  <span className="last-sync-text">
                    마지막 백업: {new Date(lastSyncedAt).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>
            ) : (
              <div className="cloud-login-prompt">
                <p>Google 계정으로 로그인하면 자동 클라우드 백업이 활성화됩니다.</p>
                <button className="btn btn-primary" onClick={loginWithGoogle}>
                  <LogIn size={15} />
                  <span>Google 계정으로 로그인</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. 원고 저장 방식 설정 (방안 A: 로컬 전용 vs 방안 B: 자동 클라우드 백업) */}
        <div className="settings-card">
          <div className="card-header-flex">
            <div>
              <h3>💾 원고 저장 및 클라우드 동기화 모드</h3>
              <p className="card-sub-desc">
                집필 스튜디오에서 [저장] 버튼을 클릭했을 때의 동작 방식을 선택합니다.
              </p>
            </div>
          </div>

          <div className="save-mode-options-grid">
            <div 
              className={`save-mode-card ${!config.autoCloudSyncOnSave ? 'active' : ''}`}
              onClick={() => handleSaveModeChange(false)}
            >
              <div className="save-mode-radio">
                <input 
                  type="radio" 
                  name="saveMode" 
                  checked={!config.autoCloudSyncOnSave} 
                  onChange={() => {}} 
                />
              </div>
              <div className="save-mode-content">
                <div className="save-mode-title-row">
                  <span className="save-mode-title">방안 A. 로컬 전용 저장 (기본 권장)</span>
                  <span className="save-mode-tag local">초경량 0ms</span>
                </div>
                <p className="save-mode-desc">
                  [저장] 클릭 시 오직 내 브라우저 로컬 저장소에만 즉시 보관합니다. 클라우드 전송은 원할 때 사이드바의 [클라우드 동기화]를 눌러 수동으로 진행합니다.
                </p>
              </div>
            </div>

            <div 
              className={`save-mode-card ${config.autoCloudSyncOnSave ? 'active' : ''}`}
              onClick={() => handleSaveModeChange(true)}
            >
              <div className="save-mode-radio">
                <input 
                  type="radio" 
                  name="saveMode" 
                  checked={!!config.autoCloudSyncOnSave} 
                  onChange={() => {}} 
                />
              </div>
              <div className="save-mode-content">
                <div className="save-mode-title-row">
                  <span className="save-mode-title">방안 B. 자동 클라우드 백업</span>
                  <span className="save-mode-tag cloud">실시간 보호</span>
                </div>
                <p className="save-mode-desc">
                  [저장] 클릭 시 로컬 저장과 동시에 백그라운드로 구글 클라우드에 자동 백업합니다. 여러 기기(집/회사)를 오가며 연속 집필할 때 편리합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. AI 제공자 및 모델 설정 */}
        <div className="settings-card">
          <div className="card-header-flex">
            <div>
              <h3>🤖 AI 엔진 및 모델 설정</h3>
              <p className="card-sub-desc">
                Google AI Studio 무료 API 키를 등록하면 최신 Gemini & Gemma 모델을 무료로 사용할 수 있습니다.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', textDecoration: 'none' }}
              >
                🔑 1초 만에 무료 API 키 발급받기
              </a>
              {/* 보안 물음표 툴팁 */}
              <div 
                className="security-tooltip-container"
                title="🔒 안심 보안: 입력하신 API 키는 클라우드 서버로 절대 전송되지 않으며, 오직 작가님의 브라우저 로컬(localStorage)에만 안전하게 보관됩니다."
              >
                <HelpCircle size={17} className="security-help-icon" />
                <div className="security-tooltip-bubble">
                  <strong>🔒 100% 로컬 보안 보장</strong>
                  <p>입력하신 API 키는 클라우드 서버로 절대 전송되지 않으며, 오직 작가님의 브라우저 로컬 저장소에만 안전하게 보관됩니다.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3단계 간편 발급 가이드 박스 */}
          <div style={{
            backgroundColor: 'var(--bg-card-sub)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '0.85rem 1rem',
            margin: '0.75rem 0 1.25rem 0',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              💡 신용카드 등록 없이 1분 만에 끝내는 무료 키 발급 순서:
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span><strong>1단계:</strong> 우측 위 [무료 키 발급받기] 클릭</span>
              <span>➔ <strong>2단계:</strong> 파란색 [Create API key] 클릭</span>
              <span>➔ <strong>3단계:</strong> 복사한 키를 아래 칸에 넣고 [키 저장] 클릭!</span>
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ margin: 0, fontWeight: 600 }}>Google AI Studio API Key</label>
              <div>
                {savedApiKey && savedApiKey === config.geminiApiKey ? (
                  <span style={{ 
                    fontSize: '0.76rem', 
                    color: 'var(--success, #10b981)', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.25rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    fontWeight: 600
                  }}>
                    <CheckCircle size={13} /> 키 등록 완료 (AI 사용 가능)
                  </span>
                ) : config.geminiApiKey && config.geminiApiKey !== savedApiKey ? (
                  <span style={{ 
                    fontSize: '0.76rem', 
                    color: 'var(--primary)', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.25rem',
                    backgroundColor: 'rgba(0, 114, 245, 0.08)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--primary)',
                    fontWeight: 600
                  }}>
                    ✏️ 변경됨 - 우측 [키 저장] 버튼을 눌러주세요
                  </span>
                ) : (
                  <span style={{ 
                    fontSize: '0.76rem', 
                    color: 'var(--warning, #f59e0b)', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.25rem',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                  }}>
                    ⚠️ 미등록 (키 입력 필요)
                  </span>
                )}
              </div>
            </div>

            {/* 인풋 + [키 저장] + [스튜디오로 이동] 결합 그룹 */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="password"
                className="form-control"
                placeholder="AIzaSy... (구글에서 발급받은 무료 키 입력)"
                value={config.geminiApiKey || ''}
                onChange={handleApiKeyChange}
                onBlur={handleApiKeyBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveApiKey();
                  }
                }}
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  minWidth: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => handleSaveApiKey()}
                disabled={isSavingKey}
              >
                <Save size={15} />
                <span>{isSavingKey ? '저장됨' : '키 저장'}</span>
              </button>
              {activeBook && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: 'var(--primary)',
                    fontWeight: 600
                  }}
                  onClick={() => setView('studio')}
                  title="스튜디오로 이동하여 집필 계속하기"
                >
                  <span>스튜디오로 이동 ➔</span>
                </button>
              )}
            </div>

            {/* 키 형식 이상 감지 배너 */}
            {config.geminiApiKey && (!config.geminiApiKey.startsWith('AIzaSy') || config.geminiApiKey.length < 35) && (
              <div style={{
                marginTop: '0.45rem',
                padding: '0.55rem 0.75rem',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: 'var(--warning, #f59e0b)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.45rem'
              }}>
                <span style={{ fontSize: '0.9rem' }}>⚠️</span>
                <div>
                  <strong>키 형식 확인 필요:</strong> Google AI Studio 무료 키는 보통 <code>AIzaSy...</code>로 시작하는 39자리 문자열입니다. 복사할 때 키가 잘렸거나 다른 문자열(프로젝트명 등)이 들어가지 않았는지 확인해 주세요.
                </div>
              </div>
            )}

            {/* 하단 보증 & 상태 피드백 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.45rem', fontSize: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Lock size={12} />
                <span>브라우저 로컬 저장 전용 (클라우드 동기화 시에도 외부 유출 없음)</span>
              </div>
              {savedApiKey ? (
                <span style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>
                  ✓ API 키 준비 완료 — 이제 스튜디오에서 AI 목차 생성이 즉시 가능합니다!
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  ※ 키를 넣고 [키 저장]을 누르면 평생 다시 입력할 필요가 없습니다.
                </span>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>AI 모델 동작 방식</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--primary)' }}>한도 도달 시 0.1초 자동 스위칭</span>
            </label>
            <select
              className="form-control"
              value={config.geminiModel || 'smart_cascade'}
              onChange={handleModelChange}
            >
              <option value="smart_cascade">
                ⭐ [스마트 자동 전환] 최신 3.8 Flash 우선 ➔ 한도 소진 시 3.5 Lite(500회) ➔ 3.1 Lite ➔ Gemma 순차 전환 (강력 추천)
              </option>
              <optgroup label="개별 단일 모델 고정 (실패 시 자동 전환 없음)">
                <option value="gemini-3.5-flash-lite">⚡ Gemini 3.5 Flash Lite (초고속 & 무결점 안정 작동 · 일 500회 추천)</option>
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (최신 플래그십 · 일 20회)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (대용량 보조 · 일 500회)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (표준 안정화 · 일 20회)</option>
                <option value="gemma-4-31b-it">Gemma 4 31B (⚠️ 구글 서버 500 에러 발생 가능 · 실험용)</option>
                <option value="gemma-4-26b-a4b-it">Gemma 4 26B (⚠️ 구글 서버 500 에러 발생 가능 · 실험용)</option>
              </optgroup>
            </select>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
              ※ 단일 모델을 고정 선택하시면 다른 모델로 임의 전환되지 않습니다. 구글 서버 오류나 한도 초과 시 모달과 화면에 즉시 모델 전환 버튼이 표시됩니다.
            </p>
          </div>
        </div>

        {/* 기타 제공자 설정 */}
        <div className="settings-card">
          <h3>기타 AI 제공자 (선택사항)</h3>
          <div className="form-group">
            <label>OpenAI API Key (선택)</label>
            <input
              type="password"
              className="form-control"
              placeholder="sk-..."
              value={config.openaiApiKey || ''}
              onChange={(e) => setConfig({ ...config, openaiApiKey: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Anthropic API Key (선택)</label>
            <input
              type="password"
              className="form-control"
              placeholder="sk-ant-..."
              value={config.anthropicApiKey || ''}
              onChange={(e) => setConfig({ ...config, anthropicApiKey: e.target.value })}
            />
          </div>
        </div>

        {/* 로컬 Ollama 카드 */}
        <div className="settings-card">
          <h3>로컬 Ollama 설정 (오프라인 구동)</h3>
          <div className="form-group">
            <label>서버 주소</label>
            <input
              type="text"
              className="form-control"
              value={config.ollamaUrl || 'http://localhost:11434'}
              onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>모델명</label>
            <input
              type="text"
              className="form-control"
              value={config.ollamaModel || 'gemma2:9b'}
              onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
