import type { Document, Types } from 'mongoose';

/**
 * Mongoose document shape. `nameKey` and the soft-delete fields are
 * internal bookkeeping — never part of `PublicMenuCategoryDto`. Same
 * pattern as `ICanteen` (see canteen.types.ts).
 */
export interface IMenuCategory extends Document {
  _id: Types.ObjectId;
  canteenId: Types.ObjectId;
  name: string;
  /** Normalized (trim + lowercase) copy of `name` — the field the {canteenId, nameKey} unique index enforces uniqueness on. */
  nameKey: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** The only shape a menu category document is ever allowed to cross the API boundary as. */
export interface PublicMenuCategoryDto {
  id: string;
  canteenId: string;
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicMenuCategoryDto(category: IMenuCategory): PublicMenuCategoryDto {
  return {
    id: category._id.toString(),
    canteenId: category.canteenId.toString(),
    name: category.name,
    description: category.description,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
    createdBy: category.createdBy.toString(),
    updatedBy: category.updatedBy?.toString(),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
