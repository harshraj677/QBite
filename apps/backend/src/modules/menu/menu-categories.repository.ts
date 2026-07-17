import type { Types } from 'mongoose';

import { MenuCategoryModel } from './menu-category.model';
import type { MenuCategorySortableField } from './menu.constants';
import type { IMenuCategory } from './menu-category.types';

export interface CreateMenuCategoryInput {
  canteenId: string | Types.ObjectId;
  name: string;
  nameKey: string;
  description?: string;
  displayOrder: number;
  createdBy: string | Types.ObjectId;
}

export interface ListMenuCategoriesOptions {
  canteenId: string | Types.ObjectId;
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  sortBy: MenuCategorySortableField;
  sortOrder: 'asc' | 'desc';
}

export interface ListMenuCategoriesResult {
  categories: IMenuCategory[];
  total: number;
}

export interface ReorderCategoryEntry {
  id: string | Types.ObjectId;
  displayOrder: number;
}

/**
 * All Mongoose queries for the `menu_categories` collection live here
 * — per ARCHITECTURE.md §3.1's layering rule, nothing outside this
 * file (including MenuCategoriesService, and MenuItemsService's
 * cross-entity lookups) touches `MenuCategoryModel` directly.
 *
 * Every read method filters `isDeleted: false` unconditionally — same
 * "no include-deleted API surface" convention as CanteensRepository —
 * except `restore`, which by definition must find a soft-deleted one.
 */
export class MenuCategoriesRepository {
  create(input: CreateMenuCategoryInput): Promise<IMenuCategory> {
    return MenuCategoryModel.create(input);
  }

  findById(id: string | Types.ObjectId): Promise<IMenuCategory | null> {
    return MenuCategoryModel.findOne({ _id: id, isDeleted: false }).exec();
  }

  /** Service-layer uniqueness pre-check — same rationale as CanteensRepository.findByNameKey. */
  findByCanteenAndNameKey(
    canteenId: string | Types.ObjectId,
    nameKey: string,
  ): Promise<IMenuCategory | null> {
    return MenuCategoryModel.findOne({ canteenId, nameKey, isDeleted: false }).exec();
  }

  async findByCanteen(options: ListMenuCategoriesOptions): Promise<ListMenuCategoriesResult> {
    const filter: Record<string, unknown> = {
      canteenId: options.canteenId,
      isDeleted: false,
    };
    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    }
    if (options.search) {
      filter.name = { $regex: options.search, $options: 'i' };
    }

    const sort: Record<string, 1 | -1> = { [options.sortBy]: options.sortOrder === 'asc' ? 1 : -1 };
    const skip = (options.page - 1) * options.limit;

    const [categories, total] = await Promise.all([
      MenuCategoryModel.find(filter).sort(sort).skip(skip).limit(options.limit).exec(),
      MenuCategoryModel.countDocuments(filter).exec(),
    ]);

    return { categories, total };
  }

  /** Partial update — same runValidators/isDeleted-guard pattern as CanteensRepository.update. */
  update(
    id: string | Types.ObjectId,
    updates: Record<string, unknown>,
  ): Promise<IMenuCategory | null> {
    return MenuCategoryModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updates },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  }

  /** Soft delete. Returns false if no matching, non-deleted category existed. */
  async delete(id: string | Types.ObjectId, deletedBy: string | Types.ObjectId): Promise<boolean> {
    const result = await MenuCategoryModel.updateOne(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
    ).exec();
    return result.modifiedCount > 0;
  }

  /** Reverses a soft delete. Returns null if no matching, soft-deleted category existed (including "never existed"). */
  restore(
    id: string | Types.ObjectId,
    restoredBy: string | Types.ObjectId,
  ): Promise<IMenuCategory | null> {
    return MenuCategoryModel.findOneAndUpdate(
      { _id: id, isDeleted: true },
      {
        $set: { isDeleted: false, updatedBy: restoredBy },
        $unset: { deletedAt: '', deletedBy: '' },
      },
      { returnDocument: 'after' },
    ).exec();
  }

  /**
   * Persists a full recomputed ordering in one round trip. The service
   * computes `entries` (every sibling's new displayOrder, not just the
   * one that moved) — this method just writes it atomically via
   * bulkWrite so the list is never read back mid-reorder in an
   * inconsistent state.
   */
  async reorderCategories(entries: ReorderCategoryEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await MenuCategoryModel.bulkWrite(
      entries.map((entry) => ({
        updateOne: {
          filter: { _id: entry.id, isDeleted: false },
          update: { $set: { displayOrder: entry.displayOrder } },
        },
      })),
    );
  }
}
