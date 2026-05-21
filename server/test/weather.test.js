import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseWeatherCode } from '../weather.js';

test('parseWeatherCode 0 returns 맑음', () => {
  assert.equal(parseWeatherCode(0), '맑음');
});

test('parseWeatherCode 61 returns 비', () => {
  assert.equal(parseWeatherCode(61), '비');
});

test('parseWeatherCode 71 returns 눈', () => {
  assert.equal(parseWeatherCode(71), '눈');
});

test('parseWeatherCode unknown returns 흐림', () => {
  assert.equal(parseWeatherCode(999), '흐림');
});
