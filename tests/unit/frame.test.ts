import { describe, expect, it } from 'vitest';
import { renderFrame } from '../../src/core/rules/frame.js';
import type { Board } from '../../src/core/model/board.js';
import type { GameState } from '../../src/core/model/game-state.js';

const EMPTY_BOARD: Board = new Array(16).fill(null);

describe('renderFrame', () => {
  it('assembles title, score, blank, grid, blank, hint with no trailing newline', () => {
    const state: GameState = { board: EMPTY_BOARD, score: 0, won: false, over: false };
    const frame = renderFrame(state);
    const lines = frame.split('\n');
    expect(lines[0]).toBe('2048');
    expect(lines[1]).toBe('Score: 0');
    expect(lines[2]).toBe('');
    expect(lines[lines.length - 2]).toBe('');
    expect(lines[lines.length - 1]).toBe('Arrows/WASD to move - q to quit');
    expect(frame.endsWith('\n')).toBe(false);
  });

  it('renders the score from the state', () => {
    const state: GameState = { board: EMPTY_BOARD, score: 42, won: false, over: false };
    expect(renderFrame(state).split('\n')[1]).toBe('Score: 42');
  });

  it('shows "Game over" before the hint when the state is over', () => {
    const state: GameState = { board: EMPTY_BOARD, score: 0, won: false, over: true };
    const lines = renderFrame(state).split('\n');
    expect(lines[lines.length - 2]).toBe('Game over');
  });

  it('shows "You win!" before the hint when the state is won', () => {
    const state: GameState = { board: EMPTY_BOARD, score: 0, won: true, over: false };
    const lines = renderFrame(state).split('\n');
    expect(lines[lines.length - 2]).toBe('You win!');
  });

  it('prefers "Game over" over "You win!" when both apply', () => {
    const state: GameState = { board: EMPTY_BOARD, score: 0, won: true, over: true };
    const lines = renderFrame(state).split('\n');
    expect(lines[lines.length - 2]).toBe('Game over');
    expect(renderFrame(state)).not.toContain('You win!');
  });

  it('accepts a bare board, deriving won/over from its contents', () => {
    const won: Board = [2048, ...new Array<null>(15).fill(null)];
    const lines = renderFrame(won).split('\n');
    expect(lines[lines.length - 2]).toBe('You win!');
  });
});
