// import { drizzle } from "drizzle-orm/d1";
// import { users, transactions, type NewUser } from "../db/schema";
// import { eq, and, isNull, or } from "drizzle-orm";
// import {
// 	hashPassphrase,
// 	verifyPassphrase,
// 	generatePassphrase,
// } from "../utils/auth";

// export class UserService {
//     const db = drizzle();
// 	/**
// 	 * Create a new user with optional referrer
// 	 */
// 	async createUser(userData: {
// 		username: string;
// 		email: string;
// 		passphrase?: string;
// 		referrerId?: number;
// 	}): Promise<{ user: NewUser; passphrase: string }> {
// 		// Generate a passphrase if not provided
// 		const passphrase = userData.passphrase || generatePassphrase();
// 		const passphraseHash = await hashPassphrase(passphrase);

// 		const newUser: NewUser = {
// 			username: userData.username,
// 			email: userData.email,
// 			passphraseHash,
// 			referrerId: userData.referrerId,
// 			registrationDate: new Date(),
// 		};

// 		const [user] = await db.insert(users).values(newUser).returning();

// 		return {
// 			user,
// 			passphrase: userData.passphrase ? "[PASSPHRASE_HIDDEN]" : passphrase,
// 		};
// 	}

// 	/**
// 	 * Authenticate a user with their passphrase
// 	 */
// 	async authenticateUser(usernameOrEmail: string, passphrase: string) {
// 		const user = await db.query.users.findFirst({
// 			where: or(
// 				eq(users.username, usernameOrEmail),
// 				eq(users.email, usernameOrEmail),
// 			),
// 		});

// 		if (!user) {
// 			return null;
// 		}

// 		const isValid = await verifyPassphrase(passphrase, user.passphraseHash);
// 		if (!isValid) {
// 			return null;
// 		}

// 		return user;
// 	}

// 	/**
// 	 * Get all referrals for a user
// 	 */
// 	async getUserReferrals(userId: number) {
// 		return await db.query.users.findMany({
// 			where: eq(users.referrerId, userId),
// 		});
// 	}

// 	/**
// 	 * Update user balance with passive income
// 	 */
// 	async addPassiveIncome(userId: number, amount: number, description?: string) {
// 		// Start a transaction to ensure both operations succeed or fail
// 		return await db.transaction(async (tx) => {
// 			// Update the user's balance
// 			const [user] = await tx
// 				.update(users)
// 				.set({
// 					currentBalance: users.currentBalance + amount,
// 				})
// 				.where(eq(users.id, userId))
// 				.returning();

// 			// Create a transaction record
// 			await tx.insert(transactions).values({
// 				userId,
// 				amount,
// 				type: "passive_income",
// 				status: "completed",
// 				description: description || "Passive income payment",
// 				createdAt: new Date(),
// 			});

// 			return user;
// 		});
// 	}

// 	/**
// 	 * Process a withdrawal request
// 	 */
// 	async requestWithdrawal(userId: number, amount: number) {
// 		return await db.transaction(async (tx) => {
// 			// Get the user
// 			const user = await tx.query.users.findFirst({
// 				where: eq(users.id, userId),
// 			});

// 			if (!user || user.currentBalance < amount) {
// 				throw new Error("Insufficient balance");
// 			}

// 			// Update the balance and withdrawal date
// 			const [updatedUser] = await tx
// 				.update(users)
// 				.set({
// 					currentBalance: user.currentBalance - amount,
// 					lastWithdrawalDate: new Date(),
// 				})
// 				.where(eq(users.id, userId))
// 				.returning();

// 			// Create a withdrawal transaction
// 			await tx.insert(transactions).values({
// 				userId,
// 				amount: -amount, // Negative amount for withdrawal
// 				type: "withdrawal",
// 				status: "pending", // Set to pending initially
// 				description: "User withdrawal request",
// 				createdAt: new Date(),
// 			});

// 			return updatedUser;
// 		});
// 	}
// }

// export default new UserService();
