import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildOutfitBlocks } from '../notion/writer.js';

const sampleOutfit = {
  top: '화이트 린넨 셔츠',
  bottom: '슬림 블랙 팬츠',
  shoes: '화이트 스니커즈',
  comment: '미니멀 캐주얼 — 출근·약속 모두 OK',
};

const sampleWeather = { temperature: 22, condition: '맑음', precipitationProbability: 10 };

const sampleItems = [
  { name: '화이트 린넨 셔츠', imageUrl: 'https://example.com/shirt.jpg' },
  { name: '슬림 블랙 팬츠', imageUrl: '' },
  { name: '화이트 스니커즈', imageUrl: '' },
];

test('buildOutfitBlocks returns array of blocks', () => {
  const blocks = buildOutfitBlocks(sampleOutfit, sampleItems, sampleWeather, 1);
  assert.ok(Array.isArray(blocks));
  assert.ok(blocks.length > 0);
});

test('buildOutfitBlocks includes callout block with comment', () => {
  const blocks = buildOutfitBlocks(sampleOutfit, sampleItems, sampleWeather, 1);
  const callout = blocks.find(b => b.type === 'callout');
  assert.ok(callout);
  const text = callout.callout.rich_text.map(t => t.text.content).join('');
  assert.match(text, /미니멀 캐주얼/);
});

test('buildOutfitBlocks includes image block when imageUrl present', () => {
  const blocks = buildOutfitBlocks(sampleOutfit, sampleItems, sampleWeather, 1);
  const image = blocks.find(b => b.type === 'image');
  assert.ok(image);
  assert.equal(image.image.external.url, 'https://example.com/shirt.jpg');
});
