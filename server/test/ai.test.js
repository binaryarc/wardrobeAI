import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseOutfitsFromOutput, parseShoppingFromOutput, extractJSON } from '../ai.js';

test('parseOutfitsFromOutput parses valid JSON', () => {
  const raw = JSON.stringify({
    outfits: [
      { top: '셔츠', bottom: '팬츠', shoes: '스니커즈', comment: '깔끔한 코디' },
    ],
  });
  const result = parseOutfitsFromOutput(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].top, '셔츠');
});

test('parseOutfitsFromOutput extracts JSON from mixed output', () => {
  const raw = '여기 추천 결과입니다:\n```json\n{"outfits":[{"top":"A","bottom":"B","shoes":"C","comment":"good"}]}\n```';
  const result = parseOutfitsFromOutput(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].top, 'A');
});

test('parseOutfitsFromOutput returns empty array on invalid JSON', () => {
  const result = parseOutfitsFromOutput('이건 JSON이 아닙니다');
  assert.deepEqual(result, []);
});

test('parseShoppingFromOutput parses shopping array', () => {
  const raw = JSON.stringify({
    outfits: [],
    shopping: [
      { name: '차콜 슬랙스', category: '하의', reason: '세미포멀 코디 보강' },
      { name: '베이지 자켓', category: '아우터', reason: '쌀쌀한 날 대비' },
    ],
  });
  const result = parseShoppingFromOutput(raw);
  assert.equal(result.length, 2);
  assert.equal(result[0].category, '하의');
});

test('parseShoppingFromOutput returns empty array when missing', () => {
  const raw = JSON.stringify({ outfits: [] });
  assert.deepEqual(parseShoppingFromOutput(raw), []);
});

test('extractJSON parses outfits and shopping from same response', () => {
  const raw = JSON.stringify({ outfits: [{ top: 'A' }], shopping: [{ name: 'X' }] });
  const parsed = extractJSON(raw);
  assert.equal(parsed.outfits.length, 1);
  assert.equal(parsed.shopping.length, 1);
});
