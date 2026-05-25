#!/usr/bin/env node
import express from 'express';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import open from 'open';
import { router, executeRecommendation } from './routes/api.js';
import { startScheduler } from './scheduler.js';
import { loadConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const distPath = join(__dirname, '..', 'dashboard', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.use('/api', router);

app.get('*', (req, res) => {
  if (existsSync(join(distPath, 'index.html'))) {
    res.sendFile(join(distPath, 'index.html'));
  } else {
    res.send('<h1>wardrobeAI</h1><p>Run <code>npm run build:dashboard</code> to build the UI.</p>');
  }
});

const PORT = process.env.PORT || 3847;
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`wardrobeAI running at ${url}`);
  open(url).catch(() => console.log(`Open ${url} in your browser`));

  const config = loadConfig();
  if (config.schedule && config.notionToken) {
    try {
      startScheduler(config.schedule, executeRecommendation);
      console.log(`Scheduler active: ${config.schedule}`);
    } catch (e) {
      console.error('Scheduler error:', e.message);
    }
  }
});
