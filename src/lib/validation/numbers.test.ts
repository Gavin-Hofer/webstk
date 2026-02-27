import { describe, expect, test } from 'vitest';

import { isValidInteger } from './numbers';

describe('isValidInteger', () => {
  test('returns true for integers in safe range', () => {
    expect(isValidInteger(Number.MAX_SAFE_INTEGER - 1)).toBeTruthy();
  });

  test('returns false for non-integers', () => {
    expect(isValidInteger(1.5)).toBeFalsy();
  });

  test('returns false outside safe integer bounds', () => {
    expect(isValidInteger(Number.MAX_SAFE_INTEGER + 1)).toBeFalsy();
  });
});
