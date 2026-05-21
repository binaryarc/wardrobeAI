import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseBlocksToItems, extractTextFromBlock } from '../notion/reader.js';

test('extractTextFromBlock returns text from paragraph', () => {
  const block = {
    type: 'paragraph',
    paragraph: { rich_text: [{ plain_text: '화이트 셔츠 상의' }] },
  };
  assert.equal(extractTextFromBlock(block), '화이트 셔츠 상의');
});

test('extractTextFromBlock returns empty string for image block', () => {
  const block = { type: 'image', image: { type: 'external', external: { url: 'https://example.com/img.jpg' } } };
  assert.equal(extractTextFromBlock(block), '');
});

test('parseBlocksToItems extracts item from heading + image', () => {
  const blocks = [
    {
      type: 'heading_2',
      heading_2: { rich_text: [{ plain_text: '화이트 린넨 셔츠 상의 여름 캐주얼' }] },
    },
    {
      type: 'image',
      image: { type: 'external', external: { url: 'https://example.com/shirt.jpg' } },
    },
  ];
  const items = parseBlocksToItems(blocks);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, '화이트 린넨 셔츠');
  assert.equal(items[0].category, '상의');
  assert.equal(items[0].imageUrl, 'https://example.com/shirt.jpg');
});

test('parseBlocksToItems handles blocks with no image', () => {
  const blocks = [
    {
      type: 'paragraph',
      paragraph: { rich_text: [{ plain_text: '슬림 블랙 팬츠 하의' }] },
    },
  ];
  const items = parseBlocksToItems(blocks);
  assert.equal(items.length, 1);
  assert.equal(items[0].imageUrl, '');
});
