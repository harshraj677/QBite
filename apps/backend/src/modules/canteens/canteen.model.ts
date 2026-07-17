import { model, Schema } from 'mongoose';

import type { ICanteen } from './canteen.types';

/**
 * See docs/DATABASE_DESIGN.md for field-by-field rationale.
 *
 * Schema-level validation here is structural (required/type/length) —
 * format validation (email shape, URL shape, phone pattern, HH:mm
 * pattern) belongs to `canteens.validation.ts` (Zod), at the request
 * boundary, per CODING_STANDARDS.md's "validate at boundaries, trust
 * internally." Duplicating every format rule at both layers would be
 * redundant, not defense in depth.
 */
const canteenSchema = new Schema<ICanteen>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    nameKey: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    image: {
      type: String,
      trim: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    openingTime: {
      type: String,
      required: true,
    },
    closingTime: {
      type: String,
      required: true,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

// Every list/lookup query filters on isDeleted; isOpen is the one
// documented filter (API_SPECIFICATION.md §9) — compound index covers
// the common "visible, currently-open canteens" query without a
// second index just for isDeleted alone.
canteenSchema.index({ isDeleted: 1, isOpen: 1 });
canteenSchema.index({ createdBy: 1 });
canteenSchema.index({ name: 1 }); // supports ?sortBy=name (canteens.constants.ts)

export const CanteenModel = model<ICanteen>('Canteen', canteenSchema);
