#!/usr/bin/env node
// 노션 옷장 페이지의 모든 이미지 캡션을 비워서 다음 추천 실행 시 새 형식으로 재분석되게 합니다.
// 사용: node scripts/reset-captions.mjs

import { Client } from '@notionhq/client';
import { loadConfig } from '../server/config.js';

const config = loadConfig();
if (!config.notionToken || !config.wardrobePageId) {
  console.error('config.json에 notionToken과 wardrobePageId가 필요합니다.');
  process.exit(1);
}

const notion = new Client({ auth: config.notionToken });

async function flatten(blocks) {
  const result = [];
  for (const b of blocks) {
    if (b.type === 'column_list' || b.type === 'column') {
      const ch = await notion.blocks.children.list({ block_id: b.id, page_size: 100 });
      result.push(...await flatten(ch.results));
    } else {
      result.push(b);
    }
  }
  return result;
}

const res = await notion.blocks.children.list({ block_id: config.wardrobePageId, page_size: 100 });
const flat = await flatten(res.results);
const images = flat.filter(b => b.type === 'image');

console.log(`이미지 블록 ${images.length}개 발견. 캡션 초기화 시작...`);

let cleared = 0;
for (const img of images) {
  const current = (img.image?.caption ?? []).map(t => t.plain_text).join('').trim();
  if (!current) continue;
  try {
    await notion.blocks.update({
      block_id: img.id,
      image: { caption: [] },
    });
    cleared++;
    console.log(`  [${cleared}] cleared: "${current.slice(0, 60)}"`);
  } catch (e) {
    console.error(`  실패 (${img.id}): ${e.message}`);
  }
}

console.log(`\n완료: ${cleared}개 캡션 초기화. 다음 추천 실행 시 자동으로 재분석됩니다.`);
