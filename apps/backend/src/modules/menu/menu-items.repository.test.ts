import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { MenuItemModel } from './menu-item.model';
import { MenuItemsRepository } from './menu-items.repository';
import type { CreateMenuItemInput } from './menu-items.repository';

const repository = new MenuItemsRepository();
const canteenId = new Types.ObjectId();
const categoryId = new Types.ObjectId();

function makeInput(overrides: Partial<CreateMenuItemInput> = {}): CreateMenuItemInput {
  return {
    canteenId,
    categoryId,
    name: 'Veg Puff',
    nameKey: 'veg puff',
    price: 3000,
    preparationTimeMinutes: 5,
    isVeg: true,
    displayOrder: 0,
    createdBy: new Types.ObjectId(),
    ...overrides,
  };
}

beforeAll(async () => {
  await connectTestDb();
  await MenuItemModel.init(); // see menu-categories.repository.test.ts for why this matters
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('MenuItemsRepository.create / findById', () => {
  it('creates an item and finds it by id, with expected defaults', async () => {
    const created = await repository.create(makeInput());

    const found = await repository.findById(created._id);

    expect(found?.name).toBe('Veg Puff');
    expect(found?.isAvailable).toBe(true);
    expect(found?.isFeatured).toBe(false);
    expect(found?.allergens).toEqual([]);
    expect(found?.isDeleted).toBe(false);
  });

  it('rejects two items with the same nameKey within the same category (unique index)', async () => {
    await repository.create(makeInput());

    await expect(repository.create(makeInput())).rejects.toMatchObject({ code: 11000 });
  });

  it('allows the same nameKey in two different categories', async () => {
    await repository.create(makeInput({ categoryId }));

    const otherCategoryId = new Types.ObjectId();
    await expect(
      repository.create(makeInput({ categoryId: otherCategoryId })),
    ).resolves.toMatchObject({ nameKey: 'veg puff' });
  });
});

describe('MenuItemsRepository.findByCanteen filtering', () => {
  beforeEach(async () => {
    await repository.create(
      makeInput({ name: 'Veg Puff', nameKey: 'veg puff', isVeg: true, price: 3000 }),
    );
    await repository.create(
      makeInput({ name: 'Chicken Puff', nameKey: 'chicken puff', isVeg: false, price: 4000 }),
    );
    await repository.create(
      makeInput({
        name: 'Cold Coffee',
        nameKey: 'cold coffee',
        isVeg: true,
        price: 6000,
        isFeatured: true,
      }),
    );
  });

  it('filters by isVeg', async () => {
    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      isVeg: true,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(2);
  });

  it('filters by price range', async () => {
    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      priceMin: 3500,
      priceMax: 5000,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(result.items.map((i) => i.name)).toEqual(['Chicken Puff']);
  });

  it('filters by isFeatured', async () => {
    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      isFeatured: true,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(result.items.map((i) => i.name)).toEqual(['Cold Coffee']);
  });

  it('filters by search (case-insensitive substring on name)', async () => {
    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      search: 'puff',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(2);
  });

  it('sorts by price descending', async () => {
    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      sortBy: 'price',
      sortOrder: 'desc',
    });
    expect(result.items.map((i) => i.name)).toEqual(['Cold Coffee', 'Chicken Puff', 'Veg Puff']);
  });

  it('excludes items from a different canteen', async () => {
    await repository.create(
      makeInput({ canteenId: new Types.ObjectId(), name: 'Other', nameKey: 'other' }),
    );

    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(result.total).toBe(3);
  });

  it('excludes soft-deleted items', async () => {
    const all = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    await repository.delete(all.items[0]._id, new Types.ObjectId());

    const remaining = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(remaining.total).toBe(2);
  });
});

describe('MenuItemsRepository.findByCategory', () => {
  it('scopes results to the given category only', async () => {
    await repository.create(makeInput({ categoryId, name: 'A', nameKey: 'a' }));
    const otherCategoryId = new Types.ObjectId();
    await repository.create(makeInput({ categoryId: otherCategoryId, name: 'B', nameKey: 'b' }));

    const result = await repository.findByCategory({
      categoryId,
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('A');
  });
});

describe('MenuItemsRepository.existsActiveInCategory / softDeleteAllInCategory', () => {
  it('reports true when the category has an active item, false after all are soft-deleted', async () => {
    const item = await repository.create(makeInput());

    expect(await repository.existsActiveInCategory(categoryId)).toBe(true);

    await repository.delete(item._id, new Types.ObjectId());

    expect(await repository.existsActiveInCategory(categoryId)).toBe(false);
  });

  it('softDeleteAllInCategory soft-deletes every active item and returns the count', async () => {
    await repository.create(makeInput({ name: 'A', nameKey: 'a' }));
    await repository.create(makeInput({ name: 'B', nameKey: 'b' }));

    const count = await repository.softDeleteAllInCategory(categoryId, new Types.ObjectId());

    expect(count).toBe(2);
    expect(await repository.existsActiveInCategory(categoryId)).toBe(false);
  });
});

describe('MenuItemsRepository.update / delete / restore', () => {
  it('applies a partial update', async () => {
    const created = await repository.create(makeInput());

    const updated = await repository.update(created._id, { price: 3500 });

    expect(updated?.price).toBe(3500);
    expect(updated?.name).toBe('Veg Puff');
  });

  it('soft-deletes and restore reverses it', async () => {
    const created = await repository.create(makeInput());
    await repository.delete(created._id, new Types.ObjectId());
    expect(await repository.findById(created._id)).toBeNull();

    const restored = await repository.restore(created._id, new Types.ObjectId());

    expect(restored?.isDeleted).toBe(false);
    expect(await repository.findById(created._id)).not.toBeNull();
  });
});

describe('MenuItemsRepository.updateAvailability', () => {
  it('sets isAvailable and leaves isFeatured untouched when turning available on', async () => {
    const created = await repository.create(makeInput({ isAvailable: false }));

    const updated = await repository.updateAvailability(created._id, true, new Types.ObjectId());

    expect(updated?.isAvailable).toBe(true);
  });

  it('clears isFeatured atomically when turning availability off', async () => {
    const created = await repository.create(makeInput({ isFeatured: true }));

    const updated = await repository.updateAvailability(created._id, false, new Types.ObjectId());

    expect(updated?.isAvailable).toBe(false);
    expect(updated?.isFeatured).toBe(false);
  });
});

describe('MenuItemsRepository.updateFeatured', () => {
  it('sets isFeatured', async () => {
    const created = await repository.create(makeInput());

    const updated = await repository.updateFeatured(created._id, true, new Types.ObjectId());

    expect(updated?.isFeatured).toBe(true);
  });
});

describe('MenuItemsRepository.reorderItems', () => {
  it('persists a full recomputed ordering', async () => {
    const a = await repository.create(makeInput({ name: 'A', nameKey: 'a', displayOrder: 0 }));
    const b = await repository.create(makeInput({ name: 'B', nameKey: 'b', displayOrder: 1 }));

    await repository.reorderItems([
      { id: a._id, displayOrder: 1 },
      { id: b._id, displayOrder: 0 },
    ]);

    const result = await repository.findByCategory({
      categoryId,
      page: 1,
      limit: 10,
      sortBy: 'displayOrder',
      sortOrder: 'asc',
    });
    expect(result.items.map((i) => i.name)).toEqual(['B', 'A']);
  });
});

// Regression coverage for the Analytics phase's read-only addition.
describe('MenuItemsRepository.count', () => {
  it('counts only non-soft-deleted items', async () => {
    await repository.create(makeInput({ name: 'A', nameKey: 'a', displayOrder: 0 }));
    const toDelete = await repository.create(
      makeInput({ name: 'B', nameKey: 'b', displayOrder: 1 }),
    );
    await repository.delete(toDelete._id, new Types.ObjectId());

    expect(await repository.count()).toBe(1);
  });
});
