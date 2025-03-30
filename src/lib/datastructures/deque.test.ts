import { expect, test } from 'vitest';

import { Deque } from './deque';

// Basic initialization tests
test('new deque should be empty', () => {
  const deque = new Deque<number>();
  expect(deque.empty).toBe(true);
  expect(deque.size).toBe(0);
  expect(deque.front).toBeNull();
  expect(deque.back).toBeNull();
});

// PushBack tests
test('pushBack adds elements to the back', () => {
  const deque = new Deque<number>();
  deque.pushBack(1);
  expect(deque.back).toBe(1);
  expect(deque.front).toBe(1);
  expect(deque.size).toBe(1);

  deque.pushBack(2);
  expect(deque.back).toBe(2);
  expect(deque.front).toBe(1);
  expect(deque.size).toBe(2);
});

// PushFront tests
test('pushFront adds elements to the front', () => {
  const deque = new Deque<number>();
  deque.pushFront(1);
  expect(deque.front).toBe(1);
  expect(deque.back).toBe(1);
  expect(deque.size).toBe(1);

  deque.pushFront(2);
  expect(deque.front).toBe(2);
  expect(deque.back).toBe(1);
  expect(deque.size).toBe(2);
});

// PopBack tests
test('popBack removes and returns elements from the back', () => {
  const deque = new Deque<number>();
  deque.pushBack(1).pushBack(2).pushBack(3);

  expect(deque.popBack()).toBe(3);
  expect(deque.size).toBe(2);
  expect(deque.back).toBe(2);

  expect(deque.popBack()).toBe(2);
  expect(deque.size).toBe(1);
  expect(deque.back).toBe(1);

  expect(deque.popBack()).toBe(1);
  expect(deque.size).toBe(0);
  expect(deque.empty).toBe(true);

  expect(deque.popBack()).toBeNull();
});

// PopFront tests
test('popFront removes and returns elements from the front', () => {
  const deque = new Deque<number>();
  deque.pushBack(1).pushBack(2).pushBack(3);

  expect(deque.popFront()).toBe(1);
  expect(deque.size).toBe(2);
  expect(deque.front).toBe(2);

  expect(deque.popFront()).toBe(2);
  expect(deque.size).toBe(1);
  expect(deque.front).toBe(3);

  expect(deque.popFront()).toBe(3);
  expect(deque.size).toBe(0);
  expect(deque.empty).toBe(true);

  expect(deque.popFront()).toBeNull();
});

// Mixed operations tests
test('mixed push and pop operations work correctly', () => {
  const deque = new Deque<number>();

  deque.pushBack(1).pushFront(2);
  expect(deque.front).toBe(2);
  expect(deque.back).toBe(1);

  deque.pushBack(3).pushFront(4);
  expect(deque.size).toBe(4);

  expect(deque.popFront()).toBe(4);
  expect(deque.popBack()).toBe(3);
  expect(deque.popFront()).toBe(2);
  expect(deque.popBack()).toBe(1);
  expect(deque.empty).toBe(true);
});

// Test with non-primitive types
test('works with complex types', () => {
  const deque = new Deque<{ id: number; value: string }>();
  const obj1 = { id: 1, value: 'one' };
  const obj2 = { id: 2, value: 'two' };

  deque.pushBack(obj1);
  deque.pushFront(obj2);

  expect(deque.front).toBe(obj2);
  expect(deque.back).toBe(obj1);
  expect(deque.size).toBe(2);
});

// Test internal array management (offset handling)
test('internal array management works for many operations', () => {
  const deque = new Deque<number>();

  // Add many elements to force internal array management
  for (let i = 0; i < 100; i++) {
    if (i % 2 === 0) {
      deque.pushBack(i);
    } else {
      deque.pushFront(i);
    }
  }

  expect(deque.size).toBe(100);

  // Remove half the elements
  for (let i = 0; i < 50; i++) {
    if (i % 2 === 0) {
      deque.popBack();
    } else {
      deque.popFront();
    }
  }

  expect(deque.size).toBe(50);

  // Add more elements
  for (let i = 100; i < 120; i++) {
    deque.pushBack(i);
  }

  expect(deque.size).toBe(70);

  // Remove all elements
  while (!deque.empty) {
    deque.popBack();
  }

  expect(deque.size).toBe(0);
  expect(deque.empty).toBe(true);
});

// Edge case: ensure chaining works
test('method chaining works', () => {
  const deque = new Deque<number>();
  deque.pushBack(1).pushBack(2).pushFront(3).pushFront(4);

  expect(deque.size).toBe(4);
  expect(deque.front).toBe(4);
  expect(deque.back).toBe(2);
});

// Test rebalance functionality
test('rebalance works correctly when arrays become unbalanced', () => {
  const deque = new Deque<number>();

  // Add 2000 elements to the back to trigger rebalance condition
  // (This exceeds the 1024 threshold in the rebalance method)
  for (let i = 0; i < 2000; ++i) {
    deque.pushBack(i);
  }

  // Add some elements to the front
  for (let i = -1; i >= -100; --i) {
    deque.pushFront(i);
  }

  // Force a rebalance.
  deque.popFront();

  // Check that the deque still maintains correct order
  expect(deque.size).toBe(2099); // 2000 + 100 - 1
  expect(deque.front).toBe(-99);
  expect(deque.back).toBe(1999);

  // Test that we can still access elements in order from front
  for (let i = -99; i < 2000; ++i) {
    expect(deque.popFront()).toBe(i);
  }

  expect(deque.empty).toBe(true);

  // Test rebalance in the other direction
  for (let i = 0; i < 2000; ++i) {
    deque.pushFront(i);
  }

  for (let i = -1; i >= -100; --i) {
    deque.pushBack(i);
  }

  // Force rebalance
  deque.popBack();

  expect(deque.size).toBe(2099);
  expect(deque.front).toBe(1999);
  expect(deque.back).toBe(-99);

  // Verify elements are still in correct order
  for (let i = -99; i < 2000; ++i) {
    expect(deque.popBack()).toBe(i);
  }

  expect(deque.empty).toBe(true);
});
