import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { MenuCategoryModel } from './menu-category.model';
import { MenuCategoriesRepository } from './menu-categories.repository';
import type { CreateMenuCategoryInput } from './menu-categories.repository';

const repository = new MenuCategoriesRepository();
const canteenId = new Types.ObjectId();

function makeInput(overrides: Partial<CreateMenuCategoryInput> = {}): CreateMenuCategoryInput {
  return {
    canteenId,
    name: 'Snacks',
    nameKey: 'snacks',
    displayOrder: 0,
    createdBy: new Types.ObjectId(),
    ...overrides,
  };
}

beforeAll(async () => {
  await connectTestDb();
  // Waits for the {canteenId, nameKey} unique index to actually exist
  // before any test runs. Without this, Model.create() can race ahead
  // of mongoose's background index build right after connect() — a
  // real, reproducible flake found in canteens.repository.test.ts
  // during this phase (see the Menu-phase final report's "Bugs Found"
  // section; not fixed there since it's a pre-existing, out-of-scope
  // module, but avoided here for this module's own tests).
  await MenuCategoryModel.init();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('MenuCategoriesRepository.create / findById', () => {
  it('creates a category and finds it by id', async () => {
    const created = await repository.create(makeInput());

    const found = await repository.findById(created._id);

    expect(found?.name).toBe('Snacks');
    expect(found?.isActive).toBe(true); // schema default
    expect(found?.isDeleted).toBe(false); // schema default
  });

  it('returns null for a non-existent id', async () => {
    const found = await repository.findById(new Types.ObjectId());
    expect(found).toBeNull();
  });

  it('rejects two categories with the same nameKey within the same canteen (unique index)', async () => {
    await repository.create(makeInput());

    await expect(repository.create(makeInput())).rejects.toMatchObject({ code: 11000 });
  });

  it('allows the same nameKey in two different canteens', async () => {
    await repository.create(makeInput({ canteenId }));

    const otherCanteenId = new Types.ObjectId();
    await expect(
      repository.create(makeInput({ canteenId: otherCanteenId })),
    ).resolves.toMatchObject({ nameKey: 'snacks' });
  });
});

describe('MenuCategoriesRepository.findByCanteenAndNameKey', () => {
  it('finds an existing, non-deleted category by its normalized key', async () => {
    await repository.create(makeInput());

    const found = await repository.findByCanteenAndNameKey(canteenId, 'snacks');

    expect(found).not.toBeNull();
  });

  it('does not find a soft-deleted category', async () => {
    const created = await repository.create(makeInput());
    await repository.delete(created._id, new Types.ObjectId());

    const found = await repository.findByCanteenAndNameKey(canteenId, 'snacks');

    expect(found).toBeNull();
  });
});

describe('MenuCategoriesRepository.findByCanteen', () => {
  beforeEach(async () => {
    await repository.create(makeInput({ name: 'Alpha', nameKey: 'alpha', displayOrder: 2 }));
    await repository.create(makeInput({ name: 'Beta', nameKey: 'beta', displayOrder: 0 }));
    await repository.create(makeInput({ name: 'Gamma', nameKey: 'gamma', displayOrder: 1 }));
  });

  it('sorts by displayOrder ascending by default filters', async () => {
    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      sortBy: 'displayOrder',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(3);
    expect(result.categories.map((c) => c.name)).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  it('paginates with the requested page/limit', async () => {
    const page1 = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 2,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(page1.categories).toHaveLength(2);
    expect(page1.total).toBe(3);
  });

  it('filters by search (case-insensitive substring on name)', async () => {
    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      search: 'am',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(result.categories.map((c) => c.name)).toEqual(['Gamma']);
  });

  it('filters by isActive', async () => {
    const all = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    await repository.update(all.categories[0]._id, { isActive: false });

    const activeOnly = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      isActive: true,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(activeOnly.total).toBe(2);
  });

  it('excludes categories from a different canteen', async () => {
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

  it('excludes soft-deleted categories', async () => {
    const all = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    await repository.delete(all.categories[0]._id, new Types.ObjectId());

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

describe('MenuCategoriesRepository.update', () => {
  it('applies a partial update and returns the updated document', async () => {
    const created = await repository.create(makeInput());

    const updated = await repository.update(created._id, { description: 'Chips, fries, etc.' });

    expect(updated?.description).toBe('Chips, fries, etc.');
    expect(updated?.name).toBe('Snacks'); // untouched fields survive
  });

  it('returns null for a non-existent id', async () => {
    const updated = await repository.update(new Types.ObjectId(), { description: 'X' });
    expect(updated).toBeNull();
  });

  it('does not update a soft-deleted category', async () => {
    const created = await repository.create(makeInput());
    await repository.delete(created._id, new Types.ObjectId());

    const updated = await repository.update(created._id, { description: 'X' });

    expect(updated).toBeNull();
  });
});

describe('MenuCategoriesRepository.delete / restore', () => {
  it('soft-deletes: sets isDeleted/deletedAt/deletedBy and hides the document from findById', async () => {
    const created = await repository.create(makeInput());
    const deletedBy = new Types.ObjectId();

    const result = await repository.delete(created._id, deletedBy);

    expect(result).toBe(true);
    expect(await repository.findById(created._id)).toBeNull();
  });

  it('returns false for a non-existent id', async () => {
    const result = await repository.delete(new Types.ObjectId(), new Types.ObjectId());
    expect(result).toBe(false);
  });

  it('restores a soft-deleted category, clearing deletedAt/deletedBy', async () => {
    const created = await repository.create(makeInput());
    const deletedBy = new Types.ObjectId();
    await repository.delete(created._id, deletedBy);

    const restoredBy = new Types.ObjectId();
    const restored = await repository.restore(created._id, restoredBy);

    expect(restored?.isDeleted).toBe(false);
    expect(restored?.deletedAt).toBeUndefined();
    expect(restored?.deletedBy).toBeUndefined();
    expect(restored?.updatedBy?.toString()).toBe(restoredBy.toString());
    expect(await repository.findById(created._id)).not.toBeNull();
  });

  it('returns null when restoring a category that was never deleted', async () => {
    const created = await repository.create(makeInput());

    const result = await repository.restore(created._id, new Types.ObjectId());

    expect(result).toBeNull();
  });
});

describe('MenuCategoriesRepository.reorderCategories', () => {
  it('persists a full recomputed ordering', async () => {
    const a = await repository.create(
      makeInput({ name: 'Alpha', nameKey: 'alpha', displayOrder: 0 }),
    );
    const b = await repository.create(
      makeInput({ name: 'Beta', nameKey: 'beta', displayOrder: 1 }),
    );

    await repository.reorderCategories([
      { id: a._id, displayOrder: 1 },
      { id: b._id, displayOrder: 0 },
    ]);

    const result = await repository.findByCanteen({
      canteenId,
      page: 1,
      limit: 10,
      sortBy: 'displayOrder',
      sortOrder: 'asc',
    });
    expect(result.categories.map((c) => c.name)).toEqual(['Beta', 'Alpha']);
  });

  it('is a no-op for an empty list', async () => {
    await expect(repository.reorderCategories([])).resolves.toBeUndefined();
  });
});
