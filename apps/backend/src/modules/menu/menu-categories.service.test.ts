import { Types } from 'mongoose';

import { ConflictError, NotFoundError } from '@errors/http-errors';
import type { AuditLogService } from '@modules/audit/audit-log.service';
import type { CanteensService } from '@modules/canteens/canteens.service';
import { MenuCategoriesService } from './menu-categories.service';
import type { MenuCategoriesRepository } from './menu-categories.repository';
import type { MenuItemsRepository } from './menu-items.repository';
import type { IMenuCategory } from './menu-category.types';

const canteenId = new Types.ObjectId().toString();
const actor = { id: new Types.ObjectId().toString(), role: 'admin' as const };
const meta = {};

function makeCategory(overrides: Partial<IMenuCategory> = {}): IMenuCategory {
  return {
    _id: new Types.ObjectId(),
    canteenId: new Types.ObjectId(canteenId),
    name: 'Snacks',
    nameKey: 'snacks',
    displayOrder: 0,
    isActive: true,
    createdBy: new Types.ObjectId(),
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IMenuCategory;
}

function makeMockCategoriesRepository(): jest.Mocked<MenuCategoriesRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByCanteenAndNameKey: jest.fn(),
    findByCanteen: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    reorderCategories: jest.fn(),
  } as unknown as jest.Mocked<MenuCategoriesRepository>;
}

function makeMockItemsRepository(): jest.Mocked<MenuItemsRepository> {
  return {
    existsActiveInCategory: jest.fn(),
    softDeleteAllInCategory: jest.fn(),
  } as unknown as jest.Mocked<MenuItemsRepository>;
}

function makeMockCanteensService(): jest.Mocked<CanteensService> {
  return {
    getCanteenById: jest.fn().mockResolvedValue({ id: canteenId }),
  } as unknown as jest.Mocked<CanteensService>;
}

function makeMockAuditLogService(): jest.Mocked<AuditLogService> {
  return {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditLogService>;
}

function makeService(
  overrides: {
    categoriesRepo?: jest.Mocked<MenuCategoriesRepository>;
    itemsRepo?: jest.Mocked<MenuItemsRepository>;
    canteensService?: jest.Mocked<CanteensService>;
    auditLogService?: jest.Mocked<AuditLogService>;
  } = {},
) {
  const categoriesRepo = overrides.categoriesRepo ?? makeMockCategoriesRepository();
  const itemsRepo = overrides.itemsRepo ?? makeMockItemsRepository();
  const canteensService = overrides.canteensService ?? makeMockCanteensService();
  const auditLogService = overrides.auditLogService ?? makeMockAuditLogService();
  return {
    service: new MenuCategoriesService(categoriesRepo, itemsRepo, canteensService, auditLogService),
    categoriesRepo,
    itemsRepo,
    canteensService,
    auditLogService,
  };
}

describe('MenuCategoriesService.createCategory', () => {
  it('creates a category, computing displayOrder and recording an audit log', async () => {
    const { service, categoriesRepo, auditLogService } = makeService();
    categoriesRepo.findByCanteenAndNameKey.mockResolvedValue(null);
    categoriesRepo.findByCanteen.mockResolvedValue({ categories: [], total: 0 });
    categoriesRepo.create.mockResolvedValue(makeCategory());

    const result = await service.createCategory(canteenId, { name: 'Snacks' }, actor, meta);

    expect(result.name).toBe('Snacks');
    expect(categoriesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nameKey: 'snacks', displayOrder: 0, createdBy: actor.id }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'menu_category.created', success: true }),
    );
  });

  it('throws when the canteen does not exist', async () => {
    const { service, canteensService, categoriesRepo } = makeService();
    canteensService.getCanteenById.mockRejectedValue(
      new NotFoundError('CANTEEN_NOT_FOUND', 'Canteen not found.'),
    );

    await expect(
      service.createCategory(canteenId, { name: 'Snacks' }, actor, meta),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(categoriesRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate name found by the pre-check, without touching create()', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findByCanteenAndNameKey.mockResolvedValue(makeCategory());

    await expect(
      service.createCategory(canteenId, { name: 'Snacks' }, actor, meta),
    ).rejects.toMatchObject({ code: 'MENU_CATEGORY_NAME_ALREADY_EXISTS' });
    expect(categoriesRepo.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate-key race error from create() to the same domain error', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findByCanteenAndNameKey.mockResolvedValue(null);
    categoriesRepo.findByCanteen.mockResolvedValue({ categories: [], total: 0 });
    categoriesRepo.create.mockRejectedValue({ code: 11000 });

    await expect(
      service.createCategory(canteenId, { name: 'Snacks' }, actor, meta),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('appends after the current highest displayOrder when none is given', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findByCanteenAndNameKey.mockResolvedValue(null);
    categoriesRepo.findByCanteen.mockResolvedValue({
      categories: [makeCategory({ displayOrder: 4 })],
      total: 1,
    });
    categoriesRepo.create.mockResolvedValue(makeCategory({ displayOrder: 5 }));

    await service.createCategory(canteenId, { name: 'Beverages' }, actor, meta);

    expect(categoriesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ displayOrder: 5 }),
    );
  });

  it('uses an explicit displayOrder when provided', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findByCanteenAndNameKey.mockResolvedValue(null);
    categoriesRepo.create.mockResolvedValue(makeCategory({ displayOrder: 9 }));

    await service.createCategory(canteenId, { name: 'Beverages', displayOrder: 9 }, actor, meta);

    expect(categoriesRepo.findByCanteen).not.toHaveBeenCalled();
    expect(categoriesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ displayOrder: 9 }),
    );
  });
});

describe('MenuCategoriesService.getCategoryById', () => {
  it('returns the category when found', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory());

    const result = await service.getCategoryById('id');

    expect(result.name).toBe('Snacks');
  });

  it('throws NotFoundError when missing', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(null);

    await expect(service.getCategoryById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('MenuCategoriesService.updateCategory', () => {
  it('throws NotFoundError when the category does not exist', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(null);

    await expect(
      service.updateCategory('id', { isActive: false }, actor, meta),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects renaming to a name already used by another category in the same canteen', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory({ nameKey: 'snacks' }));
    categoriesRepo.findByCanteenAndNameKey.mockResolvedValue(
      makeCategory({ nameKey: 'beverages' }),
    );

    await expect(
      service.updateCategory('id', { name: 'Beverages' }, actor, meta),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(categoriesRepo.update).not.toHaveBeenCalled();
  });

  it('allows a no-op rename (same name, different casing) without a conflict lookup', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory({ nameKey: 'snacks' }));
    categoriesRepo.update.mockResolvedValue(makeCategory({ name: 'SNACKS' }));

    await service.updateCategory('id', { name: 'SNACKS' }, actor, meta);

    expect(categoriesRepo.findByCanteenAndNameKey).not.toHaveBeenCalled();
  });
});

describe('MenuCategoriesService.deleteCategory', () => {
  it('throws NotFoundError when the category does not exist', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(null);

    await expect(service.deleteCategory('id', false, actor, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('rejects deleting a category with active items when force is false', async () => {
    const { service, categoriesRepo, itemsRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory());
    itemsRepo.existsActiveInCategory.mockResolvedValue(true);

    await expect(service.deleteCategory('id', false, actor, meta)).rejects.toMatchObject({
      code: 'MENU_CATEGORY_HAS_ACTIVE_ITEMS',
    });
    expect(categoriesRepo.delete).not.toHaveBeenCalled();
  });

  it('cascades to soft-delete active items when force is true', async () => {
    const { service, categoriesRepo, itemsRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory());
    itemsRepo.existsActiveInCategory.mockResolvedValue(true);
    categoriesRepo.delete.mockResolvedValue(true);

    await service.deleteCategory('id', true, actor, meta);

    expect(categoriesRepo.delete).toHaveBeenCalledWith('id', actor.id);
    expect(itemsRepo.softDeleteAllInCategory).toHaveBeenCalledWith('id', actor.id);
  });

  it('deletes without cascading when there are no active items', async () => {
    const { service, categoriesRepo, itemsRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory());
    itemsRepo.existsActiveInCategory.mockResolvedValue(false);
    categoriesRepo.delete.mockResolvedValue(true);

    await service.deleteCategory('id', false, actor, meta);

    expect(itemsRepo.softDeleteAllInCategory).not.toHaveBeenCalled();
  });
});

describe('MenuCategoriesService.reorderCategory', () => {
  it('throws NotFoundError when the target category does not exist', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(null);

    await expect(service.reorderCategory('id', 0, actor, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('recomputes the full sibling order and persists it in one call', async () => {
    const { service, categoriesRepo } = makeService();
    const target = makeCategory({ displayOrder: 0 });
    const sibling = makeCategory({ _id: new Types.ObjectId(), displayOrder: 1 });
    categoriesRepo.findById.mockResolvedValueOnce(target).mockResolvedValueOnce({
      ...target,
      displayOrder: 1,
    } as IMenuCategory);
    categoriesRepo.findByCanteen.mockResolvedValue({ categories: [target, sibling], total: 2 });

    await service.reorderCategory(target._id.toString(), 1, actor, meta);

    expect(categoriesRepo.reorderCategories).toHaveBeenCalledWith([
      { id: sibling._id, displayOrder: 0 },
      { id: target._id, displayOrder: 1 },
    ]);
  });
});
