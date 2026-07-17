import {
  createMenuItemSchema,
  listMenuItemsQuerySchema,
  menuItemIdParamSchema,
  reorderMenuItemSchema,
  updateAvailabilitySchema,
  updateFeaturedSchema,
  updateMenuItemSchema,
} from './menu-items.validation';

const validCategoryId = '507f1f77bcf86cd799439011';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: validCategoryId,
    name: 'Veg Puff',
    price: 3000,
    preparationTimeMinutes: 5,
    isVeg: true,
    ...overrides,
  };
}

describe('createMenuItemSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(createMenuItemSchema.safeParse(validPayload()).success).toBe(true);
  });

  it('rejects a missing isVeg', () => {
    const { isVeg, ...rest } = validPayload();
    void isVeg;
    expect(createMenuItemSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a zero or negative price', () => {
    expect(createMenuItemSchema.safeParse(validPayload({ price: 0 })).success).toBe(false);
    expect(createMenuItemSchema.safeParse(validPayload({ price: -100 })).success).toBe(false);
  });

  it('rejects a non-integer price (paise must be an integer)', () => {
    expect(createMenuItemSchema.safeParse(validPayload({ price: 30.5 })).success).toBe(false);
  });

  it('rejects a zero or negative preparationTimeMinutes', () => {
    expect(
      createMenuItemSchema.safeParse(validPayload({ preparationTimeMinutes: 0 })).success,
    ).toBe(false);
  });

  it('rejects a malformed categoryId', () => {
    expect(createMenuItemSchema.safeParse(validPayload({ categoryId: 'nope' })).success).toBe(
      false,
    );
  });

  it('accepts allergens as an array of short strings', () => {
    const result = createMenuItemSchema.safeParse(
      validPayload({ allergens: ['peanuts', 'dairy'] }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects more than 20 allergens', () => {
    const allergens = Array.from({ length: 21 }, (_, i) => `allergen-${i}`);
    expect(createMenuItemSchema.safeParse(validPayload({ allergens })).success).toBe(false);
  });
});

describe('updateMenuItemSchema', () => {
  it('accepts a single-field update', () => {
    expect(updateMenuItemSchema.safeParse({ price: 3500 }).success).toBe(true);
  });

  it('rejects an empty object', () => {
    expect(updateMenuItemSchema.safeParse({}).success).toBe(false);
  });

  it('rejects isAvailable — only the availability endpoint may change it', () => {
    expect(updateMenuItemSchema.safeParse({ isAvailable: true }).success).toBe(false);
  });

  it('rejects isFeatured — only the featured endpoint may change it', () => {
    expect(updateMenuItemSchema.safeParse({ isFeatured: true }).success).toBe(false);
  });

  it('rejects displayOrder — only the reorder endpoint may change it', () => {
    expect(updateMenuItemSchema.safeParse({ displayOrder: 1 }).success).toBe(false);
  });

  it('allows moving to another category via categoryId', () => {
    expect(updateMenuItemSchema.safeParse({ categoryId: validCategoryId }).success).toBe(true);
  });
});

describe('updateAvailabilitySchema / updateFeaturedSchema', () => {
  it('requires a boolean isAvailable', () => {
    expect(updateAvailabilitySchema.safeParse({ isAvailable: true }).success).toBe(true);
    expect(updateAvailabilitySchema.safeParse({}).success).toBe(false);
  });

  it('requires a boolean isFeatured', () => {
    expect(updateFeaturedSchema.safeParse({ isFeatured: false }).success).toBe(true);
    expect(updateFeaturedSchema.safeParse({}).success).toBe(false);
  });
});

describe('reorderMenuItemSchema', () => {
  it('accepts a non-negative integer', () => {
    expect(reorderMenuItemSchema.safeParse({ displayOrder: 0 }).success).toBe(true);
  });

  it('rejects a negative value', () => {
    expect(reorderMenuItemSchema.safeParse({ displayOrder: -1 }).success).toBe(false);
  });
});

describe('menuItemIdParamSchema', () => {
  it('accepts a valid ObjectId and rejects a malformed one', () => {
    expect(menuItemIdParamSchema.safeParse({ id: validCategoryId }).success).toBe(true);
    expect(menuItemIdParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });
});

describe('listMenuItemsQuerySchema', () => {
  it('applies defaults', () => {
    const result = listMenuItemsQuerySchema.safeParse({});
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

  it('transforms boolean-ish query params', () => {
    const result = listMenuItemsQuerySchema.safeParse({ isVeg: 'true', isAvailable: 'false' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isVeg).toBe(true);
      expect(result.data.isAvailable).toBe(false);
    }
  });

  it('rejects priceMin greater than priceMax', () => {
    const result = listMenuItemsQuerySchema.safeParse({ priceMin: '500', priceMax: '100' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid price range', () => {
    const result = listMenuItemsQuerySchema.safeParse({ priceMin: '100', priceMax: '500' });
    expect(result.success).toBe(true);
  });
});
