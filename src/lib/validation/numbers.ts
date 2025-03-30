/** Returns true if the input is a valid integer between the safe bounds. */
export function isValidInteger(x: number): boolean {
  return (
    Number.isInteger(x) &&
    x >= Number.MIN_SAFE_INTEGER &&
    x <= Number.MAX_SAFE_INTEGER
  );
}
