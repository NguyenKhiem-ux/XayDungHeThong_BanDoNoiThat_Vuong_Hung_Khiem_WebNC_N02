import assert from 'node:assert/strict';
import test from 'node:test';
import { retryTransientRead } from '../../backend/src/database/retry-transient-read';

test('retries a read once after a transient database disconnect', async () => {
  let calls = 0;
  const result = await retryTransientRead(async () => {
    calls += 1;
    if (calls === 1) throw { driverError: { code: 'ECONNRESET' } };
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.equal(calls, 2);
});

test('does not retry a permanent database error', async () => {
  let calls = 0;
  await assert.rejects(() => retryTransientRead(async () => {
    calls += 1;
    throw { code: 'ER_BAD_FIELD_ERROR' };
  }));
  assert.equal(calls, 1);
});
