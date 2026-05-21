import { Client } from '@notionhq/client';

function richText(content) {
  return [{ type: 'text', text: { content } }];
}

export function buildOutfitBlocks(outfit, allItems, weather, index) {
  const blocks = [];

  blocks.push({
    type: 'heading_3',
    heading_3: { rich_text: richText(`코디 ${index}`) },
  });

  const weatherLine = weather
    ? `🌤 ${weather.condition} ${weather.temperature}°C · 강수 ${weather.precipitationProbability}%`
    : '날씨 정보 없음';

  const itemLines = [outfit.top, outfit.bottom, outfit.shoes]
    .filter(Boolean)
    .map(name => `• ${name}`)
    .join('\n');

  blocks.push({
    type: 'callout',
    callout: {
      rich_text: richText(`${weatherLine}\n${itemLines}\n\n💬 ${outfit.comment}`),
      icon: { type: 'emoji', emoji: '👗' },
      color: 'gray_background',
    },
  });

  const imageItem = allItems.find(
    item => item.imageUrl && [outfit.top, outfit.bottom, outfit.shoes].includes(item.name)
  );
  if (imageItem) {
    blocks.push({
      type: 'image',
      image: { type: 'external', external: { url: imageItem.imageUrl } },
    });
  }

  return blocks;
}

export async function writeRecommendation({ notionToken, parentPageId, outputPageId, outfits, items, weather, date }) {
  const notion = new Client({ auth: notionToken });
  const dateStr = date ?? new Date().toISOString().slice(0, 10);

  let pageId = outputPageId;
  if (!pageId) {
    const page = await notion.pages.create({
      parent: { page_id: parentPageId },
      properties: { title: { title: richText('🌤️ wardrobeAI 추천') } },
    });
    pageId = page.id;
  }

  const divider = { type: 'divider', divider: {} };
  const dateHeading = {
    type: 'heading_2',
    heading_2: { rich_text: richText(`📅 ${dateStr}`) },
  };

  const outfitBlocks = outfits.flatMap((outfit, i) =>
    buildOutfitBlocks(outfit, items, weather, i + 1)
  );

  await notion.blocks.children.append({
    block_id: pageId,
    children: [divider, dateHeading, ...outfitBlocks],
  });

  return pageId;
}
