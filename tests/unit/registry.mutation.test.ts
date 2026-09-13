import { describe, expect, it } from 'vitest';
import { run } from '../../src/core/index.js';

function fixedRandom(): number {
  return 0.5;
}

describe('run usage text', () => {
  it('includes each command\'s summary, not just its name', () => {
    const dispatch = run(['--help'], fixedRandom);
    expect(dispatch.kind).toBe('text');
    if (dispatch.kind === 'text') {
      expect(dispatch.result.output).toContain('play 2048');
    }
  });

  it('does not report an unknown command when no arguments are given', () => {
    const dispatch = run([], fixedRandom);
    expect(dispatch.kind).toBe('text');
    if (dispatch.kind === 'text') {
      expect(dispatch.result.output).not.toContain('unknown command');
    }
  });
});
