import { getRequestContext, getRequestId, runWithContext } from './request-context';

describe('request-context', () => {
  it('returns undefined outside of any context', () => {
    expect(getRequestContext()).toBeUndefined();
    expect(getRequestId()).toBeUndefined();
  });

  it('makes the context available synchronously inside runWithContext', () => {
    runWithContext({ requestId: 'req-1' }, () => {
      expect(getRequestId()).toBe('req-1');
      expect(getRequestContext()).toEqual({ requestId: 'req-1' });
    });
  });

  it('propagates through nested async calls without being passed explicitly', async () => {
    async function deeplyNested(): Promise<string | undefined> {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      return getRequestId();
    }

    const result = await runWithContext({ requestId: 'req-async' }, () => deeplyNested());

    expect(result).toBe('req-async');
  });

  it('isolates concurrent contexts from each other', async () => {
    const results = await Promise.all([
      runWithContext({ requestId: 'a' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getRequestId();
      }),
      runWithContext({ requestId: 'b' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getRequestId();
      }),
    ]);

    expect(results).toEqual(['a', 'b']);
  });
});
