import { model, Schema } from 'mongoose';

import type { IMenuCategory } from './menu-category.types';

/**
 * See docs/DATABASE_DESIGN.md §2.15 for field-by-field rationale.
 * Structural validation only (required/type/length) — format/business
 * rules live in menu-categories.validation.ts (Zod) and
 * menu-categories.service.ts, per CODING_STANDARDS.md's "validate at
 * boundaries, trust internally" (same split canteen.model.ts uses).
 */
const menuCategorySchema = new Schema<IMenuCategory>(
  {
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    nameKey: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    displayOrder: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

// A category name must be unique within its canteen, not globally —
// "Snacks" can exist in both Canteen A and Canteen B. Enforced here,
// not just in the service pre-check (see canteens' identical rationale
// for keeping both the pre-check and the index).
menuCategorySchema.index({ canteenId: 1, nameKey: 1 }, { unique: true });
// Primary listing query: a canteen's visible categories, in display order.
menuCategorySchema.index({ canteenId: 1, isDeleted: 1, displayOrder: 1 });

export const MenuCategoryModel = model<IMenuCategory>('MenuCategory', menuCategorySchema);
