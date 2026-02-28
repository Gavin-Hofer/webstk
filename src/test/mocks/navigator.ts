// Stub navigator.locks which isn't available in the Node test environment.
// Coalesces concurrent requests for the same lock name so only one callback
// runs at a time, matching the exclusive-lock semantics the code relies on.
const activeLocks = new Map<string, Promise<unknown>>();
Object.defineProperty(globalThis.navigator, 'locks', {
  value: {
    request: (name: string, cb: () => Promise<unknown>) => {
      const existing = activeLocks.get(name);
      if (existing) {
        return existing;
      }
      const p = cb().finally(() => activeLocks.delete(name));
      activeLocks.set(name, p);
      return p;
    },
  },
  writable: true,
});
