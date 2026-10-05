import React, { useEffect, useState, useMemo } from 'react';
import './Vault.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { Plus, Trash2, X } from 'lucide-react';

export default function Vault() {
  const { vault, loadVault, deleteVaultItem, activeTagFilter, setTagFilter, showToast } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 등록 모달 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  const tags = useMemo(() => {
    const set = new Set();
    vault.forEach(v => v.tags?.forEach(t => set.add(t)));
    return ['ALL', ...Array.from(set)];
  }, [vault]);

  const filteredVault = useMemo(() => {
    if (activeTagFilter === 'ALL') return vault;
    return vault.filter(v => v.tags?.includes(activeTagFilter));
  }, [vault, activeTagFilter]);

  const handleCreateVaultItem = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('제목과 내용을 모두 입력해주세요.', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await bookService.createVaultItem({
        title: title.trim(),
        content: content.trim(),
        tags: parsedTags.length > 0 ? parsedTags : ['일반'],
        source: 'user'
      });
      await loadVault();
      showToast('자료가 등록되었습니다.', 'success');
      setTitle('');
      setContent('');
      setTagsInput('');
      setIsModalOpen(false);
    } catch (err) {
      showToast(`등록 실패: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="vault-page">
      <header className="vault-header">
        <div>
          <h1>자료 금고 (Idea & Reference Vault)</h1>
          <p>책 집필에 필요한 핵심 아이디어, 발췌문, 수치를 보관하고 AI 집필 시 주입하세요.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>새 자료 등록</span>
        </button>
      </header>

      <div className="vault-body">
        {/* 태그 필터 바 */}
        <div className="tag-bar">
          {tags.map(t => (
            <button
              key={t}
              className={`tag-btn ${activeTagFilter === t ? 'active' : ''}`}
              onClick={() => setTagFilter(t)}
            >
              {t === 'ALL' ? '전체 보기' : `#${t}`}
            </button>
          ))}
        </div>

        {filteredVault.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💡</div>
            <h3>등록된 자료가 없습니다.</h3>
            <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              새로운 레퍼런스를 등록하여 AI 집필에 활용해 보세요.
            </p>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} />
              <span>새 자료 등록</span>
            </button>
          </div>
        ) : (
          <div className="vault-grid">
            {filteredVault.map(item => (
              <div key={item.id} className="vault-card">
                <div className="vault-card-header">
                  <span className="vault-card-title">{item.title}</span>
                  <button
                    className="btn-icon-danger"
                    onClick={() => {
                      if (window.confirm(`'${item.title}' 자료를 삭제하시겠습니까?`)) {
                        deleteVaultItem(item.id);
                      }
                    }}
                    title="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="vault-tags">
                  {item.tags?.map(t => (
                    <span key={t} className="vault-tag-badge">#{t}</span>
                  ))}
                </div>

                <div className="vault-card-content">{item.content}</div>

                <div className="vault-card-footer">
                  <span>{new Date(item.createdAt || Date.now()).toLocaleDateString('ko-KR')}</span>
                  <span>{item.content?.length || 0} 자</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 새 자료 등록 모달 */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>새 자료 등록</h2>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateVaultItem}>
              <div className="modal-body">
                <div className="form-group">
                  <label>자료 제목 *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 2026 AI 트렌드 요약"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>태그 (쉼표로 구분)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: AI, 트렌드, 시장조사"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>핵심 내용 및 메모 *</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '130px' }}
                    placeholder="책 집필 시 AI에게 참고시킬 핵심 정보나 통계를 입력하세요."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Plus size={16} />
                  <span>{isSubmitting ? '저장 중...' : '자료 보관'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
