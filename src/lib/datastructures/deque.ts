import { EmptyError } from '@/lib/errors';

// #region Main Class
// =============================================================================

export class Deque<T> {
  private readonly frontElements: T[];
  private readonly backElements: T[];
  private frontOffset;
  private backOffset;

  constructor(array: T[] = []) {
    this.frontElements = [];
    this.backElements = [...array];
    this.frontOffset = 0;
    this.backOffset = 0;
  }

  public get front(): T | null {
    if (this.frontElements.length > this.frontOffset) {
      return this.frontElements[this.frontElements.length - 1];
    }
    if (this.backElements.length > this.backOffset) {
      return this.backElements[this.backOffset];
    }
    return null;
  }

  public get back(): T | null {
    if (this.backElements.length > this.backOffset) {
      return this.backElements[this.backElements.length - 1];
    }
    if (this.frontElements.length > this.frontOffset) {
      return this.frontElements[this.frontOffset];
    }
    return null;
  }

  public get size(): number {
    const frontSize = this.frontElements.length - this.frontOffset;
    const backSize = this.backElements.length - this.backOffset;
    return frontSize + backSize;
  }

  public get empty(): boolean {
    return this.size === 0;
  }

  public pushFront(value: T): this {
    this.frontElements.push(value);
    return this;
  }

  public pushBack(value: T): this {
    this.backElements.push(value);
    return this;
  }

  public popFront(): T | null {
    this.rebalance();
    if (this.frontElements.length > this.frontOffset) {
      // Take the value off the frontElements array.
      const value: T | null = this.frontElements.pop() ?? null;
      if (this.frontOffset >= this.frontElements.length) {
        this.frontElements.length = 0;
        this.frontOffset = 0;
      }
      return value;
    }
    if (this.backOffset < this.backElements.length) {
      // Take the value off the backElements array.
      const value: T = this.backElements[this.backOffset];
      this.backOffset += 1;
      if (this.backOffset >= this.backElements.length) {
        this.backElements.length = 0;
        this.backOffset = 0;
      } else if (2 * this.backOffset >= this.backElements.length) {
        this.backElements.splice(0, this.backOffset);
        this.backOffset = 0;
      }
      return value;
    }
    return null;
  }

  public popFrontOrThrow(): T {
    if (this.empty) {
      throw new Error('Attempted to pop from empty Deque');
    }
    return this.popFront() as T;
  }

  public popBack(): T | null {
    this.rebalance();
    if (this.backElements.length > this.backOffset) {
      // Take the value off the backElements array.
      const value: T | null = this.backElements.pop() ?? null;
      if (this.backOffset >= this.backElements.length) {
        this.backElements.length = 0;
        this.backOffset = 0;
      }
      return value;
    }
    if (this.frontOffset < this.frontElements.length) {
      // Take the value off of the frontElements array.
      const value: T = this.frontElements[this.frontOffset];
      this.frontOffset += 1;
      if (this.frontOffset >= this.frontElements.length) {
        this.frontElements.length = 0;
        this.frontOffset = 0;
      } else if (2 * this.frontOffset >= this.frontElements.length) {
        this.frontElements.splice(0, this.frontOffset);
        this.frontOffset = 0;
      }
      return value;
    }
    return null;
  }

  public popBackOrThrow(): T {
    if (this.empty) {
      throw new EmptyError('Attempted to pop from empty Deque');
    }
    return this.popBack() as T;
  }

  private rebalance(): void {
    if (this.frontElements.length < 1024 && this.backElements.length < 1024) {
      // No need to re-balance if the arrays are small.
      return;
    }
    if (this.frontElements.length >= 3 * this.backElements.length) {
      // Need to move elements from frontElements to backElements.
      this.frontElements.splice(0, this.frontOffset);
      this.backElements.splice(0, this.backOffset);
      this.frontOffset = 0;
      this.backOffset = 0;
      const numDesired: number = this.size >>> 1;
      const numToMove: number = this.frontElements.length - numDesired;
      const elements: T[] = this.frontElements.splice(0, numToMove);
      this.backElements.reverse();
      this.backElements.push(...elements);
      this.backElements.reverse();
      return;
    }

    if (this.backElements.length >= 3 * this.frontElements.length) {
      // Need to move elements from backElements to frontElements.
      this.frontElements.splice(0, this.frontOffset);
      this.backElements.splice(0, this.backOffset);
      this.frontOffset = 0;
      this.backOffset = 0;
      const numDesired: number = this.size >>> 1;
      const numToMove: number = this.backElements.length - numDesired;
      const elements: T[] = this.backElements.splice(0, numToMove);
      this.frontElements.reverse();
      this.frontElements.push(...elements);
      this.frontElements.reverse();
      return;
    }
  }
}

// #endregion
