import { describe, it, expect } from 'vitest';
import { parseKey, isValidDateKey, diffDays, elapsedDays, daysLeft, isInMonth, toKey } from '../../src/lib/dates.js';

describe('UT-D dates', () => {
  it('UT-D01 実在日付を受け付ける', () => {
    expect(isValidDateKey('2026-11-15')).toBe(true);
    expect(parseKey('2026-02-28')).not.toBeNull();
  });
  it('UT-D02 存在しない日付を弾く', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-00-10')).toBe(false);
  });
  it('UT-D03 形式違いを弾く', () => {
    expect(isValidDateKey('2026/11/15')).toBe(false);
    expect(isValidDateKey('2026-1-5')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
  });
  it('UT-D04 うるう年の2/29を受け付ける', () => {
    expect(isValidDateKey('2028-02-29')).toBe(true);
    expect(isValidDateKey('2026-02-29')).toBe(false);
  });
  it('UT-D05 diffDays は b-a', () => {
    expect(diffDays('2026-11-10', '2026-11-15')).toBe(5);
    expect(diffDays('2026-11-15', '2026-11-10')).toBe(-5);
    expect(diffDays('2026-11-15', '2026-11-15')).toBe(0);
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
  });
  it('UT-D06 経過日数は登録当日0', () => {
    expect(elapsedDays('2026-11-15', '2026-11-15')).toBe(0);
    expect(elapsedDays('2026-11-01', '2026-11-15')).toBe(14);
  });
  it('UT-D07 残日数は期限当日0・過ぎたら負', () => {
    expect(daysLeft('2026-11-15', '2026-11-15')).toBe(0);
    expect(daysLeft('2026-11-20', '2026-11-15')).toBe(5);
    expect(daysLeft('2026-11-10', '2026-11-15')).toBe(-5);
  });
  it('UT-D08 月判定', () => {
    expect(isInMonth('2026-11-30', '2026-11')).toBe(true);
    expect(isInMonth('2026-12-01', '2026-11')).toBe(false);
  });
  it('UT-D09 toKey はゼロ埋めする', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
