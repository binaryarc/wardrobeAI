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

export const CATEGORIES = Object.keys(CATEGORY_KEYWORDS);
const FALLBACK_CATEGORY = '기타';

const URL_PATTERN = /https?:\/\/[^\s\]>)'"]+/g;
const NOTION_PAGE_SIZE = 100;

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
  return FALLBACK_CATEGORY;
}

export function extractImageUrl(block) {
  if (block.type !== 'image') return null;
  const img = block.image;
  if (img.type === 'external') return img.external.url;
  if (img.type === 'file') return img.file?.url ?? null;
  return null;
}

export function getCaptionText(block) {
  return (block.image?.caption ?? []).map(t => t.plain_text).join('').trim();
}

function buildShortCaption(meta) {
  return [meta.name, meta.category, meta.style].filter(Boolean).join(' · ');
}

function metaToTags(meta) {
  return [meta.style, meta.texture, meta.color, ...(meta.tags || [])].filter(Boolean);
}

export function parseShortCaption(caption) {
  if (!caption || !caption.includes(' · ')) return null;
  const parts = caption.split(' · ').map(s => s.trim());
  return {
    name: parts[0] || '',
    category: parts[1] || detectCategory(parts[0] || ''),
    style: parts[2] || '',
  };
}

export function parseFreeformCaption(caption) {
  const text = caption.trim();
  if (!text) return null;

  const words = text.split(/\s+/);
  const categoryKeywordSet = new Set(
    Object.values(CATEGORY_KEYWORDS).flat().map(k => k.toLowerCase())
  );
  const categoryNameSet = new Set(CATEGORIES.map(k => k.toLowerCase()));

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

// Notion children API의 has_more 페이지네이션을 끝까지 따라가며 모든 블록을 수집.
export async function listAllChildren(notion, blockId) {
  const all = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      page_size: NOTION_PAGE_SIZE,
      start_cursor: cursor,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

// column_list/column 같은 컨테이너 블록을 펼쳐 평탄화. 컨테이너 자식 fetch는 병렬 처리.
export async function flattenBlocks(notion, blocks) {
  const expanded = await Promise.all(blocks.map(async (block) => {
    if (block.type === 'column_list' || block.type === 'column') {
      const children = await listAllChildren(notion, block.id);
      return flattenBlocks(notion, children);
    }
    return [block];
  }));
  return expanded.flat();
}

function buildItem({ name, category, tags, imageUrl, imageIndex }) {
  return {
    name: name || `아이템 ${imageIndex}`,
    category: category || FALLBACK_CATEGORY,
    tags: tags || [],
    imageUrl,
  };
}

// 단일 이미지 블록 처리. 캡션·캐시·AI 분석 순으로 메타데이터 확보.
// cache 객체를 직접 변경하므로 호출 후 cacheDirty 여부는 반환값으로 알림.
async function processImageBlock(block, ctx) {
  const { notion, cache, engine, imageIndex } = ctx;
  const caption = getCaptionText(block);
  const imageUrl = extractImageUrl(block) ?? '';
  const key = cacheKey(imageUrl);
  const cached = key ? cache[key] : null;
  const make = (meta) => buildItem({ ...meta, imageUrl, imageIndex });

  // 우선순위 1: 새 형식 캡션 (이름 · 카테고리 · 스타일)
  const shortParsed = parseShortCaption(caption);
  if (shortParsed) {
    if (cached && cached.name === shortParsed.name) {
      return { item: make({ name: cached.name, category: cached.category || shortParsed.category, tags: metaToTags(cached) }) };
    }
    return { item: make({ name: shortParsed.name, category: shortParsed.category, tags: [shortParsed.style].filter(Boolean) }) };
  }

  // 우선순위 2: 사용자 자유 텍스트 캡션 (AI 스킵)
  if (caption) {
    const manual = parseFreeformCaption(caption);
    return { item: make({ name: manual.name, category: manual.category, tags: manual.tags }) };
  }

  // 우선순위 3: 캐시 hit (캡션 없음)
  if (cached) {
    await updateImageCaption(notion, block.id, buildShortCaption(cached));
    return { item: make({ name: cached.name, category: cached.category, tags: metaToTags(cached) }) };
  }

  // 우선순위 4: AI 이미지 분석
  if (imageUrl && engine) {
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
      const cacheWrite = key ? { key, meta } : null;
      await updateImageCaption(notion, block.id, buildShortCaption(meta));
      return {
        item: make({ name: meta.name, category: meta.category, tags: metaToTags(meta) }),
        cacheWrite,
        analyzed: true,
      };
    }
    return { item: make({}), analyzed: true };
  }

  // 우선순위 5: 캡션·캐시·엔진 모두 없음
  return { item: make({}) };
}

export async function fetchWardrobeItems(notionToken, pageId, onProgress = null) {
  const notion = new Client({ auth: notionToken });
  const engine = detectEngine();
  const cache = loadCache();
  let cacheDirty = false;

  const topBlocks = await listAllChildren(notion, pageId);
  const flatBlocks = await flattenBlocks(notion, topBlocks);

  const items = [];
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
  let processed = 0;
  if (onProgress) onProgress({ phase: 'start', total, processed: 0 });

  for (let i = 0; i < imageBlocks.length; i++) {
    const block = imageBlocks[i];
    const imageIndex = i + 1;
    const needsAnalysis = !getCaptionText(block) && !cache[cacheKey(extractImageUrl(block) ?? '')];
    if (needsAnalysis && onProgress) {
      onProgress({ phase: 'analyzing', current: `이미지 ${imageIndex} 분석 중`, total, processed });
    }

    const { item, cacheWrite } = await processImageBlock(block, { notion, cache, engine, imageIndex });
    items.push(item);
    if (cacheWrite) {
      cache[cacheWrite.key] = cacheWrite.meta;
      cacheDirty = true;
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
        category: info.category || FALLBACK_CATEGORY,
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
