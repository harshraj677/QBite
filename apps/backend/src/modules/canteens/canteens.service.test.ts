import { Types } from 'mongoose';

import { ConflictError, NotFoundError, UnprocessableEntityError } from '@errors/http-errors';
import { CanteensService } from './canteens.service';
import type { CanteensRepository } from './canteens.repository';
import type { ICanteen } from './canteen.types';

function makeCanteen(overrides: Partial<ICanteen> = {}): ICanteen {
  return {
    _id: new Types.ObjectId(),
    name: 'Main Canteen',
    nameKey: 'main canteen',
    location: 'Block A',
    contactNumber: '+919876543210',
    email: 'main@college.edu',
    openingTime: '09:00',
    closingTime: '21:00',
    isOpen: true,
    createdBy: new Types.ObjectId(),
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ICanteen;
}

function makeMockRepository(): jest.Mocked<CanteensRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByNameKey: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleOpenStatus: jest.fn(),
  } as unknown as jest.Mocked<CanteensRepository>;
}

const createdBy = new Types.ObjectId().toString();

describe('CanteensService.createCanteen', () => {
  it('creates a canteen when the name is not taken and the time range is valid', async () => {
    const repo = makeMockRepository();
    repo.findByNameKey.mockResolvedValue(null);
    repo.create.mockResolvedValue(makeCanteen());
    const service = new CanteensService(repo);

    const result = await service.createCanteen(
      {
        name: 'Main Canteen',
        location: 'Block A',
        contactNumber: '+919876543210',
        email: 'main@college.edu',
        openingTime: '09:00',
        closingTime: '21:00',
      },
      createdBy,
    );

    expect(result.name).toBe('Main Canteen');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nameKey: 'main canteen', createdBy }),
    );
  });

  it('rejects a duplicate name found by the pre-check, without touching create()', async () => {
    const repo = makeMockRepository();
    repo.findByNameKey.mockResolvedValue(makeCanteen());
    const service = new CanteensService(repo);

    await expect(
      service.createCanteen(
        {
          name: 'Main Canteen',
          location: 'Block A',
          contactNumber: '+919876543210',
          email: 'main@college.edu',
          openingTime: '09:00',
          closingTime: '21:00',
        },
        createdBy,
      ),
    ).rejects.toMatchObject({ code: 'CANTEEN_NAME_ALREADY_EXISTS' });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate-key error from create() to the same domain error (race-condition path)', async () => {
    const repo = makeMockRepository();
    repo.findByNameKey.mockResolvedValue(null);
    repo.create.mockRejectedValue({ code: 11000 });
    const service = new CanteensService(repo);

    await expect(
      service.createCanteen(
        {
          name: 'Main Canteen',
          location: 'Block A',
          contactNumber: '+919876543210',
          email: 'main@college.edu',
          openingTime: '09:00',
          closingTime: '21:00',
        },
        createdBy,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects when closingTime is not after openingTime, before ever querying the repository', async () => {
    const repo = makeMockRepository();
    const service = new CanteensService(repo);

    await expect(
      service.createCanteen(
        {
          name: 'Main Canteen',
          location: 'Block A',
          contactNumber: '+919876543210',
          email: 'main@college.edu',
          openingTime: '21:00',
          closingTime: '09:00',
        },
        createdBy,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityError);
    expect(repo.findByNameKey).not.toHaveBeenCalled();
  });

  it('rejects equal opening and closing times', async () => {
    const repo = makeMockRepository();
    const service = new CanteensService(repo);

    await expect(
      service.createCanteen(
        {
          name: 'Main Canteen',
          location: 'Block A',
          contactNumber: '+919876543210',
          email: 'main@college.edu',
          openingTime: '09:00',
          closingTime: '09:00',
        },
        createdBy,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityError);
  });
});

describe('CanteensService.getCanteenById', () => {
  it('returns the canteen when found', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(makeCanteen());
    const service = new CanteensService(repo);

    const result = await service.getCanteenById('some-id');

    expect(result.name).toBe('Main Canteen');
  });

  it('throws NotFoundError when missing', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(null);
    const service = new CanteensService(repo);

    await expect(service.getCanteenById('missing-id')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('CanteensService.listCanteens', () => {
  it('delegates to the repository and maps documents to DTOs', async () => {
    const repo = makeMockRepository();
    repo.findAll.mockResolvedValue({ canteens: [makeCanteen()], total: 1 });
    const service = new CanteensService(repo);

    // isOpen: undefined is explicit, not omitted — Zod's
    // .optional().transform() infers a required key whose *value* can
    // be undefined, not an optional key, so ListCanteensQuery doesn't
    // structurally accept the key being absent from an object literal.
    const result = await service.listCanteens({
      page: 1,
      limit: 20,
      isOpen: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.canteens[0].name).toBe('Main Canteen');
  });
});

describe('CanteensService.updateCanteen', () => {
  it('throws NotFoundError when the canteen does not exist', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(null);
    const service = new CanteensService(repo);

    await expect(service.updateCanteen('missing-id', { location: 'X' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('validates the EFFECTIVE time range using the existing value for a field not being updated', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(makeCanteen({ openingTime: '09:00', closingTime: '21:00' }));
    const service = new CanteensService(repo);

    // Only closingTime is being changed, to something before the
    // EXISTING (unchanged) openingTime of 09:00 — must still fail.
    await expect(service.updateCanteen('id', { closingTime: '08:00' })).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('does not re-check name uniqueness when name is not part of the update', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(makeCanteen());
    repo.update.mockResolvedValue(makeCanteen({ location: 'New Location' }));
    const service = new CanteensService(repo);

    await service.updateCanteen('id', { location: 'New Location' });

    expect(repo.findByNameKey).not.toHaveBeenCalled();
  });

  it('rejects renaming to a name already used by a different canteen', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(makeCanteen({ nameKey: 'main canteen' }));
    repo.findByNameKey.mockResolvedValue(makeCanteen({ nameKey: 'other canteen' }));
    const service = new CanteensService(repo);

    await expect(service.updateCanteen('id', { name: 'Other Canteen' })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('allows a no-op rename (same name, different casing) without a conflict', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(makeCanteen({ nameKey: 'main canteen' }));
    repo.update.mockResolvedValue(makeCanteen({ name: 'MAIN CANTEEN' }));
    const service = new CanteensService(repo);

    await service.updateCanteen('id', { name: 'MAIN CANTEEN' });

    // Same normalized key as the existing document -> no uniqueness
    // lookup needed, since it can only ever collide with itself.
    expect(repo.findByNameKey).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      'id',
      expect.objectContaining({ nameKey: 'main canteen' }),
    );
  });

  it('throws NotFoundError if the document disappears between the existence check and the update', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(makeCanteen());
    repo.update.mockResolvedValue(null);
    const service = new CanteensService(repo);

    await expect(service.updateCanteen('id', { location: 'X' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('CanteensService.deleteCanteen', () => {
  it('throws NotFoundError when the canteen does not exist', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(null);
    const service = new CanteensService(repo);

    await expect(service.deleteCanteen('missing-id', createdBy)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('soft-deletes an existing canteen', async () => {
    const repo = makeMockRepository();
    repo.findById.mockResolvedValue(makeCanteen());
    repo.delete.mockResolvedValue(true);
    const service = new CanteensService(repo);

    await service.deleteCanteen('id', createdBy);

    expect(repo.delete).toHaveBeenCalledWith('id', createdBy);
  });
});

describe('CanteensService.toggleStatus', () => {
  it('returns the toggled canteen', async () => {
    const repo = makeMockRepository();
    repo.toggleOpenStatus.mockResolvedValue(makeCanteen({ isOpen: false }));
    const service = new CanteensService(repo);

    const result = await service.toggleStatus('id');

    expect(result.isOpen).toBe(false);
  });

  it('throws NotFoundError when the canteen does not exist', async () => {
    const repo = makeMockRepository();
    repo.toggleOpenStatus.mockResolvedValue(null);
    const service = new CanteensService(repo);

    await expect(service.toggleStatus('missing-id')).rejects.toBeInstanceOf(NotFoundError);
  });
});
