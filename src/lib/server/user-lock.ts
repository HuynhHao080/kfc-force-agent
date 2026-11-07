// Serializes customer operations in a single Node process. Distributed stores
// must also enforce transactional conditions at the repository boundary.
const state = globalThis as typeof globalThis & {
  kfcLocks?: Map<string, Promise<void>>;
};
const locks = (state.kfcLocks ??= new Map());
export async function withUserLock<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(userId, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(userId) === current) locks.delete(userId);
  }
}
