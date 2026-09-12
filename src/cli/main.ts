#!/usr/bin/env node
import { parseSeed, run, seededRandom, type CommandResult, type Dispatch, type RandomSource, type Session } from '../core/index.js';
import { createKeyReader } from './keys.js';
import { playLoop } from './play.js';
import { render } from './render.js';
import { createScreen } from './screen.js';

function resolveRandom(seed: number | undefined): RandomSource {
  return seed === undefined ? Math.random : seededRandom(seed);
}

function reportSeedError(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function writeText(result: CommandResult): void {
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${render(result)}\n`);
  process.exitCode = result.exitCode;
}

function runSession(session: Session): Promise<number> {
  const isTty = process.stdout.isTTY === true && process.stdin.isTTY === true;
  const screen = createScreen(process.stdout, isTty);
  const keys = createKeyReader(process.stdin);
  return playLoop(session, screen, keys);
}

async function handleDispatch(dispatch: Dispatch): Promise<void> {
  if (dispatch.kind === 'text') {
    writeText(dispatch.result);
    return;
  }
  process.exitCode = await runSession(dispatch.session);
}

async function main(): Promise<void> {
  const seedResult = parseSeed(process.env['PIPELINE_SEED']);
  if (!seedResult.ok) {
    reportSeedError(seedResult.message);
    return;
  }

  const dispatch = run(process.argv.slice(2), resolveRandom(seedResult.seed));
  await handleDispatch(dispatch);
}

await main();
