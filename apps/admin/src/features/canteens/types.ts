/** Mirrors apps/backend/src/modules/canteens/canteen.types.ts's PublicCanteenDto exactly. */
export interface CanteenDto {
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
  createdAt: string;
  updatedAt: string;
}

export type CanteenSortableField = 'name' | 'createdAt';

export interface CanteensFilters {
  search?: string;
  isOpen?: boolean;
}

export interface CanteensQueryParams extends CanteensFilters {
  page: number;
  limit: number;
  sortBy: CanteenSortableField;
  sortOrder: 'asc' | 'desc';
}
