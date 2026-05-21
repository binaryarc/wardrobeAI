export function buildPrompt(items, weather, { preferredStyles, excludeItems }) {
  const filtered = items.filter(item => !excludeItems.includes(item.name));

  const itemList = filtered
    .map(i => `- ${i.name} (${i.category}${i.tags.length ? ', ' + i.tags.join('/') : ''})`)
    .join('\n');

  const weatherDesc = weather
    ? `현재 날씨: ${weather.condition}, 기온 ${weather.temperature}°C, 강수 확률 ${weather.precipitationProbability}%`
    : '날씨 정보 없음';

  const styleDesc = preferredStyles.length
    ? `선호 스타일: ${preferredStyles.join(', ')}`
    : '';

  return `당신은 패션 스타일리스트입니다.
아래 옷 목록과 날씨 정보를 바탕으로 오늘 하루 입기 좋은 코디 3세트를 추천해주세요.

${weatherDesc}
${styleDesc}

보유 옷 목록:
${itemList}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요:
{
  "outfits": [
    {
      "top": "상의 이름 (목록에 있는 것만)",
      "bottom": "하의 이름 (목록에 있는 것만)",
      "shoes": "신발 이름 (목록에 있는 것만, 없으면 null)",
      "comment": "이 코디를 추천하는 이유 한 줄"
    }
  ]
}`;
}
