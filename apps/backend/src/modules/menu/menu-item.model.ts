import { model, Schema } from 'mongoose';

import type { IMenuItem } from './menu-item.types';

/**
 * See docs/DATABASE_DESIGN.md §2.16 for field-by-field rationale.
 * Structural validation only — format/business rules live in
 * menu-items.validation.ts (Zod) and menu-items.service.ts.
 */
const menuItemSchema = new Schema<IMenuItem>(
  {
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuCategory',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
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
    image: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    preparationTimeMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    isVeg: {
      type: Boolean,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    allergens: {
      type: [String],
      default: [],
    },
    calories: {
      type: Number,
      min: 0,
    },
    displayOrder: {
      type: Number,
      required: true,
      default: 0,
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

// An item name must be unique within its category, not globally —
// same rationale as the {canteenId, nameKey} index on menu_categories.
menuItemSchema.index({ categoryId: 1, nameKey: 1 }, { unique: true });
// Primary listing queries: a category's or a canteen's visible items,
// in display order.
menuItemSchema.index({ categoryId: 1, isDeleted: 1, displayOrder: 1 });
menuItemSchema.index({ canteenId: 1, isDeleted: 1 });

export const MenuItemModel = model<IMenuItem>('MenuItem', menuItemSchema);
