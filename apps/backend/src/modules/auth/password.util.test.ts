import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes a password to a bcrypt-shaped string, not the plain value', async () => {
    const hash = await hashPassword('Str0ng!Passw0rd');

    expect(hash).not.toBe('Str0ng!Passw0rd');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('verifies the correct password against its hash', async () => {
    const hash = await hashPassword('Str0ng!Passw0rd');

    await expect(verifyPassword('Str0ng!Passw0rd', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Str0ng!Passw0rd');

    await expect(verifyPassword('WrongPassword1!', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const [hash1, hash2] = await Promise.all([
      hashPassword('Str0ng!Passw0rd'),
      hashPassword('Str0ng!Passw0rd'),
    ]);

    expect(hash1).not.toBe(hash2);
  });
});
