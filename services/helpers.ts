import { auth } from "./auth";
import type { Context } from "hono";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";

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
