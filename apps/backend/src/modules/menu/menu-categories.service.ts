import { Types } from 'mongoose';

import { AuditLogService } from '@modules/audit/audit-log.service';
import { CanteensService } from '@modules/canteens/canteens.service';
import type { UserRole } from '@modules/users/user.types';
import { ConflictError, NotFoundError } from '@errors/http-errors';
import type { ListMenuCategoriesOptions, ReorderCategoryEntry } from './menu-categories.repository';
import { MenuCategoriesRepository } from './menu-categories.repository';
import { MenuItemsRepository } from './menu-items.repository';
import type { IMenuCategory, PublicMenuCategoryDto } from './menu-category.types';
import { toPublicMenuCategoryDto } from './menu-category.types';
import type {
  CreateMenuCategoryInput,
  ListMenuCategoriesQuery,
  UpdateMenuCategoryInput,
} from './menu-categories.validation';

export interface AuditActor {
  id: string;
  role: UserRole;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface PublicMenuCategoryListResult {
  categories: PublicMenuCategoryDto[];
  total: number;
}

/** Same shape MongoDB's duplicate-key error carries — duplicated per-module rather than shared, matching the established pattern (see canteens.service.ts's identical helper and its rationale). */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Business rules for `menu_categories`. Depends on its own repository,
 * `MenuItemsRepository` (the sibling entity's repository — see the
 * Menu-phase architectural decision: two entities of the *same*
 * module may depend on each other's repository directly, which avoids
 * a circular service-to-service dependency while still respecting the
 * cross-module boundary at the `modules/menu` edge), `CanteensService`
 * (a real cross-module dependency, via its public service — never
 * `CanteensRepository`), and `AuditLogService`.
 */
export class MenuCategoriesService {
  constructor(
    private readonly categoriesRepository: MenuCategoriesRepository = new MenuCategoriesRepository(),
    private readonly itemsRepository: MenuItemsRepository = new MenuItemsRepository(),
    private readonly canteensService: CanteensService = new CanteensService(),
    private readonly auditLogService: AuditLogService = new AuditLogService(),
  ) {}

  async createCategory(
    canteenId: string,
    input: CreateMenuCategoryInput,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicMenuCategoryDto> {
    // Throws NotFoundError('CANTEEN_NOT_FOUND', ...) if the canteen
    // doesn't exist or is soft-deleted — a category can't be created
    // under a canteen that isn't real.
    await this.canteensService.getCanteenById(canteenId);

    const nameKey = normalizeName(input.name);
    const existing = await this.categoriesRepository.findByCanteenAndNameKey(canteenId, nameKey);
    if (existing) {
      throw new ConflictError(
        'MENU_CATEGORY_NAME_ALREADY_EXISTS',
        `A category named "${input.name}" already exists in this canteen.`,
      );
    }

    const displayOrder = input.displayOrder ?? (await this.nextDisplayOrder(canteenId));

    let category: IMenuCategory;
    try {
      category = await this.categoriesRepository.create({
        canteenId,
        name: input.name,
        nameKey,
        description: input.description,
        displayOrder,
        createdBy: actor.id,
      });
    } catch (error) {
      // Two concurrent creates racing past the pre-check above — same
      // pattern as CanteensService.createCanteen.
      if (isDuplicateKeyError(error)) {
        throw new ConflictError(
          'MENU_CATEGORY_NAME_ALREADY_EXISTS',
          `A category named "${input.name}" already exists in this canteen.`,
        );
      }
      throw error;
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_category.created',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { categoryId: category._id.toString(), canteenId },
    });

    return toPublicMenuCategoryDto(category);
  }

  async getCategoryById(id: string): Promise<PublicMenuCategoryDto> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundError('MENU_CATEGORY_NOT_FOUND', 'Menu category not found.');
    }
    return toPublicMenuCategoryDto(category);
  }

  async listCategories(
    canteenId: string,
    query: ListMenuCategoriesQuery,
  ): Promise<PublicMenuCategoryListResult> {
    const options: ListMenuCategoriesOptions = {
      canteenId,
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    const result = await this.categoriesRepository.findByCanteen(options);
    return { categories: result.categories.map(toPublicMenuCategoryDto), total: result.total };
  }

  async updateCategory(
    id: string,
    updates: UpdateMenuCategoryInput,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicMenuCategoryDto> {
    const existing = await this.categoriesRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('MENU_CATEGORY_NOT_FOUND', 'Menu category not found.');
    }

    const payload: Record<string, unknown> = { ...updates, updatedBy: actor.id };
    if (updates.name !== undefined) {
      const nameKey = normalizeName(updates.name);
      if (nameKey !== existing.nameKey) {
        const conflict = await this.categoriesRepository.findByCanteenAndNameKey(
          existing.canteenId,
          nameKey,
        );
        if (conflict) {
          throw new ConflictError(
            'MENU_CATEGORY_NAME_ALREADY_EXISTS',
            `A category named "${updates.name}" already exists in this canteen.`,
          );
        }
      }
      payload.nameKey = nameKey;
    }

    let updated;
    try {
      updated = await this.categoriesRepository.update(id, payload);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError(
          'MENU_CATEGORY_NAME_ALREADY_EXISTS',
          `A category named "${updates.name}" already exists in this canteen.`,
        );
      }
      throw error;
    }

    if (!updated) {
      throw new NotFoundError('MENU_CATEGORY_NOT_FOUND', 'Menu category not found.');
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_category.updated',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { categoryId: id, changes: Object.keys(updates) },
    });

    return toPublicMenuCategoryDto(updated);
  }

  /**
   * `force=false` (default) rejects deleting a category that still
   * has active (non-deleted) items — the caller must move or delete
   * them first. `force=true` cascades: the category and every one of
   * its active items are soft-deleted together, so no item is ever
   * left pointing at a deleted category.
   */
  async deleteCategory(
    id: string,
    force: boolean,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<void> {
    const existing = await this.categoriesRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('MENU_CATEGORY_NOT_FOUND', 'Menu category not found.');
    }

    const hasActiveItems = await this.itemsRepository.existsActiveInCategory(id);
    if (hasActiveItems && !force) {
      throw new ConflictError(
        'MENU_CATEGORY_HAS_ACTIVE_ITEMS',
        'This category still has active menu items. Pass force=true to delete it and its items together.',
      );
    }

    await this.categoriesRepository.delete(id, actor.id);
    if (hasActiveItems) {
      await this.itemsRepository.softDeleteAllInCategory(id, actor.id);
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_category.deleted',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { categoryId: id, cascadedItems: hasActiveItems },
    });
  }

  /**
   * Single-resource "move to position" API (matches the
   * `PATCH /categories/:id/reorder` route shape — one id, one target
   * position). Recomputes every sibling's displayOrder together and
   * persists the whole set in one bulkWrite, so two categories can
   * never end up sharing a position.
   */
  async reorderCategory(
    id: string,
    targetDisplayOrder: number,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<PublicMenuCategoryDto> {
    const target = await this.categoriesRepository.findById(id);
    if (!target) {
      throw new NotFoundError('MENU_CATEGORY_NOT_FOUND', 'Menu category not found.');
    }

    const { categories: siblings } = await this.categoriesRepository.findByCanteen({
      canteenId: target.canteenId,
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
      sortBy: 'displayOrder',
      sortOrder: 'asc',
    });

    const withoutTarget = siblings.filter((c) => c._id.toString() !== id);
    const clampedIndex = Math.max(0, Math.min(targetDisplayOrder, withoutTarget.length));
    withoutTarget.splice(clampedIndex, 0, target);

    const entries: ReorderCategoryEntry[] = withoutTarget.map((category, index) => ({
      id: category._id,
      displayOrder: index,
    }));
    await this.categoriesRepository.reorderCategories(entries);

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'menu_category.reordered',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { categoryId: id, targetDisplayOrder: clampedIndex },
    });

    const updated = await this.categoriesRepository.findById(id);
    // Cannot be null — the category above was found and reorder never deletes.
    return toPublicMenuCategoryDto(updated as IMenuCategory);
  }

  private async nextDisplayOrder(canteenId: string): Promise<number> {
    const { categories } = await this.categoriesRepository.findByCanteen({
      canteenId,
      page: 1,
      limit: 1,
      sortBy: 'displayOrder',
      sortOrder: 'desc',
    });
    return categories.length > 0 ? categories[0].displayOrder + 1 : 0;
  }
}
