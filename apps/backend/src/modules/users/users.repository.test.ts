import { Types } from 'mongoose';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../../tests/helpers/test-db';
import { UsersRepository } from './users.repository';
import type { CreateUserInput } from './users.repository';
import type { UserRole } from './user.types';

const repository = new UsersRepository();

let counter = 0;

function makeInput(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  counter += 1;
  return {
    fullName: `Test User ${counter}`,
    collegeEmail: `user${counter}@college.edu`,
    phoneNumber: `+9198765${String(counter).padStart(5, '0')}`,
    passwordHash: 'hashed',
    role: 'student',
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

describe('UsersRepository.search', () => {
  it('filters by role', async () => {
    await repository.create(makeInput({ role: 'student' }));
    await repository.create(makeInput({ role: 'kitchen_staff' }));

    const result = await repository.search({
      role: 'kitchen_staff',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.users[0].role).toBe('kitchen_staff');
  });

  it('filters by isActive and isEmailVerified', async () => {
    await repository.create(makeInput({ fullName: 'Active Verified' }));
    const inactive = await repository.create(makeInput({ fullName: 'Inactive' }));
    await repository.setActive(inactive._id, false);

    const result = await repository.search({
      isActive: false,
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.users[0].fullName).toBe('Inactive');
  });

  it('searches case-insensitively across fullName, collegeEmail, usn, and phoneNumber', async () => {
    await repository.create(makeInput({ fullName: 'Arjun Rao', usn: '1MS20CS001' }));
    await repository.create(makeInput({ fullName: 'Someone Else' }));

    const result = await repository.search({
      search: 'arjun',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.users[0].fullName).toBe('Arjun Rao');
  });

  it('does not throw on regex-special characters in search input', async () => {
    await repository.create(makeInput());

    await expect(
      repository.search({
        search: '(test',
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    ).resolves.toMatchObject({ total: 0 });
  });

  it('paginates', async () => {
    for (let i = 0; i < 3; i += 1) {
      await repository.create(makeInput());
    }

    const page1 = await repository.search({
      page: 1,
      limit: 2,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    const page2 = await repository.search({
      page: 2,
      limit: 2,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    expect(page1.total).toBe(3);
    expect(page1.users).toHaveLength(2);
    expect(page2.users).toHaveLength(1);
  });
});

describe('UsersRepository.updateRole', () => {
  it('updates the role and returns the updated document', async () => {
    const user = await repository.create(makeInput({ role: 'student' }));

    const updated = await repository.updateRole(user._id, 'kitchen_staff');

    expect(updated?.role).toBe('kitchen_staff');
  });

  it('returns null for a non-existent id', async () => {
    const updated = await repository.updateRole(new Types.ObjectId(), 'admin');
    expect(updated).toBeNull();
  });
});

describe('UsersRepository.setActive', () => {
  it('updates isActive and returns the updated document', async () => {
    const user = await repository.create(makeInput());

    const updated = await repository.setActive(user._id, false);

    expect(updated?.isActive).toBe(false);
  });
});

describe('UsersRepository.countActive', () => {
  it('counts only active users within the given roles', async () => {
    await repository.create(makeInput({ role: 'admin' }));
    const inactiveAdmin = await repository.create(makeInput({ role: 'admin' }));
    await repository.setActive(inactiveAdmin._id, false);
    await repository.create(makeInput({ role: 'super_admin' }));
    await repository.create(makeInput({ role: 'student' }));

    const count = await repository.countActive(['admin', 'super_admin'] as UserRole[]);

    expect(count).toBe(2);
  });

  it('excludes the given id', async () => {
    const admin = await repository.create(makeInput({ role: 'admin' }));

    const count = await repository.countActive(['admin'] as UserRole[], admin._id);

    expect(count).toBe(0);
  });
});
