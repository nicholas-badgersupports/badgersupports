/* How a command that prints a report ends: it sets its exit status, then exits once stdout and stderr have taken
 * every byte written before it. A child's stdout to a pipe is written asynchronously, so process.exit() straight
 * after printing drops whatever the pipe has not yet taken, later failures and the tally line included.
 * A write's callback runs after every earlier write on that stream has been handed over, so the exit waits for both.
 */
export function finish(code) {
  process.exitCode = code;
  let open = 2;
  const done = () => { if (--open === 0) process.exit(code); };
  process.stdout.write("", done);
  process.stderr.write("", done);
}
