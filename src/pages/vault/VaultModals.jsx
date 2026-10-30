import React from 'react';
import { BookOpen, X, Bookmark, Users, Sparkles, Check } from 'lucide-react';
import { OFFICIAL_GENRES } from '../../data/genreConstants';
import { VAULT_CATEGORIES } from '../../data/vaultConstants';

// =============================================================================
// 1. 새 기획 프로젝트 생성 및 정보 수정 모달
// =============================================================================
export function NewProjectModal({
  isOpen,
  onClose,
  editingId,
  title,
  setTitle,
  genre,
  setGenre,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="vault-modal-backdrop" onClick={onClose}>
      <div className="vault-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="vault-modal-header">
          <h3 className="vault-modal-title">
            <BookOpen size={18} style={{ color: 'var(--color-primary)' }} />
            {editingId ? '기획 프로젝트 정보 수정' : '새 작품 기획 시작'}
          </h3>
          <button type="button" className="mini-icon-btn" onClick={onClose} aria-label="닫기">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="vault-modal-body">
            <div className="vault-form-group">
              <label>{editingId ? '작품 제목' : '작품 가제'}</label>
              <input
                type="text"
                className="vault-form-control"
                placeholder="예: 심야의 문장과 고요한 방"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="vault-form-group">
              <label>도서 장르</label>
              <select
                className="vault-form-control"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                {OFFICIAL_GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="vault-modal-footer">
            <button type="button" className="btn-idea-action" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-add-idea">
              {editingId ? '수정 저장' : '기획 시작하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// 2. 취재 자료 등록 및 수정 모달
// =============================================================================
export function MaterialModal({
  isOpen,
  onClose,
  editingId,
  category,
  setCategory,
  title,
  setTitle,
  content,
  setContent,
  source,
  setSource,
  tags,
  setTags,
  isSubmitting,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="vault-modal-backdrop" onClick={onClose}>
      <div className="vault-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="vault-modal-header">
          <h3 className="vault-modal-title">
            <Bookmark size={18} style={{ color: 'var(--color-primary)' }} />
            {editingId ? '취재 자료 수정' : '취재 자료 등록'}
          </h3>
          <button type="button" className="mini-icon-btn" onClick={onClose} aria-label="닫기">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="vault-modal-body">
            <div className="vault-form-group">
              <label>자료 분류</label>
              <select
                className="vault-form-control"
                value={category === 'ALL' ? 'quote' : category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {VAULT_CATEGORIES.filter((c) => c.id !== 'ALL').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="vault-form-group">
              <label>자료 제목</label>
              <input
                type="text"
                className="vault-form-control"
                placeholder="예: 파스칼의 팡세 - 방 안에 머무는 능력"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="vault-form-group">
              <label>핵심 내용 / 발췌문</label>
              <textarea
                className="vault-form-control"
                rows={4}
                placeholder="인간의 모든 불행은 방 안에 홀로 고요히 머물 줄 모른다는 데서 비롯된다..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
            <div className="vault-form-group">
              <label>출처 / 레퍼런스</label>
              <input
                type="text"
                className="vault-form-control"
                placeholder="예: 블레즈 파스칼, 《팡세》 139절"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div className="vault-form-group">
              <label>해시태그 (쉼표로 구분)</label>
              <input
                type="text"
                className="vault-form-control"
                placeholder="사색, 고독, 회복"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>
          <div className="vault-modal-footer">
            <button type="button" className="btn-idea-action" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-add-idea" disabled={isSubmitting}>
              {editingId ? '수정 완료' : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// 3. 인물 추가 및 수정 모달
// =============================================================================
export function CharacterModal({
  isOpen,
  onClose,
  editingId,
  name,
  setName,
  role,
  setRole,
  goal,
  setGoal,
  flaw,
  setFlaw,
  traits,
  setTraits,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="vault-modal-backdrop" onClick={onClose}>
      <div className="vault-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="vault-modal-header">
          <h3 className="vault-modal-title">
            <Users size={18} style={{ color: 'var(--color-primary)' }} />
            {editingId ? '인물 프로필 수정' : '새 인물·화자 추가'}
          </h3>
          <button type="button" className="mini-icon-btn" onClick={onClose} aria-label="닫기">
            <X size={15} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="vault-modal-body">
            <div className="vault-form-group">
              <label>인물 이름 / 화자 호칭</label>
              <input
                type="text"
                className="vault-form-control"
                placeholder="예: 서진우 (주인공) / 나 (에세이 1인칭 화자)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="vault-form-group">
              <label>역할 비중</label>
              <select
                className="vault-form-control"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="주인공/화자">주인공 / 1인칭 화자</option>
                <option value="조력자/친구">조력자 / 멘토 / 친구</option>
                <option value="대립자/갈등원인">대립자 / 갈등 요인</option>
                <option value="관찰자/주변인">관찰자 / 주변 인물</option>
              </select>
            </div>
            <div className="vault-form-group">
              <label>핵심 욕망 / 목표 (Goal)</label>
              <input
                type="text"
                className="vault-form-control"
                placeholder="이 인물이 궁극적으로 얻고자 하는 가치나 목적"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
            <div className="vault-form-group">
              <label>결핍 / 치명적 약점 (Flaw)</label>
              <input
                type="text"
                className="vault-form-control"
                placeholder="인물의 내면적 트라우마나 극복해야 할 약점"
                value={flaw}
                onChange={(e) => setFlaw(e.target.value)}
              />
            </div>
            <div className="vault-form-group">
              <label>외모 및 성격 특징 (Traits)</label>
              <input
                type="text"
                className="vault-form-control"
                placeholder="차분함, 예민한 감각, 밤늦게 차를 마시는 습관 등"
                value={traits}
                onChange={(e) => setTraits(e.target.value)}
              />
            </div>
          </div>
          <div className="vault-modal-footer">
            <button type="button" className="btn-idea-action" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-add-idea">
              저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// 4. 출판 표준 플롯 기반 AI 목차 기획 모달
// =============================================================================
export function OutlinePlanModal({
  isOpen,
  onClose,
  planMode = 'plot',
  generatedOutline,
  isGenerating,
  onGenerate,
  onApply
}) {
  if (!isOpen) return null;

  const isPlotMode = planMode === 'plot';
  const modalTitle = isPlotMode ? '서사 뼈대 기반 AI 목차 기획' : '출간 기획 기반 AI 목차 기획';
  const modalDescription = isPlotMode
    ? '현재 설계된 서사 뼈대 단계와 세부 꼭지 메모를 분석하여 바로 집필 가능한 완성도 높은 가목차 구성을 제안합니다.'
    : '서사 뼈대 단계를 거치지 않고, 도서 장르와 출간 기획서(로그라인·기획의도·타깃독자)를 바탕으로 표준 목차를 즉시 생성합니다.';
  const generateBtnLabel = isPlotMode ? '뼈대 기반 목차 자동 도출' : '기획서 기반 목차 자동 도출';

  return (
    <div className="vault-modal-backdrop" onClick={onClose}>
      <div className="vault-modal-box" style={{ width: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className="vault-modal-header">
          <h3 className="vault-modal-title">
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            {modalTitle}
          </h3>
          <button type="button" className="mini-icon-btn" onClick={onClose} aria-label="닫기">
            <X size={15} />
          </button>
        </div>
        <div className="vault-modal-body">
          <p style={{ fontSize: '0.84rem', color: 'var(--text-sub)', margin: 0 }}>
            {modalDescription}
          </p>

          {!generatedOutline ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <button
                type="button"
                className="btn-add-idea"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                onClick={onGenerate}
                disabled={isGenerating}
              >
                <Sparkles size={15} />
                {isGenerating ? '목차 생성 및 정렬 중...' : generateBtnLabel}
              </button>
            </div>
          ) : (
            <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-surface)', borderRadius: '8px' }}>
              {generatedOutline.map((c, i) => (
                <div key={i} style={{ marginBottom: '0.85rem' }}>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--color-primary)' }}>{c.title}</strong>
                  <div style={{ paddingLeft: '0.75rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {c.sections.map((s, si) => (
                      <div key={si} style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                        • {s.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="vault-modal-footer">
          <button type="button" className="btn-idea-action" onClick={onClose}>
            닫기
          </button>
          {generatedOutline && (
            <button type="button" className="btn-add-idea" onClick={onApply}>
              <Check size={14} />
              목차 조립대에 반영
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 통합 기본 내보내기 컴포넌트
// =============================================================================
export default function VaultModals({
  // 1. 새 프로젝트 / 수정
  isNewProjectModalOpen,
  setIsNewProjectModalOpen,
  editingProjectId,
  newProjectTitle,
  setNewProjectTitle,
  newProjectGenre,
  setNewProjectGenre,
  handleCreateNewProject,

  // 2. 취재 자료
  isVaultModalOpen,
  setIsVaultModalOpen,
  editingMaterialId,
  vaultCategory,
  setVaultCategory,
  vaultTitle,
  setVaultTitle,
  vaultContent,
  setVaultContent,
  vaultSource,
  setVaultSource,
  tagsInput,
  setTagsInput,
  isVaultSubmitting,
  handleCreateOrUpdateMaterial,

  // 3. 인물
  isCharModalOpen,
  setIsCharModalOpen,
  editingCharId,
  charName,
  setCharName,
  charRole,
  setCharRole,
  charGoal,
  setCharGoal,
  charFlaw,
  setCharFlaw,
  charTraits,
  setCharTraits,
  handleSaveCharacter,

  // 4. 목차 기획
  isOutlinePlanModalOpen,
  setIsOutlinePlanModalOpen,
  outlinePlanMode,
  generatedAiOutline,
  isAiGeneratingOutline,
  handleGenerateAiOutline,
  handleApplyAiOutline
}) {
  return (
    <>
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        editingId={editingProjectId}
        title={newProjectTitle}
        setTitle={setNewProjectTitle}
        genre={newProjectGenre}
        setGenre={setNewProjectGenre}
        onSubmit={handleCreateNewProject}
      />

      <MaterialModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        editingId={editingMaterialId}
        category={vaultCategory}
        setCategory={setVaultCategory}
        title={vaultTitle}
        setTitle={setVaultTitle}
        content={vaultContent}
        setContent={setVaultContent}
        source={vaultSource}
        setSource={setVaultSource}
        tags={tagsInput}
        setTags={setTagsInput}
        isSubmitting={isVaultSubmitting}
        onSubmit={handleCreateOrUpdateMaterial}
      />

      <CharacterModal
        isOpen={isCharModalOpen}
        onClose={() => setIsCharModalOpen(false)}
        editingId={editingCharId}
        name={charName}
        setName={setCharName}
        role={charRole}
        setRole={setCharRole}
        goal={charGoal}
        setGoal={setCharGoal}
        flaw={charFlaw}
        setFlaw={setCharFlaw}
        traits={charTraits}
        setTraits={setCharTraits}
        onSubmit={handleSaveCharacter}
      />

      <OutlinePlanModal
        isOpen={isOutlinePlanModalOpen}
        onClose={() => setIsOutlinePlanModalOpen(false)}
        planMode={outlinePlanMode}
        generatedOutline={generatedAiOutline}
        isGenerating={isAiGeneratingOutline}
        onGenerate={handleGenerateAiOutline}
        onApply={handleApplyAiOutline}
      />
    </>
  );
}
