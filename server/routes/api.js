import { Router } from 'express';
import { execFile } from 'node:child_process';
import open from 'open';
import { loadConfig, saveConfig } from '../config.js';
import { runRecommendation } from '../engine.js';
import { startScheduler } from '../scheduler.js';
import { cleanupTmpImages } from '../analyzer.js';
import cron from 'node-cron';

const router = Router();
const state = {
  lastRun: null,
  logs: [],
  running: false,
  progress: null,   // 현재 진행 상황
};

// SSE 구독자 목록
const sseClients = new Set();

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch {}
  }
}

function addLog(level, message) {
  state.logs.unshift({ level, message, time: new Date().toISOString() });
  if (state.logs.length > 20) state.logs.pop();
  broadcast({ type: 'log', level, message });
}

async function executeRecommendation({ openResult = false } = {}) {
  if (state.running) return;
  state.running = true;
  state.progress = null;
  broadcast({ type: 'status', running: true });
  addLog('info', '추천 시작...');

  try {
    const config = loadConfig();
    const result = await runRecommendation(config, {}, (p) => {
      state.progress = p;
      broadcast({ type: 'progress', ...p });
    });
    state.lastRun = new Date().toISOString();
    addLog('success', `추천 완료 — 코디 ${result.outfits.length}세트 노션에 작성됨`);

    if (openResult && result.newOutputPageId) {
      const pageUrl = `https://www.notion.so/${result.newOutputPageId.replace(/-/g, '')}`;
      open(pageUrl).catch(() => addLog('info', `브라우저에서 열기: ${pageUrl}`));
    }
  } catch (err) {
    addLog('error', err.message);
  } finally {
    state.running = false;
    state.progress = null;
    broadcast({ type: 'status', running: false });
  }
}

// SSE 스트림
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // 현재 상태 즉시 전송
  res.write(`data: ${JSON.stringify({ type: 'init', running: state.running, progress: state.progress })}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

router.get('/status', (req, res) => {
  const config = loadConfig();
  res.json({
    configured: !!(config.notionToken && config.wardrobePageId && config.city),
    lastRun: state.lastRun,
    schedule: config.schedule,
    running: state.running,
    progress: state.progress,
  });
});

router.get('/logs', (req, res) => res.json(state.logs));

router.get('/config', (req, res) => {
  const config = loadConfig();
  res.json({ ...config, notionToken: config.notionToken ? '***' : '' });
});

router.post('/config', (req, res) => {
  const current = loadConfig();
  const sanitized = Object.fromEntries(
    Object.entries(req.body).filter(([, v]) => v !== '***')
  );
  const updated = { ...current, ...sanitized };
  if (updated.schedule) {
    try {
      startScheduler(updated.schedule, executeRecommendation);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  saveConfig(updated);
  res.json({ ok: true });
});

router.post('/run', async (req, res) => {
  res.json({ ok: true, message: '추천 실행 시작' });
  executeRecommendation({ openResult: true });
});

router.get('/check-ai', (req, res) => {
  const { engine } = req.query;
  if (!['claude', 'codex'].includes(engine)) {
    return res.status(400).json({ ok: false, error: 'invalid engine' });
  }
  execFile('which', [engine], { timeout: 3000 }, (whichErr) => {
    if (whichErr) return res.json({ ok: false, reason: 'not_installed' });
    const args = ['--version'];
    execFile(engine, args, { timeout: 5000 }, (runErr, stdout) => {
      if (runErr) return res.json({ ok: false, reason: 'not_logged_in' });
      res.json({ ok: true, version: stdout.trim().split('\n')[0] });
    });
  });
});

// 매시간 임시 이미지 정리
cron.schedule('0 * * * *', cleanupTmpImages);

export { router, executeRecommendation };
