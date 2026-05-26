#!/usr/bin/env node
// 소개 페이지의 "추천 결과" 안내 콜아웃을 실제 결과 스크린샷 이미지로 교체한다.
// 일회용: 콜아웃 뒤에 이미지를 삽입하고 콜아웃을 삭제한다.
// 사용: node scripts/insert-result-screenshot.mjs

import { Client } from '@notionhq/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../server/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const notion = new Client({ auth: config.notionToken });

const CALLOUT_ID = '36c70798-acca-81c8-b553-d1bd1ee60728'; // "추천 결과가 노션에 작성된 화면" 콜아웃
const IMG_PATH = join(__dirname, '..', 'wardrobe-result.png');
const CAPTION = '실제 추천 결과 페이지 — 코디 3세트와 보강 아이템 추천';

async function uploadLocalImage(filePath) {
  const buf = readFileSync(filePath);
  const initRes = await fetch('https://api.notion.com/v1/file_uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'result.png', content_type: 'image/png' }),
  });
  if (!initRes.ok) throw new Error(`init 실패: ${initRes.status}`);
  const { id, upload_url } = await initRes.json();
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'image/png' }), 'result.png');
  const up = await fetch(upload_url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.notionToken}`, 'Notion-Version': '2022-06-28' },
    body: fd,
  });
  if (!up.ok) throw new Error(`업로드 실패: ${up.status}`);
  return id;
}

// 콜아웃이 속한 부모 페이지 ID 조회
const callout = await notion.blocks.retrieve({ block_id: CALLOUT_ID });
const parentId = callout.parent?.page_id || callout.parent?.block_id;
if (!parentId) throw new Error('부모 ID를 찾을 수 없습니다.');

console.log('이미지 업로드 중...');
const fileUploadId = await uploadLocalImage(IMG_PATH);

console.log('콜아웃 뒤에 이미지 삽입 중...');
await notion.blocks.children.append({
  block_id: parentId,
  after: CALLOUT_ID,
  children: [{
    type: 'image',
    image: { type: 'file_upload', file_upload: { id: fileUploadId }, caption: [{ type: 'text', text: { content: CAPTION } }] },
  }],
});

console.log('안내 콜아웃 삭제 중...');
await notion.blocks.delete({ block_id: CALLOUT_ID });

console.log('완료 — 추천 결과 스크린샷이 삽입되었습니다.');
