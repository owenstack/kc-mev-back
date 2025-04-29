import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../db";
import * as schema from "../db/schema";
import { type User, user } from "../db/schema";
import { validateSessionToken } from "./auth";

export async function getAuthenticatedUser(c: Context) {
	const cookies = new Map(
		c.req
			.header("Cookie")
			?.split(";")
			.map((cookie) => {
				const [key, value] = cookie.trim().split("=");
				return [key, value];
			}) || [],
	);

	const token = cookies.get("session");
	if (!token) {
		throw new Error("Unauthorized: No valid user session");
	}

	const result = await validateSessionToken(token);
	if (!result.user) {
		throw new Error("Unauthorized: Invalid or expired session");
	}

	return result.user;
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
	return userSub;
}

export async function updateUserBalance(userId: number, value: number) {
	const currentUser = await db.query.user.findFirst({
		where: eq(schema.user.id, userId),
	});

	if (currentUser) {
		await db
			.update(schema.user)
			.set({
				balance: currentUser.balance + value,
				updatedAt: new Date(),
			})
			.where(eq(schema.user.id, userId));
	}
}

export async function getUsers(c: Context): Promise<User[]> {
	const user = await getAuthenticatedUser(c);
	if (user.role !== "admin") {
		throw new Error("Unauthorized: Only admins can access this endpoint");
	}
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

	return users;
}

export async function updateUserAdmin(
	c: Context,
	userId: number,
	userData: Partial<User>,
) {
	try {
		const adminUser = await getAuthenticatedUser(c);
		if (adminUser.role !== "admin") {
			throw new Error("Unauthorized: Only admins can access this endpoint");
		}

		const updatedUserData = {
			...userData,
			updatedAt: new Date(),
		};

		await db
			.update(schema.user)
			.set(updatedUserData)
			.where(eq(schema.user.id, userId));

		return c.json({ success: true });
	} catch (error) {
		return c.text(
			`Something went wrong. Error: ${(error as Error).message}`,
			500,
		);
	}
}

export async function deleteUser(c: Context, userId: number) {
	try {
		const adminUser = await getAuthenticatedUser(c);
		if (adminUser.role !== "admin") {
			throw new Error("Unauthorized: Only admins can access this endpoint");
		}
		await db.delete(user).where(eq(user.id, userId));
	} catch (error) {
		return c.text(
			`Something went wrong. Error: ${(error as Error).message}`,
			500,
		);
	}
}
