export interface Screen {
  draw(frame: string): void;
}

const ESC = '\x1B';
const CLEAR_SCREEN = `${ESC}[2J${ESC}[0;0H`;

/** Clears the screen before each frame only when `isTty` is true; otherwise appends (D15). */
export function createScreen(out: NodeJS.WritableStream, isTty: boolean): Screen {
  return {
    draw(frame: string): void {
      const prefix = isTty ? CLEAR_SCREEN : '';
      out.write(`${prefix}${frame}\n`);
    },
  };
}
