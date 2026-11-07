export interface CustomerAccount {
  id: string;
  email: string;
  fullName: string;
  passwordSalt: string;
  passwordHash: string;
  passwordKdf?: string;
  createdAt: string;
  updatedAt: string;
}
export type CustomerProfile = Pick<
  CustomerAccount,
  "id" | "email" | "fullName"
>;
