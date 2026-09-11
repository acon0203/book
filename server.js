import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import {
  generateBookOutline,
  generateSectionContent,
  polishContent
} from './services/aiService.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const configPath = path.resolve('config.json');
const dbPath = path.resolve('database.json');

// --- DB & Config Helpers ---
async function getConfig() {
  try {
    const data = await fs.readFile(configPath, 'utf8');
    const cfg = JSON.parse(data);
    // .env 병합 (비어있을 경우)
    if (!cfg.geminiApiKey) cfg.geminiApiKey = process.env.GEMINI_API_KEY || '';
    if (!cfg.openaiApiKey) cfg.openaiApiKey = process.env.OPENAI_API_KEY || '';
    if (!cfg.anthropicApiKey) cfg.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
    return cfg;
  } catch (err) {
    return {
      selectedProvider: 'gemini',
      selectedModel: 'gemini-1.5-flash',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'gemma2:9b',
      defaultTone: 'professional',
      defaultLength: 'detailed'
    };
  }
}

async function saveConfig(cfg) {
  await fs.writeFile(configPath, JSON.stringify(cfg, null, 2), 'utf8');
}

async function getDb() {
  try {
    const data = await fs.readFile(dbPath, 'utf8');
    const db = JSON.parse(data);
    if (!db.books) db.books = [];
    if (!db.vault) db.vault = [];
    if (!db.templates) db.templates = [];
    if (!db.stats) db.stats = { totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 };
    return db;
  } catch (err) {
    const defaultDb = { books: [], vault: [], templates: [], stats: { totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 } };
    await saveDb(defaultDb);
    return defaultDb;
  }
}

async function saveDb(db) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

// --- 1. 설정 API ---
app.get('/api/config', async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    await saveConfig(req.body);
    res.json({ success: true, message: '설정이 성공적으로 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. 도서 프로젝트(Books) API ---
app.get('/api/books', async (req, res) => {
  try {
    const db = await getDb();
    res.json(db.books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const db = await getDb();
    const book = db.books.find(b => b.id === req.params.id);
    if (!book) return res.status(404).json({ error: '책을 찾을 수 없습니다.' });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books', async (req, res) => {
  try {
    const db = await getDb();
    const newBook = {
      id: `book-${Date.now()}`,
      title: req.body.title || '제목 없는 책',
      subtitle: req.body.subtitle || '',
      author: req.body.author || '지은이',
      genre: req.body.genre || 'practical',
      targetAudience: req.body.targetAudience || '',
      tone: req.body.tone || 'professional',
      coverStyle: req.body.coverStyle || 'modern-cyan',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: req.body.chapters || []
    };
    db.books.unshift(newBook);
    await saveDb(db);
    res.json(newBook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    const db = await getDb();
    const index = db.books.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: '책을 찾을 수 없습니다.' });
    
    db.books[index] = {
      ...db.books[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    await saveDb(db);
    res.json(db.books[index]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.books = db.books.filter(b => b.id !== req.params.id);
    await saveDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 특정 챕터/소목차 본문 저장 전용 API
app.put('/api/books/:id/sections/:sectionId', async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const { content, title, status } = req.body;
    const db = await getDb();
    const book = db.books.find(b => b.id === id);
    if (!book) return res.status(404).json({ error: '책을 찾을 수 없습니다.' });

    let targetSection = null;
    for (const chap of book.chapters) {
      const sec = chap.sections?.find(s => s.id === sectionId);
      if (sec) {
        targetSection = sec;
        break;
      }
    }

    if (!targetSection) return res.status(404).json({ error: '소목차를 찾을 수 없습니다.' });

    if (content !== undefined) {
      targetSection.content = content;
      targetSection.wordCount = content.trim().length;
    }
    if (title !== undefined) targetSection.title = title;
    if (status !== undefined) targetSection.status = status;

    book.updatedAt = new Date().toISOString();
    await saveDb(db);
    res.json({ success: true, section: targetSection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 3. 자료 금고(Vault) API ---
app.get('/api/vault', async (req, res) => {
  try {
    const db = await getDb();
    res.json(db.vault);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vault', async (req, res) => {
  try {
    const db = await getDb();
    const item = {
      id: `vault-${Date.now()}`,
      title: req.body.title || '새 자료',
      type: req.body.type || 'memo',
      content: req.body.content || '',
      tags: req.body.tags || [],
      createdAt: new Date().toISOString()
    };
    db.vault.unshift(item);
    await saveDb(db);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vault/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.vault = db.vault.filter(v => v.id !== req.params.id);
    await saveDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 4. 템플릿(Templates) API ---
app.get('/api/templates', async (req, res) => {
  try {
    const db = await getDb();
    res.json(db.templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const db = await getDb();
    const newTpl = {
      id: `tpl-${Date.now()}`,
      name: req.body.name || '커스텀 템플릿',
      genre: req.body.genre || 'custom',
      description: req.body.description || '',
      defaultChapters: req.body.defaultChapters || []
    };
    db.templates.push(newTpl);
    await saveDb(db);
    res.json(newTpl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 5. 통계 API ---
app.get('/api/stats', async (req, res) => {
  try {
    const db = await getDb();
    let totalWords = 0;
    let totalSections = 0;
    let completedSections = 0;

    db.books.forEach(b => {
      b.chapters?.forEach(c => {
        c.sections?.forEach(s => {
          totalSections++;
          totalWords += (s.content || '').trim().length;
          if (s.status === 'completed' || (s.content && s.content.trim().length > 100)) {
            completedSections++;
          }
        });
      });
    });

    res.json({
      bookCount: db.books.length,
      vaultCount: db.vault.length,
      totalWords,
      totalSections,
      completedSections,
      aiGenerationsCount: db.stats?.aiGenerationsCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 6. AI 생성 API 파이프라인 ---

// 목차 기획
app.post('/api/generate/outline', async (req, res) => {
  try {
    const config = await getConfig();
    const { topic, genre, targetAudience, chapterCount, tone, vaultItemIds } = req.body;

    let vaultReferences = '';
    if (vaultItemIds && vaultItemIds.length > 0) {
      const db = await getDb();
      const selectedItems = db.vault.filter(v => vaultItemIds.includes(v.id));
      vaultReferences = selectedItems.map(v => `[${v.title}]: ${v.content}`).join('\n\n');
    }

    const outline = await generateBookOutline({
      topic,
      genre,
      targetAudience,
      chapterCount: chapterCount || 4,
      tone: tone || config.defaultTone || 'professional',
      vaultReferences,
      config
    });

    // DB 통계 갱신
    const db = await getDb();
    db.stats.aiGenerationsCount = (db.stats.aiGenerationsCount || 0) + 1;
    await saveDb(db);

    res.json(outline);
  } catch (err) {
    console.error('목차 생성 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 소목차 본문 집필
app.post('/api/generate/section', async (req, res) => {
  try {
    const config = await getConfig();
    const {
      bookId,
      chapterId,
      sectionId,
      bookTitle,
      genre,
      targetAudience,
      chapterTitle,
      chapterSummary,
      sectionTitle,
      sectionPoints,
      previousContext,
      vaultItemIds,
      tone,
      detailLevel
    } = req.body;

    let vaultReferences = '';
    if (vaultItemIds && vaultItemIds.length > 0) {
      const db = await getDb();
      const selectedItems = db.vault.filter(v => vaultItemIds.includes(v.id));
      vaultReferences = selectedItems.map(v => `[${v.title}]: ${v.content}`).join('\n\n');
    }

    const content = await generateSectionContent({
      bookTitle,
      genre,
      targetAudience,
      chapterTitle,
      chapterSummary,
      sectionTitle,
      sectionPoints,
      previousContext,
      vaultReferences,
      tone: tone || config.defaultTone || 'professional',
      detailLevel: detailLevel || config.defaultLength || 'detailed',
      config
    });

    // 해당 도서 및 섹션 업데이트 (bookId & sectionId 제공 시)
    if (bookId && sectionId) {
      const db = await getDb();
      const book = db.books.find(b => b.id === bookId);
      if (book) {
        for (const chap of book.chapters) {
          const sec = chap.sections?.find(s => s.id === sectionId);
          if (sec) {
            sec.content = content;
            sec.wordCount = content.trim().length;
            sec.status = 'completed';
            break;
          }
        }
        book.updatedAt = new Date().toISOString();
        db.stats.aiGenerationsCount = (db.stats.aiGenerationsCount || 0) + 1;
        await saveDb(db);
      }
    }

    res.json({ content });
  } catch (err) {
    console.error('본문 집필 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 문장 다듬기 및 살 붙이기
app.post('/api/generate/polish', async (req, res) => {
  try {
    const config = await getConfig();
    const { text, instruction, tone } = req.body;

    const polished = await polishContent({
      text,
      instruction: instruction || '문맥을 정돈하고 표현을 더 풍부하고 명료하게 다듬어주세요.',
      tone: tone || config.defaultTone || 'professional',
      config
    });

    res.json({ text: polished });
  } catch (err) {
    console.error('다듬기 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`[Book Studio] 전자책 제작 스튜디오 서버가 포트 ${port}에서 실행 중입니다.`);
  console.log(`브라우저에서 접속: http://localhost:${port}`);
});
