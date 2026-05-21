import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tmpDir = join(tmpdir(), 'wardrobeai-test-' + Date.now());

before(() => mkdirSync(tmpDir, { recursive: true }));
after(() => rmSync(tmpDir, { recursive: true, force: true }));

test('loadConfig returns defaults when file missing', async () => {
  const { loadConfig } = await import('../config.js');
  const cfg = loadConfig(join(tmpDir, 'nonexistent', 'config.json'));
  assert.equal(cfg.aiEngine, 'claude');
  assert.equal(cfg.schedule, '0 8 * * *');
  assert.equal(cfg.outputPageId, null);
});

test('saveConfig writes and loadConfig reads back', async () => {
  const { loadConfig, saveConfig } = await import('../config.js');
  const path = join(tmpDir, 'config.json');
  const data = {
    notionToken: 'secret_test',
    wardrobePageId: 'abc123',
    city: 'Seoul',
    preferredStyles: ['미니멀'],
    excludeItems: [],
    aiEngine: 'claude',
    schedule: '0 9 * * *',
    outputPageId: null,
  };
  saveConfig(data, path);
  const loaded = loadConfig(path);
  assert.equal(loaded.notionToken, 'secret_test');
  assert.equal(loaded.city, 'Seoul');
  assert.deepEqual(loaded.preferredStyles, ['미니멀']);
});
