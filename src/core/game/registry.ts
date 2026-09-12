import type { CommandResult } from '../model/command-result.js';
import type { RandomSource } from '../model/random-source.js';
import { newSession, type Session } from './session.js';

export type Dispatch =
  | { readonly kind: 'text'; readonly result: CommandResult }
  | { readonly kind: 'session'; readonly session: Session };

function textDispatch(output: string, exitCode: number): Dispatch {
  return { kind: 'text', result: { output, exitCode } };
}

/** A registered command: its usage-text summary and how it turns args into a `Dispatch`. */
interface CommandDefinition {
  readonly summary: string;
  readonly dispatch: (args: readonly string[], random: RandomSource) => Dispatch;
}

function dispatchPlay(args: readonly string[], random: RandomSource): Dispatch {
  if (args.length > 0) {
    return textDispatch('usage: play', 1);
  }
  return { kind: 'session', session: newSession(random) };
}

/**
 * The single source of truth for the command surface: each entry's summary drives the
 * usage text (A5) and its `dispatch` drives behaviour, so the two cannot drift apart —
 * a name cannot be advertised without also defining what it does.
 */
const COMMAND_DEFINITIONS: ReadonlyMap<string, CommandDefinition> = new Map([
  ['play', { summary: 'play 2048', dispatch: dispatchPlay }],
]);

/** name -> one-line summary; the usage text is built from this map (A5). */
export const commands: ReadonlyMap<string, string> = new Map(
  Array.from(COMMAND_DEFINITIONS.entries()).map(([name, definition]) => [name, definition.summary]),
);

/** Formats the usage text from a name -> summary map; a seam so the join can be tested
 *  over more than the one entry `commands` happens to hold today. */
export function buildUsage(entries: ReadonlyMap<string, string> = commands): string {
  const lines = Array.from(entries.entries()).map(([name, summary]) => `  ${name}   ${summary}`);
  return `usage: pipeline <command> [args]\n\ncommands:\n${lines.join('\n')}`;
}

const usage = buildUsage();

/** Dispatch `argv` (without node/script) to text output or a play session. */
export function run(argv: readonly string[], random: RandomSource): Dispatch {
  const name = argv[0];
  if (name === undefined || name === '--help' || name === '-h') {
    return textDispatch(usage, name === undefined ? 1 : 0);
  }
  const definition = COMMAND_DEFINITIONS.get(name);
  if (definition === undefined) {
    return textDispatch(`unknown command: ${name}\n\n${usage}`, 1);
  }
  return definition.dispatch(argv.slice(1), random);
}
