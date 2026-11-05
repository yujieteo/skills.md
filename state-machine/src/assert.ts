export function assert(condition: unknown, message: string): asserts condition {
  if (typeof message !== "string" || message === "") throw new Error("an assertion needs a message");
  if (!condition) throw new Error(`assertion failed: ${message}`);
}
