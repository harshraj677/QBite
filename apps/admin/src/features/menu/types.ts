/** Mirrors apps/backend/src/modules/menu/menu-item.types.ts's PublicMenuItemDto exactly. */
export interface MenuItemDto {
  id: string;
  canteenId: string;
  categoryId: string;
  name: string;
  description?: string;
  image?: string;
  /** Integer, paise — see @/lib/format's formatCurrency. */
  price: number;
  preparationTimeMinutes: number;
  isVeg: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  allergens: string[];
  calories?: number;
  displayOrder: number;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors apps/backend/src/modules/menu/menu-category.types.ts's PublicMenuCategoryDto exactly. */
export interface MenuCategoryDto {
  id: string;
  canteenId: string;
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type MenuItemSortableField = 'name' | 'price' | 'displayOrder' | 'createdAt';

export interface MenuItemsFilters {
  search?: string;
  categoryId?: string;
  isVeg?: boolean;
  isAvailable?: boolean;
}

export interface MenuItemsQueryParams extends MenuItemsFilters {
  page: number;
  limit: number;
  sortBy: MenuItemSortableField;
  sortOrder: 'asc' | 'desc';
}
