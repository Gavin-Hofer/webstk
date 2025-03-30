import { Deque } from '@/lib/datastructures/deque';
import { isValidInteger } from '@/lib/validation/numbers';
import { ValueError } from '@/lib/errors';

// #region Types
// =============================================================================

type Task<T> = () => Promise<T>;

// #region Main Function
// =============================================================================

/**
 * Executes a collection of asynchronous tasks with a specified concurrency limit.
 *
 * This function processes tasks in order, but limits the number of concurrently
 * executing tasks to the specified concurrency value. Results are returned in
 * order of task completion.
 *
 * If any of the tasks reject, then the entire promise will be rejected.
 *
 * Conditions:
 *  - Concurrency must be a positive integer
 *
 * Assumptions:
 *  - Tasks must be executable functions that return a Promise
 *
 * @param tasks - Array of asynchronous functions to execute
 * @param concurrency - Maximum number of tasks to execute simultaneously
 * @returns An array containing the results of all executed tasks in order of completion
 * @throws ValueError if concurrency is not a positive integer
 */
export async function promisePool<T>(
  tasks: Iterable<Task<T>>,
  concurrency: number,
): Promise<T[]> {
  if (!isValidInteger(concurrency) || concurrency <= 0) {
    const message = `Invalid value for concurrency: ${concurrency} (must be a positive integer)`;
    throw new ValueError(message);
  }
  const results: T[] = [];
  for await (const result of promisePoolGenerator(tasks, concurrency)) {
    results.push(result);
  }
  return results;
}

/**
 * Executes a collection of asynchronous tasks with a specified concurrency limit as an async generator.
 *
 * This generator processes tasks in order, but limits the number of concurrently
 * executing tasks to the specified concurrency value. Results are yielded in
 * order of task completion.
 *
 * If any of the tasks reject, then the entire generator will throw an error.
 *
 * Conditions:
 *  - Concurrency must be a positive integer
 *
 * Assumptions:
 *  - Tasks must be executable functions that return a Promise
 *
 * @param tasks - Iterable of asynchronous functions to execute
 * @param concurrency - Maximum number of tasks to execute simultaneously
 * @yields Results of each task as they complete
 * @throws ValueError if concurrency is not a positive integer
 */
export async function* promisePoolGenerator<T>(
  tasks: Iterable<Task<T>>,
  concurrency: number,
): AsyncGenerator<T> {
  if (!isValidInteger(concurrency) || concurrency <= 0) {
    const message = `Invalid value for concurrency: ${concurrency} (must be a positive integer)`;
    throw new ValueError(message);
  }
  const queue = new Deque<Promise<T>>();
  for (const task of tasks) {
    while (queue.size >= concurrency) {
      yield await queue.popFrontOrThrow();
    }
    queue.pushBack(task());
  }
  while (!queue.empty) {
    yield await queue.popFrontOrThrow();
  }
}
