import {
  canteenIdParamSchema,
  createCanteenSchema,
  listCanteensQuerySchema,
  updateCanteenSchema,
} from './canteens.validation';

const validInput = {
  name: 'Main Canteen',
  description: 'The main campus canteen.',
  location: 'Block A, Ground Floor',
  image: 'https://cdn.example.com/canteen.jpg',
  contactNumber: '+919876543210',
  email: 'Main.Canteen@College.EDU',
  openingTime: '09:00',
  closingTime: '21:00',
};

function omit(obj: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  const copy = { ...obj };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

describe('createCanteenSchema', () => {
  it('accepts a valid payload', () => {
    expect(createCanteenSchema.safeParse(validInput).success).toBe(true);
  });

  it('lowercases the email', () => {
    const result = createCanteenSchema.parse(validInput);
    expect(result.email).toBe('main.canteen@college.edu');
  });

  it('allows description and image to be omitted', () => {
    expect(createCanteenSchema.safeParse(omit(validInput, 'description', 'image')).success).toBe(
      true,
    );
  });

  it.each(['name', 'location', 'contactNumber', 'email', 'openingTime', 'closingTime'])(
    'rejects a payload missing required field "%s"',
    (field) => {
      expect(createCanteenSchema.safeParse(omit(validInput, field)).success).toBe(false);
    },
  );

  it('rejects an invalid email', () => {
    const result = createCanteenSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid contact number', () => {
    const result = createCanteenSchema.safeParse({ ...validInput, contactNumber: 'call-me' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL image', () => {
    const result = createCanteenSchema.safeParse({ ...validInput, image: 'not a url' });
    expect(result.success).toBe(false);
  });

  it.each(['9am', '09:60', '24:00', '9:00', ''])(
    'rejects malformed openingTime "%s"',
    (openingTime) => {
      const result = createCanteenSchema.safeParse({ ...validInput, openingTime });
      expect(result.success).toBe(false);
    },
  );

  it.each(['00:00', '09:00', '23:59'])('accepts well-formed 24-hour time "%s"', (openingTime) => {
    // Format only — Zod does not cross-validate opening vs. closing
    // time ordering; that's CanteensService.assertValidTimeRange's job
    // (see canteens.service.test.ts). closingTime is fixed here so
    // only openingTime's format is under test.
    expect(createCanteenSchema.safeParse({ ...validInput, openingTime }).success).toBe(true);
  });

  it('rejects a name that is too short', () => {
    expect(createCanteenSchema.safeParse({ ...validInput, name: 'A' }).success).toBe(false);
  });
});

describe('updateCanteenSchema', () => {
  it('accepts a single-field update', () => {
    expect(updateCanteenSchema.safeParse({ location: 'New Block' }).success).toBe(true);
  });

  it('rejects an empty object', () => {
    expect(updateCanteenSchema.safeParse({}).success).toBe(false);
  });

  it('still validates field formats on a partial update', () => {
    expect(updateCanteenSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('canteenIdParamSchema', () => {
  it('accepts a well-formed ObjectId', () => {
    expect(canteenIdParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(true);
  });

  it('rejects a malformed id', () => {
    expect(canteenIdParamSchema.safeParse({ id: 'not-an-object-id' }).success).toBe(false);
  });
});

describe('listCanteensQuerySchema', () => {
  it('applies defaults when no query params are given', () => {
    const result = listCanteensQuerySchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
  });

  it('coerces page/limit from strings (as Express query params always arrive)', () => {
    const result = listCanteensQuerySchema.parse({ page: '2', limit: '10' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('caps limit at the max page size', () => {
    expect(listCanteensQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('transforms the isOpen string filter into a real boolean', () => {
    expect(listCanteensQuerySchema.parse({ isOpen: 'true' }).isOpen).toBe(true);
    expect(listCanteensQuerySchema.parse({ isOpen: 'false' }).isOpen).toBe(false);
    expect(listCanteensQuerySchema.parse({}).isOpen).toBeUndefined();
  });

  it('rejects a sortBy field outside the allow-list', () => {
    expect(listCanteensQuerySchema.safeParse({ sortBy: 'email' }).success).toBe(false);
  });

  it('accepts an optional search string', () => {
    expect(listCanteensQuerySchema.parse({ search: 'beta' }).search).toBe('beta');
    expect(listCanteensQuerySchema.parse({}).search).toBeUndefined();
  });

  it('rejects an empty search string', () => {
    expect(listCanteensQuerySchema.safeParse({ search: '' }).success).toBe(false);
  });
});
