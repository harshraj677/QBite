import { replaceRequestProperty } from './replace-request-property';

describe('replaceRequestProperty', () => {
  it('mutates the target object in place rather than returning a new one', () => {
    const target = { a: 1, b: 2 };
    const reference = target;

    replaceRequestProperty(target, { c: 3 });

    expect(target).toBe(reference);
  });

  it('removes keys not present in the replacement', () => {
    const target: Record<string, unknown> = { a: 1, b: 2 };

    replaceRequestProperty(target, { c: 3 });

    expect(target).toEqual({ c: 3 });
  });

  it('works on an object defined via a getter with no setter (the Express 5 req.query case)', () => {
    const backing = { role: 'admin' };
    const holder: { readonly query: Record<string, unknown> } = {
      get query() {
        return backing;
      },
    };

    // The point of this test: this must NOT throw
    // "Cannot set property query of ... which has only a getter".
    expect(() => replaceRequestProperty(holder.query, { role: 'customer' })).not.toThrow();
    expect(backing).toEqual({ role: 'customer' });
  });
});
