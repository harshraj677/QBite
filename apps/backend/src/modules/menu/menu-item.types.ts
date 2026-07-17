import type { Document, Types } from 'mongoose';

/**
 * Mongoose document shape. `nameKey` and the soft-delete fields are
 * internal bookkeeping — never part of `PublicMenuItemDto`. `price` is
 * an integer in paise (docs/DATABASE_DESIGN.md §6's money convention),
 * never a float.
 */
export interface IMenuItem extends Document {
  _id: Types.ObjectId;
  canteenId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  /** Normalized (trim + lowercase) copy of `name` — the field the {categoryId, nameKey} unique index enforces uniqueness on. */
  nameKey: string;
  description?: string;
  image?: string;
  /** Integer, smallest currency unit (paise). ₹249.00 is stored as 24900. */
  price: number;
  preparationTimeMinutes: number;
  isVeg: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  allergens: string[];
  calories?: number;
  displayOrder: number;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** The only shape a menu item document is ever allowed to cross the API boundary as. */
export interface PublicMenuItemDto {
  id: string;
  canteenId: string;
  categoryId: string;
  name: string;
  description?: string;
  image?: string;
  price: number;
  preparationTimeMinutes: number;
  isVeg: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  allergens: string[];
  calories?: number;
  displayOrder: number;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicMenuItemDto(item: IMenuItem): PublicMenuItemDto {
  return {
    id: item._id.toString(),
    canteenId: item.canteenId.toString(),
    categoryId: item.categoryId.toString(),
    name: item.name,
    description: item.description,
    image: item.image,
    price: item.price,
    preparationTimeMinutes: item.preparationTimeMinutes,
    isVeg: item.isVeg,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    allergens: item.allergens,
    calories: item.calories,
    displayOrder: item.displayOrder,
    createdBy: item.createdBy.toString(),
    updatedBy: item.updatedBy?.toString(),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
