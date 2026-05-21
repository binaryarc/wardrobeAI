import { test, mock } from 'node:test';
import { strict as assert } from 'node:assert';

test('runRecommendation calls all modules and returns outfits', async (t) => {
  const fakeItems = [
    { name: '셔츠', category: '상의', tags: [], imageUrl: '' },
    { name: '팬츠', category: '하의', tags: [], imageUrl: '' },
  ];
  const fakeWeather = { temperature: 20, condition: '맑음', precipitationProbability: 5 };
  const fakeOutfits = [{ top: '셔츠', bottom: '팬츠', shoes: null, comment: '테스트' }];

  const mockFetchWardrobe = t.mock.fn(async () => fakeItems);
  const mockFetchWeather = t.mock.fn(async () => fakeWeather);
  const mockRunAI = t.mock.fn(async () => JSON.stringify({ outfits: fakeOutfits }));
  const mockWriteRecommendation = t.mock.fn(async () => 'new-page-id');

  const { runRecommendation } = await import('../engine.js');
  const result = await runRecommendation(
    { notionToken: 't', wardrobePageId: 'p', city: 'Seoul', preferredStyles: [], excludeItems: [], aiEngine: 'claude', outputPageId: null },
    { fetchWardrobeItems: mockFetchWardrobe, fetchWeather: mockFetchWeather, runAI: mockRunAI, writeRecommendation: mockWriteRecommendation }
  );

  assert.equal(mockFetchWardrobe.mock.calls.length, 1);
  assert.equal(mockFetchWeather.mock.calls.length, 1);
  assert.equal(mockRunAI.mock.calls.length, 1);
  assert.equal(mockWriteRecommendation.mock.calls.length, 1);
  assert.equal(result.outfits.length, 1);
  assert.equal(result.newOutputPageId, 'new-page-id');
});
