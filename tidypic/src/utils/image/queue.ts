/** A small platform-independent worker pool. Each task must handle its own error. */
export async function runQueue<T>(
  items: readonly T[],
  task: (item: T) => Promise<void>,
  concurrency = 2,
  stopped = () => false,
) {
  let cursor = 0;
  async function worker() {
    while (!stopped()) {
      const index = cursor++;
      if (index >= items.length) return;
      await task(items[index]!);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      worker,
    ),
  );
}
