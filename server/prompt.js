import { CATEGORIES } from './notion/reader.js';

const OUTER_TEMP_THRESHOLD = 18;
const OTHER_CATEGORY = '기타';

function formatItem(item) {
  const tagPart = item.tags?.length ? ` — ${item.tags.join(', ')}` : '';
  return `- ${item.name} (${item.category})${tagPart}`;
}

export function shouldIncludeOuter(weather) {
  if (!weather || typeof weather.temperature !== 'number') return false;
  return weather.temperature <= OUTER_TEMP_THRESHOLD;
}

function groupByCategory(items) {
  const categorySet = new Set(CATEGORIES);
  const groups = Object.fromEntries(CATEGORIES.map(c => [c, []]));
  groups[OTHER_CATEGORY] = [];
  for (const item of items) {
    const bucket = categorySet.has(item.category) ? item.category : OTHER_CATEGORY;
    groups[bucket].push(item);
  }
  return groups;
}

export function buildPrompt(items, weather, { preferredStyles, excludeItems }) {
  const filtered = items.filter(item => !excludeItems.includes(item.name));
  const grouped = groupByCategory(filtered);

  const sections = Object.entries(grouped)
    .filter(([, arr]) => arr.length > 0)
    .map(([cat, arr]) => `[${cat}]\n${arr.map(formatItem).join('\n')}`)
    .join('\n\n');

  const weatherDesc = weather
    ? `현재 날씨: ${weather.condition}, 기온 ${weather.temperature}°C, 강수 확률 ${weather.precipitationProbability}%`
    : '날씨 정보 없음';

  const styleDesc = preferredStyles.length
    ? `선호 스타일: ${preferredStyles.join(', ')}`
    : '';

  const includeOuter = shouldIncludeOuter(weather);
  const outerLine = includeOuter
    ? '\n      "outer": "아우터 이름 (목록 [아우터]에 있는 것만, 추천 안 하면 null)",'
    : '';
  const outerRule = includeOuter
    ? '\n- 기온이 낮으므로 가능하면 아우터를 함께 추천하세요. 적절한 아우터가 없으면 null.'
    : '';

  return `당신은 패션 스타일리스트입니다.
아래 옷 목록과 날씨를 바탕으로 (1) 오늘 입기 좋은 코디 3세트와 (2) 보유 옷장을 보완할 추가 아이템 4개를 추천하세요.

${weatherDesc}
${styleDesc}

보유 옷 목록 (괄호: 카테고리, ' — ' 뒤: 스타일/소재/색상/태그):
${sections}

규칙:
- outfits: 반드시 위 목록에 있는 정확한 이름만 사용하세요. 임의로 만들어내지 마세요.
- outfits: 세 개는 서로 겹치지 않게 다양하게 구성하세요.
- outfits: 날씨와 선호 스타일에 맞는 조합을 우선하세요.${outerRule}
- shopping: 보유 옷장의 부족한 카테고리·색상·스타일을 분석해 보강하면 코디 다양성이 늘어날 아이템 4개를 제안하세요. 이미 보유한 옷과 조합 가능성을 근거로 설명하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력:
{
  "outfits": [
    {
      "top": "상의 이름 (목록 [상의]에 있는 것만)",
      "bottom": "하의 이름 (목록 [하의]에 있는 것만)",
      "shoes": "신발 이름 (목록 [신발]에 있는 것만, 없으면 null)",${outerLine}
      "comment": "이 코디를 추천하는 이유 한 줄 (날씨/스타일 근거 포함)"
    }
  ],
  "shopping": [
    {
      "name": "추천 아이템 이름 (예: 차콜 그레이 슬랙스)",
      "category": "상의/하의/아우터/신발/액세서리 중 하나",
      "reason": "왜 필요한지 + 보유 옷 중 어떤 것과 매치되는지 (한 줄)"
    }
  ]
}`;
}
