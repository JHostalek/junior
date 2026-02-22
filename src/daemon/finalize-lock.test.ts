import { describe, expect, mock, test } from 'bun:test';
import { locks, withFinalizeLock } from './finalize-lock.js';

mock.module('@/core/logger.js', () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
}));

function defer<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('withFinalizeLock', () => {
  test('serializes calls with same key', async () => {
    const order: number[] = [];
    const gate = defer();

    const first = withFinalizeLock('/repo', async () => {
      order.push(1);
      await gate.promise;
      order.push(2);
      return 'a';
    });

    const second = withFinalizeLock('/repo', async () => {
      order.push(3);
      return 'b';
    });

    await Bun.sleep(10);
    expect(order).toEqual([1]);

    gate.resolve();
    const [r1, r2] = await Promise.all([first, second]);

    expect(r1).toBe('a');
    expect(r2).toBe('b');
    expect(order).toEqual([1, 2, 3]);
  });

  test('different keys run in parallel', async () => {
    const order: string[] = [];
    const gateA = defer();
    const gateB = defer();

    const a = withFinalizeLock('/repo-a', async () => {
      order.push('a-start');
      await gateA.promise;
      order.push('a-end');
    });

    const b = withFinalizeLock('/repo-b', async () => {
      order.push('b-start');
      await gateB.promise;
      order.push('b-end');
    });

    await Bun.sleep(10);
    expect(order).toEqual(['a-start', 'b-start']);

    gateA.resolve();
    gateB.resolve();
    await Promise.all([a, b]);

    expect(order).toEqual(['a-start', 'b-start', 'a-end', 'b-end']);
  });

  test('error in first does not block second', async () => {
    const first = withFinalizeLock('/repo-err', async () => {
      throw new Error('boom');
    });
    await expect(first).rejects.toThrow('boom');

    const second = await withFinalizeLock('/repo-err', async () => 'ok');
    expect(second).toBe('ok');
  });

  test('map self-cleans when no waiters remain', async () => {
    await withFinalizeLock('/repo-clean', async () => 'done');
    expect(locks.has('/repo-clean')).toBe(false);
  });
});
