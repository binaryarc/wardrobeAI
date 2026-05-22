import { fetchWardrobeItems } from './notion/reader.js';
import { fetchWeather } from './weather.js';
import { buildPrompt } from './prompt.js';
import { extractJSON } from './ai.js';
import { runRecommendationAI, cleanupTmpImages } from './analyzer.js';
import { writeRecommendation } from './notion/writer.js';

export async function runRecommendation(config, deps = {}, onProgress = null) {
  const {
    fetchWardrobeItems: _fetchWardrobe = fetchWardrobeItems,
    fetchWeather: _fetchWeather = fetchWeather,
    writeRecommendation: _writeRecommendation = writeRecommendation,
    runAI: _runAI = (prompt) => runRecommendationAI(prompt, config.aiEngine || null),
  } = deps;

  const emit = (msg) => { if (onProgress) onProgress(msg); };

  emit({ step: 'wardrobe', message: '옷장 불러오는 중...' });

  const [items, weather] = await Promise.all([
    _fetchWardrobe(config.notionToken, config.wardrobePageId, (p) => {
      if (p.phase === 'analyzing') {
        emit({ step: 'analyze', message: p.current || `이미지 분석 중 (${p.processed}/${p.total})`, processed: p.processed, total: p.total });
      }
    }),
    _fetchWeather(config.city),
  ]);

  emit({ step: 'weather', message: `날씨 확인 완료 — ${weather ? `${weather.condition} ${weather.temperature}°C` : '정보 없음'}` });
  emit({ step: 'prompt', message: `옷 ${items.length}개 분석 완료, AI 추천 생성 중...` });

  const prompt = buildPrompt(items, weather, {
    preferredStyles: config.preferredStyles,
    excludeItems: config.excludeItems,
  });

  const rawOutput = await _runAI(prompt);
  const parsed = extractJSON(rawOutput) ?? {};
  const outfits = Array.isArray(parsed.outfits) ? parsed.outfits : [];
  const shopping = Array.isArray(parsed.shopping) ? parsed.shopping : [];

  emit({ step: 'writing', message: `추천 ${outfits.length}세트 + 보강 ${shopping.length}개 노션에 작성 중...` });

  const newOutputPageId = await _writeRecommendation({
    notionToken: config.notionToken,
    parentPageId: config.wardrobePageId,
    outfits,
    shopping,
    items,
    weather,
    date: new Date().toISOString().slice(0, 10),
  });

  cleanupTmpImages();

  emit({ step: 'done', message: `완료 — 코디 ${outfits.length}세트, 보강 ${shopping.length}개` });
  return { outfits, shopping, weather, items, newOutputPageId };
}
