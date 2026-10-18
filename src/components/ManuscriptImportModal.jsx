import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Clipboard, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  BookOpen, 
  ArrowRight,
  Layers,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { readManuscriptFile, parseManuscript } from '../utils/manuscriptImporter';
import { bookService } from '../services/bookService';
import { useStore } from '../store';
import './ManuscriptImportModal.css';

export default function ManuscriptImportModal({ isOpen, onClose, currentBook = null }) {
  const { loadBooks, openBook, showToast, user, markUnsynced } = useStore();

  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'paste'
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 파싱된 원고 결과 상태
  const [parsedResult, setParsedResult] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [bookGenre, setBookGenre] = useState('소설');
  const [targetBookMode, setTargetBookMode] = useState(currentBook ? 'append' : 'new'); // 'new' | 'append'

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 1. 파일 처리
  const handleFileChange = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'md', 'docx'].includes(ext)) {
      showToast('.txt, .md, .docx 파일만 지원됩니다.', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      setSelectedFile(file);
      const text = await readManuscriptFile(file);
      const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
      const parsed = parseManuscript(text, defaultTitle);

      setParsedResult(parsed);
      setBookTitle(parsed.title);
      showToast(`${file.name} 원고를 성공적으로 분석했습니다.`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`원고 분석 실패: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. 붙여넣기 텍스트 처리
  const handlePasteAnalyze = () => {
    if (!pastedText.trim()) {
      showToast('분석할 원고 텍스트를 입력해주세요.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const parsed = parseManuscript(pastedText, '붙여넣은 원고');
      setParsedResult(parsed);
      setBookTitle(parsed.title);
      showToast('원고가 성공적으로 분석되었습니다.', 'success');
    } catch (err) {
      showToast(`분석 실패: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 드래그 & 드롭 핸들러
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // 3. 최종 가져오기 실행
  const handleConfirmImport = async () => {
    if (!parsedResult || parsedResult.chapters.length === 0) {
      showToast('가져올 유효한 챕터가 없습니다.', 'error');
      return;
    }

    try {
      setIsProcessing(true);

      const cfgRaw = localStorage.getItem('bookstudio_config');
      let cfgAuthor = '';
      try { if (cfgRaw) cfgAuthor = JSON.parse(cfgRaw).defaultAuthor; } catch {}
      const defaultAuthor = user?.displayName || cfgAuthor || '김연재';

      if (targetBookMode === 'new' || !currentBook) {
        // [새 도서 프로젝트로 생성]
        const newBook = await bookService.createBook({
          title: bookTitle.trim() || parsedResult.title,
          subtitle: parsedResult.subtitle || '',
          genre: bookGenre,
          author: defaultAuthor,
          chapters: parsedResult.chapters
        });

        markUnsynced();
        await loadBooks();
        showToast(`'${newBook.title}' 도서로 원고가 성공적으로 등록되었습니다.`, 'success');
        onClose();
        openBook(newBook.id);
      } else {
        // [현재 도서에 챕터 이어붙이기]
        const existingChapters = currentBook.chapters || [];
        const combinedChapters = [...existingChapters, ...parsedResult.chapters];
        
        await bookService.updateBook(currentBook.id, {
          chapters: combinedChapters
        });

        markUnsynced();
        await loadBooks();
        showToast(`${parsedResult.chapters.length}개 챕터가 현재 도서에 추가되었습니다.`, 'success');
        onClose();
      }
    } catch (err) {
      console.error(err);
      showToast(`원고 등록 실패: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalSections = parsedResult?.chapters.reduce((acc, c) => acc + (c.sections?.length || 0), 0) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box import-manuscript-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <div className="import-modal-title-group">
            <UploadCloud size={20} className="modal-title-icon" />
            <h2>외부 원고 가져오기 (TXT · Word · Markdown)</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* 본문 */}
        <div className="modal-body import-modal-body">
          {/* 상단 안내 바 */}
          <div className="import-info-banner">
            <Sparkles size={16} className="info-sparkle-icon" />
            <span>
              외부에서 작성한 원고를 넣으면 <strong>제 1장, 1화, Chapter, 마크다운(#)</strong> 등의 목차 패턴을 자동으로 감지하여 챕터와 소목차로 즉시 분할합니다.
            </span>
          </div>

          {/* 탭 전환 */}
          {!parsedResult && (
            <div className="import-tab-switcher">
              <button 
                type="button" 
                className={`import-tab-btn ${activeTab === 'file' ? 'active' : ''}`}
                onClick={() => setActiveTab('file')}
              >
                <FileText size={15} />
                <span>파일 업로드 (.txt, .md, .docx)</span>
              </button>
              <button 
                type="button" 
                className={`import-tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
                onClick={() => setActiveTab('paste')}
              >
                <Clipboard size={15} />
                <span>원고 텍스트 직접 붙여넣기</span>
              </button>
            </div>
          )}

          {/* 1단계: 입력 화면 */}
          {!parsedResult ? (
            activeTab === 'file' ? (
              <div 
                className={`import-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".txt,.md,.docx"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
                <div className="dropzone-inner">
                  <UploadCloud size={44} className="dropzone-icon" />
                  <h4>파일을 여기로 드래그하거나 클릭하여 선택하세요</h4>
                  <p>지원 파일 형식: <strong>TXT (.txt), 마크다운 (.md), MS 워드 (.docx)</strong></p>
                  <span className="dropzone-badge">0ms 브라우저 초경량 파싱</span>
                </div>
              </div>
            ) : (
              <div className="import-paste-area">
                <textarea 
                  className="import-paste-textarea"
                  placeholder="워드나 한글, 메모장에서 작성한 원고 전체를 여기에 붙여넣으세요 (Ctrl + V)..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
                <div className="paste-action-bar">
                  <span className="paste-char-count">{pastedText.length.toLocaleString()}자 입력됨</span>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm"
                    onClick={handlePasteAnalyze}
                    disabled={!pastedText.trim() || isProcessing}
                  >
                    <span>원고 목차 자동 분석</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )
          ) : (
            /* 2단계: 파싱 결과 미리보기 및 설정 */
            <div className="import-preview-section">
              {/* 분석 요약 카드 */}
              <div className="import-summary-card">
                <div className="summary-left">
                  <CheckCircle2 size={24} className="summary-check-icon" />
                  <div>
                    <h4>원고 구조 자동 감지 완료!</h4>
                    <p>
                      총 <strong>{parsedResult.chapters.length}개 챕터</strong> · <strong>{totalSections}개 소목차</strong> · <strong>{parsedResult.totalWords.toLocaleString()}자</strong>
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn-retry-import"
                  onClick={() => {
                    setParsedResult(null);
                    setSelectedFile(null);
                    setPastedText('');
                  }}
                >
                  다른 원고 올리기
                </button>
              </div>

              {/* 도서 메타 설정 */}
              <div className="import-form-grid">
                <div className="form-group">
                  <label>도서 제목</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={bookTitle} 
                    onChange={(e) => setBookTitle(e.target.value)} 
                    placeholder="도서 제목을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label>장르 분류</label>
                  <select 
                    className="form-control" 
                    value={bookGenre} 
                    onChange={(e) => setBookGenre(e.target.value)}
                  >
                    <option value="소설">소설 / 웹소설</option>
                    <option value="시 / 에세이">시 / 에세이 / 자서전</option>
                    <option value="경제 / 경영">경제 / 경영</option>
                    <option value="자기계발">자기계발</option>
                    <option value="인문 / 사회">인문 / 사회 / 평전</option>
                    <option value="IT / 과학">IT / 과학</option>
                    <option value="라이프 / 실용">라이프 / 실용</option>
                    <option value="예술 / 문화">예술 / 문화</option>
                  </select>
                </div>
              </div>

              {/* 가져오기 대상 선택 (현재 열린 도서가 있을 때) */}
              {currentBook && (
                <div className="import-target-selector">
                  <label>가져오기 방식</label>
                  <div className="target-radio-group">
                    <label className={`target-radio-card ${targetBookMode === 'new' ? 'active' : ''}`}>
                      <input 
                        type="radio" 
                        name="targetMode" 
                        value="new" 
                        checked={targetBookMode === 'new'} 
                        onChange={() => setTargetBookMode('new')} 
                      />
                      <div>
                        <strong>새 도서 프로젝트로 생성</strong>
                        <span>새로운 책으로 등록하고 작업합니다.</span>
                      </div>
                    </label>
                    <label className={`target-radio-card ${targetBookMode === 'append' ? 'active' : ''}`}>
                      <input 
                        type="radio" 
                        name="targetMode" 
                        value="append" 
                        checked={targetBookMode === 'append'} 
                        onChange={() => setTargetBookMode('append')} 
                      />
                      <div>
                        <strong>현재 도서('{currentBook.title}')에 이어붙이기</strong>
                        <span>기존 챕터 뒤에 감지된 챕터들을 덧붙입니다.</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* 감지된 챕터 구조 리스트 미리보기 */}
              <div className="import-chapters-preview-box">
                <div className="preview-box-header">
                  <span>감지된 챕터 목차 목록</span>
                  <span className="count-badge">{parsedResult.chapters.length}개</span>
                </div>
                <div className="preview-chapters-list">
                  {parsedResult.chapters.map((ch, idx) => (
                    <div key={ch.id || idx} className="preview-chapter-item">
                      <div className="preview-chap-header">
                        <span className="chap-num-badge">{idx + 1}</span>
                        <strong className="chap-name">{ch.title}</strong>
                        <span className="chap-meta-info">
                          소목차 {ch.sections.length}개 · 약 {ch.sections.reduce((a, s) => a + (s.wordCount || 0), 0).toLocaleString()}자
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>
            취소
          </button>
          {parsedResult && (
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleConfirmImport}
              disabled={isProcessing}
            >
              <FileCheck size={16} />
              <span>{targetBookMode === 'new' ? '새 책으로 가져오기 완료' : '현재 도서에 챕터 추가'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
