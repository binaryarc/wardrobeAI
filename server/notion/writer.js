import { Client } from '@notionhq/client';

function richText(content) {
  return [{ type: 'text', text: { content } }];
}

// 이미지 URL을 노션 파일 업로드 API로 업로드하고 file_upload ID 반환
async function uploadImageToNotion(notionToken, imageUrl) {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const buf = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('webp') ? 'webp' : 'jpg';

    // 1단계: 업로드 세션 생성
    const initRes = await fetch('https://api.notion.com/v1/file_uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: `outfit.${ext}`, content_type: contentType }),
    });
    if (!initRes.ok) return null;
    const { id: fileUploadId, upload_url: uploadUrl } = await initRes.json();

    // 2단계: 파일 데이터 업로드
    const formData = new FormData();
    formData.append('file', new Blob([buf], { type: contentType }), `outfit.${ext}`);
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${notionToken}`, 'Notion-Version': '2022-06-28' },
      body: formData,
    });
    if (!uploadRes.ok) return null;

    return fileUploadId;
  } catch {
    return null;
  }
}

export function buildOutfitBlocks(outfit, allItems, weather, index, fileUploadIds = []) {
  const blocks = [];

  blocks.push({
    type: 'heading_3',
    heading_3: { rich_text: richText(`코디 ${index}`) },
  });

  const weatherLine = weather
    ? `🌤 ${weather.condition} ${weather.temperature}°C · 강수 ${weather.precipitationProbability}%`
    : '날씨 정보 없음';

  const outfitNames = [outfit.top, outfit.bottom, outfit.shoes, outfit.outer].filter(Boolean);
  const itemLines = outfitNames.map(name => `• ${name}`).join('\n');

  blocks.push({
    type: 'callout',
    callout: {
      rich_text: richText(`${weatherLine}\n${itemLines}\n\n💬 ${outfit.comment}`),
      icon: { type: 'emoji', emoji: '👗' },
      color: 'gray_background',
    },
  });

  for (const { fileUploadId, label } of fileUploadIds) {
    // caption은 생성 시 API가 무시하므로 _label로 보관 후 append 뒤 blocks.update로 적용
    blocks.push({
      type: 'image',
      image: { type: 'file_upload', file_upload: { id: fileUploadId } },
      _label: label,
    });
  }

  return blocks;
}

function buildShopInfoBlocks(item) {
  if (!item.shopInfo) return [];
  const info = item.shopInfo;
  const lines = [
    item.shopUrl ? `🔗 ${item.shopUrl}` : null,
    info.brand ? `브랜드: ${info.brand}` : null,
    info.price ? `가격: ${info.price}` : null,
    info.material ? `소재: ${info.material}` : null,
    info.description || null,
  ].filter(Boolean).join('\n');

  return [{
    type: 'callout',
    callout: {
      rich_text: richText(`🛍 ${item.name}\n${lines}`),
      icon: { type: 'emoji', emoji: '🛒' },
      color: 'blue_background',
    },
  }];
}

export async function writeRecommendation({ notionToken, parentPageId, outfits, items, weather, date }) {
  const notion = new Client({ auth: notionToken });
  const dateStr = date ?? new Date().toISOString().slice(0, 10);

  // 오늘 몇 번째 추천인지
  const runNumber = await (async () => {
    try {
      const children = await notion.blocks.children.list({ block_id: parentPageId, page_size: 100 });
      const todayPages = children.results.filter(b =>
        b.type === 'child_page' && b.child_page?.title?.startsWith(dateStr)
      );
      return todayPages.length + 1;
    } catch { return 1; }
  })();

  const pageTitle = `${dateStr}_${runNumber}_${outfits.length}세트`;
  const page = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: { title: { title: richText(pageTitle) } },
  });
  const pageId = page.id;

  const shopItems = items.filter(i => i.shopInfo);
  const shopBlocks = shopItems.flatMap(i => buildShopInfoBlocks(i));

  // 각 코디에 사용할 이미지를 노션에 업로드 (세트 구성 아이템 전부)
  const outfitBlocks = [];
  for (let i = 0; i < outfits.length; i++) {
    const outfit = outfits[i];
    const slotLabels = [
      { key: 'top', label: '상의' },
      { key: 'bottom', label: '하의' },
      { key: 'shoes', label: '신발' },
      { key: 'outer', label: '아우터' },
    ];

    const fileUploadIds = [];
    for (const { key, label } of slotLabels) {
      const name = outfit[key];
      if (!name) continue;
      const item = items.find(it => it.imageUrl && it.name === name);
      if (!item) continue;
      const fileUploadId = await uploadImageToNotion(notionToken, item.imageUrl);
      if (fileUploadId) fileUploadIds.push({ fileUploadId, label: `${label} — ${name}` });
    }

    outfitBlocks.push(...buildOutfitBlocks(outfit, items, weather, i + 1, fileUploadIds));
  }

  const allBlocks = [
    ...(shopBlocks.length ? [{ type: 'heading_2', heading_2: { rich_text: richText('🛍 보유 상품 정보') } }, ...shopBlocks, { type: 'divider', divider: {} }] : []),
    ...outfitBlocks,
  ];

  // 이미지 블록은 따로 분리: 생성 후 즉시 caption update 필요
  // allBlocks를 이미지/비이미지로 나눠서 순서대로 처리
  const pendingCaptions = []; // { blockId, label }

  // 50개 청크로 append하되, 이미지 블록의 _label은 제거하고 생성 결과에서 ID 추적
  const cleanBlocks = allBlocks.map(b => {
    if (b.type === 'image' && b._label) {
      const { _label, ...clean } = b;
      return { ...clean, _needsCaption: true, _label };
    }
    return b;
  });

  for (let i = 0; i < cleanBlocks.length; i += 50) {
    const chunk = cleanBlocks.slice(i, i + 50);
    const apiChunk = chunk.map(({ _needsCaption, _label, ...b }) => b);
    const res = await notion.blocks.children.append({ block_id: pageId, children: apiChunk });
    const created = res.results || [];
    // 청크 내 각 블록과 생성 결과를 순서대로 매핑
    chunk.forEach((b, j) => {
      if (b._needsCaption && b._label && created[j]) {
        pendingCaptions.push({ blockId: created[j].id, label: b._label });
      }
    });
  }

  // 이미지 캡션 적용 (Notion API: 생성 시 caption 무시 → update로만 가능)
  for (const { blockId, label } of pendingCaptions) {
    try {
      await notion.blocks.update({
        block_id: blockId,
        image: { caption: richText(label) },
      });
    } catch {}
  }

  return pageId;
}
