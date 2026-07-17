import { randomInt } from 'node:crypto';

import bcrypt from 'bcrypt';

import { OTP_BCRYPT_ROUNDS, OTP_LENGTH } from './auth.constants';

/**
 * `crypto.randomInt` (cryptographically secure), not `Math.random()`
 * — an OTP is a security credential, however short-lived, and
 * `Math.random()` is not suitable for anything security-sensitive.
 */
export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  const value = randomInt(0, max);
  return value.toString().padStart(OTP_LENGTH, '0');
}

export function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);
}

export function verifyOtp(otp: string, otpHash: string): Promise<boolean> {
  return bcrypt.compare(otp, otpHash);
}
