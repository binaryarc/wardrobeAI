import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractTextFromBlock, extractImageUrl, parseShortCaption, parseFreeformCaption } from '../notion/reader.js';

test('extractTextFromBlock returns text from paragraph', () => {
  const block = {
    type: 'paragraph',
    paragraph: { rich_text: [{ plain_text: '화이트 셔츠 상의' }] },
  };
  assert.equal(extractTextFromBlock(block), '화이트 셔츠 상의');
});

test('extractTextFromBlock returns empty string for image block', () => {
  const block = { type: 'image', image: { type: 'external', external: { url: 'https://example.com/img.jpg' } } };
  assert.equal(extractTextFromBlock(block), '');
});

test('extractImageUrl returns external image url', () => {
  const block = { type: 'image', image: { type: 'external', external: { url: 'https://example.com/img.jpg' } } };
  assert.equal(extractImageUrl(block), 'https://example.com/img.jpg');
});

test('extractImageUrl returns file image url', () => {
  const block = { type: 'image', image: { type: 'file', file: { url: 'https://s3.notion.so/abc.jpg' } } };
  assert.equal(extractImageUrl(block), 'https://s3.notion.so/abc.jpg');
});

test('extractImageUrl returns null for non-image block', () => {
  const block = { type: 'paragraph', paragraph: { rich_text: [] } };
  assert.equal(extractImageUrl(block), null);
});

test('parseShortCaption parses new format', () => {
  const r = parseShortCaption('화이트 오버핏 반팔 티셔츠 · 상의 · 미니멀');
  assert.equal(r.name, '화이트 오버핏 반팔 티셔츠');
  assert.equal(r.category, '상의');
  assert.equal(r.style, '미니멀');
});

test('parseShortCaption returns null when no separator', () => {
  assert.equal(parseShortCaption('그냥 평범한 텍스트'), null);
  assert.equal(parseShortCaption(''), null);
});

test('parseFreeformCaption splits name and category by category-name keyword', () => {
  const r = parseFreeformCaption('디자이너 워시드 데님 캐주얼 하의 와이드핏 빈티지');
  assert.equal(r.category, '하의');
  assert.match(r.name, /디자이너/);
  assert.ok(r.tags.includes('와이드핏'));
  assert.ok(r.tags.includes('빈티지'));
});

test('parseFreeformCaption falls back to keyword detection when no explicit category name', () => {
  const r = parseFreeformCaption('블랙 슬림 데님 베이직 데일리');
  assert.equal(r.category, '하의');
  assert.ok(r.tags.length > 0);
});

test('parseFreeformCaption returns 기타 when no category clue', () => {
  const r = parseFreeformCaption('무언가 알 수 없는 단어들');
  assert.equal(r.category, '기타');
});
