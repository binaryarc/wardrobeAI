import { Router } from 'express';
import { loadConfig, saveConfig } from '../config.js';
import { runRecommendation } from '../engine.js';
import { startScheduler } from '../scheduler.js';

const router = Router();
const state = { lastRun: null, nextSchedule: null, logs: [], running: false };

function addLog(level, message) {
  state.logs.unshift({ level, message, time: new Date().toISOString() });
  if (state.logs.length > 10) state.logs.pop();
}

async function executeRecommendation() {
  if (state.running) return;
  state.running = true;
  addLog('info', '추천 시작...');
  try {
    const config = loadConfig();
    const result = await runRecommendation(config);
    if (result.newOutputPageId && result.newOutputPageId !== config.outputPageId) {
      saveConfig({ ...config, outputPageId: result.newOutputPageId });
    }
    state.lastRun = new Date().toISOString();
    addLog('success', `추천 완료 — 코디 ${result.outfits.length}세트 노션에 작성됨`);
  } catch (err) {
    addLog('error', err.message);
  } finally {
    state.running = false;
  }
}

router.get('/status', (req, res) => {
  const config = loadConfig();
  res.json({
    configured: !!(config.notionToken && config.wardrobePageId && config.city),
    lastRun: state.lastRun,
    schedule: config.schedule,
    running: state.running,
  });
});

router.get('/logs', (req, res) => res.json(state.logs));

router.get('/config', (req, res) => {
  const config = loadConfig();
  res.json({ ...config, notionToken: config.notionToken ? '***' : '' });
});

router.post('/config', (req, res) => {
  const current = loadConfig();
  const updated = { ...current, ...req.body };
  saveConfig(updated);
  if (updated.schedule) {
    try {
      startScheduler(updated.schedule, executeRecommendation);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  res.json({ ok: true });
});

router.post('/run', async (req, res) => {
  res.json({ ok: true, message: '추천 실행 시작' });
  executeRecommendation();
});

export { router, executeRecommendation, startScheduler };
