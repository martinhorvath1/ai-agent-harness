import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createKeyReader, isQuit, toDirection, toKeyPress } from '../../src/cli/keys.js';

const ESCAPE = String.fromCharCode(27);
const CTRL_C = String.fromCharCode(3);
const TIMEOUT_SENTINEL = Symbol('no resolution within the wait window');

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Races `promise` against a short timer, so we can assert it never resolves. */
function settledOrTimeout(promise: Promise<unknown>): Promise<unknown> {
  return Promise.race([promise, delay(20).then(() => TIMEOUT_SENTINEL)]);
}

/** A stream that looks like a TTY: `isTTY` is true and `setRawMode` is a spy. */
function fakeTtyStream(): PassThrough & { isTTY: true; setRawMode: ReturnType<typeof vi.fn> } {
  const stream = new PassThrough() as PassThrough & { isTTY: true; setRawMode: ReturnType<typeof vi.fn> };
  stream.isTTY = true;
  stream.setRawMode = vi.fn();
  return stream;
}

describe('toKeyPress', () => {
  it('normalises a readline key payload', () => {
    const key = toKeyPress('a', { name: 'a', sequence: 'a', ctrl: false, meta: false, shift: false });
    expect(key).toEqual({ name: 'a', sequence: 'a', ctrl: false, shift: false });
  });

  it('carries a true ctrl flag through, not just a false one', () => {
    const key = toKeyPress('c', { name: 'c', sequence: 'c', ctrl: true, meta: false, shift: false });
    expect(key.ctrl).toBe(true);
  });

  it('carries a true shift flag through, not just a false one', () => {
    const key = toKeyPress('A', { name: 'a', sequence: 'A', ctrl: false, meta: false, shift: true });
    expect(key.shift).toBe(true);
  });

  it('falls back to the raw sequence when readline gives no key', () => {
    expect(toKeyPress('x', undefined)).toEqual({ name: 'x', sequence: 'x', ctrl: false, shift: false });
  });

  it('tolerates a missing sequence and key', () => {
    expect(toKeyPress(undefined, undefined)).toEqual({ name: '', sequence: '', ctrl: false, shift: false });
  });
});

describe('isQuit', () => {
  it('treats q as quit', () => {
    expect(isQuit(toKeyPress('q', { name: 'q', ctrl: false, meta: false, shift: false }))).toBe(true);
  });

  it('treats escape as quit', () => {
    expect(isQuit(toKeyPress(ESCAPE, { name: 'escape', ctrl: false, meta: false, shift: false }))).toBe(true);
  });

  it('treats ctrl-c as quit', () => {
    expect(isQuit(toKeyPress(CTRL_C, { name: 'c', ctrl: true, meta: false, shift: false }))).toBe(true);
  });

  it('does not treat an ordinary key as quit', () => {
    expect(isQuit(toKeyPress('h', { name: 'h', ctrl: false, meta: false, shift: false }))).toBe(false);
  });

  it('requires both ctrl and the c key together, not either alone', () => {
    // ctrl held with a different key: neither "ctrl OR name==='c'" nor "ctrl AND true"
    // would be correct relaxations of the real "ctrl AND name==='c'" contract.
    expect(isQuit(toKeyPress('x', { name: 'x', ctrl: true, meta: false, shift: false }))).toBe(false);
  });
});

describe('toDirection', () => {
  it.each([
    ['up', 'up'],
    ['down', 'down'],
    ['left', 'left'],
    ['right', 'right'],
    ['w', 'up'],
    ['W', 'up'],
    ['s', 'down'],
    ['S', 'down'],
    ['a', 'left'],
    ['A', 'left'],
    ['d', 'right'],
    ['D', 'right'],
  ] as const)('maps key name %s to direction %s', (name, direction) => {
    expect(toDirection(toKeyPress(name, { name, ctrl: false, meta: false, shift: false }))).toBe(direction);
  });

  it('returns undefined for a non-direction key', () => {
    expect(toDirection(toKeyPress('x', { name: 'x', ctrl: false, meta: false, shift: false }))).toBeUndefined();
  });

  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'does not resolve a key named after an Object.prototype member (%s) to a function',
    (name) => {
      const key = toKeyPress(name, { name, ctrl: false, meta: false, shift: false });
      expect(toDirection(key)).toBeUndefined();
    },
  );
});

describe('createKeyReader', () => {
  it('resolves with the next key written to the stream', async () => {
    const input = new PassThrough();
    const reader = createKeyReader(input);
    const pending = reader.next();
    input.write('h');
    await expect(pending).resolves.toMatchObject({ name: 'h', sequence: 'h' });
    reader.close();
  });

  it('queues a burst of keys arriving in one chunk so none are lost', async () => {
    const input = new PassThrough();
    const reader = createKeyReader(input);
    input.write('ab');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const first = await reader.next();
    const second = await reader.next();
    expect(first).toMatchObject({ name: 'a' });
    expect(second).toMatchObject({ name: 'b' });
    reader.close();
  });

  it('resolves with undefined when input ends', async () => {
    const input = new PassThrough();
    const reader = createKeyReader(input);
    const pending = reader.next();
    input.end();
    await expect(pending).resolves.toBeUndefined();
  });

  it('resolves with undefined immediately once input has already ended', async () => {
    const input = new PassThrough();
    const reader = createKeyReader(input);
    // Consume the end-of-input signal once via the pending waiter path, leaving the queue
    // empty, so the second call can only succeed through the `ended` fast path.
    const first = reader.next();
    input.end();
    await expect(first).resolves.toBeUndefined();
    await expect(reader.next()).resolves.toBeUndefined();
  });

  it('resolves with undefined when the stream emits a close event with no prior end', async () => {
    const input = new PassThrough();
    const reader = createKeyReader(input);
    const pending = reader.next();
    input.emit('close');
    await expect(pending).resolves.toBeUndefined();
  });

  it('a second reader created on the same stream after close() still receives keys', async () => {
    // close() pauses the stream (readableFlowing = false). createKeyReader relies on its own
    // explicit resume() to bring the stream back to flowing mode for the new reader --
    // emitKeypressEvents alone does not re-resume a stream that was explicitly paused.
    const input = new PassThrough();
    const first = createKeyReader(input);
    first.close();

    const second = createKeyReader(input);
    const pending = second.next();
    input.write('a');

    await expect(pending).resolves.toMatchObject({ name: 'a' });
    second.close();
  });
});

describe('createKeyReader and raw mode', () => {
  it('enables raw mode on creation when the stream is a TTY that supports it', () => {
    const input = fakeTtyStream();
    createKeyReader(input);
    expect(input.setRawMode).toHaveBeenCalledWith(true);
  });

  it('never touches raw mode when the stream is not a TTY', () => {
    const input = new PassThrough() as PassThrough & { setRawMode: ReturnType<typeof vi.fn> };
    input.setRawMode = vi.fn();
    createKeyReader(input);
    expect(input.setRawMode).not.toHaveBeenCalled();
  });

  it('turns raw mode off once, exactly when input ends', async () => {
    const input = fakeTtyStream();
    const reader = createKeyReader(input);
    const pending = reader.next();
    input.emit('end');
    await expect(pending).resolves.toBeUndefined();
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
    const callsAfterFirstEnd = input.setRawMode.mock.calls.length;

    // A defensive re-check: the exported contract guards against running its end-of-input
    // handling twice, regardless of whether a real stream could ever emit 'end' again.
    input.emit('end');
    expect(input.setRawMode.mock.calls.length).toBe(callsAfterFirstEnd);
  });

  it('turns raw mode off on close()', () => {
    const input = fakeTtyStream();
    const reader = createKeyReader(input);
    input.setRawMode.mockClear();
    reader.close();
    expect(input.setRawMode).toHaveBeenCalledWith(false);
  });

  it('pauses the stream on close(), so a resumed TTY does not keep the event loop alive', () => {
    const input = fakeTtyStream();
    const pauseSpy = vi.spyOn(input, 'pause');
    const reader = createKeyReader(input);
    expect(pauseSpy).not.toHaveBeenCalled();
    reader.close();
    expect(pauseSpy).toHaveBeenCalledTimes(1);
  });
});

describe('KeyReader#close', () => {
  it('stops delivering key presses after close', async () => {
    const input = new PassThrough();
    const reader = createKeyReader(input);
    reader.close();

    const pending = reader.next();
    input.emit('keypress', 'h', { name: 'h' });

    expect(await settledOrTimeout(pending)).toBe(TIMEOUT_SENTINEL);
  });

  it('stops a later end event from resolving a pending read', async () => {
    const input = new PassThrough();
    const reader = createKeyReader(input);
    reader.close();

    const pending = reader.next();
    input.emit('end');

    expect(await settledOrTimeout(pending)).toBe(TIMEOUT_SENTINEL);
  });

  it('stops a later close event from resolving a pending read', async () => {
    const input = new PassThrough();
    const reader = createKeyReader(input);
    reader.close();

    const pending = reader.next();
    input.emit('close');

    expect(await settledOrTimeout(pending)).toBe(TIMEOUT_SENTINEL);
  });
});
