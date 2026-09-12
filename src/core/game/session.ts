import type { Direction } from '../model/direction.js';
import type { GameState } from '../model/game-state.js';
import type { RandomSource } from '../model/random-source.js';
import { renderFrame } from '../rules/frame.js';
import { nextState, startGame } from './turn.js';

export interface Session {
  /** The frame text for the current state. */
  readonly frame: string;
  /** True when no legal move remains: the shell draws this frame and stops (D9). */
  readonly over: boolean;
  /** The session after a direction key. */
  press(direction: Direction): Session;
}

function buildSession(state: GameState, random: RandomSource): Session {
  return {
    frame: renderFrame(state),
    over: state.over,
    press: (direction: Direction) => sessionFrom(nextState(state, direction, random), random),
  };
}

/** A session over an arbitrary state; the seam acceptance tests use to set a position up. */
export function sessionFrom(state: GameState, random: RandomSource): Session {
  return buildSession(state, random);
}

/** A session over a fresh game. */
export function newSession(random: RandomSource): Session {
  return sessionFrom(startGame(random), random);
}
