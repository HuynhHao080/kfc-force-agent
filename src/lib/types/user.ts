export interface User {
  id: string;
  email: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  language: "vi" | "en";
  defaultAddressId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  ward: string;
  district: string;
  city: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
