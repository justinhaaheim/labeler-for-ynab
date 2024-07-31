// Currency.test.ts
import {areEqualWithPrecision} from './Currency';

describe('areEqualWithPrecision', () => {
  test('should return true for numbers that are equal with the specified precision', () => {
    expect(areEqualWithPrecision(1.12343, 1.12344, 4)).toBe(true);
    expect(areEqualWithPrecision(1.12345, 1.12345, 5)).toBe(true);
    expect(areEqualWithPrecision(123.456, 123.456, 3)).toBe(true);
  });

  test('should return false for numbers that are not equal with the specified precision', () => {
    expect(areEqualWithPrecision(1.12345, 1.12344, 5)).toBe(false);
    expect(areEqualWithPrecision(1.12345, 1.12346, 5)).toBe(false);
    expect(areEqualWithPrecision(123.456, 123.457, 3)).toBe(false);
  });

  test('should handle very small numbers correctly', () => {
    expect(areEqualWithPrecision(0.00000123, 0.00000124, 7)).toBe(true);
    expect(areEqualWithPrecision(0.00000123, 0.00000125, 7)).toBe(false);
  });

  test('should handle very large numbers correctly', () => {
    expect(areEqualWithPrecision(123456789.12345, 123456789.12344, 4)).toBe(
      true,
    );
    expect(areEqualWithPrecision(123456789.12345, 123456789.12346, 5)).toBe(
      false,
    );
  });

  test('should handle different values for the digits parameter', () => {
    expect(areEqualWithPrecision(1.1112, 1.1113, 3)).toBe(true);
    expect(areEqualWithPrecision(1.1112, 1.1113, 4)).toBe(false);

    expect(areEqualWithPrecision(1.11112, 1.11113, 4)).toBe(true);
    expect(areEqualWithPrecision(1.11112, 1.11113, 5)).toBe(false);
  });

  test('rounds predictably', () => {
    expect(areEqualWithPrecision(5.123, 5.125, 2)).toBe(false);
    expect(areEqualWithPrecision(5.123, 5.124, 2)).toBe(true);
  });

  test('handles a real-life scenario as expected', () => {
    const itemsTotal = 5 + 2.26 + 80.51; // 87.77000000000001
    const expectedTotal = 87.77;

    expect(itemsTotal).not.toStrictEqual(expectedTotal);
    expect(areEqualWithPrecision(itemsTotal, expectedTotal, 2)).toBe(true);
  });

  test('throws if a negative number is passed for digits', () => {
    expect(() => areEqualWithPrecision(1, 1, -2)).toThrow();
  });
});
