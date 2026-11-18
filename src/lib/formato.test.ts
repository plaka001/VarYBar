import { expect, it } from 'vitest';
import { aInputLocal, cuando, desdeInputLocal, rangoDias } from './formato';
it('formatos en hora de Colombia', () => {
  expect(cuando('2026-11-20T21:30:00+00:00')).toBe('Vie 20 nov · 4:30 p. m.');
  expect(cuando('2026-11-22T01:15:00+00:00')).toBe('Sáb 21 nov · 8:15 p. m.');
  expect(rangoDias(['2026-11-20T21:30:00+00:00', '2026-11-21T01:40:00+00:00', '2026-11-22T01:15:00+00:00'])).toBe('Vie 20 y sáb 21 nov');
  expect(rangoDias([null, null])).toBe('Por programar');
  expect(aInputLocal('2026-11-26T01:30:00+00:00')).toBe('2026-11-25T20:30');
  expect(desdeInputLocal('2026-11-25T20:30')).toBe('2026-11-25T20:30:00-05:00');
  expect(new Date(desdeInputLocal('2026-11-25T20:30')!).toISOString()).toBe('2026-11-26T01:30:00.000Z');
});
