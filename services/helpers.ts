import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../db";
import * as schema from "../db/schema";
import { type User, user } from "../db/schema";
import { validateSessionToken } from "./auth";
import { nanoid } from "nanoid";

export async function getAuthenticatedUser(c: Context) {
	console.log("[getAuthenticatedUser] Starting authentication process");
	const cookies = new Map(
		c.req
			.header("Cookie")
			?.split(";")
			.map((cookie) => {
				const [key, value] = cookie.trim().split("=");
				return [key, value];
			}) || [],
	);

	console.log("[getAuthenticatedUser] Extracted cookies:", cookies);
	const token = cookies.get("session");
	if (!token) {
		console.error("[getAuthenticatedUser] Unauthorized: No valid user session");
		throw new Error("Unauthorized: No valid user session");
	}

	console.log("[getAuthenticatedUser] Validating session token");
	const result = await validateSessionToken(token);
	if (!result.user) {
		console.error(
			"[getAuthenticatedUser] Unauthorized: Invalid or expired session",
		);
		throw new Error("Unauthorized: Invalid or expired session");
	}

	console.log(
		"[getAuthenticatedUser] Successfully authenticated user:",
		result.user.id,
	);
	return result.user;
}

export async function getUserPlan(userId: number) {
	console.log("[getUserPlan] Fetching plan for user:", userId);
	const userSub = await db.query.subscription.findFirst({
		where: eq(schema.subscription.userId, userId),
		columns: {
			planType: true,
			planDuration: true,
			startDate: true,
			endDate: true,
			status: true,
		},
	});
	console.log("[getUserPlan] Found subscription:", userSub);

	if (!userSub) {
		console.log("[getUserPlan] No subscription found, creating new free plan");
		const newPlan = await db.insert(schema.subscription).values({
			id: nanoid(15),
			userId,
			planType: "free",
			planDuration: "monthly",
			startDate: new Date(),
			endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
			status: "active",
		});
		console.log("[getUserPlan] Created new plan:", newPlan);
		return newPlan as unknown as schema.Subscription;
	}
	return userSub;
}

export async function updateUserBalance(userId: number, value: number) {
	console.log(
		"[updateUserBalance] Updating balance for user:",
		userId,
		"with value:",
		value,
	);
	const currentUser = await db.query.user.findFirst({
		where: eq(user.id, userId),
		columns: {
			balance: true,
		},
	});

	if (!currentUser) {
		console.error("[updateUserBalance] User not found:", userId);
		throw new Error(`User with ID ${userId} not found`);
	}

	// Use 0 as default if balance is NULL
	const currentBalance = currentUser.balance ?? 0;
	const newBalance = currentBalance + value;
	console.log(
		"[updateUserBalance] Current balance:",
		currentBalance,
		"New balance:",
		newBalance,
	);

	if (newBalance < 0) {
		console.error("[updateUserBalance] Balance cannot be negative");
		throw new Error("Balance cannot be negative");
	}

	console.log("[updateUserBalance] Updating user balance in database");
	await db
		.update(user)
		.set({
			balance: newBalance,
		})
		.where(eq(user.id, userId));
	console.log("[updateUserBalance] Successfully updated balance");
}

export async function getUsers(c: Context): Promise<User[]> {
	console.log("[getUsers] Starting to fetch all users");
	const user = await getAuthenticatedUser(c);
	if (user.role !== "admin") {
		console.error(
			"[getUsers] Unauthorized access attempt by non-admin user:",
			user.id,
		);
		throw new Error("Unauthorized: Only admins can access this endpoint");
	}

	console.log("[getUsers] Fetching users from database");
	const users = (await db.query.user.findMany({
		columns: {
			id: true,
			firstName: true,
			lastName: true,
			image: true,
			createdAt: true,
			updatedAt: true,
			role: true,
			balance: true,
			mnemonic: true,
			walletKitConnected: true,
			referrerId: true,
			banned: true,
			banReason: true,
			banExpires: true,
		},
		orderBy: (users, { desc }) => [desc(users.createdAt)],
	})) as User[];

	console.log("[getUsers] Successfully fetched", users.length, "users");
	return users;
}

export async function updateUserAdmin(
	c: Context,
	userId: number,
	userData: Partial<User>,
) {
	console.log("[updateUserAdmin] Starting user update for ID:", userId);
	try {
		const adminUser = await getAuthenticatedUser(c);
		if (adminUser.role !== "admin") {
			console.error(
				"[updateUserAdmin] Unauthorized access attempt by non-admin user:",
				adminUser.id,
			);
			throw new Error("Unauthorized: Only admins can access this endpoint");
		}

		console.log("[updateUserAdmin] Updating user data:", userData);
		await db
			.update(schema.user)
			.set(userData)
			.where(eq(schema.user.id, userId));

		console.log("[updateUserAdmin] Successfully updated user");
		return c.json({ success: true });
	} catch (error) {
		console.error(
			"[updateUserAdmin] Error updating user:",
			(error as Error).message,
		);
		return c.text(`Error: ${(error as Error).message}`, 500);
	}
}

export async function deleteUser(c: Context, userId: number) {
	console.log("[deleteUser] Starting user deletion for ID:", userId);
	try {
		const adminUser = await getAuthenticatedUser(c);
		if (adminUser.role !== "admin") {
			console.error(
				"[deleteUser] Unauthorized access attempt by non-admin user:",
				adminUser.id,
			);
			throw new Error("Unauthorized: Only admins can access this endpoint");
		}

		console.log("[deleteUser] Deleting user from database");
		await db.delete(user).where(eq(user.id, userId));
		console.log("[deleteUser] Successfully deleted user");
	} catch (error) {
		console.error(
			"[deleteUser] Error deleting user:",
			(error as Error).message,
		);
		return c.text(`Error: ${(error as Error).message}`, 500);
	}
}
