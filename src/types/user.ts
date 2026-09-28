export type UserRole = "user" | "admin";

export type UserStatus = "active" | "suspended";

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role?: UserRole;
  status?: UserStatus;
  credits: number;
  isFreeUnlimited?: boolean;
  referralCode?: string;
  referredBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReferralReward {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: "pending" | "claimed";
  createdAt?: unknown;
  claimedAt?: unknown;
}
