/** Result of running a command: what to print and the process exit code. */
export interface CommandResult {
  readonly output: string;
  readonly exitCode: number;
}
