/** @jest-environment node */

import {
  VIRTUALIZATION_THRESHOLD,
  getDynamicTableHeight,
  getVirtualWindow,
  shouldUseVirtualization
} from './illustrationsListLayout';

describe('illustrationsListLayout', () => {
  test('1) returns min height when viewport is too small', () => {
    const height = getDynamicTableHeight(500, { reservedHeight: 380, minHeight: 260 });
    expect(height).toBe(260);
  });

  test('2) returns computed height inside bounds', () => {
    const height = getDynamicTableHeight(1000, { reservedHeight: 400, minHeight: 260, maxHeight: 920 });
    expect(height).toBe(600);
  });

  test('3) clamps to max height for very large viewports', () => {
    const height = getDynamicTableHeight(2000, { reservedHeight: 300, maxHeight: 900 });
    expect(height).toBe(900);
  });

  test('4) virtualization is disabled at threshold', () => {
    expect(shouldUseVirtualization(VIRTUALIZATION_THRESHOLD)).toBe(false);
  });

  test('5) virtualization is enabled above threshold', () => {
    expect(shouldUseVirtualization(VIRTUALIZATION_THRESHOLD + 1)).toBe(true);
  });

  test('6) virtual window returns empty range when there are no rows', () => {
    const range = getVirtualWindow({ totalRows: 0, containerHeight: 300, rowHeight: 80 });
    expect(range).toEqual({
      startIndex: 0,
      endIndex: 0,
      topPadding: 0,
      bottomPadding: 0
    });
  });

  test('7) virtual window starts from top correctly', () => {
    const range = getVirtualWindow({
      scrollTop: 0,
      rowHeight: 80,
      containerHeight: 320,
      totalRows: 120,
      overscan: 2
    });

    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(6);
    expect(range.topPadding).toBe(0);
    expect(range.bottomPadding).toBe((120 - 6) * 80);
  });

  test('8) virtual window offsets range when scrolled down', () => {
    const range = getVirtualWindow({
      scrollTop: 1600,
      rowHeight: 80,
      containerHeight: 320,
      totalRows: 120,
      overscan: 2
    });

    expect(range.startIndex).toBe(18);
    expect(range.endIndex).toBe(26);
    expect(range.topPadding).toBe(18 * 80);
  });

  test('9) virtual window respects upper row boundary', () => {
    const range = getVirtualWindow({
      scrollTop: 10_000,
      rowHeight: 90,
      containerHeight: 360,
      totalRows: 40,
      overscan: 4
    });

    expect(range.endIndex).toBe(40);
    expect(range.bottomPadding).toBe(0);
  });

  test('10) virtual window never returns negative paddings', () => {
    const range = getVirtualWindow({
      scrollTop: 50,
      rowHeight: 80,
      containerHeight: 240,
      totalRows: 3,
      overscan: 10
    });

    expect(range.topPadding).toBeGreaterThanOrEqual(0);
    expect(range.bottomPadding).toBeGreaterThanOrEqual(0);
    expect(range.startIndex).toBeGreaterThanOrEqual(0);
    expect(range.endIndex).toBeLessThanOrEqual(3);
  });
});
