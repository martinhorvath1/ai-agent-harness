import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

// @D13 @D14
it('the retired baseline acceptance suite leaves nothing behind', () => {
  expect(existsSync(`${repoRoot}/tests/acceptance/baseline`)).toBe(false);
  expect(existsSync(`${repoRoot}/specs/baseline/acceptance.sha256`)).toBe(false);
});
