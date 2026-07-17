import type { Document, Types } from 'mongoose';

/**
 * Mongoose document shape. `nameKey` and the soft-delete fields
 * (`isDeleted`/`deletedAt`/`deletedBy`) are internal bookkeeping —
 * never part of `PublicCanteenDto`, the only shape that crosses the
 * API boundary. See docs/DATABASE_DESIGN.md for field rationale.
 */
export interface ICanteen extends Document {
  _id: Types.ObjectId;
  name: string;
  /** Normalized (trim + lowercase) copy of `name`, computed by the service layer — the field the unique index actually enforces uniqueness on, so "Main Canteen" and "main canteen" can't both exist. */
  nameKey: string;
  description?: string;
  location: string;
  image?: string;
  contactNumber: string;
  email: string;
  /** 24-hour "HH:mm" — see CanteensService's time-range validation. */
  openingTime: string;
  closingTime: string;
  isOpen: boolean;
  createdBy: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** The only shape a canteen document is ever allowed to cross the API boundary as. */
export interface PublicCanteenDto {
  id: string;
  name: string;
  description?: string;
  location: string;
  image?: string;
  contactNumber: string;
  email: string;
  openingTime: string;
  closingTime: string;
  isOpen: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicCanteenDto(canteen: ICanteen): PublicCanteenDto {
  return {
    id: canteen._id.toString(),
    name: canteen.name,
    description: canteen.description,
    location: canteen.location,
    image: canteen.image,
    contactNumber: canteen.contactNumber,
    email: canteen.email,
    openingTime: canteen.openingTime,
    closingTime: canteen.closingTime,
    isOpen: canteen.isOpen,
    createdBy: canteen.createdBy.toString(),
    createdAt: canteen.createdAt,
    updatedAt: canteen.updatedAt,
  };
}
