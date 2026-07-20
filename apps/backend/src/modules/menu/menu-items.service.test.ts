import { Types } from 'mongoose';

import { ConflictError, NotFoundError, UnprocessableEntityError } from '@errors/http-errors';
import type { AuditLogService } from '@modules/audit/audit-log.service';
import type { CanteensService } from '@modules/canteens/canteens.service';
import { MenuItemsService } from './menu-items.service';
import type { MenuCategoriesRepository } from './menu-categories.repository';
import type { MenuItemsRepository } from './menu-items.repository';
import type { IMenuCategory } from './menu-category.types';
import type { IMenuItem } from './menu-item.types';

const canteenId = new Types.ObjectId().toString();
const categoryId = new Types.ObjectId().toString();
const actor = { id: new Types.ObjectId().toString(), role: 'admin' as const };
const meta = {};

function makeCategory(overrides: Partial<IMenuCategory> = {}): IMenuCategory {
  return {
    _id: new Types.ObjectId(categoryId),
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

function makeItem(overrides: Partial<IMenuItem> = {}): IMenuItem {
  return {
    _id: new Types.ObjectId(),
    canteenId: new Types.ObjectId(canteenId),
    categoryId: new Types.ObjectId(categoryId),
    name: 'Veg Puff',
    nameKey: 'veg puff',
    price: 3000,
    preparationTimeMinutes: 5,
    isVeg: true,
    isAvailable: true,
    isFeatured: false,
    allergens: [],
    displayOrder: 0,
    createdBy: new Types.ObjectId(),
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IMenuItem;
}

function makeMockItemsRepository(): jest.Mocked<MenuItemsRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByCategoryAndNameKey: jest.fn(),
    findByCategory: jest.fn(),
    findByCanteen: jest.fn(),
    existsActiveInCategory: jest.fn(),
    softDeleteAllInCategory: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    updateAvailability: jest.fn(),
    updateFeatured: jest.fn(),
    reorderItems: jest.fn(),
    count: jest.fn(),
  } as unknown as jest.Mocked<MenuItemsRepository>;
}

function makeMockCategoriesRepository(): jest.Mocked<MenuCategoriesRepository> {
  return {
    findById: jest.fn(),
  } as unknown as jest.Mocked<MenuCategoriesRepository>;
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
    itemsRepo?: jest.Mocked<MenuItemsRepository>;
    categoriesRepo?: jest.Mocked<MenuCategoriesRepository>;
    canteensService?: jest.Mocked<CanteensService>;
    auditLogService?: jest.Mocked<AuditLogService>;
  } = {},
) {
  const itemsRepo = overrides.itemsRepo ?? makeMockItemsRepository();
  const categoriesRepo = overrides.categoriesRepo ?? makeMockCategoriesRepository();
  const canteensService = overrides.canteensService ?? makeMockCanteensService();
  const auditLogService = overrides.auditLogService ?? makeMockAuditLogService();
  return {
    service: new MenuItemsService(itemsRepo, categoriesRepo, canteensService, auditLogService),
    itemsRepo,
    categoriesRepo,
    canteensService,
    auditLogService,
  };
}

const validInput = {
  categoryId,
  name: 'Veg Puff',
  price: 3000,
  preparationTimeMinutes: 5,
  isVeg: true,
} as const;

describe('MenuItemsService.createItem', () => {
  it('creates an item and records an audit log', async () => {
    const { service, itemsRepo, categoriesRepo, auditLogService } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory());
    itemsRepo.findByCategoryAndNameKey.mockResolvedValue(null);
    itemsRepo.findByCategory.mockResolvedValue({ items: [], total: 0 });
    itemsRepo.create.mockResolvedValue(makeItem());

    const result = await service.createItem(canteenId, validInput, actor, meta);

    expect(result.name).toBe('Veg Puff');
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'menu_item.created', success: true }),
    );
  });

  it('throws when the category does not exist (or is soft-deleted)', async () => {
    const { service, categoriesRepo, itemsRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(null);

    await expect(service.createItem(canteenId, validInput, actor, meta)).rejects.toMatchObject({
      code: 'MENU_CATEGORY_NOT_FOUND',
    });
    expect(itemsRepo.create).not.toHaveBeenCalled();
  });

  it('throws when the category belongs to a different canteen', async () => {
    const { service, categoriesRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory({ canteenId: new Types.ObjectId() }));

    await expect(service.createItem(canteenId, validInput, actor, meta)).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );
  });

  it('rejects a duplicate item name within the same category', async () => {
    const { service, categoriesRepo, itemsRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory());
    itemsRepo.findByCategoryAndNameKey.mockResolvedValue(makeItem());

    await expect(service.createItem(canteenId, validInput, actor, meta)).rejects.toMatchObject({
      code: 'MENU_ITEM_NAME_ALREADY_EXISTS',
    });
    expect(itemsRepo.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate-key race error to the same domain error', async () => {
    const { service, categoriesRepo, itemsRepo } = makeService();
    categoriesRepo.findById.mockResolvedValue(makeCategory());
    itemsRepo.findByCategoryAndNameKey.mockResolvedValue(null);
    itemsRepo.findByCategory.mockResolvedValue({ items: [], total: 0 });
    itemsRepo.create.mockRejectedValue({ code: 11000 });

    await expect(service.createItem(canteenId, validInput, actor, meta)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('MenuItemsService.updateItem', () => {
  it('throws NotFoundError when the item does not exist', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(null);

    await expect(service.updateItem('id', { price: 4000 }, actor, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('allows moving to another category in the same canteen', async () => {
    const { service, itemsRepo, categoriesRepo } = makeService();
    const newCategoryId = new Types.ObjectId().toString();
    itemsRepo.findById.mockResolvedValue(makeItem());
    categoriesRepo.findById.mockResolvedValue(
      makeCategory({ _id: new Types.ObjectId(newCategoryId) }),
    );
    itemsRepo.findByCategoryAndNameKey.mockResolvedValue(null);
    itemsRepo.update.mockResolvedValue(makeItem({ categoryId: new Types.ObjectId(newCategoryId) }));

    await service.updateItem('id', { categoryId: newCategoryId }, actor, meta);

    expect(itemsRepo.update).toHaveBeenCalled();
  });

  it('rejects moving into a category belonging to a different canteen', async () => {
    const { service, itemsRepo, categoriesRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(makeItem());
    categoriesRepo.findById.mockResolvedValue(makeCategory({ canteenId: new Types.ObjectId() }));

    await expect(
      service.updateItem('id', { categoryId: new Types.ObjectId().toString() }, actor, meta),
    ).rejects.toMatchObject({ code: 'MENU_ITEM_CANTEEN_MISMATCH' });
    expect(itemsRepo.update).not.toHaveBeenCalled();
  });

  it('rejects moving into a category that does not exist', async () => {
    const { service, itemsRepo, categoriesRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(makeItem());
    categoriesRepo.findById.mockResolvedValue(null);

    await expect(
      service.updateItem('id', { categoryId: new Types.ObjectId().toString() }, actor, meta),
    ).rejects.toMatchObject({ code: 'MENU_CATEGORY_NOT_FOUND' });
  });
});

describe('MenuItemsService.deleteItem', () => {
  it('throws NotFoundError when the item does not exist', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(null);

    await expect(service.deleteItem('id', actor, meta)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('soft-deletes an existing item', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(makeItem());
    itemsRepo.delete.mockResolvedValue(true);

    await service.deleteItem('id', actor, meta);

    expect(itemsRepo.delete).toHaveBeenCalledWith('id', actor.id);
  });
});

describe('MenuItemsService.setAvailability', () => {
  it('throws NotFoundError when the item does not exist', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.updateAvailability.mockResolvedValue(null);

    await expect(service.setAvailability('id', false, actor, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('updates availability and records an audit log', async () => {
    const { service, itemsRepo, auditLogService } = makeService();
    itemsRepo.updateAvailability.mockResolvedValue(
      makeItem({ isAvailable: false, isFeatured: false }),
    );

    const result = await service.setAvailability('id', false, actor, meta);

    expect(result.isAvailable).toBe(false);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'menu_item.availability_updated' }),
    );
  });
});

describe('MenuItemsService.setFeatured', () => {
  it('rejects featuring an item that is not available', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(makeItem({ isAvailable: false }));

    await expect(service.setFeatured('id', true, actor, meta)).rejects.toMatchObject({
      code: 'MENU_ITEM_NOT_AVAILABLE_FOR_FEATURE',
    });
    expect(itemsRepo.updateFeatured).not.toHaveBeenCalled();
  });

  it('allows featuring an available item', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(makeItem({ isAvailable: true }));
    itemsRepo.updateFeatured.mockResolvedValue(makeItem({ isFeatured: true }));

    const result = await service.setFeatured('id', true, actor, meta);

    expect(result.isFeatured).toBe(true);
  });

  it('allows un-featuring without checking availability', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.updateFeatured.mockResolvedValue(makeItem({ isFeatured: false }));

    await service.setFeatured('id', false, actor, meta);

    expect(itemsRepo.findById).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the item does not exist', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(null);

    await expect(service.setFeatured('id', true, actor, meta)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('MenuItemsService.reorderItem', () => {
  it('throws NotFoundError when the target item does not exist', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.findById.mockResolvedValue(null);

    await expect(service.reorderItem('id', 0, actor, meta)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('recomputes the full sibling order scoped to the category', async () => {
    const { service, itemsRepo } = makeService();
    const target = makeItem({ displayOrder: 0 });
    const sibling = makeItem({ _id: new Types.ObjectId(), displayOrder: 1 });
    itemsRepo.findById.mockResolvedValueOnce(target).mockResolvedValueOnce({
      ...target,
      displayOrder: 1,
    } as IMenuItem);
    itemsRepo.findByCategory.mockResolvedValue({ items: [target, sibling], total: 2 });

    await service.reorderItem(target._id.toString(), 1, actor, meta);

    expect(itemsRepo.reorderItems).toHaveBeenCalledWith([
      { id: sibling._id, displayOrder: 0 },
      { id: target._id, displayOrder: 1 },
    ]);
  });
});

// Regression coverage for the Analytics phase's read-only addition.
describe('MenuItemsService.countItems', () => {
  it('delegates to the repository', async () => {
    const { service, itemsRepo } = makeService();
    itemsRepo.count.mockResolvedValue(42);

    const result = await service.countItems();

    expect(itemsRepo.count).toHaveBeenCalled();
    expect(result).toBe(42);
  });
});
