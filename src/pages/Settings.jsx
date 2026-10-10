import React, { useEffect, useState, useRef } from 'react';
import './Settings.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { 
  Save, 
  Cloud, 
  Download, 
  Upload,
  RefreshCw, 
  CheckCircle, 
  LogIn, 
  LogOut,
  HelpCircle, 
  ShieldCheck, 
  Lock, 
  User, 
  PenTool, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  FileJson, 
  HardDrive,
  Cpu,
  Key,
  Info,
  Bell,
  FileText,
  ExternalLink,
  ChevronRight,
  X,
  Compass,
  ArrowLeft,
  Zap
} from 'lucide-react';
import ModelQuotasModal from '../components/ModelQuotasModal';

export default function Settings() {
  const { 
    books, loadBooks, loadVault, showToast, user, loginWithGoogle, logout,
    syncStatus, syncToCloud, restoreFromCloud, lastSyncedAt, setView, activeBook 
  } = useStore();

  const [config, setConfig] = useState({
    defaultAuthor: '',
    autoSaveInterval: '300',
    selectedProvider: 'gemini',
    geminiModel: 'smart_cascade',
    geminiApiKey: '',
    autoCloudSyncOnSave: false,
    openaiApiKey: '',
    anthropicApiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma2:9b'
  });

  const [savedApiKey, setSavedApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isAdvancedAiOpen, setIsAdvancedAiOpen] = useState(false);
  const [infoSubView, setInfoSubView] = useState(null); // 'notices' | 'terms' | 'guide' | 'support' | null
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    bookService.getConfig().then(cfg => {
      let model = cfg.geminiModel || 'smart_cascade';
      if (model === 'gemma-4-31b') model = 'gemma-4-31b-it';
      if (model === 'gemma-4-26b') model = 'gemma-4-26b-a4b-it';
      setConfig(prev => ({ 
        ...prev, 
        ...cfg, 
        defaultAuthor: cfg.defaultAuthor || user?.displayName || '',
        geminiModel: model 
      }));
      setSavedApiKey(cfg.geminiApiKey || '');
    }).catch(console.error);
  }, [user]);

  // 전체 설정 저장
  const handleSave = async () => {
    try {
      setIsSaving(true);
      await bookService.saveConfig(config);
      setSavedApiKey(config.geminiApiKey || '');
      showToast('환경 설정이 저장되었습니다.', 'success');
    } catch (err) {
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // API 키 전용 저장
  const handleSaveApiKey = async () => {
    const keyToSave = (config.geminiApiKey || '').trim();
    if (!keyToSave) {
      showToast('API 키를 입력해주세요.', 'info');
      return;
    }
    try {
      setIsSavingKey(true);
      const updated = { ...config, geminiApiKey: keyToSave };
      await bookService.saveConfig(updated);
      setSavedApiKey(keyToSave);
      showToast('Google AI API 키가 안전하게 저장되었습니다! ✨', 'success');
    } catch (err) {
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setTimeout(() => setIsSavingKey(false), 300);
    }
  };

  // 단일 항목 변경 및 즉각 저장
  const handleConfigChange = async (key, value) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    await bookService.saveConfig(updated);
  };

  // 클라우드 복원 컨펌
  const handleCloudRestoreConfirm = () => {
    if (window.confirm('클라우드에서 최신 데이터를 복원하시겠습니까?\n현재 로컬 데이터는 클라우드 데이터로 갱신됩니다.')) {
      restoreFromCloud();
    }
  };

  // [로컬 오프라인 백업] JSON 파일 다운로드
  const handleExportBackupFile = async () => {
    try {
      const backupData = await bookService.exportBackupData();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `연재서재_전체백업_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('전체 서재 백업 파일이 다운로드되었습니다! 💾', 'success');
    } catch (err) {
      showToast(`백업 내보내기 실패: ${err.message}`, 'error');
    }
  };

  // [로컬 오프라인 복원] JSON 파일 불러오기
  const handleImportBackupFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`'${file.name}' 파일로부터 서재 데이터를 복원하시겠습니까?\n현재 브라우저의 도서 및 자료가 해당 파일 내용으로 복원됩니다.`)) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        await bookService.importBackupData(parsed);
        await loadBooks();
        await loadVault();
        showToast('백업 파일에서 서재 데이터를 완벽하게 복원했습니다! 🎉', 'success');
      } catch (err) {
        showToast(`복원 실패: 유효한 백업 JSON 파일이 아닙니다 (${err.message})`, 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (infoSubView) {
    return (
      <div className="settings-page settings-subview-page">
        <header className="settings-subview-header">
          <button 
            type="button" 
            className="btn-subview-back" 
            onClick={() => setInfoSubView(null)}
          >
            <ArrowLeft size={16} />
            <span>서재 관리로 돌아가기</span>
          </button>
          
          <div className="subview-header-title-box">
            {infoSubView === 'notices' && (
              <>
                <div className="subview-title-row">
                  <Bell size={24} className="text-blue" />
                  <h1>공지사항 & 업데이트 내역</h1>
                </div>
                <p>연재서재의 최신 기능 추가 및 서비스 개선 소식을 안내해 드립니다.</p>
              </>
            )}
            {infoSubView === 'terms' && (
              <>
                <div className="subview-title-row">
                  <ShieldCheck size={24} className="text-green" />
                  <h1>이용약관 및 데이터 안심 정책</h1>
                </div>
                <p>로컬 우선(Local-First) 원고 보존 원칙 및 AI 데이터 비학습 보장 정책을 안내합니다.</p>
              </>
            )}
            {infoSubView === 'guide' && (
              <>
                <div className="subview-title-row">
                  <PenTool size={24} className="text-amber" />
                  <h1>집필 단축키 및 에디터 가이드</h1>
                </div>
                <p>쾌적하고 빠른 집필을 위한 필수 단축키와 데이터 보존 팁을 확인하세요.</p>
              </>
            )}
            {infoSubView === 'support' && (
              <>
                <div className="subview-title-row">
                  <HelpCircle size={24} className="text-purple" />
                  <h1>고객센터 및 자주 묻는 질문 (FAQ)</h1>
                </div>
                <p>궁금한 점에 대한 즉각적인 답변과 1:1 문의 채널을 제공합니다.</p>
              </>
            )}
          </div>
        </header>

        <div className="settings-subview-body">
          <div className="subview-content-card">
            {infoSubView === 'notices' && (
              <div className="notice-list">
                <article className="notice-item">
                  <div className="notice-meta">
                    <span className="notice-badge badge-new">릴리즈</span>
                    <span className="notice-date">2026.10</span>
                  </div>
                  <h4>v1.2.0 - 데이터 저장·동기화 센터 & 전체 서재 JSON 백업 오픈</h4>
                  <p>
                    이제 소중한 서재의 모든 원고와 설정을 단 한 번의 클릭으로 로컬 JSON 파일로 안전하게 백업하고 복원할 수 있습니다.
                    Google 계정 연동 시 Firestore 클라우드 스냅샷 자동 백업도 완벽히 지원됩니다.
                  </p>
                </article>

                <article className="notice-item">
                  <div className="notice-meta">
                    <span className="notice-badge">기능 추가</span>
                    <span className="notice-date">2026.10</span>
                  </div>
                  <h4>v1.1.0 - 문피아식 연재 탐색 & 네이버웹소설식 웹 뷰어 오픈</h4>
                  <p>
                    8대 장르 바와 실시간 TOP 5 랭킹, 요일별 연재 목록을 탑재한 '연재 작품' 탐색 화면과 
                    가독성 극대화 폰트, 화이트/세피아/다크 테마, 페이지 넘김 모드를 갖춘 표준 뷰어가 출시되었습니다.
                  </p>
                </article>

                <article className="notice-item">
                  <div className="notice-meta">
                    <span className="notice-badge">공지</span>
                    <span className="notice-date">2026.10</span>
                  </div>
                  <h4>v1.0.0 - 연재서재(Book Studio) 정식 런칭 안내</h4>
                  <p>
                    타이핑 0ms 지연의 초경량 제로 랙(Zero-Lag) 전자책 집필 스튜디오가 정식 런칭되었습니다. 
                    오프라인에서도 중단 없는 집필을 경험해보세요.
                  </p>
                </article>
              </div>
            )}

            {infoSubView === 'terms' && (
              <div className="terms-content">
                <section className="terms-section">
                  <h4>1. 원고 데이터 주권 원칙 (Local-First Guarantee)</h4>
                  <p>
                    연재서재(Book Studio)에서 작성되는 모든 원고, 플롯, 기획서는 1차적으로 사용자의 브라우저 로컬 저장소(localStorage)에 실시간 보존됩니다.
                    사용자의 명시적인 클라우드 동기화 또는 발행 요청 없이는 어떤 원고도 외부 서버로 전송되지 않습니다.
                  </p>
                </section>

                <section className="terms-section">
                  <h4>2. AI 생성 및 데이터 비학습 보장</h4>
                  <p>
                    AI 집필 어시스턴트(Gemini, Claude, GPT) 기능 이용 시 전달되는 문맥과 프롬프트는 
                    오직 답변 생성 목적으로만 1회성 처리되며, 인공지능 모델의 재학습 데이터로 절대 사용되지 않습니다.
                  </p>
                </section>

                <section className="terms-section">
                  <h4>3. 저작권 보호 및 귀속</h4>
                  <p>
                    연재서재를 통해 집필된 모든 전자책과 원고의 저작권은 전적으로 창작자(작가 본인)에게 귀속됩니다.
                    플랫폼은 원고에 대한 어떠한 독점적 권리도 요구하지 않습니다.
                  </p>
                </section>

                <section className="terms-section">
                  <h4>4. 클라우드 백업 보안</h4>
                  <p>
                    Google 계정 연동 시 전송되는 스냅샷 데이터는 본인의 고유 계정(UID) 격리 문서 영역에 안전하게 보관되며 타인에게 절대 노출되지 않습니다.
                  </p>
                </section>
              </div>
            )}

            {infoSubView === 'guide' && (
              <div className="guide-content">
                <div className="guide-group">
                  <h4>⌨️ 집필 에디터 단축키</h4>
                  <table className="guide-table">
                    <tbody>
                      <tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>원고 강제 즉시 저장 (자동 저장은 300ms 디바운스 동작)</td></tr>
                      <tr><td><kbd>Ctrl</kbd> + <kbd>B</kbd></td><td>선택 텍스트 굵게</td></tr>
                      <tr><td><kbd>Ctrl</kbd> + <kbd>I</kbd></td><td>선택 텍스트 기울임</td></tr>
                      <tr><td><kbd>F11</kbd></td><td>브라우저 전체화면 몰입 모드</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="guide-group">
                  <h4>📖 웹 뷰어 조작 단축키 (페이지 모드)</h4>
                  <table className="guide-table">
                    <tbody>
                      <tr><td><kbd>→</kbd> / <kbd>Space</kbd></td><td>다음 페이지(쪽)로 넘김</td></tr>
                      <tr><td><kbd>←</kbd></td><td>이전 페이지(쪽)로 되돌림</td></tr>
                      <tr><td><kbd>Esc</kbd></td><td>뷰어 나가기 (서재로 복귀)</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="guide-group">
                  <h4>💾 데이터 유실 방지 팁</h4>
                  <p className="guide-tip-text">
                    브라우저 방문 기록이나 인터넷 사용 기록을 전체 삭제할 경우 브라우저 저장소가 초기화될 수 있습니다. 
                    주기적으로 <strong>[전체 서재 백업 다운로드]</strong>를 통해 <code>.json</code> 파일을 PC에 보관해 두시면 100% 안전합니다.
                  </p>
                </div>
              </div>
            )}

            {infoSubView === 'support' && (
              <div className="support-content">
                <div className="faq-list">
                  <div className="faq-item">
                    <div className="faq-q">Q. Google 계정 로그인은 꼭 해야 하나요?</div>
                    <div className="faq-a">
                      아닙니다! 로그인 없이도 브라우저 로컬에서 모든 집필, 서재 관리, AI 어시스턴트 기능을 100% 무료로 무제한 사용하실 수 있습니다. 
                      로그인은 다른 기기와 원고를 동기화하고 싶으실 때만 선택적으로 진행하시면 됩니다.
                    </div>
                  </div>

                  <div className="faq-item">
                    <div className="faq-q">Q. Gemini API 키는 어디서 무료로 발급받나요?</div>
                    <div className="faq-a">
                      구글의 <strong>Google AI Studio (aistudio.google.com)</strong>에 구글 계정으로 접속하시면 몇 번의 클릭만으로 영구 무료 개인 API 키를 발급받으실 수 있습니다.
                    </div>
                  </div>

                  <div className="faq-item">
                    <div className="faq-q">Q. 작성한 원고를 외부 전자책 파일(EPUB)로 뽑아낼 수 있나요?</div>
                    <div className="faq-a">
                      네! 스튜디오 상단의 내보내기 버튼 또는 완성 서가에서 국제 표준 EPUB 3.0 파일로 언제든 소장용 전자책을 다운로드할 수 있습니다.
                    </div>
                  </div>
                </div>

                <div className="support-contact-box">
                  <h4>💬 문의 및 피드백</h4>
                  <p>사용 중 겪으신 불편 사항이나 추가되었으면 하는 기능이 있다면 언제든 제안해주세요.</p>
                  <div className="contact-links">
                    <span className="contact-badge">이메일 문의: support@bookstudio.app</span>
                    <span className="contact-badge">커뮤니티: 연재서재 오픈 라운지</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <h1>서재 관리</h1>
          <p>작가 계정, 원고 백업·동기화, AI 집필 엔진 및 서비스 안내를 통합 관리합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          <Save size={16} />
          <span>{isSaving ? '저장 중...' : '전체 설정 저장'}</span>
        </button>
      </header>

      <div className="settings-body">
        {/* =================================================================
            꼭지 1: 👤 계정 & 작가 프로필 관리
            ================================================================= */}
        <section className="settings-card">
          <div className="card-header-flex">
            <div className="card-header-title-group">
              <User size={20} className="section-header-icon text-blue" />
              <div>
                <h3>계정 & 작가 프로필</h3>
                <p className="card-sub-desc">Google 로그인 세션 및 기본 필명, 에디터 집필 환경을 설정합니다.</p>
              </div>
            </div>
            {user && (
              <span className="cloud-badge-status">
                <CheckCircle size={14} className="badge-icon-green" />
                <span>로그인됨</span>
              </span>
            )}
          </div>

          <div className="settings-account-box">
            {user ? (
              <div className="account-profile-row">
                <div className="profile-user-info">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="profile-avatar-img" />
                  ) : (
                    <div className="profile-avatar-placeholder">{user.displayName?.[0] || 'U'}</div>
                  )}
                  <div>
                    <strong className="profile-name">{user.displayName || '작가'}</strong>
                    <span className="profile-email">{user.email}</span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={logout}>
                  <LogOut size={14} />
                  <span>로그아웃</span>
                </button>
              </div>
            ) : (
              <div className="account-login-prompt">
                <p>Google 계정으로 로그인하면 기기 간 원고 백업 및 동기화가 활성화됩니다.</p>
                <button className="btn btn-primary" onClick={loginWithGoogle}>
                  <LogIn size={15} />
                  <span>Google 계정으로 1초 로그인</span>
                </button>
              </div>
            )}
          </div>

          <div className="settings-form-grid">
            <div className="form-group">
              <label>기본 필명 / 작가명</label>
              <input
                type="text"
                className="form-control"
                placeholder="예: 김연재 (새 책 생성 시 자동 기입)"
                value={config.defaultAuthor || ''}
                onChange={(e) => handleConfigChange('defaultAuthor', e.target.value)}
              />
              <span className="form-hint">새 도서 기획서나 에디터 뷰어에 기본 작가명으로 자동 적용됩니다.</span>
            </div>

            <div className="form-group">
              <label>에디터 자동 저장 주기</label>
              <select
                className="form-control"
                value={config.autoSaveInterval || '300'}
                onChange={(e) => handleConfigChange('autoSaveInterval', e.target.value)}
              >
                <option value="300">300ms (초고속 즉각 저장 · 추천)</option>
                <option value="500">500ms (표준 디바운스)</option>
                <option value="1000">1초 (절전형 디바운스)</option>
              </select>
              <span className="form-hint">집필 중 타이핑이 멈췄을 때 로컬 브라우저에 즉각 저장되는 주기입니다.</span>
            </div>
          </div>
        </section>

        {/* =================================================================
            꼭지 2: 💾 데이터 저장 & 동기화 센터 (클라우드 + 로컬 백업)
            ================================================================= */}
        <section className="settings-card">
          <div className="card-header-flex">
            <div className="card-header-title-group">
              <HardDrive size={20} className="section-header-icon text-indigo" />
              <div>
                <h3>데이터 저장 및 동기화 센터</h3>
                <p className="card-sub-desc">클라우드 자동 백업 모드 및 원클릭 오프라인 서재 백업/복원을 지원합니다.</p>
              </div>
            </div>
          </div>

          {/* 저장 모드 선택: 방안 A vs 방안 B */}
          <div className="save-mode-options-grid">
            <div 
              className={`save-mode-card ${!config.autoCloudSyncOnSave ? 'active' : ''}`}
              onClick={() => handleConfigChange('autoCloudSyncOnSave', false)}
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
                  <span className="save-mode-title">방안 A. 로컬 전용 저장 (권장)</span>
                  <span className="save-mode-tag local">초경량 0ms</span>
                </div>
                <p className="save-mode-desc">
                  원고를 내 브라우저 로컬 저장소에 0ms로 즉시 저장합니다. 클라우드 전송은 원할 때 수동으로 백업합니다.
                </p>
              </div>
            </div>

            <div 
              className={`save-mode-card ${config.autoCloudSyncOnSave ? 'active' : ''}`}
              onClick={() => handleConfigChange('autoCloudSyncOnSave', true)}
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
                  <span className="save-mode-title">방안 B. 실시간 자동 클라우드 백업</span>
                  <span className="save-mode-tag cloud">실시간 보호</span>
                </div>
                <p className="save-mode-desc">
                  로컬 저장과 동시에 백그라운드로 Google Firestore에 자동 백업합니다. 여러 기기 집필 시 안전합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 클라우드 백업/복원 액션 바 */}
          <div className="cloud-action-box">
            <div className="cloud-action-left">
              <Cloud size={18} className="text-primary" />
              <div>
                <strong>Google Cloud Firestore 동기화</strong>
                <span className="cloud-time-label">
                  {lastSyncedAt ? `마지막 백업: ${new Date(lastSyncedAt).toLocaleString('ko-KR')}` : '아직 클라우드 백업 기록이 없습니다.'}
                </span>
              </div>
            </div>
            <div className="cloud-action-right">
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => syncToCloud(true)}
                disabled={syncStatus === 'syncing' || !user}
                title={user ? '현재 서재를 클라우드에 백업' : '로그인이 필요합니다'}
              >
                <RefreshCw size={13} className={syncStatus === 'syncing' ? 'spin-icon' : ''} />
                <span>{syncStatus === 'syncing' ? '백업 중...' : '지금 클라우드 백업'}</span>
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={handleCloudRestoreConfirm}
                disabled={syncStatus === 'syncing' || !user}
                title={user ? '클라우드 데이터 복원' : '로그인이 필요합니다'}
              >
                <Download size={13} />
                <span>클라우드 데이터 복원</span>
              </button>
            </div>
          </div>

          {/* 오프라인 서재 파일(JSON) 백업 및 복원 */}
          <div className="file-backup-section">
            <div className="file-backup-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileJson size={18} className="text-amber" />
                <strong>전체 서재 오프라인 파일 백업</strong>
              </div>
              <p>모든 도서, 원고 챕터, 자료 금고 메모를 1개의 JSON 파일로 영구 보관하거나 기기를 바꿀 때 불러올 수 있습니다.</p>
            </div>
            <div className="file-backup-actions">
              <button className="btn btn-outline-primary btn-sm" onClick={handleExportBackupFile}>
                <Download size={13} />
                <span>전체 서재 JSON 백업 다운로드</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={13} />
                <span>백업 파일로 서재 복원</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".json" 
                style={{ display: 'none' }} 
                onChange={handleImportBackupFile}
              />
            </div>
          </div>
        </section>

        {/* =================================================================
            꼭지 3: 🤖 AI 집필 엔진 설정 (Gemini + 스마트 전환 + 고급 접힘)
            ================================================================= */}
        <section className="settings-card">
          <div className="card-header-flex">
            <div className="card-header-title-group">
              <Cpu size={20} className="section-header-icon text-purple" />
              <div>
                <h3>AI 집필 엔진 설정</h3>
                <p className="card-sub-desc">Google AI Studio 무료 API 키를 연동하여 스마트 자동 전환 AI를 구동합니다.</p>
              </div>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              🔑 무료 API 키 발급받기
            </a>
          </div>

          {/* API Key 입력 폼 */}
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ margin: 0, fontWeight: 600 }}>Google AI Studio API Key</label>
              <div>
                {savedApiKey ? (
                  <span className="badge-key-status success">
                    <CheckCircle size={13} /> 키 등록 완료 (AI 집필 가능)
                  </span>
                ) : (
                  <span className="badge-key-status warning">
                    ⚠️ 미등록 (키 입력 필요)
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="password"
                className="form-control"
                placeholder="AIzaSy... (구글에서 발급받은 무료 키 입력)"
                value={config.geminiApiKey || ''}
                onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value.trim() })}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveApiKey}
                disabled={isSavingKey}
                style={{ minWidth: '90px' }}
              >
                <Key size={14} />
                <span>{isSavingKey ? '저장됨' : '키 저장'}</span>
              </button>
            </div>

            <div className="key-security-note">
              <Lock size={12} />
              <span>입력하신 API 키는 클라우드로 전송되지 않고 브라우저 로컬에만 안전하게 보관됩니다.</span>
            </div>
          </div>

          {/* AI 모델 동작 방식 */}
          <div className="form-group" style={{ marginTop: '1.2rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>AI 모델 동작 방식</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--primary)' }}>한도 도달 시 0.1초 자동 스위칭</span>
            </label>
            <select
              className="form-control"
              value={config.geminiModel || 'smart_cascade'}
              onChange={(e) => handleConfigChange('geminiModel', e.target.value)}
            >
              <option value="smart_cascade">
                ⭐ [스마트 자동 전환] 최신 3.8 Flash 우선 ➔ 한도 소진 시 3.5 Lite(500회) ➔ 3.1 Lite ➔ Gemma 순차 전환 (강력 추천)
              </option>
              <optgroup label="개별 단일 모델 고정">
                <option value="gemini-3.5-flash-lite">⚡ Gemini 3.5 Flash Lite (초고속 & 무결점 안정 작동 · 일 500회 추천)</option>
                <option value="gemini-3.6-flash">🚀 Gemini 3.6 Flash (3.5 후속 최신 플래그십 · 일 20회)</option>
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (최신 플래그십 · 일 20회)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (대용량 보조 · 일 500회)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (표준 안정화 · 일 20회)</option>
              </optgroup>
            </select>
            <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsQuotaModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
              >
                <Zap size={13} style={{ color: '#f59e0b' }} />
                <span>실시간 AI 모델 잔여 한도 확인</span>
              </button>
            </div>
          </div>

          {/* 고급 AI 제공자 설정 (아코디언 접힘/펼침: OpenAI, Claude, 로컬 Ollama) */}
          <div className="advanced-ai-accordion">
            <button
              type="button"
              className="accordion-toggle-btn"
              onClick={() => setIsAdvancedAiOpen(prev => !prev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={15} className="text-dim" />
                <span>고급 AI 제공자 설정 (OpenAI, Claude, 로컬 Ollama)</span>
              </div>
              {isAdvancedAiOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isAdvancedAiOpen && (
              <div className="accordion-content-panel">
                <p className="accordion-desc">
                  구글 무료 Gemini 외에 다른 외부 AI 엔진을 사용하고 싶으실 때 선택적으로 설정합니다.
                </p>

                <div className="form-group">
                  <label>OpenAI API Key (선택)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="sk-..."
                    value={config.openaiApiKey || ''}
                    onChange={(e) => handleConfigChange('openaiApiKey', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Anthropic Claude API Key (선택)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="sk-ant-..."
                    value={config.anthropicApiKey || ''}
                    onChange={(e) => handleConfigChange('anthropicApiKey', e.target.value)}
                  />
                </div>

                <div className="ollama-box">
                  <strong>로컬 Ollama (오프라인 PC 직접 구동)</strong>
                  <div className="settings-form-grid" style={{ marginTop: '0.5rem' }}>
                    <div className="form-group">
                      <label>Ollama 서버 주소</label>
                      <input
                        type="text"
                        className="form-control"
                        value={config.ollamaUrl || 'http://localhost:11434'}
                        onChange={(e) => handleConfigChange('ollamaUrl', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>설치된 모델명</label>
                      <input
                        type="text"
                        className="form-control"
                        value={config.ollamaModel || 'gemma2:9b'}
                        onChange={(e) => handleConfigChange('ollamaModel', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =================================================================
            꼭지 4: ℹ️ 서비스 안내 (밀리의 서재 스타일)
            ================================================================= */}
        <section className="settings-card">
          <div className="card-header-flex">
            <div className="card-header-title-group">
              <Info size={20} className="section-header-icon text-indigo" />
              <div>
                <h3>서비스 안내</h3>
                <p className="card-sub-desc">공지사항, 데이터 안심 정책, 집필 가이드 및 고객센터를 확인합니다.</p>
              </div>
            </div>
            <span className="version-pill">v1.2.0 최신</span>
          </div>

          <div className="service-info-menu-list">
            <button 
              type="button" 
              className="service-menu-item"
              onClick={() => setInfoSubView('notices')}
            >
              <div className="menu-item-left">
                <Bell size={18} className="menu-item-icon text-blue" />
                <div>
                  <div className="menu-item-title">공지사항 & 업데이트 내역</div>
                  <div className="menu-item-sub">v1.2.0 전체 서재 백업/복원 및 연재 탐색 오픈</div>
                </div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>

            <button 
              type="button" 
              className="service-menu-item"
              onClick={() => setInfoSubView('terms')}
            >
              <div className="menu-item-left">
                <ShieldCheck size={18} className="menu-item-icon text-green" />
                <div>
                  <div className="menu-item-title">이용약관 및 데이터 안심 정책</div>
                  <div className="menu-item-sub">로컬 우선(Local-First) 저장 원칙 및 AI 비학습 보장</div>
                </div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>

            <button 
              type="button" 
              className="service-menu-item"
              onClick={() => setInfoSubView('guide')}
            >
              <div className="menu-item-left">
                <PenTool size={18} className="menu-item-icon text-amber" />
                <div>
                  <div className="menu-item-title">집필 단축키 및 에디터 가이드</div>
                  <div className="menu-item-sub">Ctrl+S 즉시 저장, 뷰어 제어, 마크다운/HTML 문법</div>
                </div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>

            <button 
              type="button" 
              className="service-menu-item"
              onClick={() => setInfoSubView('support')}
            >
              <div className="menu-item-left">
                <HelpCircle size={18} className="menu-item-icon text-purple" />
                <div>
                  <div className="menu-item-title">고객센터 및 피드백 문의</div>
                  <div className="menu-item-sub">자주 묻는 질문(FAQ), 오류 제보 및 신규 기능 제안</div>
                </div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>
          </div>
        </section>
      </div>

      {/* 실시간 AI Model Quotas 모달 */}
      <ModelQuotasModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />
    </div>
  );
}
