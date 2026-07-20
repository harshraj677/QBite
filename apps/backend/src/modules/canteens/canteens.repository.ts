import type { Types } from 'mongoose';

import { CanteenModel } from './canteen.model';
import type { CanteenSortableField } from './canteens.constants';
import type { ICanteen } from './canteen.types';

/** Escapes regex metacharacters in free-text search input — same helper/reasoning as UsersRepository.search's. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CreateCanteenInput {
  name: string;
  nameKey: string;
  description?: string;
  location: string;
  image?: string;
  contactNumber: string;
  email: string;
  openingTime: string;
  closingTime: string;
  createdBy: string | Types.ObjectId;
}

export interface ListCanteensOptions {
  page: number;
  limit: number;
  isOpen?: boolean;
  /** Matched case-insensitively against name and location — added for the Canteens Management phase's Directory search. */
  search?: string;
  sortBy: CanteenSortableField;
  sortOrder: 'asc' | 'desc';
}

export interface ListCanteensResult {
  canteens: ICanteen[];
  total: number;
}

/**
 * All Mongoose queries for the `canteens` collection live here — per
 * ARCHITECTURE.md §3.1's layering rule, nothing outside this file
 * (including CanteensService) touches `CanteenModel` directly.
 *
 * Every read method filters `isDeleted: false` unconditionally — this
 * module exposes no "include deleted" query path; soft-deleted
 * canteens are invisible to every caller, by design.
 */
export class CanteensRepository {
  create(input: CreateCanteenInput): Promise<ICanteen> {
    return CanteenModel.create(input);
  }

  findById(id: string | Types.ObjectId): Promise<ICanteen | null> {
    return CanteenModel.findOne({ _id: id, isDeleted: false }).exec();
  }

  /** Used by the service layer's uniqueness check — not part of the requested repository method list, but required to enforce "canteen name must be unique" without relying solely on the DB's duplicate-key error for the common case. */
  findByNameKey(nameKey: string): Promise<ICanteen | null> {
    return CanteenModel.findOne({ nameKey, isDeleted: false }).exec();
  }

  async findAll(options: ListCanteensOptions): Promise<ListCanteensResult> {
    const filter: Record<string, unknown> = { isDeleted: false };
    if (options.isOpen !== undefined) {
      filter.isOpen = options.isOpen;
    }
    if (options.search) {
      const pattern = new RegExp(escapeRegex(options.search), 'i');
      filter.$or = [{ name: pattern }, { location: pattern }];
    }

    const sort: Record<string, 1 | -1> = { [options.sortBy]: options.sortOrder === 'asc' ? 1 : -1 };
    const skip = (options.page - 1) * options.limit;

    const [canteens, total] = await Promise.all([
      CanteenModel.find(filter).sort(sort).skip(skip).limit(options.limit).exec(),
      CanteenModel.countDocuments(filter).exec(),
    ]);

    return { canteens, total };
  }

  /**
   * Partial update — only the keys present in `updates` are touched.
   * `runValidators: true` validates just those keys (Mongoose does not
   * re-validate required fields the update doesn't touch), so a
   * single-field update never fails because of an unrelated required
   * field it didn't include.
   */
  update(id: string | Types.ObjectId, updates: Record<string, unknown>): Promise<ICanteen | null> {
    return CanteenModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updates },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  }

  /** Soft delete — sets isDeleted/deletedAt/deletedBy rather than removing the document. Returns false if no matching, non-deleted canteen existed. */
  async delete(id: string | Types.ObjectId, deletedBy: string | Types.ObjectId): Promise<boolean> {
    const result = await CanteenModel.updateOne(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
    ).exec();
    return result.modifiedCount > 0;
  }

  /**
   * Atomic flip via an aggregation-pipeline update ($not reads the
   * document's own current value server-side) rather than
   * read-then-write — avoids a race between two concurrent toggle
   * calls landing in the wrong order.
   */
  toggleOpenStatus(id: string | Types.ObjectId): Promise<ICanteen | null> {
    return CanteenModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      [{ $set: { isOpen: { $not: '$isOpen' } } }],
      // Mongoose 9 requires updatePipeline explicitly to accept an
      // array as a pipeline update — without it this throws "Cannot
      // pass an array to query updates unless the updatePipeline
      // option is set" (caught by canteens.repository.test.ts).
      { returnDocument: 'after', updatePipeline: true },
    ).exec();
  }

  /** Non-soft-deleted canteens — Analytics phase, Dashboard's "Total Canteens" (see ARCHITECTURE.md §3.1's `modules/analytics` note). */
  count(): Promise<number> {
    return CanteenModel.countDocuments({ isDeleted: false }).exec();
  }

  /** Batch fetch — Analytics phase, enriching a canteenId list (e.g. revenue-by-canteen) with names in one round trip. */
  findByIds(ids: (string | Types.ObjectId)[]): Promise<ICanteen[]> {
    return CanteenModel.find({ _id: { $in: ids }, isDeleted: false }).exec();
  }
}
