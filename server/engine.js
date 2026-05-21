import { fetchWardrobeItems } from './notion/reader.js';
import { fetchWeather } from './weather.js';
import { buildPrompt } from './prompt.js';
import { runAI, parseOutfitsFromOutput } from './ai.js';
import { writeRecommendation } from './notion/writer.js';

export async function runRecommendation(config, deps = {}) {
  const {
    fetchWardrobeItems: _fetchWardrobe = fetchWardrobeItems,
    fetchWeather: _fetchWeather = fetchWeather,
    runAI: _runAI = runAI,
    writeRecommendation: _writeRecommendation = writeRecommendation,
  } = deps;

  const [items, weather] = await Promise.all([
    _fetchWardrobe(config.notionToken, config.wardrobePageId),
    _fetchWeather(config.city),
  ]);

  const prompt = buildPrompt(items, weather, {
    preferredStyles: config.preferredStyles,
    excludeItems: config.excludeItems,
  });

  const rawOutput = await _runAI(prompt, config.aiEngine);
  const outfits = parseOutfitsFromOutput(rawOutput);

  const newOutputPageId = await _writeRecommendation({
    notionToken: config.notionToken,
    parentPageId: config.wardrobePageId,
    outputPageId: config.outputPageId,
    outfits,
    items,
    weather,
    date: new Date().toISOString().slice(0, 10),
  });

  return { outfits, weather, items, newOutputPageId };
}
