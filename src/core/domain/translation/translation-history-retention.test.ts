import { describe, expect, test } from 'bun:test';
import { isWithinHistoryRetention } from './translation-history-retention';

describe('Domain: translation history retention', () => {
  const now = Date.parse('2026-10-20T12:00:00.000Z');
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;

  test('expires records older than 90 days, including by one millisecond', () => {
    expect(isWithinHistoryRetention(new Date(cutoff - 1), now)).toBe(false);
  });

  test('retains records exactly 90 days old and newer', () => {
    expect(isWithinHistoryRetention(new Date(cutoff), now)).toBe(true);
    expect(isWithinHistoryRetention(new Date(now), now)).toBe(true);
  });

  test('retains future timestamps without treating them as expired', () => {
    expect(isWithinHistoryRetention(new Date(now + 1), now)).toBe(true);
  });

  test('does not retain invalid dates', () => {
    expect(isWithinHistoryRetention(new Date('invalid'), now)).toBe(false);
  });
});
