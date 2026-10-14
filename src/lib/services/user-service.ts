import { UserRepository } from "@/lib/db/repositories/interfaces/user-repository.interface";
import { User, UserProfile, UserPreferences, Address } from "@/lib/types/user";

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.getUserById(userId);
  }

  async createUser(user: User): Promise<void> {
    await this.userRepository.createUser(user);
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.userRepository.getUserProfile(userId);
  }

  async updateUserProfile(profile: UserProfile): Promise<void> {
    await this.userRepository.updateUserProfile(profile);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return this.userRepository.getUserPreferences(userId);
  }

  async updateUserPreferences(preferences: UserPreferences): Promise<void> {
    await this.userRepository.updateUserPreferences(preferences);
  }

  async getUserAddresses(userId: string): Promise<Address[]> {
    return this.userRepository.getUserAddresses(userId);
  }

  async createAddress(address: Address): Promise<void> {
    await this.userRepository.createAddress(address);
  }
}
