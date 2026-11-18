export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  map: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("Concurrency must be a positive integer.");
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;
  let firstError: unknown;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = await map(items[index], index);
      } catch (error) {
        // Finish every scheduled item, without retries, before reporting the first failure.
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (failed) throw firstError;
  return results;
}
