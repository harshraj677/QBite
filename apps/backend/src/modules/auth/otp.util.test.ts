import { OTP_LENGTH } from './auth.constants';
import { generateOtp, hashOtp, verifyOtp } from './otp.util';

describe('otp.util', () => {
  it('generates a numeric code of the configured length', () => {
    const otp = generateOtp();

    expect(otp).toHaveLength(OTP_LENGTH);
    expect(/^\d+$/.test(otp)).toBe(true);
  });

  it('zero-pads short values so the length is always exact', () => {
    // Statistically, over many generations at least one should start
    // with a leading zero if padding works — but rather than rely on
    // randomness, just assert the invariant every generated value
    // must satisfy.
    for (let i = 0; i < 50; i += 1) {
      expect(generateOtp()).toHaveLength(OTP_LENGTH);
    }
  });

  it('hashes an OTP so the stored value is not the plain code', async () => {
    const otp = generateOtp();
    const hash = await hashOtp(otp);

    expect(hash).not.toBe(otp);
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('verifies a correct OTP against its hash', async () => {
    const otp = generateOtp();
    const hash = await hashOtp(otp);

    await expect(verifyOtp(otp, hash)).resolves.toBe(true);
  });

  it('rejects an incorrect OTP', async () => {
    const hash = await hashOtp('000000');

    await expect(verifyOtp('999999', hash)).resolves.toBe(false);
  });
});
