import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPrompt } from '../prompt.js';

const sampleItems = [
  { name: '화이트 린넨 셔츠', category: '상의', tags: ['여름', '캐주얼'], imageUrl: '' },
  { name: '슬림 블랙 팬츠', category: '하의', tags: ['기본'], imageUrl: '' },
  { name: '화이트 스니커즈', category: '신발', tags: ['캐주얼'], imageUrl: '' },
];

const sampleWeather = { temperature: 22, condition: '맑음', precipitationProbability: 10 };

test('buildPrompt includes weather info', () => {
  const prompt = buildPrompt(sampleItems, sampleWeather, { preferredStyles: ['미니멀'], excludeItems: [] });
  assert.match(prompt, /22/);
  assert.match(prompt, /맑음/);
});

test('buildPrompt includes item names', () => {
  const prompt = buildPrompt(sampleItems, sampleWeather, { preferredStyles: [], excludeItems: [] });
  assert.match(prompt, /화이트 린넨 셔츠/);
  assert.match(prompt, /슬림 블랙 팬츠/);
});

test('buildPrompt excludes items in excludeItems', () => {
  const prompt = buildPrompt(sampleItems, sampleWeather, { preferredStyles: [], excludeItems: ['슬림 블랙 팬츠'] });
  assert.doesNotMatch(prompt, /슬림 블랙 팬츠/);
});

test('buildPrompt requests JSON outfits array', () => {
  const prompt = buildPrompt(sampleItems, sampleWeather, { preferredStyles: [], excludeItems: [] });
  assert.match(prompt, /outfits/);
  assert.match(prompt, /JSON/);
});
