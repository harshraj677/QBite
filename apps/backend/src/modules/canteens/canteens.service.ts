import { ConflictError, NotFoundError, UnprocessableEntityError } from '@errors/http-errors';
import type { ListCanteensOptions, ListCanteensResult } from './canteens.repository';
import { CanteensRepository } from './canteens.repository';
import type { PublicCanteenDto } from './canteen.types';
import { toPublicCanteenDto } from './canteen.types';
import type {
  CreateCanteenInput,
  ListCanteensQuery,
  UpdateCanteenInput,
} from './canteens.validation';

export interface PublicCanteenListResult {
  canteens: PublicCanteenDto[];
  total: number;
}

/** Same shape MongoDB's duplicate-key error carries — checked instead of importing mongoose's error class directly, matching the pattern already used in auth.service.ts (duplicated here rather than exported from the auth module — see the Canteen-phase architectural decision on not touching auth). */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Business rules for the `canteens` module. Depends only on
 * `CanteensRepository` — never touches `CanteenModel` directly (see
 * ARCHITECTURE.md §3.1's layering rule).
 */
export class CanteensService {
  constructor(private readonly canteensRepository: CanteensRepository = new CanteensRepository()) {}

  async createCanteen(input: CreateCanteenInput, createdBy: string): Promise<PublicCanteenDto> {
    this.assertValidTimeRange(input.openingTime, input.closingTime);

    const nameKey = normalizeName(input.name);
    const existing = await this.canteensRepository.findByNameKey(nameKey);
    if (existing) {
      throw new ConflictError(
        'CANTEEN_NAME_ALREADY_EXISTS',
        `A canteen named "${input.name}" already exists.`,
      );
    }

    try {
      const canteen = await this.canteensRepository.create({ ...input, nameKey, createdBy });
      return toPublicCanteenDto(canteen);
    } catch (error) {
      // Two concurrent creates racing past the pre-check above and
      // both hitting the unique index on nameKey — the index is the
      // real guarantee, the findByNameKey call above is a fast-path/
      // better-error-message optimization. Same pattern as
      // AuthService.register's duplicate-key handling.
      if (isDuplicateKeyError(error)) {
        throw new ConflictError(
          'CANTEEN_NAME_ALREADY_EXISTS',
          `A canteen named "${input.name}" already exists.`,
        );
      }
      throw error;
    }
  }

  async getCanteenById(id: string): Promise<PublicCanteenDto> {
    const canteen = await this.canteensRepository.findById(id);
    if (!canteen) {
      throw new NotFoundError('CANTEEN_NOT_FOUND', 'Canteen not found.');
    }
    return toPublicCanteenDto(canteen);
  }

  async listCanteens(query: ListCanteensQuery): Promise<PublicCanteenListResult> {
    const options: ListCanteensOptions = {
      page: query.page,
      limit: query.limit,
      isOpen: query.isOpen,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    const result: ListCanteensResult = await this.canteensRepository.findAll(options);
    return { canteens: result.canteens.map(toPublicCanteenDto), total: result.total };
  }

  async updateCanteen(id: string, updates: UpdateCanteenInput): Promise<PublicCanteenDto> {
    const existing = await this.canteensRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('CANTEEN_NOT_FOUND', 'Canteen not found.');
    }

    // Time-range validation must consider the *effective* hours after
    // this update, not just the fields being changed — e.g. changing
    // only closingTime to something before the existing (unchanged)
    // openingTime must still be rejected.
    const effectiveOpeningTime = updates.openingTime ?? existing.openingTime;
    const effectiveClosingTime = updates.closingTime ?? existing.closingTime;
    this.assertValidTimeRange(effectiveOpeningTime, effectiveClosingTime);

    const payload: Record<string, unknown> = { ...updates };
    if (updates.name !== undefined) {
      const nameKey = normalizeName(updates.name);
      if (nameKey !== existing.nameKey) {
        const conflict = await this.canteensRepository.findByNameKey(nameKey);
        if (conflict) {
          throw new ConflictError(
            'CANTEEN_NAME_ALREADY_EXISTS',
            `A canteen named "${updates.name}" already exists.`,
          );
        }
      }
      payload.nameKey = nameKey;
    }

    let updated;
    try {
      updated = await this.canteensRepository.update(id, payload);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError(
          'CANTEEN_NAME_ALREADY_EXISTS',
          `A canteen named "${updates.name}" already exists.`,
        );
      }
      throw error;
    }

    if (!updated) {
      throw new NotFoundError('CANTEEN_NOT_FOUND', 'Canteen not found.');
    }
    return toPublicCanteenDto(updated);
  }

  async deleteCanteen(id: string, deletedBy: string): Promise<void> {
    const existing = await this.canteensRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('CANTEEN_NOT_FOUND', 'Canteen not found.');
    }
    await this.canteensRepository.delete(id, deletedBy);
  }

  async toggleStatus(id: string): Promise<PublicCanteenDto> {
    const canteen = await this.canteensRepository.toggleOpenStatus(id);
    if (!canteen) {
      throw new NotFoundError('CANTEEN_NOT_FOUND', 'Canteen not found.');
    }
    return toPublicCanteenDto(canteen);
  }

  /** Same-day hours only — closingTime must be strictly after openingTime. An overnight canteen (e.g. 22:00-02:00) is not supported in this phase; flagged as a known simplification, not a silent gap. */
  private assertValidTimeRange(openingTime: string, closingTime: string): void {
    if (closingTime <= openingTime) {
      throw new UnprocessableEntityError(
        'CANTEEN_INVALID_TIME_RANGE',
        'closingTime must be after openingTime.',
      );
    }
  }
}
