import { emitKeypressEvents, type Key } from 'node:readline';
import type { Readable } from 'node:stream';
import type { Direction } from '../core/index.js';

/** A single key press, normalised so callers never deal with `undefined`. */
export interface KeyPress {
  readonly name: string;
  readonly sequence: string;
  readonly ctrl: boolean;
  readonly shift: boolean;
}

function firstString(...candidates: (string | undefined)[]): string {
  return candidates.find((candidate) => candidate !== undefined) ?? '';
}

/** Normalise readline's loosely-typed keypress payload. */
export function toKeyPress(sequence: string | undefined, key: Key | undefined): KeyPress {
  return {
    name: firstString(key?.name, sequence),
    sequence: firstString(key?.sequence, sequence),
    ctrl: key?.ctrl === true,
    shift: key?.shift === true,
  };
}

/** True for the key presses that mean "stop": q, Escape, or Ctrl-C. */
export function isQuit(key: KeyPress): boolean {
  return key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c');
}

const DIRECTION_BY_NAME: ReadonlyMap<string, Direction> = new Map([
  ['up', 'up'],
  ['down', 'down'],
  ['left', 'left'],
  ['right', 'right'],
  ['w', 'up'],
  ['s', 'down'],
  ['a', 'left'],
  ['d', 'right'],
]);

/** Arrow keys and W/A/S/D, case-insensitive; undefined for any other key (D18). */
export function toDirection(key: KeyPress): Direction | undefined {
  return DIRECTION_BY_NAME.get(key.name.toLowerCase());
}

interface RawModeStream extends Readable {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
}

function setRawMode(input: RawModeStream, enabled: boolean): void {
  if (input.isTTY === true && typeof input.setRawMode === 'function') {
    input.setRawMode(enabled);
  }
}

export interface KeyReader {
  /** The next key press, or undefined when input has ended (D16). */
  next(): Promise<KeyPress | undefined>;
  close(): void;
}

/** Attaches once and queues key presses, so a burst arriving in one chunk is never lost. */
export function createKeyReader(input: RawModeStream = process.stdin): KeyReader {
  emitKeypressEvents(input);
  setRawMode(input, true);
  input.resume();

  const queue: (KeyPress | undefined)[] = [];
  const waiters: ((value: KeyPress | undefined) => void)[] = [];
  let ended = false;

  const deliver = (value: KeyPress | undefined): void => {
    const waiter = waiters.shift();
    if (waiter !== undefined) {
      waiter(value);
    } else {
      queue.push(value);
    }
  };

  const onKeypress = (sequence: string | undefined, key: Key | undefined): void => {
    deliver(toKeyPress(sequence, key));
  };
  const onEnd = (): void => {
    if (!ended) {
      ended = true;
      setRawMode(input, false);
      deliver(undefined);
    }
  };

  input.on('keypress', onKeypress);
  input.on('end', onEnd);
  input.on('close', onEnd);

  return {
    next(): Promise<KeyPress | undefined> {
      if (queue.length > 0) {
        return Promise.resolve(queue.shift());
      }
      if (ended) {
        return Promise.resolve(undefined);
      }
      return new Promise((resolve) => waiters.push(resolve));
    },
    close(): void {
      input.off('keypress', onKeypress);
      input.off('end', onEnd);
      input.off('close', onEnd);
      setRawMode(input, false);
      input.pause();
    },
  };
}
