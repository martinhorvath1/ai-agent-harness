import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createScreen } from '../../src/cli/screen.js';

const ESCAPE = String.fromCharCode(27);

function collect(stream: PassThrough): string {
  const chunk = stream.read() as Buffer | string | null;
  return chunk === null ? '' : chunk.toString();
}

describe('createScreen', () => {
  it('appends frames without clearing when not a TTY', () => {
    const out = new PassThrough();
    const screen = createScreen(out, false);
    screen.draw('frame one');
    screen.draw('frame two');
    const written = collect(out);
    expect(written.includes(ESCAPE)).toBe(false);
    expect(written).toBe('frame one\nframe two\n');
  });

  it('clears the screen before each frame on a TTY', () => {
    const out = new PassThrough();
    const screen = createScreen(out, true);
    screen.draw('frame one');
    const written = collect(out);
    expect(written.startsWith(ESCAPE)).toBe(true);
    expect(written).toContain('frame one');
  });
});
