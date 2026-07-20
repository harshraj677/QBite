import { userIdParamSchema } from './users.validation';

describe('userIdParamSchema', () => {
  it('accepts a valid ObjectId', () => {
    expect(userIdParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(true);
  });

  it('rejects a malformed id', () => {
    expect(userIdParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(userIdParamSchema.safeParse({}).success).toBe(false);
  });
});
