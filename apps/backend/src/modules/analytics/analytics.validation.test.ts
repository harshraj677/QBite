import {
  analyticsFilterQuerySchema,
  canteenAnalyticsQuerySchema,
  menuAnalyticsQuerySchema,
  revenueAnalyticsQuerySchema,
  userAnalyticsQuerySchema,
} from './analytics.validation';

describe('analyticsFilterQuerySchema', () => {
  it('defaults filter to last30days when omitted', () => {
    const result = analyticsFilterQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filter).toBe('last30days');
    }
  });

  it.each([
    'today',
    'yesterday',
    'last7days',
    'last30days',
    'currentMonth',
    'previousMonth',
    'currentYear',
  ])('accepts the "%s" preset with no startDate/endDate', (filter) => {
    expect(analyticsFilterQuerySchema.safeParse({ filter }).success).toBe(true);
  });

  it('rejects an unrecognized filter value', () => {
    expect(analyticsFilterQuerySchema.safeParse({ filter: 'lastWeek' }).success).toBe(false);
  });

  it('accepts filter=custom with both startDate and endDate', () => {
    const result = analyticsFilterQuerySchema.safeParse({
      filter: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejects filter=custom with only startDate', () => {
    const result = analyticsFilterQuerySchema.safeParse({
      filter: 'custom',
      startDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects filter=custom with neither startDate nor endDate', () => {
    expect(analyticsFilterQuerySchema.safeParse({ filter: 'custom' }).success).toBe(false);
  });

  it('rejects startDate after endDate', () => {
    const result = analyticsFilterQuerySchema.safeParse({
      filter: 'custom',
      startDate: '2026-02-01',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('accepts startDate equal to endDate', () => {
    const result = analyticsFilterQuerySchema.safeParse({
      filter: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('coerces date strings to Date instances', () => {
    const result = analyticsFilterQuerySchema.safeParse({
      filter: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeInstanceOf(Date);
      expect(result.data.endDate).toBeInstanceOf(Date);
    }
  });
});

describe('revenueAnalyticsQuerySchema', () => {
  it('defaults granularity to day', () => {
    const result = revenueAnalyticsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.granularity).toBe('day');
    }
  });

  it.each(['day', 'week', 'month', 'year'])('accepts granularity=%s', (granularity) => {
    expect(revenueAnalyticsQuerySchema.safeParse({ granularity }).success).toBe(true);
  });

  it('rejects an unrecognized granularity', () => {
    expect(revenueAnalyticsQuerySchema.safeParse({ granularity: 'hourly' }).success).toBe(false);
  });

  it('still enforces the custom-range refinement', () => {
    expect(revenueAnalyticsQuerySchema.safeParse({ filter: 'custom' }).success).toBe(false);
  });
});

describe('menuAnalyticsQuerySchema / canteenAnalyticsQuerySchema / userAnalyticsQuerySchema', () => {
  it.each([
    ['menu', menuAnalyticsQuerySchema],
    ['canteen', canteenAnalyticsQuerySchema],
    ['user', userAnalyticsQuerySchema],
  ] as const)('%s schema defaults limit to 10', (_name, schema) => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it.each([
    ['menu', menuAnalyticsQuerySchema],
    ['canteen', canteenAnalyticsQuerySchema],
    ['user', userAnalyticsQuerySchema],
  ] as const)('%s schema rejects a limit above 50', (_name, schema) => {
    expect(schema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it.each([
    ['menu', menuAnalyticsQuerySchema],
    ['canteen', canteenAnalyticsQuerySchema],
    ['user', userAnalyticsQuerySchema],
  ] as const)('%s schema rejects a limit below 1', (_name, schema) => {
    expect(schema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it.each([
    ['menu', menuAnalyticsQuerySchema],
    ['canteen', canteenAnalyticsQuerySchema],
    ['user', userAnalyticsQuerySchema],
  ] as const)('%s schema coerces a string limit to a number', (_name, schema) => {
    const result = schema.safeParse({ limit: '25' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it.each([
    ['menu', menuAnalyticsQuerySchema],
    ['canteen', canteenAnalyticsQuerySchema],
    ['user', userAnalyticsQuerySchema],
  ] as const)('%s schema still enforces the custom-range refinement', (_name, schema) => {
    expect(schema.safeParse({ filter: 'custom', startDate: '2026-01-01' }).success).toBe(false);
  });
});
