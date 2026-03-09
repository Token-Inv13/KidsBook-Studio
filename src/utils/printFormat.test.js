/** @jest-environment node */

import { getPrintFormatInches } from './printFormat';

describe('getPrintFormatInches', () => {
  test('converts mm dimensions to inches', () => {
    const result = getPrintFormatInches({
      width: 210,
      height: 297,
      unit: 'mm',
      bleed: true
    });

    expect(result.width).toBeCloseTo(8.2677, 3);
    expect(result.height).toBeCloseTo(11.6929, 3);
    expect(result.bleed).toBe(0.125);
    expect(result.unit).toBe('inches');
  });

  test('accepts explicit numeric bleed in mm', () => {
    const result = getPrintFormatInches({
      width: 210,
      height: 297,
      unit: 'mm',
      bleed: 3.2
    });

    expect(result.bleed).toBeCloseTo(0.126, 3);
  });
});
