import { Types } from 'mongoose';

import { AuditLogService } from '@modules/audit/audit-log.service';
import { CanteensService } from '@modules/canteens/canteens.service';
import type { UserRole } from '@modules/users/user.types';
import { ConflictError, NotFoundError, UnprocessableEntityError } from '@errors/http-errors';
import { MenuCategoriesRepository } from './menu-categories.repository';
import type { ListMenuItemsByCanteenOptions, ReorderItemEntry } from './menu-items.repository';
import { MenuItemsRepository } from './menu-items.repository';
import type { IMenuItem, PublicMenuItemDto } from './menu-item.types';
import { toPublicMenuItemDto } from './menu-item.types';
import type {
  CreateMenuItemInput,
  ListMenuItemsQuery,
  UpdateMenuItemInput,
} from './menu-items.validation';

export interface AuditActor {
  id: string;
  role: UserRole;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface PublicMenuItemListResult {
  items: PublicMenuItemDto[];
  total: number;
}

/** Same shape MongoDB's duplicate-key error carries — duplicated per-module, matching the established pattern. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Business rules for `menu_items`. Depends on its own repository,
 * `MenuCategoriesRepository` (the sibling entity's repository — same
 * Menu-phase architectural decision as MenuCategoriesService's
 * dependency on `MenuItemsRepository`), `CanteensService` (cross-
 * module, via its public service), and `AuditLogService`.
 */
export class MenuItemsService {
  constructor(
    private readonly itemsRepository: MenuItemsRepository = new MenuItemsRepository(),
    private readonly categoriesRepository: MenuCategoriesRepository = new MenuCategoriesRepository(),
    private readonly canteensService: CanteensService = new CanteensService(),
    private readonly auditLogService: AuditLogService = new AuditLogService(),
  ) {}

  async createItem(
    canteenId: string,
    input: CreateMenuItemInput,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicMenuItemDto> {
    await this.canteensService.getCanteenById(canteenId);

    const category = await this.categoriesRepository.findById(input.categoryId);
    if (!category) {
      // Covers both "category doesn't exist" and "category is
      // soft-deleted" — findById filters isDeleted:false, so a
      // deleted category is indistinguishable from a missing one,
      // which is exactly the "cannot create item under deleted
      // category" rule.
      throw new NotFoundError('MENU_CATEGORY_NOT_FOUND', 'Menu category not found.');
    }
    if (category.canteenId.toString() !== canteenId) {
      throw new UnprocessableEntityError(
        'MENU_CATEGORY_CANTEEN_MISMATCH',
        'The category does not belong to this canteen.',
      );
    }

    const nameKey = normalizeName(input.name);
    const existing = await this.itemsRepository.findByCategoryAndNameKey(input.categoryId, nameKey);
    if (existing) {
      throw new ConflictError(
        'MENU_ITEM_NAME_ALREADY_EXISTS',
        `An item named "${input.name}" already exists in this category.`,
      );
    }

    const displayOrder = input.displayOrder ?? (await this.nextDisplayOrder(input.categoryId));

    let item: IMenuItem;
    try {
      item = await this.itemsRepository.create({
        canteenId,
        categoryId: input.categoryId,
        name: input.name,
        nameKey,
        description: input.description,
        image: input.image,
        price: input.price,
        preparationTimeMinutes: input.preparationTimeMinutes,
        isVeg: input.isVeg,
        isAvailable: input.isAvailable,
        isFeatured: input.isFeatured,
        allergens: input.allergens,
        calories: input.calories,
        displayOrder,
        createdBy: actor.id,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError(
          'MENU_ITEM_NAME_ALREADY_EXISTS',
          `An item named "${input.name}" already exists in this category.`,
        );
      }
      throw error;
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_item.created',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { itemId: item._id.toString(), canteenId, categoryId: input.categoryId },
    });

    return toPublicMenuItemDto(item);
  }

  async getItemById(id: string): Promise<PublicMenuItemDto> {
    const item = await this.itemsRepository.findById(id);
    if (!item) {
      throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'Menu item not found.');
    }
    return toPublicMenuItemDto(item);
  }

  async listItems(canteenId: string, query: ListMenuItemsQuery): Promise<PublicMenuItemListResult> {
    const options: ListMenuItemsByCanteenOptions = {
      canteenId,
      page: query.page,
      limit: query.limit,
      search: query.search,
      categoryId: query.categoryId,
      isVeg: query.isVeg,
      isAvailable: query.isAvailable,
      isFeatured: query.isFeatured,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    const result = await this.itemsRepository.findByCanteen(options);
    return { items: result.items.map(toPublicMenuItemDto), total: result.total };
  }

  async updateItem(
    id: string,
    updates: UpdateMenuItemInput,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicMenuItemDto> {
    const existing = await this.itemsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'Menu item not found.');
    }

    const effectiveCategoryId = updates.categoryId ?? existing.categoryId.toString();
    if (updates.categoryId !== undefined && updates.categoryId !== existing.categoryId.toString()) {
      const newCategory = await this.categoriesRepository.findById(updates.categoryId);
      if (!newCategory) {
        throw new NotFoundError('MENU_CATEGORY_NOT_FOUND', 'Menu category not found.');
      }
      if (newCategory.canteenId.toString() !== existing.canteenId.toString()) {
        throw new UnprocessableEntityError(
          'MENU_ITEM_CANTEEN_MISMATCH',
          'Cannot move an item into a category belonging to a different canteen.',
        );
      }
    }

    const payload: Record<string, unknown> = { ...updates, updatedBy: actor.id };
    if (updates.name !== undefined) {
      const nameKey = normalizeName(updates.name);
      if (nameKey !== existing.nameKey || effectiveCategoryId !== existing.categoryId.toString()) {
        const conflict = await this.itemsRepository.findByCategoryAndNameKey(
          effectiveCategoryId,
          nameKey,
        );
        if (conflict && conflict._id.toString() !== id) {
          throw new ConflictError(
            'MENU_ITEM_NAME_ALREADY_EXISTS',
            `An item named "${updates.name}" already exists in this category.`,
          );
        }
      }
      payload.nameKey = nameKey;
    }

    let updated;
    try {
      updated = await this.itemsRepository.update(id, payload);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError(
          'MENU_ITEM_NAME_ALREADY_EXISTS',
          'An item with this name already exists in the target category.',
        );
      }
      throw error;
    }

    if (!updated) {
      throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'Menu item not found.');
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_item.updated',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { itemId: id, changes: Object.keys(updates) },
    });

    return toPublicMenuItemDto(updated);
  }

  async deleteItem(id: string, actor: AuditActor, meta: RequestMeta): Promise<void> {
    const existing = await this.itemsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'Menu item not found.');
    }

    await this.itemsRepository.delete(id, actor.id);

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_item.deleted',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { itemId: id },
    });
  }

  /**
   * Atomic; also clears `isFeatured` when turning availability off
   * (MenuItemsRepository.updateAvailability does this in the same
   * write) — the "featured toggle must be consistent" rule's other
   * half is enforced in `setFeatured` below.
   */
  async setAvailability(
    id: string,
    isAvailable: boolean,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicMenuItemDto> {
    const updated = await this.itemsRepository.updateAvailability(id, isAvailable, actor.id);
    if (!updated) {
      throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'Menu item not found.');
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_item.availability_updated',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { itemId: id, isAvailable },
    });

    return toPublicMenuItemDto(updated);
  }

  /** An unavailable item can never be featured — the other half of the "featured toggle must be consistent" rule. */
  async setFeatured(
    id: string,
    isFeatured: boolean,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicMenuItemDto> {
    if (isFeatured) {
      const existing = await this.itemsRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'Menu item not found.');
      }
      if (!existing.isAvailable) {
        throw new UnprocessableEntityError(
          'MENU_ITEM_NOT_AVAILABLE_FOR_FEATURE',
          'An unavailable item cannot be featured.',
        );
      }
    }

    const updated = await this.itemsRepository.updateFeatured(id, isFeatured, actor.id);
    if (!updated) {
      throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'Menu item not found.');
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_item.featured_updated',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { itemId: id, isFeatured },
    });

    return toPublicMenuItemDto(updated);
  }

  /**
   * Single-resource "move to position" API, scoped to the item's own
   * category (siblings are other items in the same category) — same
   * recompute-and-bulkWrite pattern as
   * MenuCategoriesService.reorderCategory.
   */
  async reorderItem(
    id: string,
    targetDisplayOrder: number,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicMenuItemDto> {
    const target = await this.itemsRepository.findById(id);
    if (!target) {
      throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'Menu item not found.');
    }

    const { items: siblings } = await this.itemsRepository.findByCategory({
      categoryId: target.categoryId,
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
      sortBy: 'displayOrder',
      sortOrder: 'asc',
    });

    const withoutTarget = siblings.filter((i) => i._id.toString() !== id);
    const clampedIndex = Math.max(0, Math.min(targetDisplayOrder, withoutTarget.length));
    withoutTarget.splice(clampedIndex, 0, target);

    const entries: ReorderItemEntry[] = withoutTarget.map((item, index) => ({
      id: item._id,
      displayOrder: index,
    }));
    await this.itemsRepository.reorderItems(entries);

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_item.reordered',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { itemId: id, targetDisplayOrder: clampedIndex },
    });

    const updated = await this.itemsRepository.findById(id);
    return toPublicMenuItemDto(updated as IMenuItem);
  }

  private async nextDisplayOrder(categoryId: string): Promise<number> {
    const { items } = await this.itemsRepository.findByCategory({
      categoryId,
      page: 1,
      limit: 1,
      sortBy: 'displayOrder',
      sortOrder: 'desc',
    });
    return items.length > 0 ? items[0].displayOrder + 1 : 0;
  }
}
