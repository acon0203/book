import React, { useEffect, useState } from 'react';
import './Settings.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { Save, Cloud, Download, RefreshCw, CheckCircle, LogIn } from 'lucide-react';

export default function Settings() {
  const { 
    books, showToast, user, loginWithGoogle, syncStatus, syncToCloud, restoreFromCloud, lastSyncedAt 
  } = useStore();
  const [config, setConfig] = useState({
    selectedProvider: 'gemini',
    geminiApiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma2:9b',
    openaiApiKey: '',
    anthropicApiKey: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    bookService.getConfig().then(cfg => setConfig(prev => ({ ...prev, ...cfg }))).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await bookService.saveConfig(config);
      showToast('설정이 저장되었습니다.', 'success');
    } catch (err) {
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
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

        {/* AI 제공자 설정 */}
        <div className="settings-card">
          <h3>기본 AI 플랫폼 선택</h3>
          <div className="form-group">
            <label>주 사용 AI</label>
            <select
              className="form-control"
              value={config.selectedProvider || 'gemini'}
              onChange={(e) => setConfig({ ...config, selectedProvider: e.target.value })}
            >
              <option value="gemini">Google AI Studio (Gemini 1.5 Flash - 추천)</option>
              <option value="gemma-studio">Google AI Studio (Gemma 2 9B/27B - 무료)</option>
              <option value="ollama">로컬 무료 AI (Ollama - Gemma 2 / Llama 3)</option>
              <option value="openai">OpenAI (GPT-4o-mini / GPT-4o)</option>
              <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
            </select>
          </div>
        </div>

        {/* API 키 카드 */}
        <div className="settings-card">
          <h3>API 키 설정</h3>
          <div className="form-group">
            <label>Google AI Studio API Key</label>
            <input
              type="password"
              className="form-control"
              placeholder="AIzaSy..."
              value={config.geminiApiKey || ''}
              onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
            />
          </div>
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
