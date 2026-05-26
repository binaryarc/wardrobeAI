#!/usr/bin/env node
// 소개 페이지의 특정 "스크린샷 안내" 콜아웃을 실제 이미지로 교체한다.
// 콜아웃 뒤에 이미지를 삽입하고 콜아웃을 삭제한다.
// 사용: node scripts/insert-screenshot.mjs <calloutId> <imagePath(루트 기준)> "<caption>"

import { Client } from '@notionhq/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { loadConfig } from '../server/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const notion = new Client({ auth: config.notionToken });

const [calloutId, imageRel, caption = ''] = process.argv.slice(2);
if (!calloutId || !imageRel) {
  console.error('사용: node scripts/insert-screenshot.mjs <calloutId> <imagePath> "<caption>"');
  process.exit(1);
}
const imgPath = join(__dirname, '..', imageRel);

async function uploadLocalImage(filePath) {
  const buf = readFileSync(filePath);
  const name = basename(filePath);
  const initRes = await fetch('https://api.notion.com/v1/file_uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, content_type: 'image/png' }),
  });
  if (!initRes.ok) throw new Error(`init 실패: ${initRes.status}`);
  const { id, upload_url } = await initRes.json();
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'image/png' }), name);
  const up = await fetch(upload_url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.notionToken}`, 'Notion-Version': '2022-06-28' },
    body: fd,
  });
  if (!up.ok) throw new Error(`업로드 실패: ${up.status}`);
  return id;
}

const callout = await notion.blocks.retrieve({ block_id: calloutId });
const parentId = callout.parent?.page_id || callout.parent?.block_id;
if (!parentId) throw new Error('부모 ID를 찾을 수 없습니다.');

console.log('이미지 업로드 중...');
const fileUploadId = await uploadLocalImage(imgPath);

console.log('콜아웃 뒤에 이미지 삽입 중...');
await notion.blocks.children.append({
  block_id: parentId,
  after: calloutId,
  children: [{
    type: 'image',
    image: { type: 'file_upload', file_upload: { id: fileUploadId }, caption: caption ? [{ type: 'text', text: { content: caption } }] : [] },
  }],
});

console.log('안내 콜아웃 삭제 중...');
await notion.blocks.delete({ block_id: calloutId });

console.log('완료 — 스크린샷이 삽입되었습니다.');
