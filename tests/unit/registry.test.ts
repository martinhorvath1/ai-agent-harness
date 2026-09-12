import { describe, expect, it } from 'vitest';
import { buildUsage, commands, run } from '../../src/core/game/registry.js';

function fixedRandom() {
  return 0.5;
}

describe('commands', () => {
  it('lists play and nothing else', () => {
    expect(Array.from(commands.keys())).toEqual(['play']);
  });
});

describe('buildUsage', () => {
  it('joins each entry onto its own line, not concatenated together', () => {
    const entries = new Map([
      ['play', 'play 2048'],
      ['score', 'show the high score'],
    ]);

    const usage = buildUsage(entries);

    expect(usage).toContain('  play   play 2048\n  score   show the high score');
    // A broken join (e.g. '' instead of '\n') would run the two lines together with no
    // separator, which this line count catches even if the substring check above did not.
    expect(usage.split('\n')).toHaveLength(5);
  });
});

describe('run', () => {
  it('returns usage text with exit code 1 when no command is given', () => {
    const dispatch = run([], fixedRandom);
    expect(dispatch.kind).toBe('text');
    if (dispatch.kind === 'text') {
      expect(dispatch.result.output).toContain('usage:');
      expect(dispatch.result.exitCode).toBe(1);
    }
  });

  it.each(['--help', '-h'])('returns usage text with exit code 0 for %s', (flag) => {
    const dispatch = run([flag], fixedRandom);
    expect(dispatch.kind).toBe('text');
    if (dispatch.kind === 'text') {
      expect(dispatch.result.output).toContain('play');
      expect(dispatch.result.exitCode).toBe(0);
    }
  });

  it('starts a play session with no further args', () => {
    const dispatch = run(['play'], fixedRandom);
    expect(dispatch.kind).toBe('session');
    if (dispatch.kind === 'session') {
      expect(dispatch.session.frame).toContain('2048');
    }
  });

  it('rejects play with extra arguments', () => {
    const dispatch = run(['play', 'extra'], fixedRandom);
    expect(dispatch).toEqual({ kind: 'text', result: { output: 'usage: play', exitCode: 1 } });
  });

  it('reports an unknown command', () => {
    const dispatch = run(['nope'], fixedRandom);
    expect(dispatch.kind).toBe('text');
    if (dispatch.kind === 'text') {
      expect(dispatch.result.output).toContain('unknown command: nope');
      expect(dispatch.result.exitCode).toBe(1);
    }
  });
});
