import { type InitData, parse, validate } from "@telegram-apps/init-data-node";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { nanoid } from "nanoid";
import { db } from "../db";
import * as schema from "../db/schema";
import { type User, user } from "../db/schema";

export async function getAuthenticatedUser(c: Context): Promise<User> {
	const authHeader = c.req.header("authorization");
	if (!authHeader) {
		throw new Error("Unauthorized: No authorization header");
	}

	const [authType, authData = ""] = authHeader.split(" ");
	if (authType !== "tma") {
		throw new Error("Unauthorized: Invalid authorization type");
	}

	try {
		// Access bot token from Cloudflare Workers env
		const token = c.env?.DEV_BOT_TOKEN || c.env?.PROD_BOT_TOKEN;
		if (!token) {
			throw new Error("Bot token not configured");
		}

		// Validate the Telegram initData
		validate(authData, token, {
			expiresIn: 3600, // 1 hour expiry
		});

		const initData = parse(authData);
		if (!initData.user) {
			throw new Error("Unauthorized: No user data found");
		}

		// Store the init data in the context for later use
		c.set("initData", initData);

		// Get or create user in our database
		const dbUser = await getOrCreateUser(initData.user);
		return dbUser;
	} catch (e) {
		throw new Error(
			`Unauthorized: ${e instanceof Error ? e.message : "Invalid or expired session"}`,
		);
	}
}

async function getOrCreateUser(telegramUser: InitData["user"]): Promise<User> {
	// Try to find existing user by Telegram ID
	if (!telegramUser) {
		throw new Error("Invalid Telegram user data");
	}
	const existingUser = await db.query.user.findFirst({
		where: eq(user.telegramId, telegramUser.id),
	});

	if (existingUser) {
		// Update user info in case it changed on Telegram
		const updatedUser = await db
			.update(user)
			.set({
				firstName: telegramUser.first_name,
				lastName: telegramUser.last_name || null,
				username: telegramUser.username || null,
				image: telegramUser.photo_url || null,
				updatedAt: new Date(),
			})
			.where(eq(user.telegramId, telegramUser.id))
			.returning();

		return updatedUser[0];
	}

	// Create new user
	const newUser = await db
		.insert(user)
		.values({
			telegramId: telegramUser.id,
			firstName: telegramUser.first_name,
			lastName: telegramUser.last_name || null,
			username: telegramUser.username || null,
			image: telegramUser.photo_url || null,
			role: "user",
			balance: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning();

	return newUser[0];
}

export async function getUserPlan(userId: number) {
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

	if (!userSub) {
		const newPlan = await db
			.insert(schema.subscription)
			.values({
				id: nanoid(15),
				userId,
				planType: "free",
				planDuration: "monthly",
				startDate: new Date(),
				endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
				status: "active",
			})
			.returning();

		return newPlan[0];
	}
	return userSub;
}

export async function updateUserBalance(userId: number, value: number) {
	const currentUser = await db.query.user.findFirst({
		where: eq(user.id, userId),
		columns: {
			balance: true,
		},
	});

	if (!currentUser) {
		throw new Error(`User with ID ${userId} not found`);
	}

	// Use 0 as default if balance is NULL
	const currentBalance = currentUser.balance ?? 0;
	const newBalance = currentBalance + value;

	if (newBalance < 0) {
		throw new Error("Balance cannot be negative");
	}

	await db
		.update(user)
		.set({
			balance: newBalance,
		})
		.where(eq(user.id, userId));
}

export async function getUsers(c: Context): Promise<User[]> {
	const currentUser = await getAuthenticatedUser(c);
	if (currentUser.role !== "admin") {
		throw new Error("Unauthorized: Only admins can access this endpoint");
	}

	const users = await db.query.user.findMany({
		columns: {
			id: true,
			telegramId: true,
			firstName: true,
			lastName: true,
			username: true,
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
	});

	return users;
}

export async function updateUserAdmin(
	c: Context,
	userId: number,
	userData: Partial<User>,
) {
	const adminUser = await getAuthenticatedUser(c);
	if (adminUser.role !== "admin") {
		throw new Error("Unauthorized: Only admins can access this endpoint");
	}

	const updatedUser = await db
		.update(schema.user)
		.set(userData)
		.where(eq(schema.user.id, userId))
		.returning();

	return updatedUser[0];
}

export async function deleteUser(c: Context, userId: number) {
	const adminUser = await getAuthenticatedUser(c);
	if (adminUser.role !== "admin") {
		throw new Error("Unauthorized: Only admins can access this endpoint");
	}

	await db.delete(user).where(eq(user.id, userId));
}
