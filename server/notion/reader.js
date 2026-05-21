import { Client } from '@notionhq/client';

const CATEGORY_KEYWORDS = {
  상의: ['상의', '셔츠', '티', '티셔츠', '니트', '블라우스', '탑', '스웨터', '후드'],
  하의: ['하의', '팬츠', '바지', '스커트', '치마', '반바지', '쇼츠'],
  아우터: ['아우터', '자켓', '재킷', '코트', '패딩', '점퍼', '가디건'],
  신발: ['신발', '스니커즈', '로퍼', '부츠', '샌들', '슬리퍼', '구두'],
  액세서리: ['액세서리', '가방', '백', '모자', '스카프', '벨트'],
};

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

function extractImageUrl(block) {
  if (block.type !== 'image') return null;
  const img = block.image;
  return img.type === 'external' ? img.external.url : (img.file?.url ?? '');
}

export function parseBlocksToItems(blocks) {
  const items = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const text = extractTextFromBlock(block);
    if (text.trim()) {
      const words = text.trim().split(/\s+/);
      const name = words.slice(0, 3).join(' ');
      const category = detectCategory(text);
      const tags = words.slice(3).filter(w => w.length > 0);

      let imageUrl = '';
      if (i + 1 < blocks.length && blocks[i + 1].type === 'image') {
        imageUrl = extractImageUrl(blocks[i + 1]) ?? '';
        i++;
      }
      items.push({ name, category, tags, imageUrl });
    }
    i++;
  }
  return items;
}

export async function fetchWardrobeItems(notionToken, pageId) {
  const notion = new Client({ auth: notionToken });
  const response = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
  return parseBlocksToItems(response.results);
}
