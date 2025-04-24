import { getAuthenticatedUser } from "./helpers";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { env } from "cloudflare:workers";
import type { Transaction } from "../db/schema";
import { nanoid } from "nanoid";

export async function createTransaction(c: Context): Promise<Transaction> {
	const user = await getAuthenticatedUser(c);
	const response = await db.insert(schema.transaction).values({
		id: nanoid(15),
		userId: user.id,
		type: c.req.query("type") as "withdrawal" | "deposit" | "transfer",
		amount: Number.parseFloat(c.req.query("amount") as string),
		status: "pending",
		description: c.req.query("description"),
		metadata: c.req.query("metadata"),
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	return response as unknown as Transaction;
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
