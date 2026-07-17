import type { Types } from 'mongoose';

import { MenuItemModel } from './menu-item.model';
import type { MenuItemSortableField } from './menu.constants';
import type { IMenuItem } from './menu-item.types';

export interface CreateMenuItemInput {
  canteenId: string | Types.ObjectId;
  categoryId: string | Types.ObjectId;
  name: string;
  nameKey: string;
  description?: string;
  image?: string;
  price: number;
  preparationTimeMinutes: number;
  isVeg: boolean;
  isAvailable?: boolean;
  isFeatured?: boolean;
  allergens?: string[];
  calories?: number;
  displayOrder: number;
  createdBy: string | Types.ObjectId;
}

interface BaseListOptions {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string | Types.ObjectId;
  isVeg?: boolean;
  isAvailable?: boolean;
  isFeatured?: boolean;
  priceMin?: number;
  priceMax?: number;
  sortBy: MenuItemSortableField;
  sortOrder: 'asc' | 'desc';
}

export interface ListMenuItemsByCanteenOptions extends BaseListOptions {
  canteenId: string | Types.ObjectId;
}

export interface ListMenuItemsByCategoryOptions extends BaseListOptions {
  categoryId: string | Types.ObjectId;
}

export interface ListMenuItemsResult {
  items: IMenuItem[];
  total: number;
}

export interface ReorderItemEntry {
  id: string | Types.ObjectId;
  displayOrder: number;
}

function buildFilter(options: BaseListOptions): Record<string, unknown> {
  const filter: Record<string, unknown> = { isDeleted: false };
  if (options.categoryId !== undefined) filter.categoryId = options.categoryId;
  if (options.isVeg !== undefined) filter.isVeg = options.isVeg;
  if (options.isAvailable !== undefined) filter.isAvailable = options.isAvailable;
  if (options.isFeatured !== undefined) filter.isFeatured = options.isFeatured;
  if (options.search) filter.name = { $regex: options.search, $options: 'i' };
  if (options.priceMin !== undefined || options.priceMax !== undefined) {
    const price: Record<string, number> = {};
    if (options.priceMin !== undefined) price.$gte = options.priceMin;
    if (options.priceMax !== undefined) price.$lte = options.priceMax;
    filter.price = price;
  }
  return filter;
}

/**
 * All Mongoose queries for the `menu_items` collection live here — per
 * ARCHITECTURE.md §3.1's layering rule, nothing outside this file
 * (including MenuItemsService, and MenuCategoriesService's cross-
 * entity lookups) touches `MenuItemModel` directly.
 *
 * Every read method filters `isDeleted: false` unconditionally, same
 * convention as MenuCategoriesRepository/CanteensRepository.
 */
export class MenuItemsRepository {
  create(input: CreateMenuItemInput): Promise<IMenuItem> {
    return MenuItemModel.create(input);
  }

  findById(id: string | Types.ObjectId): Promise<IMenuItem | null> {
    return MenuItemModel.findOne({ _id: id, isDeleted: false }).exec();
  }

  /** Service-layer uniqueness pre-check — same rationale as MenuCategoriesRepository.findByCanteenAndNameKey. */
  findByCategoryAndNameKey(
    categoryId: string | Types.ObjectId,
    nameKey: string,
  ): Promise<IMenuItem | null> {
    return MenuItemModel.findOne({ categoryId, nameKey, isDeleted: false }).exec();
  }

  async findByCategory(options: ListMenuItemsByCategoryOptions): Promise<ListMenuItemsResult> {
    const filter = buildFilter(options);
    return this.runListQuery(filter, options);
  }

  async findByCanteen(options: ListMenuItemsByCanteenOptions): Promise<ListMenuItemsResult> {
    const filter = { ...buildFilter(options), canteenId: options.canteenId };
    return this.runListQuery(filter, options);
  }

  /** Used by MenuCategoriesService.deleteCategory's guard — true if the category has any non-soft-deleted item. */
  existsActiveInCategory(categoryId: string | Types.ObjectId): Promise<boolean> {
    return MenuItemModel.exists({ categoryId, isDeleted: false }).then(Boolean);
  }

  /** Cascade half of the force-delete-category flow — soft-deletes every active item in the category in one write. */
  async softDeleteAllInCategory(
    categoryId: string | Types.ObjectId,
    deletedBy: string | Types.ObjectId,
  ): Promise<number> {
    const result = await MenuItemModel.updateMany(
      { categoryId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
    ).exec();
    return result.modifiedCount;
  }

  update(id: string | Types.ObjectId, updates: Record<string, unknown>): Promise<IMenuItem | null> {
    return MenuItemModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updates },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  }

  /** Soft delete. Returns false if no matching, non-deleted item existed. */
  async delete(id: string | Types.ObjectId, deletedBy: string | Types.ObjectId): Promise<boolean> {
    const result = await MenuItemModel.updateOne(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
    ).exec();
    return result.modifiedCount > 0;
  }

  /** Reverses a soft delete. Returns null if no matching, soft-deleted item existed (including "never existed"). */
  restore(
    id: string | Types.ObjectId,
    restoredBy: string | Types.ObjectId,
  ): Promise<IMenuItem | null> {
    return MenuItemModel.findOneAndUpdate(
      { _id: id, isDeleted: true },
      {
        $set: { isDeleted: false, updatedBy: restoredBy },
        $unset: { deletedAt: '', deletedBy: '' },
      },
      { returnDocument: 'after' },
    ).exec();
  }

  /**
   * Atomic single-field toggle. Also clears `isFeatured` in the same
   * write when turning availability off — see MenuItemsService's
   * "featured toggle must be consistent" rule: a featured-but-
   * unavailable item is an invalid state, and this makes the
   * transition impossible to observe even momentarily (one write, not
   * read-then-write).
   */
  updateAvailability(
    id: string | Types.ObjectId,
    isAvailable: boolean,
    updatedBy: string | Types.ObjectId,
  ): Promise<IMenuItem | null> {
    const update: Record<string, unknown> = { isAvailable, updatedBy };
    if (!isAvailable) update.isFeatured = false;
    return MenuItemModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: update },
      { returnDocument: 'after' },
    ).exec();
  }

  updateFeatured(
    id: string | Types.ObjectId,
    isFeatured: boolean,
    updatedBy: string | Types.ObjectId,
  ): Promise<IMenuItem | null> {
    return MenuItemModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isFeatured, updatedBy } },
      { returnDocument: 'after' },
    ).exec();
  }

  /** Persists a full recomputed ordering in one bulkWrite — same pattern as MenuCategoriesRepository.reorderCategories. */
  async reorderItems(entries: ReorderItemEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await MenuItemModel.bulkWrite(
      entries.map((entry) => ({
        updateOne: {
          filter: { _id: entry.id, isDeleted: false },
          update: { $set: { displayOrder: entry.displayOrder } },
        },
      })),
    );
  }

  private async runListQuery(
    filter: Record<string, unknown>,
    options: BaseListOptions,
  ): Promise<ListMenuItemsResult> {
    const sort: Record<string, 1 | -1> = { [options.sortBy]: options.sortOrder === 'asc' ? 1 : -1 };
    const skip = (options.page - 1) * options.limit;

    const [items, total] = await Promise.all([
      MenuItemModel.find(filter).sort(sort).skip(skip).limit(options.limit).exec(),
      MenuItemModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }
}
