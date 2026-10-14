export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  currency: "VND";
  imageUrl?: string;
  isAvailable: boolean;
  isActive: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemOption {
  id: string;
  menuItemId: string;
  name: string;
  required: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OptionValue {
  id: string;
  optionId: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductBundle {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: "VND";
  isActive: boolean;
  isAvailable: boolean;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BundleItem {
  id: string;
  bundleId: string;
  menuItemId: string;
  quantity: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}
