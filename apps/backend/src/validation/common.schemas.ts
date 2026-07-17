import { z } from 'zod';

/**
 * Shared across every module's `*.validation.ts` that needs to parse a
 * Mongo ObjectId out of params/body/query — introduced with the `menu`
 * module (the first to need this in more than one place: canteenId,
 * categoryId, id) so the pattern/message isn't redefined per module.
 * Pre-existing modules (`canteens`) keep their own inline copy
 * deliberately — not touched here, per the "don't modify previous
 * modules" constraint.
 */
export const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z.string().regex(OBJECT_ID_PATTERN, 'Invalid id.');
