import type { CommandResult } from '../core/index.js';

/** Render a command result as the exact text the shell writes, without the trailing newline. */
export function render(result: CommandResult): string {
  return result.output;
}
