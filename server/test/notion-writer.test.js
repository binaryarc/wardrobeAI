import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildOutfitBlocks, buildShoppingBlocks } from '../notion/writer.js';

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

test('buildOutfitBlocks includes image blocks for each fileUploadId passed', () => {
  const fileUploadIds = [
    { fileUploadId: 'upload-id-shirt', label: '상의 — 화이트 린넨 셔츠' },
    { fileUploadId: 'upload-id-shoes', label: '신발 — 화이트 스니커즈' },
  ];
  const blocks = buildOutfitBlocks(sampleOutfit, sampleItems, sampleWeather, 1, fileUploadIds);
  const images = blocks.filter(b => b.type === 'image');
  assert.equal(images.length, 2);
  assert.equal(images[0].image.file_upload.id, 'upload-id-shirt');
  assert.equal(images[1].image.file_upload.id, 'upload-id-shoes');
});

test('buildOutfitBlocks has no image blocks when fileUploadIds is empty', () => {
  const blocks = buildOutfitBlocks(sampleOutfit, sampleItems, sampleWeather, 1, []);
  const images = blocks.filter(b => b.type === 'image');
  assert.equal(images.length, 0);
});

test('buildShoppingBlocks returns empty for empty input', () => {
  assert.deepEqual(buildShoppingBlocks([]), []);
  assert.deepEqual(buildShoppingBlocks(undefined), []);
});

test('buildShoppingBlocks returns header + callout per item', () => {
  const shopping = [
    { name: '차콜 슬랙스', category: '하의', reason: '세미포멀 보강' },
    { name: '베이지 자켓', category: '아우터', reason: '쌀쌀한 날 대비' },
  ];
  const blocks = buildShoppingBlocks(shopping);
  const callouts = blocks.filter(b => b.type === 'callout');
  const headings = blocks.filter(b => b.type === 'heading_2');
  assert.equal(callouts.length, 2);
  assert.equal(headings.length, 1);
  const text = callouts[0].callout.rich_text.map(t => t.text.content).join('');
  assert.match(text, /차콜 슬랙스/);
  assert.match(text, /세미포멀/);
});
