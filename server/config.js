import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_CONFIG = {
  notionToken: '',
  wardrobePageId: '',
  city: '',
  preferredStyles: [],
  excludeItems: [],
  aiEngine: 'claude',
  schedule: '0 8 * * *',
  outputPageId: null,
  outfitCount: 3,
};

export function getDataDir() {
  return process.platform === 'win32'
    ? join(process.env.APPDATA || homedir(), 'wardrobeai')
    : join(homedir(), '.wardrobeai');
}

export function getDefaultConfigPath() {
  return join(getDataDir(), 'config.json');
}

export function loadConfig(configPath = getDefaultConfigPath()) {
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(data, configPath = getDefaultConfigPath()) {
  const dir = dirname(configPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
}
