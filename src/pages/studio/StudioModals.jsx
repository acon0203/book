import React, { useState, useEffect } from 'react';
import {
  X, FileText, Copy, Download, Check, History, Plus, RotateCcw, Trash2
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import './StudioModals.css';

const cleanTitle = (t) => aiService.cleanOutlineTitle(t);

function useModalEsc(isOpen, onClose) {
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
}

// =============================================================================
// [공통 헬퍼] 텍스트 및 마크다운 변환 함수
// =============================================================================
function htmlToMarkdown(html) {
  if (!html) return '';
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<ul[^>]*>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');
  md = md.replace(/<br\s*[\/]?>/gi, '\n');
  md = md.replace(/<hr\s*[\/]?>/gi, '\n---\n\n');
  md = md.replace(/<[^>]*>/g, '');
  md = md.replace(/&nbsp;/gi, ' ');
  md = md.replace(/&amp;/gi, '&');
  md = md.replace(/&lt;/gi, '<');
  md = md.replace(/&gt;/gi, '>');
  md = md.replace(/&quot;/gi, '"');
  md = md.replace(/&#39;/gi, "'");
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function htmlToPlainText(html) {
  if (!html) return '';
  let text = html;
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li>/gi, '• ');
  text = text.replace(/<[^>]*>/g, '');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function stripDuplicateHeader(content, sectionTitle, chapterTitle) {
  if (!content) return '';
  const lines = content.split('\n');
  const sTitle = cleanTitle(sectionTitle || '').trim();
  const cTitle = cleanTitle(chapterTitle || '').trim();

  while (lines.length > 0) {
    const rawLine = lines[0].trim();
    const cleanLine = rawLine.replace(/^[#\s\*\-_>]+/, '').trim();
    if (!rawLine) {
      lines.shift();
      continue;
    }
    const isDup =
      (sTitle && cleanLine.includes(sTitle)) ||
      (cTitle && cleanLine.includes(cTitle)) ||
      /^제\s*\d+\s*장/i.test(cleanLine) ||
      /^\d+[\.\-]\s*\d+/i.test(cleanLine);

    if (isDup) {
      lines.shift();
    } else {
      break;
    }
  }
  return lines.join('\n').trim();
}

// =============================================================================
// 1. [ExportModal] 전자책 전체 내보내기 모달
// =============================================================================
export function ExportModal({ isOpen, onClose, activeBook, showToast }) {
  useModalEsc(isOpen, onClose);
  const [exportFormat, setExportFormat] = useState('md');

  if (!isOpen || !activeBook) return null;

  const getExportText = () => {
    if (exportFormat === 'md') {
      let md = `# ${activeBook.title}\n\n`;
      if (activeBook.subtitle) md += `> ${activeBook.subtitle}\n\n`;
      activeBook.chapters?.forEach((c, cI) => {
        md += `## 제 ${cI + 1}장. ${cleanTitle(c.title)}\n\n`;
        c.sections?.forEach((s, sI) => {
          let cleanSecBody = htmlToMarkdown(s.content);
          cleanSecBody = stripDuplicateHeader(cleanSecBody, s.title, c.title);
          md += `### ${cI + 1}.${sI + 1} ${cleanTitle(s.title)}\n\n${cleanSecBody}\n\n`;
        });
      });
      return md.trim();
    }

    let txt = `==================================================\n`;
    txt += `${activeBook.title}\n`;
    if (activeBook.subtitle) txt += `${activeBook.subtitle}\n`;
    txt += `==================================================\n\n`;

    activeBook.chapters?.forEach((c, cI) => {
      txt += `\n[ 제 ${cI + 1} 장. ${cleanTitle(c.title)} ]\n\n`;
      c.sections?.forEach((s, sI) => {
        let cleanSecBody = htmlToPlainText(s.content);
        cleanSecBody = stripDuplicateHeader(cleanSecBody, s.title, c.title);
        txt += `(${cI + 1}.${sI + 1} ${cleanTitle(s.title)})\n\n`;
        if (cleanSecBody) {
          txt += `${cleanSecBody}\n\n`;
        }
      });
    });

    return txt.trim();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportText());
    showToast('클립보드에 복사되었습니다.', 'info');
  };

  const handleDownload = () => {
    const text = getExportText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBook.title}.${exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('다운로드되었습니다.', 'success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>전자책 전체 내보내기</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>내보낼 형식</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${exportFormat === 'md' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExportFormat('md')}
              >
                <FileText size={15} /> Markdown (.md)
              </button>
              <button
                type="button"
                className={`btn ${exportFormat === 'txt' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExportFormat('txt')}
              >
                <FileText size={15} /> Text (.txt)
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>원고 미리보기</label>
            <textarea
              className="form-control"
              style={{ height: '220px', fontFamily: 'monospace', fontSize: '0.82rem' }}
              value={getExportText()}
              readOnly
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={handleCopy}>
            <Copy size={15} /> 복사
          </button>
          <button type="button" className="btn btn-primary" onClick={handleDownload}>
            <Download size={15} /> 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// 3. [VaultModal] AI 집필 참고 자료 선택 모달
// =============================================================================
export function VaultModal({
  isOpen,
  onClose,
  vault = [],
  selectedVaultIds = [],
  toggleSelectVaultId,
  clearSelectedVaultIds
}) {
  useModalEsc(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>AI 집필 참고 자료 선택</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem' }}>선택된 자료: {selectedVaultIds.length}개</span>
            {selectedVaultIds.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelectedVaultIds}>
                선택 초기화
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
            {vault.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>자료가 없습니다.</p>
            ) : (
              vault.map((v) => {
                const sel = selectedVaultIds.includes(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={() => toggleSelectVaultId(v.id)}
                    style={{
                      display: 'flex',
                      gap: '0.6rem',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '6px',
                      background: sel ? 'var(--bg-active)' : 'var(--bg-panel)',
                      border: `1px solid ${sel ? 'var(--primary)' : 'var(--border-glass)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => {}}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: sel ? 'var(--primary)' : 'var(--text-main)' }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {v.content?.substring(0, 60)}...
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            <Check size={16} /> 적용 완료 ({selectedVaultIds.length}개)
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 4. [VersionModal] 버전 관리 (기록 확인 및 되돌리기/삭제) 모달
// =============================================================================
export function VersionModal({
  isOpen,
  onClose,
  activeBook,
  triggerCreateVersionPrompt,
  handleRestoreVersion,
  handleDeleteVersion
}) {
  useModalEsc(isOpen, onClose);
  if (!isOpen || !activeBook) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-version" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={20} className="text-primary" />
            <h2>버전 관리</h2>
            <span className="version-book-title-badge">《{activeBook.title}》</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <div className="version-list-intro">
            <p>보관된 버전 기록을 확인하고 원하는 시점의 원고로 언제든 되돌릴 수 있습니다.</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={triggerCreateVersionPrompt}
            >
              <Plus size={13} />
              <span>현재 원고 새 버전으로 저장</span>
            </button>
          </div>

          {(!activeBook.versions || activeBook.versions.length === 0) ? (
            <div className="version-empty-state">
              <History size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>아직 보관된 버전 기록이 없습니다.</p>
              <span>우측 상단 디스켓 버튼의 [새 버전으로 저장]을 누르면 이 시점의 원고가 보관됩니다.</span>
            </div>
          ) : (
            <div className="version-card-list">
              {activeBook.versions.map((ver, idx) => (
                <div key={ver.id || idx} className={`version-card ${ver.isAutoBackup ? 'is-autobackup' : ''}`}>
                  <div className="version-card-main">
                    <div className="version-card-title-row">
                      <strong className="version-card-name">{ver.name}</strong>
                      {ver.isAutoBackup ? (
                        <span className="badge-autobackup">자동 백업</span>
                      ) : (
                        <span className="badge-manual-version">버전 #{activeBook.versions.length - idx}</span>
                      )}
                    </div>
                    <div className="version-card-meta">
                      <span>{new Date(ver.createdAt).toLocaleString('ko-KR')}</span>
                      <span>·</span>
                      <span>{(ver.totalWords || 0).toLocaleString()} 자</span>
                      <span>·</span>
                      <span>{ver.chapterCount || ver.chapters?.length || 0}개 챕터</span>
                    </div>
                  </div>
                  <div className="version-card-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm btn-version-restore"
                      onClick={() => handleRestoreVersion(ver)}
                      title="이 버전으로 원고 전체 되돌리기"
                    >
                      <RotateCcw size={13} />
                      <span>되돌리기</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-version-delete"
                      onClick={() => handleDeleteVersion(ver)}
                      title="버전 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            * 되돌리기를 실행하면 현재 화면의 원고가 해당 시점의 데이터로 교체됩니다.
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
