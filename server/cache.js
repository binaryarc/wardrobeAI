import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getDataDir } from './config.js';

function getDefaultCachePath() {
  return join(getDataDir(), 'items-cache.json');
}

export function loadCache(cachePath = getDefaultCachePath()) {
  if (!existsSync(cachePath)) return {};
  try {
    return JSON.parse(readFileSync(cachePath, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveCache(cache, cachePath = getDefaultCachePath()) {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

// Notion S3 이미지 URL은 만료 토큰이 붙어 매번 바뀌므로 query string 제거 후 path로 키 생성
export function cacheKey(imageUrl) {
  if (!imageUrl) return '';
  try {
    const u = new URL(imageUrl);
    return `${u.origin}${u.pathname}`;
  } catch {
    return imageUrl;
  }
}
