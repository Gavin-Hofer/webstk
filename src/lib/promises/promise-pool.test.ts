import { expect, test, vi } from 'vitest';

import { ValueError } from '@/lib/errors';
import { promisePool } from './promise-pool';

// Basic functionality tests
test('promisePool should execute tasks with concurrency limit', async () => {
  const results = await promisePool(
    [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ],
    2,
  );

  expect(results).toHaveLength(3);
  expect(results[0]).toBe(1);
  expect(results[1]).toBe(2);
  expect(results[2]).toBe(3);
});

// Concurrency tests
test('promisePool should limit concurrent executions', async () => {
  const executingTasks = new Set();
  const maxConcurrent = { count: 0 };

  const createTask = (id: number) => async () => {
    executingTasks.add(id);
    maxConcurrent.count = Math.max(maxConcurrent.count, executingTasks.size);

    // Simulate some async work
    await new Promise((resolve) => setTimeout(resolve, 10));

    executingTasks.delete(id);
    return id;
  };

  const tasks = Array.from({ length: 10 }, (_, i) => createTask(i));
  const concurrency = 3;

  const results = await promisePool(tasks, concurrency);

  expect(results).toHaveLength(10);
  expect(maxConcurrent.count).toBeLessThanOrEqual(concurrency);
  // Verify all tasks were executed
  expect(new Set(results).size).toBe(10);
});

// Test task order and result order
test('tasks are processed in order but results may be in completion order', async () => {
  const executionOrder: number[] = [];

  const createTask = (id: number, delay: number) => async () => {
    executionOrder.push(id);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return id;
  };

  const tasks = [
    createTask(1, 30), // Slow task
    createTask(2, 10), // Fast task
    createTask(3, 20), // Medium task
  ];

  const results = await promisePool(tasks, 3);

  // Tasks should be started in order
  expect(executionOrder).toEqual([1, 2, 3]);

  // For this specific case, with the given delays and full concurrency,
  // results should be in order of completion (not necessarily execution)
  expect(results).toHaveLength(3);
  expect(results).toContain(1);
  expect(results).toContain(2);
  expect(results).toContain(3);
});

// Error propagation tests
test('promisePool should propagate errors from tasks', async () => {
  const error = new Error('Task failed');

  const tasks = [
    () => Promise.resolve(1),
    () => Promise.reject(error),
    () => Promise.resolve(3),
  ];

  await expect(promisePool(tasks, 1)).rejects.toThrow(error);
});

// Input validation tests
test('promisePool should throw ValueError for invalid concurrency values', async () => {
  const tasks = [() => Promise.resolve(1)];

  // Non-positive number
  await expect(promisePool(tasks, 0)).rejects.toThrow(ValueError);
  await expect(promisePool(tasks, -1)).rejects.toThrow(ValueError);

  // Non-integer
  await expect(promisePool(tasks, 1.5)).rejects.toThrow(ValueError);

  // NaN
  await expect(promisePool(tasks, Number.NaN)).rejects.toThrow(ValueError);
});

// Edge cases
test('promisePool should handle empty task list', async () => {
  const results = await promisePool([], 1);
  expect(results).toEqual([]);
});

test('promisePool should handle large number of tasks', async () => {
  const numTasks = 100;
  const tasks = Array.from({ length: numTasks }, (_, i) => async () => i);

  const results = await promisePool(tasks, 5);

  expect(results).toHaveLength(numTasks);
  // Verify all expected values are in the results
  for (let i = 0; i < numTasks; i++) {
    expect(results).toContain(i);
  }
});

// Test with varying task durations
test('promisePool handles tasks with varying durations', async () => {
  const createTask = (id: number, duration: number) => async () => {
    await new Promise((resolve) => setTimeout(resolve, duration));
    return id;
  };

  const tasks = [
    createTask(1, 50), // Slow
    createTask(2, 10), // Fast
    createTask(3, 30), // Medium
    createTask(4, 40), // Medium-slow
    createTask(5, 20), // Medium-fast
  ];

  const results = await promisePool(tasks, 2);

  expect(results).toHaveLength(5);
  expect(new Set(results)).toEqual(new Set([1, 2, 3, 4, 5]));
});

// Test with complex return types
test('promisePool works with complex return types', async () => {
  type ComplexType = { id: number; data: string };
  const tasks = [
    async () => ({ id: 1, data: 'one' }),
    async () => ({ id: 2, data: 'two' }),
    async () => ({ id: 3, data: 'three' }),
  ];

  const results = await promisePool<ComplexType>(tasks, 2);

  expect(results).toHaveLength(3);
  expect(results).toContainEqual({ id: 1, data: 'one' });
  expect(results).toContainEqual({ id: 2, data: 'two' });
  expect(results).toContainEqual({ id: 3, data: 'three' });
});

// Test with simulated real-world scenario
test('promisePool simulates a real-world API fetching scenario', async () => {
  type UserData = { id: number; data: string };

  // Mock API fetch
  const mockFetch = vi.fn().mockImplementation(async (id: number) => {
    const delay = Math.floor(Math.random() * 50) + 10; // Random delay between 10-60ms
    await new Promise((resolve) => setTimeout(resolve, delay));
    return { id, data: `Data for ${id}` };
  });

  // Create tasks
  const userIds = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const tasks = userIds.map((id) => () => mockFetch(id));

  // Execute with concurrency limit of 3
  const results = await promisePool<UserData>(tasks, 3);

  // Verify all API calls were made
  expect(mockFetch).toHaveBeenCalledTimes(userIds.length);
  expect(results).toHaveLength(userIds.length);

  // Verify each user was fetched
  for (const id of userIds) {
    expect(results.some((result) => result.id === id)).toBe(true);
  }
});
