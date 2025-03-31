/** Error for invalid input values. */
export class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Error for empty collections. */
export class EmptyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}