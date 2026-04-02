const lockChains = new Map();

function normalizeLockKey(lockKey) {
  if (typeof lockKey === 'string' && lockKey.trim()) {
    return lockKey;
  }
  return String(lockKey);
}

function withFileLock(lockKey, task) {
  const key = normalizeLockKey(lockKey);
  const previous = lockChains.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const release = next.finally(() => {
    if (lockChains.get(key) === tail) {
      lockChains.delete(key);
    }
  });
  const tail = release.catch(() => undefined);
  lockChains.set(key, tail);
  return next;
}

module.exports = {
  withFileLock,
};
