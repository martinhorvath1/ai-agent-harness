import type { Session } from '../core/index.js';
import { isQuit, toDirection, type KeyPress, type KeyReader } from './keys.js';
import type { Screen } from './screen.js';

function nextSession(session: Session, key: KeyPress): Session {
  const direction = toDirection(key);
  return direction === undefined ? session : session.press(direction);
}

/** Draws, reads, repeats; resolves 0 on a quit key, end of input, or game over (D9, D16, D17). */
export async function playLoop(session: Session, screen: Screen, keys: KeyReader): Promise<number> {
  let current = session;
  for (;;) {
    screen.draw(current.frame);
    if (current.over) {
      keys.close();
      return 0;
    }
    const key = await keys.next();
    if (key === undefined || isQuit(key)) {
      keys.close();
      return 0;
    }
    current = nextSession(current, key);
  }
}
