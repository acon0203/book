import React, { useState, useEffect } from 'react';
import { Sparkles, Edit2, X, Check, BookOpen, Palette, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { OFFICIAL_GENRES } from '../data/genreConstants';
import './BookInfoModal.css';

// 6종 모던 프리셋 표지 그라디언트 테마
export const COVER_COLOR_PRESETS = [
  { id: 'navy', label: '딥 네이비', value: 'linear-gradient(135deg, #1e293b, #0f172a)' },
  { id: 'blue', label: '로열 블루', value: 'linear-gradient(135deg, #1e40af, #1e1b4b)' },
  { id: 'emerald', label: '에메랄드 숲', value: 'linear-gradient(135deg, #065f46, #022c22)' },
  { id: 'purple', label: '미드나잇 퍼플', value: 'linear-gradient(135deg, #581c87, #2e1065)' },
  { id: 'sunset', label: '웜 선셋', value: 'linear-gradient(135deg, #9a3412, #451a03)' },
  { id: 'wine', label: '딥 와인', value: 'linear-gradient(135deg, #831843, #500724)' }
];

export default function BookInfoModal({
  isOpen,
  onClose,
  mode = 'create', // 'create' | 'edit'
  book = null,     // edit 모드 시 수정 대상 도서 객체
  onSuccess        // 완료 후 콜백 (resultBook) => void
}) {
  const { user, loadBooks, openBook, showToast, updateBookInfo, markUnsynced, deleteBook, openConfirm, setView } = useStore();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [genre, setGenre] = useState('자기계발');
  const [author, setAuthor] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [coverColor, setCoverColor] = useState(COVER_COLOR_PRESETS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 기본 저자명 계산 헬퍼
  const getInitialAuthor = () => {
    const cfgRaw = localStorage.getItem('bookstudio_config');
    let cfgAuthor = '';
    try { if (cfgRaw) cfgAuthor = JSON.parse(cfgRaw).defaultAuthor; } catch {}
    return user?.displayName || cfgAuthor || '김연재';
  };

  // 모달 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && book) {
        setTitle(book.title || '');
        setSubtitle(book.subtitle || '');
        setGenre(book.genre || '자기계발');
        setAuthor(book.author || getInitialAuthor());
        setTargetAudience(book.targetAudience || '');
        setCoverColor(book.coverColor || COVER_COLOR_PRESETS[0].value);
      } else {
        // 생성 모드
        setTitle('');
        setSubtitle('');
        setGenre('자기계발');
        setAuthor(getInitialAuthor());
        setTargetAudience('');
        setCoverColor(COVER_COLOR_PRESETS[0].value);
      }
    }
  }, [isOpen, mode, book]);

  // ESC 키로 닫기
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast('도서 메인 제목을 입력해주세요.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      if (mode === 'edit' && book) {
        // 1. 도서 정보 수정 모드
        const updated = await updateBookInfo(book.id, {
          title: trimmedTitle,
          subtitle: subtitle.trim(),
          genre,
          author: author.trim() || getInitialAuthor(),
          targetAudience: targetAudience.trim(),
          coverColor
        });
        onClose();
        if (onSuccess) onSuccess(updated);
      } else {
        // 2. 새 도서 생성 모드
        const newBook = await bookService.createBook({
          title: trimmedTitle,
          subtitle: subtitle.trim(),
          genre,
          author: author.trim() || getInitialAuthor(),
          targetAudience: targetAudience.trim(),
          coverColor
        });

        markUnsynced();
        await loadBooks();
        showToast(`'${newBook.title}' 새 전자책 프로젝트가 시작되었습니다.`, 'success');
        onClose();
        if (onSuccess) {
          onSuccess(newBook);
        } else {
          openBook(newBook.id);
        }
      }
    } catch (err) {
      console.error(err);
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!book) return;
    const ok = await openConfirm({
      title: '도서 프로젝트 삭제',
      message: `'${book.title}' 프로젝트를 정말 삭제하시겠습니까?\n작성된 모든 챕터와 원고가 영구 삭제됩니다.`,
      danger: true,
      confirmText: '삭제'
    });
    if (ok) {
      onClose();
      await deleteBook(book.id);
      setView('library');
    }
  };

  const isEditMode = mode === 'edit';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box book-info-modal" onClick={(e) => e.stopPropagation()}>
        {/* 모달 헤더 */}
        <div className="modal-header book-info-header">
          <div className="book-info-title-group">
            {isEditMode ? (
              <Edit2 size={20} style={{ color: 'var(--primary)' }} />
            ) : (
              <Sparkles size={20} style={{ color: 'var(--primary)' }} />
            )}
            <h2>{isEditMode ? '도서 기본 정보 설정' : '새 전자책 프로젝트 기획'}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSubmit} className="book-info-form">
          <div className="modal-body">
            {/* 1행: 도서 메인 제목 */}
            <div className="form-group">
              <label>도서 메인 제목 <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="예: 생성형 AI로 시작하는 1인 비즈니스"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* 2행: 부제 / 한 줄 슬로건 */}
            <div className="form-group">
              <label>부제 / 한 줄 슬로건</label>
              <input
                type="text"
                className="form-control"
                placeholder="예: 기획부터 출간까지 3주 만에 끝내는 실전 로드맵"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            {/* 3행: 장르 & 저자명/필명 (2열 그리드) */}
            <div className="book-info-grid">
              <div className="form-group">
                <label>도서 장르 (공식 10대 장르)</label>
                <select
                  className="form-control"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                >
                  {OFFICIAL_GENRES.map((g) => (
                    <option key={g.id} value={g.label}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>저자명 / 필명</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="예: 김연재, 필명 등"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
            </div>

            {/* 4행: 목표 독자층 */}
            <div className="form-group">
              <label>목표 독자층</label>
              <input
                type="text"
                className="form-control"
                placeholder="예: AI 툴을 업무에 바로 써먹고 싶은 직장인"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            {/* 5행: 책 표지 테마 색상 (프리셋 팔레트) */}
            <div className="cover-color-picker-wrap">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Palette size={14} style={{ color: 'var(--primary)' }} />
                <span>책 표지 테마 색상</span>
              </label>
              <div className="cover-color-palette">
                {COVER_COLOR_PRESETS.map((preset) => {
                  const isSelected = coverColor === preset.value;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`color-swatch-chip ${isSelected ? 'active' : ''}`}
                      style={{ background: preset.value }}
                      onClick={() => setCoverColor(preset.value)}
                      title={preset.label}
                    >
                      {isSelected && <Check size={16} className="color-swatch-check" />}
                    </button>
                  );
                })}
              </div>

              {/* 실시간 표지 미니 미리보기 */}
              <div className="cover-preview-banner" style={{ background: coverColor }}>
                <span>《{title.trim() || '도서 제목'}》</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>{genre} · {author || '작가'}</span>
              </div>
            </div>
          </div>

          {/* 모달 푸터 */}
          <div className="modal-footer" style={{ display: 'flex', justifyContent: isEditMode ? 'space-between' : 'flex-end', alignItems: 'center' }}>
            {isEditMode && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteBook}
                disabled={isSubmitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
              >
                <Trash2 size={14} />
                <span>프로젝트 삭제</span>
              </button>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isEditMode ? (
                  <>
                    <Edit2 size={15} />
                    <span>{isSubmitting ? '저장 중...' : '변경사항 저장'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>{isSubmitting ? '생성 중...' : '프로젝트 시작'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
