import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseOutfitsFromOutput } from '../ai.js';

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
