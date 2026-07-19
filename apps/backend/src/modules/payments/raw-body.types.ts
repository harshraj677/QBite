/**
 * Global `Request` augmentation, same mechanism `auth.middleware.ts`
 * already uses for `req.user` — an ambient `declare module` applies
 * project-wide once this file is part of the TS program (every file
 * under `src/**` is, per tsconfig's `include`), with no explicit
 * import needed at any call site.
 *
 * `rawBody` is populated once, globally, by `app.ts`'s
 * `express.json({ verify })` callback — see that file's comment for
 * why. Declared here (in `modules/payments/`, the sole consumer)
 * rather than in `app.ts` itself, matching the same "the module that
 * needs the concept owns the augmentation" precedent as `req.user`.
 */
declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Raw request body bytes, exactly as received. Needed for
     * Razorpay webhook HMAC signature verification, which Razorpay
     * computes over the literal bytes it sent — `JSON.stringify(req.body)`
     * is not guaranteed to reproduce them byte-for-byte (key order,
     * whitespace, number formatting can all differ), so the parsed
     * `req.body` cannot be used for this. Every other route ignores
     * this field entirely.
     */
    rawBody?: Buffer;
  }
}

export {};
