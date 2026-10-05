// === 연재서재 클라이언트 애플리케이션 ===

const state = {
  currentView: 'view-library',
  books: [],
  vault: [],
  templates: [],
  config: {},
  activeBook: null,
  activeChapterId: null,
  activeSectionId: null,
  selectedVaultIds: [],
  activeTagFilter: 'ALL',
  selectedEditorRange: null,
  activePolishPreset: 'expand'
};

// --- 초기화 ---
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupNavigation();
  setupEventListeners();

  await loadConfig();
  await loadTemplates();
  await loadBooks();
  await loadVault();
  await loadStats();
});

// --- 테마 관리 ---
function initTheme() {
  const savedTheme = localStorage.getItem('book_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    document.getElementById('themeIcon').textContent = '🌙';
  } else {
    document.body.classList.remove('light-mode');
    document.getElementById('themeIcon').textContent = '☀️';
  }

  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('book_theme', isLight ? 'light' : 'dark');
    document.getElementById('themeIcon').textContent = isLight ? '🌙' : '☀️';
  });
}

// --- 1열 네비게이션 ---
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-item');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      switchView(targetView);
    });
  });
}

function switchView(viewId) {
  state.currentView = viewId;

  // 네비게이션 버튼 상태
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 뷰 섹션 상태
  document.querySelectorAll('.app-view').forEach(view => {
    if (view.id === viewId) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // 뷰 진입 시 데이터 갱신
  if (viewId === 'view-library') loadBooks();
  if (viewId === 'view-vault') loadVault();
  if (viewId === 'view-stats') loadStats();
  if (viewId === 'view-settings') loadConfig();
}

// --- API 로더 함수들 ---
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    state.config = await res.json();

    document.getElementById('cfgSelectedProvider').value = state.config.selectedProvider || 'gemini';
    document.getElementById('cfgGeminiKey').value = state.config.geminiApiKey || '';
    document.getElementById('cfgOllamaUrl').value = state.config.ollamaUrl || 'http://localhost:11434';
    document.getElementById('cfgOllamaModel').value = state.config.ollamaModel || 'gemma2:9b';
    document.getElementById('cfgOpenAiKey').value = state.config.openaiApiKey || '';
    document.getElementById('cfgAnthropicKey').value = state.config.anthropicApiKey || '';
  } catch (err) {
    console.error('설정 로드 실패:', err);
  }
}

async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    state.templates = await res.json();
  } catch (err) {
    console.error('템플릿 로드 실패:', err);
  }
}

async function loadBooks() {
  try {
    const res = await fetch('/api/books');
    state.books = await res.json();
    renderLibrary();
  } catch (err) {
    console.error('도서 목록 로드 실패:', err);
  }
}

async function loadVault() {
  try {
    const res = await fetch('/api/vault');
    state.vault = await res.json();
    renderVault();
  } catch (err) {
    console.error('자료 금고 로드 실패:', err);
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();

    document.getElementById('statTotalWords').textContent = stats.totalWords.toLocaleString() + ' 자';
    document.getElementById('statBookCount').textContent = stats.bookCount + ' 권';
    document.getElementById('statCompletedSections').textContent = `${stats.completedSections} / ${stats.totalSections}`;
    document.getElementById('statAiCount').textContent = stats.aiGenerationsCount + ' 회';

    // 도서별 진행도 목록
    const progressList = document.getElementById('statsBookProgressList');
    progressList.innerHTML = '';
    state.books.forEach(b => {
      let totalSec = 0;
      let compSec = 0;
      b.chapters?.forEach(c => {
        c.sections?.forEach(s => {
          totalSec++;
          if (s.status === 'completed' || (s.content && s.content.trim().length > 100)) compSec++;
        });
      });
      const percent = totalSec === 0 ? 0 : Math.round((compSec / totalSec) * 100);

      const div = document.createElement('div');
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:0.4rem;">
          <strong style="color:var(--text-main);">${escapeHtml(b.title)}</strong>
          <span style="color:var(--primary); font-weight:600;">${percent}% (${compSec}/${totalSec})</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${percent}%;"></div>
        </div>
      `;
      progressList.appendChild(div);
    });
  } catch (err) {
    console.error('통계 로드 실패:', err);
  }
}

// --- 내 서재 렌더링 ---
function renderLibrary() {
  const grid = document.getElementById('bookGrid');
  grid.innerHTML = '';

  if (state.books.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 4rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.1rem; margin-bottom: 1rem;">등록된 책이 없습니다. 첫 번째 전자책을 만들어보세요!</p>
        <button class="btn btn-primary" onclick="openModal('modalNewBook')">➕ 첫 전자책 기획하기</button>
      </div>
    `;
    return;
  }

  state.books.forEach(book => {
    let totalSec = 0;
    let compSec = 0;
    let totalWords = 0;
    book.chapters?.forEach(c => {
      c.sections?.forEach(s => {
        totalSec++;
        totalWords += (s.content || '').trim().length;
        if (s.status === 'completed' || (s.content && s.content.trim().length > 100)) compSec++;
      });
    });

    const percent = totalSec === 0 ? 0 : Math.round((compSec / totalSec) * 100);

    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-card-cover">
        <span class="book-genre-badge">${getGenreLabel(book.genre)}</span>
        <div class="book-cover-title">${escapeHtml(book.title)}</div>
      </div>
      <div class="book-card-body">
        <p class="book-subtitle">${escapeHtml(book.subtitle || '부제목 없음')}</p>
        <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:0.75rem;">
          저자: ${escapeHtml(book.author || '지은이')} | 글자수: ${totalWords.toLocaleString()}자
        </div>
        <div class="progress-container">
          <div class="progress-info">
            <span>진행률</span>
            <span>${percent}% (${compSec}/${totalSec} 챕터)</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${percent}%;"></div>
          </div>
        </div>
        <div class="book-card-actions">
          <button class="btn btn-primary" onclick="openStudio('${book.id}')">집필 스튜디오 ✍️</button>
          <button class="btn btn-danger" style="flex:0 0 44px; padding:0;" title="삭제" onclick="deleteBook('${book.id}')">🗑️</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// --- 집필 스튜디오 진입 및 렌더링 ---
window.openStudio = function(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;

  state.activeBook = book;
  document.getElementById('studioBookTitle').textContent = book.title;

  // 첫 번째 소목차 선택 기본값
  if (book.chapters && book.chapters.length > 0 && book.chapters[0].sections?.length > 0) {
    state.activeChapterId = book.chapters[0].id;
    state.activeSectionId = book.chapters[0].sections[0].id;
  } else {
    state.activeChapterId = null;
    state.activeSectionId = null;
  }

  renderToc();
  loadCurrentSectionIntoEditor();
  switchView('view-studio');
};

function renderToc() {
  const list = document.getElementById('tocList');
  list.innerHTML = '';

  const book = state.activeBook;
  if (!book || !book.chapters) return;

  let totalSec = 0;
  let compSec = 0;

  book.chapters.forEach(chapter => {
    const chapBlock = document.createElement('div');
    chapBlock.className = 'toc-chapter-block';

    const chapHeader = document.createElement('div');
    chapHeader.className = 'toc-chapter-header';
    chapHeader.innerHTML = `
      <span>${escapeHtml(chapter.title)}</span>
      <button style="background:none; border:none; color:var(--primary); font-size:0.8rem; cursor:pointer;" onclick="event.stopPropagation(); addSection('${chapter.id}')">➕ 소목차</button>
    `;

    const secList = document.createElement('div');
    secList.className = 'toc-section-list';

    chapter.sections?.forEach(sec => {
      totalSec++;
      const isCompleted = sec.status === 'completed' || (sec.content && sec.content.trim().length > 100);
      if (isCompleted) compSec++;

      const secItem = document.createElement('div');
      secItem.className = `toc-section-item ${sec.id === state.activeSectionId ? 'active' : ''}`;
      secItem.innerHTML = `
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(sec.title)}</span>
        <span class="status-badge ${isCompleted ? 'completed' : 'pending'}">
          ${isCompleted ? '완료 ✓' : '대기 ⏳'}
        </span>
      `;

      secItem.addEventListener('click', () => {
        state.activeChapterId = chapter.id;
        state.activeSectionId = sec.id;
        renderToc();
        loadCurrentSectionIntoEditor();
      });

      secList.appendChild(secItem);
    });

    chapBlock.appendChild(chapHeader);
    chapBlock.appendChild(secList);
    list.appendChild(chapBlock);
  });

  const percent = totalSec === 0 ? 0 : Math.round((compSec / totalSec) * 100);
  document.getElementById('studioProgressText').textContent = `${percent}% (${compSec}/${totalSec})`;
  document.getElementById('studioProgressBar').style.width = `${percent}%`;
}

function loadCurrentSectionIntoEditor() {
  const titleInput = document.getElementById('currentSectionTitle');
  const richEditor = document.getElementById('richEditor');
  const wordCount = document.getElementById('currentWordCount');

  const currentSec = getCurrentSection();
  if (!currentSec) {
    titleInput.value = '';
    if (richEditor) richEditor.innerHTML = '';
    wordCount.textContent = '0 자';
    return;
  }

  titleInput.value = currentSec.title || '';
  const content = currentSec.content || '';

  if (richEditor) {
    if (content.trim().startsWith('<') && content.includes('</')) {
      richEditor.innerHTML = content;
    } else if (content.trim().length > 0) {
      richEditor.innerHTML = marked.parse(content);
    } else {
      richEditor.innerHTML = '';
    }
    updateWordCount(richEditor.innerText);
  }

  state.selectedEditorRange = null;
}

function getCurrentSection() {
  if (!state.activeBook || !state.activeSectionId) return null;
  for (const chap of state.activeBook.chapters) {
    const sec = chap.sections?.find(s => s.id === state.activeSectionId);
    if (sec) return sec;
  }
  return null;
}

function updateWordCount(text) {
  const count = (text || '').trim().length;
  document.getElementById('currentWordCount').textContent = count.toLocaleString() + ' 자';
}

// --- 자료 금고 렌더링 ---
function renderVault() {
  const grid = document.getElementById('vaultGrid');
  grid.innerHTML = '';

  const tagFilterBar = document.getElementById('vaultTagFilter');
  const allTags = new Set();
  state.vault.forEach(v => (v.tags || []).forEach(t => allTags.add(t)));

  // 태그 필터 바 구성
  tagFilterBar.innerHTML = `<button class="tag-btn ${state.activeTagFilter === 'ALL' ? 'active' : ''}" onclick="filterVaultTag('ALL')">전체 보기</button>`;
  allTags.forEach(tag => {
    tagFilterBar.innerHTML += `<button class="tag-btn ${state.activeTagFilter === tag ? 'active' : ''}" onclick="filterVaultTag('${tag}')">#${tag}</button>`;
  });

  const filtered = state.activeTagFilter === 'ALL'
    ? state.vault
    : state.vault.filter(v => v.tags?.includes(state.activeTagFilter));

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-dim);">해당 자료가 없습니다.</div>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'vault-card';
    card.innerHTML = `
      <div class="vault-card-title">
        <span>${escapeHtml(item.title)}</span>
        <button style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.9rem;" onclick="deleteVault('${item.id}')">✕</button>
      </div>
      <div class="vault-card-body">${escapeHtml(item.content)}</div>
      <div class="vault-card-tags">
        ${(item.tags || []).map(t => `<span class="vault-tag-chip">#${escapeHtml(t)}</span>`).join('')}
      </div>
    `;
    grid.appendChild(card);
  });
}

window.filterVaultTag = function(tag) {
  state.activeTagFilter = tag;
  renderVault();
};

// --- 이벤트 리스너 세팅 ---
function setupEventListeners() {
  // 내 서재 복귀
  document.getElementById('btnBackToLibrary').addEventListener('click', () => {
    switchView('view-library');
  });

  // 새 책 만들기 모달
  document.getElementById('btnOpenNewBookModal').addEventListener('click', () => {
    openModal('modalNewBook');
  });

  // 새 책 생성 확정
  document.getElementById('btnConfirmCreateBook').addEventListener('click', handleCreateBook);

  // 새 자료 등록 모달
  document.getElementById('btnOpenNewVaultModal').addEventListener('click', () => {
    openModal('modalNewVault');
  });
  document.getElementById('btnConfirmCreateVault').addEventListener('click', handleCreateVault);

  // 리치 에디터 및 AI 교정 패널, 미리보기 모달 초기화
  setupRichEditor();
  setupAiPolishPanel();
  setupHtmlPreviewModal();

  // 소목차 제목 변경 시
  document.getElementById('currentSectionTitle').addEventListener('input', (e) => {
    const sec = getCurrentSection();
    if (sec) sec.title = e.target.value;
    renderToc();
  });

  // 수동 저장 버튼
  document.getElementById('btnSaveSection').addEventListener('click', saveCurrentSection);

  // AI 소목차 집필 버튼
  document.getElementById('btnGenerateSectionAI').addEventListener('click', handleGenerateSectionAI);

  // 자료 금고 연동 모달/토글
  const btnVaultRef = document.getElementById('btnOpenVaultReference');
  if (btnVaultRef) {
    btnVaultRef.addEventListener('click', () => {
      switchView('view-vault');
    });
  }

  // 목차 기획 AI 버튼
  document.getElementById('btnReOutline').addEventListener('click', handleReOutline);

  // 챕터 추가 버튼
  document.getElementById('btnAddChapter').addEventListener('click', handleAddChapter);

  // 내보내기 버튼
  document.getElementById('btnExportBook').addEventListener('click', handleExportBook);

  // 환경 설정 저장 버튼
  document.getElementById('btnSaveConfig').addEventListener('click', handleSaveConfig);
}

// --- 도서 생성 핸들러 ---
async function handleCreateBook() {
  const title = document.getElementById('newBookTitle').value.trim();
  if (!title) return alert('도서 제목을 입력해 주세요.');

  const subtitle = document.getElementById('newBookSubtitle').value.trim();
  const author = document.getElementById('newBookAuthor').value.trim() || '지은이';
  const genre = document.getElementById('newBookGenre').value;
  const targetAudience = document.getElementById('newBookAudience').value.trim();
  const startType = document.getElementById('newBookStartType').value;

  let chapters = [];

  if (startType === 'template') {
    const tpl = state.templates.find(t => t.genre === genre) || state.templates[0];
    if (tpl && tpl.defaultChapters) {
      chapters = tpl.defaultChapters.map((chapTitle, idx) => ({
        id: `chap-${Date.now()}-${idx}`,
        title: chapTitle,
        order: idx + 1,
        summary: `${chapTitle} 내용 요약`,
        sections: [
          {
            id: `sec-${Date.now()}-${idx}-1`,
            title: `${idx + 1}-1. 핵심 실행 가이드`,
            points: '기본 개념 및 실천 방법',
            content: '',
            status: 'pending',
            wordCount: 0
          }
        ]
      }));
    }
  }

  const newBookPayload = {
    title,
    subtitle,
    author,
    genre,
    targetAudience,
    chapters
  };

  try {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBookPayload)
    });
    const createdBook = await res.json();
    closeModal('modalNewBook');
    await loadBooks();
    openStudio(createdBook.id);
  } catch (err) {
    alert('책 생성 실패: ' + err.message);
  }
}

// --- 리치 텍스트 에디터 설정 ---
function setupRichEditor() {
  const richEditor = document.getElementById('richEditor');
  if (!richEditor) return;

  // 본문 입력 시 인메모리 데이터 및 글자 수 업데이트
  richEditor.addEventListener('input', () => {
    const sec = getCurrentSection();
    if (sec) {
      sec.content = richEditor.innerHTML;
      sec.wordCount = richEditor.innerText.trim().length;
    }
    updateWordCount(richEditor.innerText);
  });

  // 선택 영역(Selection) 감지 -> 상태 저장 및 우측 AI 교정 입력창 연동
  const updateSelectionState = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (richEditor.contains(range.commonAncestorContainer)) {
      const selectedText = sel.toString().trim();
      if (selectedText.length > 0) {
        state.selectedEditorRange = range.cloneRange();
        const diffInput = document.getElementById('aiDiffInput');
        if (diffInput && !diffInput.value) {
          diffInput.value = selectedText;
        }
      }
    }
  };

  richEditor.addEventListener('mouseup', updateSelectionState);
  richEditor.addEventListener('keyup', updateSelectionState);

  // 툴바 단락 스타일 (Normal, H1, H2, H3, Blockquote)
  const formatSelect = document.getElementById('toolFormatBlock');
  if (formatSelect) {
    formatSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      document.execCommand('formatBlock', false, val);
      richEditor.focus();
    });
  }

  // 툴바 일반 서식 버튼들
  document.querySelectorAll('.tool-btn[data-command]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.getAttribute('data-command');
      if (cmd === 'blockquote') {
        document.execCommand('formatBlock', false, 'blockquote');
      } else if (cmd === 'code') {
        const sel = window.getSelection();
        if (sel && sel.toString().trim()) {
          document.execCommand('insertHTML', false, `<code>${escapeHtml(sel.toString())}</code>`);
        } else {
          document.execCommand('formatBlock', false, 'pre');
        }
      } else {
        document.execCommand(cmd, false, null);
      }
      richEditor.focus();
    });
  });

  // 글자색 변경
  const foreColorInput = document.getElementById('toolForeColor');
  if (foreColorInput) {
    foreColorInput.addEventListener('input', (e) => {
      document.execCommand('foreColor', false, e.target.value);
      const bar = document.getElementById('fontColorBar');
      if (bar) bar.style.background = e.target.value;
      richEditor.focus();
    });
  }

  // 배경/형광펜 색 변경
  const hiliteColorInput = document.getElementById('toolHiliteColor');
  if (hiliteColorInput) {
    hiliteColorInput.addEventListener('input', (e) => {
      document.execCommand('hiliteColor', false, e.target.value);
      const bar = document.getElementById('bgColorBar');
      if (bar) bar.style.background = e.target.value;
      richEditor.focus();
    });
  }

  // 링크 삽입 버튼
  const btnLink = document.getElementById('toolInsertLink');
  if (btnLink) {
    btnLink.addEventListener('click', () => {
      const url = prompt('삽입할 링크 URL을 입력하세요:', 'https://');
      if (url) {
        document.execCommand('createLink', false, url);
        richEditor.focus();
      }
    });
  }
}

// --- 우측 AI 문장 교정 / 첨삭 스튜디오 패널 설정 ---
function setupAiPolishPanel() {
  // 프리셋 칩 선택 이벤트
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activePolishPreset = chip.getAttribute('data-preset') || 'expand';
    });
  });

  // [선택 영역 가져오기] 버튼
  const btnFetch = document.getElementById('btnFetchSelection');
  if (btnFetch) {
    btnFetch.addEventListener('click', () => {
      const sel = window.getSelection();
      const richEditor = document.getElementById('richEditor');
      if (sel && sel.toString().trim() && richEditor.contains(sel.anchorNode)) {
        state.selectedEditorRange = sel.getRangeAt(0).cloneRange();
        document.getElementById('aiDiffInput').value = sel.toString().trim();
      } else if (state.selectedEditorRange) {
        document.getElementById('aiDiffInput').value = state.selectedEditorRange.toString().trim();
      } else if (richEditor && richEditor.innerText.trim()) {
        document.getElementById('aiDiffInput').value = richEditor.innerText.trim();
      } else {
        alert('에디터에서 교정할 문장을 먼저 마우스로 드래그하여 선택해 주세요.');
      }
    });
  }

  // [수정 전 비우기] 버튼
  const btnClearInput = document.getElementById('btnClearDiffInput');
  if (btnClearInput) {
    btnClearInput.addEventListener('click', () => {
      document.getElementById('aiDiffInput').value = '';
    });
  }

  // [AI 교정 실행] 버튼
  const btnRun = document.getElementById('btnRunAiPolish');
  if (btnRun) {
    btnRun.addEventListener('click', handleRunAiPolish);
  }

  // [수정 후 복사] 버튼
  const btnCopy = document.getElementById('btnCopyDiffOutput');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const text = document.getElementById('aiDiffOutput').value;
      if (!text.trim()) return alert('복사할 교정 결과가 없습니다.');
      navigator.clipboard.writeText(text).then(() => {
        alert('교정 결과가 클립보드에 복사되었습니다.');
      });
    });
  }

  // [수정 후 비우기] 버튼
  const btnClearOutput = document.getElementById('btnClearDiffOutput');
  if (btnClearOutput) {
    btnClearOutput.addEventListener('click', () => {
      document.getElementById('aiDiffOutput').value = '';
    });
  }

  // [본문에 즉시 적용하기] 버튼
  const btnApply = document.getElementById('btnApplyAiDiff');
  if (btnApply) {
    btnApply.addEventListener('click', handleApplyAiDiff);
  }
}

// --- AI 교정 실행 핸들러 ---
async function handleRunAiPolish() {
  const inputEl = document.getElementById('aiDiffInput');
  const text = (inputEl ? inputEl.value : '').trim();
  if (!text) {
    return alert('교정할 원문 텍스트를 입력하거나 본문에서 마우스로 드래그하여 선택해 주세요.');
  }

  const preset = state.activePolishPreset || 'expand';
  const custom = (document.getElementById('aiDiffInstruction')?.value || '').trim();

  let instruction = '';
  if (preset === 'expand') instruction = '내용에 구체적인 근거와 실전 사례, 부연 설명을 풍부하게 덧붙여 살을 붙여주세요.';
  else if (preset === 'clear') instruction = '문맥을 명쾌하고 신뢰감 있는 전문 칼럼니스트 문체로 다듬어주세요.';
  else if (preset === 'grammar') instruction = '맞춤법, 띄어쓰기, 문법적 오류, 어색한 조사 및 오탈자를 정밀하게 교정해 주세요.';
  else if (preset === 'concise') instruction = '군더더기 표현을 과감히 쳐내고 핵심 메시지만 명료하고 직관적으로 요약 정돈해 주세요.';
  else if (preset === 'friendly') instruction = '독자에게 말을 건네듯 친근하고 부드러운 대화체로 윤문해 주세요.';

  if (custom) instruction += `\n[추가 특별 요청]: ${custom}`;

  const btn = document.getElementById('btnRunAiPolish');
  const btnText = document.getElementById('btnRunPolishText');
  const originalHtml = btnText ? btnText.innerHTML : '🚀 AI 교정 실행';

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = '⏳ AI 분석 및 교정 중...';

  try {
    const res = await fetch('/api/generate/polish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        instruction,
        tone: state.activeBook?.tone || 'professional'
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const outputEl = document.getElementById('aiDiffOutput');
    if (outputEl) {
      outputEl.value = data.text;
      outputEl.focus();
    }
  } catch (err) {
    alert('AI 교정 오류: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.innerHTML = originalHtml;
  }
}

// --- 본문에 교정 결과 즉시 적용 핸들러 ---
function handleApplyAiDiff() {
  const outputEl = document.getElementById('aiDiffOutput');
  const polishedText = (outputEl ? outputEl.value : '').trim();
  if (!polishedText) {
    return alert('본문에 적용할 교정 결과가 없습니다. 먼저 AI 교정을 실행해 주세요.');
  }

  const richEditor = document.getElementById('richEditor');
  if (!richEditor) return;

  richEditor.focus();

  // 마크다운이나 일반 텍스트를 에디터용 HTML로 파싱
  const formattedHtml = marked.parse(polishedText).trim();
  let applied = false;

  // 1순위: 이전에 저장된 Selection Range가 있고 여전히 richEditor 내부에 있을 때
  if (state.selectedEditorRange && richEditor.contains(state.selectedEditorRange.commonAncestorContainer)) {
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(state.selectedEditorRange);
      document.execCommand('insertHTML', false, formattedHtml);
      applied = true;
    } catch (e) {
      console.warn('Range insertHTML 실패, 대체 방식 시도', e);
    }
  }

  // 2순위: 원본 텍스트 매칭 치환
  if (!applied) {
    const origText = (document.getElementById('aiDiffInput')?.value || '').trim();
    if (origText && richEditor.innerText.includes(origText)) {
      richEditor.innerHTML = richEditor.innerHTML.replace(origText, formattedHtml);
      applied = true;
    }
  }

  // 3순위: 그 외의 경우 커서 위치 또는 끝에 덧붙이기
  if (!applied) {
    document.execCommand('insertHTML', false, `<br>${formattedHtml}`);
    applied = true;
  }

  // 섹션 인메모리 및 글자 수 업데이트
  const sec = getCurrentSection();
  if (sec) {
    sec.content = richEditor.innerHTML;
    sec.wordCount = richEditor.innerText.trim().length;
  }
  updateWordCount(richEditor.innerText);

  // 선택 영역 초기화
  state.selectedEditorRange = null;

  alert('교정된 내용이 본문에 성공적으로 적용되었습니다! ✨');
}

// --- HTML 전자책 미리보기 모달 설정 ---
function setupHtmlPreviewModal() {
  const btnOpen = document.getElementById('btnOpenHtmlPreview');
  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      const richEditor = document.getElementById('richEditor');
      const sec = getCurrentSection();
      const chap = getChapterOfSection(sec?.id);

      const previewMeta = document.getElementById('htmlPreviewMeta');
      if (previewMeta) {
        previewMeta.innerHTML = `<strong>${chap ? escapeHtml(chap.title) : '전자책 본문'}</strong> · <span>${sec ? escapeHtml(sec.title) : '소목차'}</span>`;
      }

      const previewContent = document.getElementById('htmlPreviewContent');
      if (previewContent) {
        const html = (richEditor && richEditor.innerHTML.trim())
          ? richEditor.innerHTML
          : '<p style="color:#718096; text-align:center; padding: 3rem 0;">작성된 본문 내용이 없습니다. 리치 에디터에서 내용을 작성해 보세요.</p>';
        previewContent.innerHTML = html;
      }

      openModal('modalHtmlPreview');
    });
  }

  const btnPrint = document.getElementById('btnPrintHtmlPreview');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }
}

// --- AI 소목차 집필 핸들러 ---
async function handleGenerateSectionAI() {
  const sec = getCurrentSection();
  if (!sec) return alert('집필할 소목차를 선택해 주세요.');

  const book = state.activeBook;
  const btn = document.getElementById('btnGenerateSectionAI');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ 젬마/AI 집필 중...';

  try {
    const res = await fetch('/api/generate/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: book.id,
        sectionId: sec.id,
        bookTitle: book.title,
        genre: book.genre,
        targetAudience: book.targetAudience,
        chapterTitle: getChapterOfSection(sec.id)?.title || '',
        sectionTitle: sec.title,
        sectionPoints: sec.points || '',
        vaultItemIds: state.selectedVaultIds
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    sec.content = marked.parse(data.content);
    sec.status = 'completed';
    sec.wordCount = data.content.trim().length;

    loadCurrentSectionIntoEditor();
    renderToc();
    alert('소목차 본문 작성이 완료되었습니다!');
  } catch (err) {
    alert('AI 집필 중 오류 발생: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// --- 문장 다듬기 핸들러 (기존 모달 지원) ---
async function handleExecutePolish() {
  const sec = getCurrentSection();
  const richEditor = document.getElementById('richEditor');
  const textToPolish = (richEditor ? richEditor.innerText : (sec?.content || '')).trim();

  if (!textToPolish) {
    return alert('다듬을 본문 내용이 없습니다.');
  }

  const preset = document.getElementById('polishPreset').value;
  const custom = document.getElementById('polishCustomInstruction').value.trim();
  let instruction = '';

  if (preset === 'expand') instruction = '내용에 구체적인 근거와 실전 사례를 풍부하게 덧붙여 살을 붙여주세요.';
  else if (preset === 'clear') instruction = '문맥을 명쾌하고 신뢰감 있는 전문 칼럼니스트 문체로 다듬어주세요.';
  else if (preset === 'concise') instruction = '군더더기 표현을 쳐내고 핵심만 콤팩트하게 다듬어주세요.';
  else if (preset === 'friendly') instruction = '독자에게 말을 건네듯 친근한 대화체로 윤문해주세요.';

  if (custom) instruction += `\n[추가 지침]: ${custom}`;

  const btn = document.getElementById('btnExecutePolish');
  btn.disabled = true;
  btn.innerHTML = '✨ 다듬는 중...';

  try {
    const res = await fetch('/api/generate/polish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToPolish,
        instruction,
        tone: state.activeBook.tone || 'professional'
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    if (richEditor) {
      richEditor.innerHTML = marked.parse(data.text);
      if (sec) {
        sec.content = richEditor.innerHTML;
        sec.wordCount = richEditor.innerText.trim().length;
      }
      updateWordCount(richEditor.innerText);
    }
    closeModal('modalPolish');
    alert('문장 다듬기가 완료되었습니다!');
  } catch (err) {
    alert('다듬기 오류: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ 다듬기 실행';
  }
}

// --- 저장 핸들러 ---
async function saveCurrentSection() {
  const sec = getCurrentSection();
  if (!sec || !state.activeBook) return;

  const richEditor = document.getElementById('richEditor');
  if (richEditor) {
    sec.content = richEditor.innerHTML;
    sec.wordCount = richEditor.innerText.trim().length;
  }

  try {
    await fetch(`/api/books/${state.activeBook.id}/sections/${sec.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: sec.title,
        content: sec.content,
        status: (sec.wordCount && sec.wordCount > 50) ? 'completed' : 'pending'
      })
    });
    renderToc();
    alert('성공적으로 저장되었습니다. 💾');
  } catch (err) {
    alert('저장 실패: ' + err.message);
  }
}

// --- AI 목차 재기획 핸들러 ---
async function handleReOutline() {
  const book = state.activeBook;
  if (!book) return;

  const topic = prompt('어떤 주제와 목차로 다시 기획할까요?', book.title);
  if (!topic) return;

  const btn = document.getElementById('btnReOutline');
  btn.disabled = true;
  btn.innerHTML = '🤖 기획 중...';

  try {
    const res = await fetch('/api/generate/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        genre: book.genre,
        targetAudience: book.targetAudience,
        chapterCount: 4,
        vaultItemIds: state.selectedVaultIds
      })
    });

    const outline = await res.json();
    if (outline.error) throw new Error(outline.error);

    // 도서 목차 갱신
    book.chapters = (outline.chapters || []).map((chap, idx) => ({
      id: `chap-${Date.now()}-${idx}`,
      title: chap.title,
      summary: chap.summary || '',
      order: idx + 1,
      sections: (chap.sections || []).map((s, sIdx) => ({
        id: `sec-${Date.now()}-${idx}-${sIdx}`,
        title: s.title,
        points: s.points || '',
        content: '',
        status: 'pending',
        wordCount: 0
      }))
    }));

    await fetch(`/api/books/${book.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapters: book.chapters })
    });

    renderToc();
    loadCurrentSectionIntoEditor();
    alert('새로운 목차 트리가 성공적으로 생성되었습니다!');
  } catch (err) {
    alert('목차 기획 실패: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🤖 목차 기획';
  }
}

// --- 챕터 및 소목차 추가 ---
function handleAddChapter() {
  const book = state.activeBook;
  if (!book) return;

  const chapNum = (book.chapters?.length || 0) + 1;
  const title = prompt('추가할 새 챕터 제목을 입력하세요:', `제${chapNum}장. 새 챕터`);
  if (!title) return;

  const newChap = {
    id: `chap-${Date.now()}`,
    title,
    order: chapNum,
    summary: '',
    sections: [
      {
        id: `sec-${Date.now()}-1`,
        title: `${chapNum}-1. 첫 번째 소목차`,
        points: '',
        content: '',
        status: 'pending',
        wordCount: 0
      }
    ]
  };

  book.chapters.push(newChap);
  renderToc();
}

window.addSection = function(chapId) {
  const book = state.activeBook;
  const chap = book?.chapters?.find(c => c.id === chapId);
  if (!chap) return;

  const secNum = (chap.sections?.length || 0) + 1;
  const title = prompt('추가할 소목차 제목을 입력하세요:', `소목차 ${secNum}`);
  if (!title) return;

  const newSec = {
    id: `sec-${Date.now()}`,
    title,
    order: secNum,
    points: '',
    content: '',
    status: 'pending',
    wordCount: 0
  };

  chap.sections.push(newSec);
  renderToc();
};

// --- 도서 전체 내보내기 (PDF / 인쇄) ---
function handleExportBook() {
  const book = state.activeBook;
  if (!book) return;

  let fullBookMarkdown = `
# ${book.title}
### ${book.subtitle || ''}

**저자**: ${book.author || '지은이'}  
**발행일**: ${new Date().toLocaleDateString('ko-KR')}

---

## [ 목차 ]
`;

  book.chapters?.forEach(chap => {
    fullBookMarkdown += `\n- **${chap.title}**`;
    chap.sections?.forEach(sec => {
      fullBookMarkdown += `\n  - ${sec.title}`;
    });
  });

  fullBookMarkdown += '\n\n---\n';

  book.chapters?.forEach(chap => {
    fullBookMarkdown += `\n\n# ${chap.title}\n`;
    if (chap.summary) fullBookMarkdown += `*${chap.summary}*\n\n`;

    chap.sections?.forEach(sec => {
      fullBookMarkdown += `\n\n${sec.content || `### ${sec.title}\n*(내용 작성 대기중)*`}\n`;
    });
  });

  document.getElementById('exportBookPreview').innerHTML = marked.parse(fullBookMarkdown);
  openModal('modalExport');
}

// --- 자료 금고 생성 및 삭제 ---
async function handleCreateVault() {
  const title = document.getElementById('newVaultTitle').value.trim();
  const content = document.getElementById('newVaultContent').value.trim();
  if (!title || !content) return alert('제목과 내용을 모두 입력해 주세요.');

  const tagsRaw = document.getElementById('newVaultTags').value;
  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  try {
    await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, tags })
    });
    closeModal('modalNewVault');
    document.getElementById('newVaultTitle').value = '';
    document.getElementById('newVaultContent').value = '';
    document.getElementById('newVaultTags').value = '';
    await loadVault();
  } catch (err) {
    alert('자료 등록 실패: ' + err.message);
  }
}

window.deleteVault = async function(id) {
  if (!confirm('이 자료를 삭제하시겠습니까?')) return;
  await fetch(`/api/vault/${id}`, { method: 'DELETE' });
  await loadVault();
};

window.deleteBook = async function(id) {
  if (!confirm('정말 이 책을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
  await fetch(`/api/books/${id}`, { method: 'DELETE' });
  await loadBooks();
};

// --- 설정 저장 ---
async function handleSaveConfig() {
  const newConfig = {
    selectedProvider: document.getElementById('cfgSelectedProvider').value,
    geminiApiKey: document.getElementById('cfgGeminiKey').value.trim(),
    ollamaUrl: document.getElementById('cfgOllamaUrl').value.trim(),
    ollamaModel: document.getElementById('cfgOllamaModel').value.trim(),
    openaiApiKey: document.getElementById('cfgOpenAiKey').value.trim(),
    anthropicApiKey: document.getElementById('cfgAnthropicKey').value.trim()
  };

  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    alert('설정이 성공적으로 저장되었습니다!');
  } catch (err) {
    alert('설정 저장 실패: ' + err.message);
  }
}

// --- 유틸리티 ---
function getChapterOfSection(sectionId) {
  if (!state.activeBook) return null;
  for (const chap of state.activeBook.chapters) {
    if (chap.sections?.some(s => s.id === sectionId)) return chap;
  }
  return null;
}

function getGenreLabel(genre) {
  if (genre === 'practical') return '실용 가이드북';
  if (genre === 'essay') return '에세이 / 수필';
  if (genre === 'manual') return '업무 매뉴얼';
  return '일반 도서';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

window.openModal = function(modalId) {
  document.getElementById(modalId).classList.add('active');
};

window.closeModal = function(modalId) {
  document.getElementById(modalId).classList.remove('active');
};
