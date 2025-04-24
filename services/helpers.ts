import { auth } from "./auth";
import type { Context } from "hono";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, sql } from "drizzle-orm";
import type { UserWithRole } from "better-auth/plugins/admin";

export async function getAuthenticatedUser(c: Context) {
	const session = await auth.api.getSession({
		headers: new Headers(c.req.header()),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized: No valid user session");
	}

	return session.user;
}

export async function getUserPlan(userId: string) {
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

export async function updateUserBalance(userId: string, value: number) {
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

export interface CustomUser extends UserWithRole {
	referrerId: string | null;
	balance: number;
	mnemonic: string | null;
	walletKitConnected: boolean | null;
}

export async function getUsers(c: Context): Promise<CustomUser[]> {
	const user = await getAuthenticatedUser(c);
	// if (user.role !== "admin") {
	// 	throw new Error("Unauthorized: Only admins can access this endpoint");
	// }
	const users = (await db.query.user.findMany({
		columns: {
			id: true,
			email: true,
			emailVerified: true,
			name: true,
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
	})) as unknown as CustomUser[];

	return users;
}
