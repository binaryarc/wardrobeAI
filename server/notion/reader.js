import { Client } from '@notionhq/client';
import { analyzeImage, analyzePage, detectEngine } from '../analyzer.js';
import { loadCache, saveCache, cacheKey } from '../cache.js';

const CATEGORY_KEYWORDS = {
  상의: ['상의', '셔츠', '티', '티셔츠', '니트', '블라우스', '탑', '스웨터', '후드', 'top', 'shirt', 'tee', 'knit', 'blouse'],
  하의: ['하의', '팬츠', '바지', '스커트', '치마', '반바지', '쇼츠', '데님', '청바지', 'pants', 'skirt', 'shorts', 'jeans', 'denim'],
  아우터: ['아우터', '자켓', '재킷', '코트', '패딩', '점퍼', '가디건', 'jacket', 'coat', 'outer', 'cardigan'],
  신발: ['신발', '스니커즈', '로퍼', '부츠', '샌들', '슬리퍼', '구두', 'sneaker', 'shoes', 'boots', 'loafer', 'sandal'],
  액세서리: ['액세서리', '가방', '백', '모자', '스카프', '벨트', 'bag', 'hat', 'scarf', 'belt'],
};

const URL_PATTERN = /https?:\/\/[^\s\]>)'"]+/g;

export function extractTextFromBlock(block) {
  const richTextTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'callout'];
  if (richTextTypes.includes(block.type)) {
    return (block[block.type]?.rich_text ?? []).map(t => t.plain_text).join('');
  }
  return '';
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return '기타';
}

export function extractImageUrl(block) {
  if (block.type !== 'image') return null;
  const img = block.image;
  if (img.type === 'external') return img.external.url;
  if (img.type === 'file') return img.file?.url ?? null;
  return null;
}

// 사람이 보는 짧은 캡션 (이름 · 카테고리 · 스타일)
function buildShortCaption(meta) {
  return [meta.name, meta.category, meta.style].filter(Boolean).join(' · ');
}

// 새 형식 캡션(" · " 포함)에서 이름·카테고리·스타일 파싱.
export function parseShortCaption(caption) {
  if (!caption || !caption.includes(' · ')) return null;
  const parts = caption.split(' · ').map(s => s.trim());
  return {
    name: parts[0] || '',
    category: parts[1] || detectCategory(parts[0] || ''),
    style: parts[2] || '',
  };
}

// 사용자가 자유롭게 적은 캡션도 아이템으로 변환.
// 카테고리 키워드가 있으면 그 직전까지를 이름, 키워드 자체는 카테고리에 흡수, 나머지는 태그.
// 카테고리 키워드가 없으면 첫 단어 묶음을 이름으로 사용하고 전체를 태그로 활용.
export function parseFreeformCaption(caption) {
  const text = caption.trim();
  if (!text) return null;

  const words = text.split(/\s+/);
  const categoryKeywordSet = new Set(
    Object.values(CATEGORY_KEYWORDS).flat().map(k => k.toLowerCase())
  );
  const categoryNameSet = new Set(Object.keys(CATEGORY_KEYWORDS).map(k => k.toLowerCase()));

  // 카테고리 이름이 직접 들어 있는 위치 찾기 (예: '하의', '상의')
  const catNameIdx = words.findIndex(w => categoryNameSet.has(w.toLowerCase()));
  let name, category, tags;

  if (catNameIdx > 0) {
    name = words.slice(0, catNameIdx).join(' ');
    category = words[catNameIdx];
    tags = words.slice(catNameIdx + 1).filter(w =>
      w.length > 0 && !categoryNameSet.has(w.toLowerCase())
    );
  } else {
    name = words.slice(0, Math.min(4, words.length)).join(' ');
    category = detectCategory(text);
    tags = words.filter(w =>
      w.length > 0 && !categoryKeywordSet.has(w.toLowerCase())
    );
  }

  return { name: name || text, category, tags };
}

async function updateImageCaption(notion, blockId, captionText) {
  try {
    await notion.blocks.update({
      block_id: blockId,
      image: { caption: [{ type: 'text', text: { content: captionText } }] },
    });
  } catch {}
}

async function flattenBlocks(notion, blocks) {
  const result = [];
  for (const block of blocks) {
    if (block.type === 'column_list' || block.type === 'column') {
      const children = await notion.blocks.children.list({ block_id: block.id, page_size: 100 });
      const nested = await flattenBlocks(notion, children.results);
      result.push(...nested);
    } else {
      result.push(block);
    }
  }
  return result;
}

export async function fetchWardrobeItems(notionToken, pageId, onProgress = null) {
  const notion = new Client({ auth: notionToken });
  const engine = detectEngine();
  const cache = loadCache();
  let cacheDirty = false;

  const response = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
  const flatBlocks = await flattenBlocks(notion, response.results);

  const items = [];
  let imageIndex = 1;
  let processed = 0;

  const urlBlocks = [];
  const imageBlocks = [];

  for (const block of flatBlocks) {
    if (block.type === 'image') {
      imageBlocks.push(block);
    } else {
      const text = extractTextFromBlock(block);
      const urls = text.match(URL_PATTERN) || [];
      for (const url of urls) {
        if (!url.includes('notion.so') && !url.includes('s3.amazonaws')) {
          urlBlocks.push({ url, blockId: block.id });
        }
      }
    }
  }

  const total = imageBlocks.length + urlBlocks.length;
  if (onProgress) onProgress({ phase: 'start', total, processed: 0 });

  for (const block of imageBlocks) {
    const caption = (block.image?.caption ?? []).map(t => t.plain_text).join('').trim();
    const imageUrl = extractImageUrl(block) ?? '';
    const key = cacheKey(imageUrl);
    const cached = key ? cache[key] : null;

    // 우선순위 1: 새 형식 캡션 (이름 · 카테고리 · 스타일)
    //   캐시에 풀 메타가 있으면 태그까지 확장해서 사용, 없으면 캡션만으로 구성.
    const shortParsed = parseShortCaption(caption);
    if (shortParsed) {
      if (cached && cached.name === shortParsed.name) {
        items.push({
          name: cached.name,
          category: cached.category || shortParsed.category,
          tags: [cached.style, cached.texture, cached.color, ...(cached.tags || [])].filter(Boolean),
          imageUrl,
        });
      } else {
        items.push({
          name: shortParsed.name,
          category: shortParsed.category,
          tags: [shortParsed.style].filter(Boolean),
          imageUrl,
        });
      }
    }
    // 우선순위 2: 사용자가 직접 적은 자유 텍스트 캡션 (AI 분석 스킵)
    else if (caption) {
      const manual = parseFreeformCaption(caption);
      items.push({
        name: manual.name || `아이템 ${imageIndex}`,
        category: manual.category,
        tags: manual.tags,
        imageUrl,
      });
    }
    // 우선순위 3: 캐시 hit (캡션은 없지만 이전에 분석한 이미지)
    else if (cached) {
      await updateImageCaption(notion, block.id, buildShortCaption(cached));
      items.push({
        name: cached.name || `아이템 ${imageIndex}`,
        category: cached.category || '기타',
        tags: [cached.style, cached.texture, cached.color, ...(cached.tags || [])].filter(Boolean),
        imageUrl,
      });
    }
    // 우선순위 4: AI 이미지 분석
    else if (imageUrl && engine) {
      if (onProgress) onProgress({ phase: 'analyzing', current: `이미지 ${imageIndex} 분석 중`, total, processed });
      const analysis = await analyzeImage(imageUrl, engine);
      if (analysis) {
        const meta = {
          name: analysis.name,
          category: analysis.category,
          style: analysis.style,
          texture: analysis.texture,
          color: analysis.color,
          tags: Array.isArray(analysis.tags) ? analysis.tags : [],
        };
        if (key) {
          cache[key] = meta;
          cacheDirty = true;
        }
        await updateImageCaption(notion, block.id, buildShortCaption(meta));
        items.push({
          name: meta.name || `아이템 ${imageIndex}`,
          category: meta.category || '기타',
          tags: [meta.style, meta.texture, meta.color, ...meta.tags].filter(Boolean),
          imageUrl,
        });
      } else {
        items.push({ name: `아이템 ${imageIndex}`, category: '기타', tags: [], imageUrl });
      }
      imageIndex++;
    }
    // 우선순위 5: 캡션·캐시·엔진 모두 없음
    else {
      items.push({ name: `아이템 ${imageIndex++}`, category: '기타', tags: [], imageUrl });
    }

    processed++;
    if (onProgress) onProgress({ phase: 'analyzing', total, processed });
  }

  for (const { url } of urlBlocks) {
    if (onProgress) onProgress({ phase: 'analyzing', current: `쇼핑 URL 분석 중: ${url.slice(0, 40)}...`, total, processed });

    const info = engine ? await analyzePage(url, engine) : null;
    if (info) {
      items.push({
        name: info.name || url,
        category: info.category || '기타',
        tags: [info.brand, info.style, info.color, info.material, ...(info.tags || [])].filter(Boolean),
        imageUrl: '',
        shopUrl: url,
        shopInfo: info,
      });
    }

    processed++;
    if (onProgress) onProgress({ phase: 'analyzing', total, processed });
  }

  if (cacheDirty) saveCache(cache);
  if (onProgress) onProgress({ phase: 'done', total, processed });
  return items;
}
