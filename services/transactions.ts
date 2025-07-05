import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { nanoid } from "nanoid";
import { db } from "../db";
import * as schema from "../db/schema";
import type { Transaction } from "../db/schema";
import { getAuthenticatedUser } from "./helpers";

export async function createTransaction(c: Context): Promise<Transaction> {
	const user = await getAuthenticatedUser(c);
	const { type, amount, metadata, description } = await c.req.json();
	const response = await db
		.insert(schema.transaction)
		.values({
			id: nanoid(15),
			userId: user.id,
			type: type as "withdrawal" | "deposit" | "transfer",
			amount: Number.parseFloat(amount as string),
			status: "pending",
			description: description || "",
			metadata: metadata || "",
		})
		.returning();
	return response[0];
}

export async function getTransactions(c: Context) {
	const user = await getAuthenticatedUser(c);
	if (user.role !== "admin") {
		throw Error("Unauthorized operation");
	}
	const response = await db.select().from(schema.transaction);
	return response;
}

export async function getUserTransactions(c: Context) {
	const user = await getAuthenticatedUser(c);
	const response = await db
		.select()
		.from(schema.transaction)
		.where(eq(schema.transaction.userId, user.id));
	return response;
}
