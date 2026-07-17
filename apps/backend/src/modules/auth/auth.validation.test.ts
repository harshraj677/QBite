import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validation';

const validRegisterInput = {
  usn: '1xx21cs001',
  fullName: 'Ada Lovelace',
  collegeEmail: 'Ada.Lovelace@College.EDU',
  phoneNumber: '+919876543210',
  password: 'Str0ng!Passw0rd',
};

describe('registerSchema', () => {
  it('accepts a valid registration payload', () => {
    const result = registerSchema.safeParse(validRegisterInput);

    expect(result.success).toBe(true);
  });

  it('normalizes usn to uppercase and email to lowercase', () => {
    const result = registerSchema.parse(validRegisterInput);

    expect(result.usn).toBe('1XX21CS001');
    expect(result.collegeEmail).toBe('ada.lovelace@college.edu');
  });

  it.each([
    ['too short', 'AB1'],
    ['contains symbols', '1XX-21-CS-001'],
    ['too long', 'A'.repeat(20)],
  ])('rejects an invalid USN (%s)', (_label, usn) => {
    const result = registerSchema.safeParse({ ...validRegisterInput, usn });

    expect(result.success).toBe(false);
  });

  it.each([
    ['too short', 'Ab1!aaaa'.slice(0, 6)],
    ['no uppercase', 'weakpass1!'],
    ['no lowercase', 'WEAKPASS1!'],
    ['no digit', 'WeakPass!'],
    ['no special char', 'WeakPass1'],
  ])('rejects a weak password (%s)', (_label, password) => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      ...validRegisterInput,
      collegeEmail: 'not-an-email',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed phone number', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, phoneNumber: 'abc123' });

    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts USN or email as the identifier without strength rules on the password', () => {
    expect(loginSchema.safeParse({ identifier: '1XX21CS001', password: 'anything' }).success).toBe(
      true,
    );
    expect(loginSchema.safeParse({ identifier: 'a@b.edu', password: 'x' }).success).toBe(true);
  });

  it('rejects an empty identifier or password', () => {
    expect(loginSchema.safeParse({ identifier: '', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: 'a@b.edu', password: '' }).success).toBe(false);
  });
});

describe('verifyEmailSchema', () => {
  it('requires exactly a 6-digit OTP', () => {
    expect(verifyEmailSchema.safeParse({ collegeEmail: 'a@b.edu', otp: '123456' }).success).toBe(
      true,
    );
    expect(verifyEmailSchema.safeParse({ collegeEmail: 'a@b.edu', otp: '12345' }).success).toBe(
      false,
    );
    expect(verifyEmailSchema.safeParse({ collegeEmail: 'a@b.edu', otp: 'abcdef' }).success).toBe(
      false,
    );
  });
});

describe('resetPasswordSchema', () => {
  it('applies the same password strength policy as registration', () => {
    expect(resetPasswordSchema.safeParse({ token: 'x', newPassword: 'weak' }).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token: 'x', newPassword: 'Str0ng!Passw0rd' }).success,
    ).toBe(true);
  });
});
