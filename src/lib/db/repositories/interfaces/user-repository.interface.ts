import { User, UserProfile, UserPreferences, Address } from "@/lib/types/user";

export interface UserRepository {
  getUserById(userId: string): Promise<User | null>;
  createUser(user: User): Promise<void>;
  getUserProfile(userId: string): Promise<UserProfile | null>;
  updateUserProfile(profile: UserProfile): Promise<void>;
  getUserPreferences(userId: string): Promise<UserPreferences | null>;
  updateUserPreferences(preferences: UserPreferences): Promise<void>;
  getUserAddresses(userId: string): Promise<Address[]>;
  saveUserAddresses(
    userId: string,
    addresses: Address[],
    expectedRevision: string,
  ): Promise<void>;
  createAddress(address: Address): Promise<void>;
}
