import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { CanteensRepository } from './canteens.repository';
import type { CreateCanteenInput } from './canteens.repository';

const repository = new CanteensRepository();

function makeInput(overrides: Partial<CreateCanteenInput> = {}): CreateCanteenInput {
  return {
    name: 'Main Canteen',
    nameKey: 'main canteen',
    location: 'Block A, Ground Floor',
    contactNumber: '+919876543210',
    email: 'main.canteen@college.edu',
    openingTime: '09:00',
    closingTime: '21:00',
    createdBy: new Types.ObjectId(),
    ...overrides,
  };
}

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('CanteensRepository.create / findById', () => {
  it('creates a canteen and finds it by id', async () => {
    const created = await repository.create(makeInput());

    const found = await repository.findById(created._id);

    expect(found?.name).toBe('Main Canteen');
    expect(found?.isOpen).toBe(true); // schema default
    expect(found?.isDeleted).toBe(false); // schema default
  });

  it('returns null for a non-existent id', async () => {
    const found = await repository.findById(new Types.ObjectId());
    expect(found).toBeNull();
  });

  it('rejects two documents with the same nameKey (unique index)', async () => {
    await repository.create(makeInput());

    await expect(
      repository.create(makeInput({ email: 'other@college.edu' })),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });
});

describe('CanteensRepository.findByNameKey', () => {
  it('finds an existing, non-deleted canteen by its normalized key', async () => {
    await repository.create(makeInput({ nameKey: 'main canteen' }));

    const found = await repository.findByNameKey('main canteen');

    expect(found).not.toBeNull();
  });

  it('does not find a soft-deleted canteen', async () => {
    const created = await repository.create(makeInput());
    await repository.delete(created._id, new Types.ObjectId());

    const found = await repository.findByNameKey('main canteen');

    expect(found).toBeNull();
  });
});

describe('CanteensRepository.findAll', () => {
  beforeEach(async () => {
    await repository.create(
      makeInput({ name: 'Alpha Canteen', nameKey: 'alpha canteen', email: 'a@college.edu' }),
    );
    await repository.create(
      makeInput({ name: 'Beta Canteen', nameKey: 'beta canteen', email: 'b@college.edu' }),
    );
    await repository.create(
      makeInput({ name: 'Gamma Canteen', nameKey: 'gamma canteen', email: 'g@college.edu' }),
    );
  });

  it('paginates with the requested page/limit', async () => {
    const page1 = await repository.findAll({ page: 1, limit: 2, sortBy: 'name', sortOrder: 'asc' });
    const page2 = await repository.findAll({ page: 2, limit: 2, sortBy: 'name', sortOrder: 'asc' });

    expect(page1.total).toBe(3);
    expect(page1.canteens).toHaveLength(2);
    expect(page1.canteens.map((c) => c.name)).toEqual(['Alpha Canteen', 'Beta Canteen']);
    expect(page2.canteens.map((c) => c.name)).toEqual(['Gamma Canteen']);
  });

  it('sorts by name descending', async () => {
    const result = await repository.findAll({
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'desc',
    });

    expect(result.canteens.map((c) => c.name)).toEqual([
      'Gamma Canteen',
      'Beta Canteen',
      'Alpha Canteen',
    ]);
  });

  it('filters by isOpen', async () => {
    const all = await repository.findAll({ page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' });
    await repository.toggleOpenStatus(all.canteens[0]._id); // close Alpha

    const openOnly = await repository.findAll({
      page: 1,
      limit: 10,
      isOpen: true,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(openOnly.total).toBe(2);
    expect(openOnly.canteens.map((c) => c.name)).toEqual(['Beta Canteen', 'Gamma Canteen']);
  });

  it('excludes soft-deleted canteens', async () => {
    const all = await repository.findAll({ page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' });
    await repository.delete(all.canteens[0]._id, new Types.ObjectId());

    const remaining = await repository.findAll({
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(remaining.total).toBe(2);
  });

  it('searches case-insensitively by name', async () => {
    const result = await repository.findAll({
      page: 1,
      limit: 10,
      search: 'beta',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(1);
    expect(result.canteens[0].name).toBe('Beta Canteen');
  });

  it('searches by location', async () => {
    const all = await repository.findAll({ page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' });
    await repository.update(all.canteens[0]._id, { location: 'Unique Wing, 2nd Floor' });

    const result = await repository.findAll({
      page: 1,
      limit: 10,
      search: 'unique wing',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(1);
  });

  it('does not throw on regex-special characters in search input', async () => {
    await expect(
      repository.findAll({
        page: 1,
        limit: 10,
        search: '(alpha',
        sortBy: 'name',
        sortOrder: 'asc',
      }),
    ).resolves.toMatchObject({ total: 0 });
  });
});

describe('CanteensRepository.update', () => {
  it('applies a partial update and returns the updated document', async () => {
    const created = await repository.create(makeInput());

    const updated = await repository.update(created._id, { location: 'Block B, First Floor' });

    expect(updated?.location).toBe('Block B, First Floor');
    expect(updated?.name).toBe('Main Canteen'); // untouched fields survive
  });

  it('returns null for a non-existent id', async () => {
    const updated = await repository.update(new Types.ObjectId(), { location: 'X' });
    expect(updated).toBeNull();
  });

  it('does not update a soft-deleted canteen', async () => {
    const created = await repository.create(makeInput());
    await repository.delete(created._id, new Types.ObjectId());

    const updated = await repository.update(created._id, { location: 'X' });

    expect(updated).toBeNull();
  });
});

describe('CanteensRepository.delete', () => {
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

  it('returns false when deleting an already-deleted canteen', async () => {
    const created = await repository.create(makeInput());
    await repository.delete(created._id, new Types.ObjectId());

    const secondAttempt = await repository.delete(created._id, new Types.ObjectId());

    expect(secondAttempt).toBe(false);
  });
});

describe('CanteensRepository.toggleOpenStatus', () => {
  it('flips isOpen from true to false and back', async () => {
    const created = await repository.create(makeInput());
    expect(created.isOpen).toBe(true);

    const closed = await repository.toggleOpenStatus(created._id);
    expect(closed?.isOpen).toBe(false);

    const reopened = await repository.toggleOpenStatus(created._id);
    expect(reopened?.isOpen).toBe(true);
  });

  it('returns null for a non-existent id', async () => {
    const result = await repository.toggleOpenStatus(new Types.ObjectId());
    expect(result).toBeNull();
  });
});

// Regression coverage for the Analytics phase's read-only additions.
describe('CanteensRepository.count', () => {
  it('counts only non-soft-deleted canteens', async () => {
    await repository.create(makeInput());
    const toDelete = await repository.create(makeInput({ name: 'Second', nameKey: 'second' }));
    await repository.delete(toDelete._id, new Types.ObjectId());

    expect(await repository.count()).toBe(1);
  });
});

describe('CanteensRepository.findByIds', () => {
  it('batch-fetches by id, excluding soft-deleted ones', async () => {
    const a = await repository.create(makeInput());
    const b = await repository.create(makeInput({ name: 'Second', nameKey: 'second' }));
    const deleted = await repository.create(makeInput({ name: 'Third', nameKey: 'third' }));
    await repository.delete(deleted._id, new Types.ObjectId());

    const found = await repository.findByIds([a._id, b._id, deleted._id]);

    expect(found.map((c) => c._id.toString()).sort()).toEqual(
      [a._id.toString(), b._id.toString()].sort(),
    );
  });
});
