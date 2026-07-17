import {
  canteenIdParamSchema,
  categoryIdParamSchema,
  createMenuCategorySchema,
  deleteMenuCategoryQuerySchema,
  listMenuCategoriesQuerySchema,
  reorderMenuCategorySchema,
  updateMenuCategorySchema,
} from './menu-categories.validation';

describe('createMenuCategorySchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createMenuCategorySchema.safeParse({ name: 'Snacks' });
    expect(result.success).toBe(true);
  });

  it('rejects a name shorter than 2 characters', () => {
    const result = createMenuCategorySchema.safeParse({ name: 'S' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing name', () => {
    const result = createMenuCategorySchema.safeParse({ description: 'x' });
    expect(result.success).toBe(false);
  });

  it('coerces a numeric-string displayOrder', () => {
    const result = createMenuCategorySchema.safeParse({ name: 'Snacks', displayOrder: '3' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.displayOrder).toBe(3);
  });

  it('rejects a negative displayOrder', () => {
    const result = createMenuCategorySchema.safeParse({ name: 'Snacks', displayOrder: -1 });
    expect(result.success).toBe(false);
  });
});

describe('updateMenuCategorySchema', () => {
  it('accepts a single-field update', () => {
    const result = updateMenuCategorySchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it('rejects an empty object', () => {
    const result = updateMenuCategorySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects displayOrder — only the reorder endpoint may change it', () => {
    const result = updateMenuCategorySchema.safeParse({ displayOrder: 2 });
    expect(result.success).toBe(false);
  });
});

describe('reorderMenuCategorySchema', () => {
  it('accepts a non-negative integer', () => {
    expect(reorderMenuCategorySchema.safeParse({ displayOrder: 0 }).success).toBe(true);
  });

  it('rejects a negative value', () => {
    expect(reorderMenuCategorySchema.safeParse({ displayOrder: -1 }).success).toBe(false);
  });

  it('rejects a missing value', () => {
    expect(reorderMenuCategorySchema.safeParse({}).success).toBe(false);
  });
});

describe('canteenIdParamSchema / categoryIdParamSchema', () => {
  const validId = '507f1f77bcf86cd799439011';

  it('accepts a valid ObjectId', () => {
    expect(canteenIdParamSchema.safeParse({ canteenId: validId }).success).toBe(true);
    expect(categoryIdParamSchema.safeParse({ id: validId }).success).toBe(true);
  });

  it('rejects a malformed id', () => {
    expect(canteenIdParamSchema.safeParse({ canteenId: 'not-an-id' }).success).toBe(false);
    expect(categoryIdParamSchema.safeParse({ id: 'not-an-id' }).success).toBe(false);
  });
});

describe('listMenuCategoriesQuerySchema', () => {
  it('applies defaults when no query params are given', () => {
    const result = listMenuCategoriesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        page: 1,
        limit: 20,
        sortBy: 'displayOrder',
        sortOrder: 'asc',
      });
    }
  });

  it('transforms isActive string to boolean', () => {
    const result = listMenuCategoriesQuerySchema.safeParse({ isActive: 'false' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isActive).toBe(false);
  });

  it('rejects a limit above the max page size', () => {
    const result = listMenuCategoriesQuerySchema.safeParse({ limit: '1000' });
    expect(result.success).toBe(false);
  });
});

describe('deleteMenuCategoryQuerySchema', () => {
  it('defaults force to false when absent', () => {
    const result = deleteMenuCategoryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.force).toBe(false);
  });

  it('parses force=true', () => {
    const result = deleteMenuCategoryQuerySchema.safeParse({ force: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.force).toBe(true);
  });
});
