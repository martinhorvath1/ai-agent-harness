import { describe, expect, it } from 'vitest';
import { playLoop } from '../../src/cli/play.js';
import { newSession } from '../../src/core/game/session.js';
import type { KeyPress, KeyReader } from '../../src/cli/keys.js';
import type { Screen } from '../../src/cli/screen.js';
import type { Direction, Session } from '../../src/core/index.js';

function key(name: string, ctrl = false): KeyPress {
  return { name, sequence: name, ctrl, shift: false };
}

function fakeReader(keys: readonly (KeyPress | undefined)[]): KeyReader & { closed: boolean } {
  const queue = [...keys];
  const reader = {
    closed: false,
    next: () => Promise.resolve(queue.shift()),
    close(): void {
      reader.closed = true;
    },
  };
  return reader;
}

function fakeScreen(): Screen & { frames: string[] } {
  const frames: string[] = [];
  return {
    frames,
    draw(frame: string): void {
      frames.push(frame);
    },
  };
}

function randomAt(value: number) {
  return () => value;
}

/** A `Session` that records every direction passed to `press`, so the wiring from key to
 *  direction is observable independently of the real move rules. */
function recordingSession(): Session & { pressed: Direction[] } {
  const pressed: Direction[] = [];
  const session: Session & { pressed: Direction[] } = {
    pressed,
    frame: 'frame',
    over: false,
    press(direction: Direction): Session {
      pressed.push(direction);
      return session;
    },
  };
  return session;
}

/** A `Session` fixed on one frame, `over` from the start: the loop must draw it and stop
 *  without asking `keys` for another key (D9). */
function overSession(frame = 'game over frame'): Session {
  return {
    frame,
    over: true,
    press(): Session {
      throw new Error('press should not be called once the session is over');
    },
  };
}

describe('playLoop', () => {
  it('draws one frame and resolves 0 on a quit key', async () => {
    const session = newSession(randomAt(0.5));
    const screen = fakeScreen();
    const reader = fakeReader([key('q')]);

    const exitCode = await playLoop(session, screen, reader);

    expect(exitCode).toBe(0);
    expect(screen.frames).toHaveLength(1);
    expect(reader.closed).toBe(true);
  });

  it('resolves 0 on end of input (undefined key)', async () => {
    const session = newSession(randomAt(0.5));
    const screen = fakeScreen();
    const reader = fakeReader([undefined]);

    const exitCode = await playLoop(session, screen, reader);

    expect(exitCode).toBe(0);
    expect(screen.frames).toHaveLength(1);
  });

  it('presses a direction key and redraws, then quits', async () => {
    const session = recordingSession();
    const screen = fakeScreen();
    const reader = fakeReader([key('up'), key('q')]);

    await playLoop(session, screen, reader);

    expect(screen.frames).toHaveLength(2);
    expect(session.pressed).toEqual(['up']);
  });

  it('draws the over frame and resolves 0 without reading a key (D9)', async () => {
    const session = overSession('final frame');
    const screen = fakeScreen();
    const reader = fakeReader([]);
    let nextCalled = false;
    const spyingReader: KeyReader & { closed: boolean } = {
      ...reader,
      next: () => {
        nextCalled = true;
        return reader.next();
      },
    };

    const exitCode = await playLoop(session, screen, spyingReader);

    expect(exitCode).toBe(0);
    expect(screen.frames).toEqual(['final frame']);
    expect(nextCalled).toBe(false);
    expect(reader.closed).toBe(true);
  });

  it('ignores a key that is not a direction or quit key', async () => {
    const session = newSession(randomAt(0.5));
    const screen = fakeScreen();
    const reader = fakeReader([key('x'), key('q')]);

    await playLoop(session, screen, reader);

    expect(screen.frames).toHaveLength(2);
  });

  it('quits on ctrl-c', async () => {
    const session = newSession(randomAt(0.5));
    const screen = fakeScreen();
    const reader = fakeReader([key('c', true)]);

    const exitCode = await playLoop(session, screen, reader);

    expect(exitCode).toBe(0);
    expect(screen.frames).toHaveLength(1);
  });

  it.each([
    ['up', 'up'],
    ['w', 'up'],
    ['down', 'down'],
    ['s', 'down'],
    ['left', 'left'],
    ['a', 'left'],
    ['right', 'right'],
    ['d', 'right'],
  ] as const)('presses %s -> session.press is called with %s', async (name, direction) => {
    const session = recordingSession();
    const screen = fakeScreen();
    const reader = fakeReader([key(name), key('q')]);

    await playLoop(session, screen, reader);

    expect(session.pressed).toEqual([direction]);
  });

  it('does not call press for a key that is not a direction key', async () => {
    const session = recordingSession();
    const screen = fakeScreen();
    const reader = fakeReader([key('x'), key('q')]);

    await playLoop(session, screen, reader);

    expect(session.pressed).toEqual([]);
  });
});
