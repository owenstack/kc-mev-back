import { eq } from "drizzle-orm";
import type { Context } from "hono";
import * as schema from "../db/schema";
import { db } from "../db";
import { getAuthenticatedUser } from "./helpers";
import { nanoid } from "nanoid";

export interface Booster {
	id: string;
	name: string;
	description: string;
	multiplier: number;
	duration: number; // Duration in milliseconds, 0 for one-time use
	price: number;
	type: "oneTime" | "duration" | "permanent";
}

export interface ActiveBooster extends Booster {
	activatedAt: number;
	userId: string;
}

export const availableBoosters: Booster[] = [
	{
		id: "quick-boost",
		name: "Quick Boost",
		description: "One-time 2x multiplier for your next trade",
		multiplier: 2,
		duration: 0,
		price: 100,
		type: "oneTime",
	},
	{
		id: "hour-boost",
		name: "Hour Power",
		description: "1.5x multiplier for 1 hour",
		multiplier: 1.5,
		duration: 60 * 60 * 1000,
		price: 250,
		type: "duration",
	},
	{
		id: "day-boost",
		name: "Day Trader",
		description: "1.25x multiplier for 24 hours",
		multiplier: 1.25,
		duration: 24 * 60 * 60 * 1000,
		price: 500,
		type: "duration",
	},
	{
		id: "permanent-boost",
		name: "Permanent Edge",
		description: "Permanent 1.1x multiplier",
		multiplier: 1.1,
		duration: 0,
		price: 2000,
		type: "permanent",
	},
	{
		id: "super-quick-boost",
		name: "Super Quick Boost",
		description: "One-time 3x multiplier for your next trade",
		multiplier: 3,
		duration: 0,
		price: 300,
		type: "oneTime",
	},
	{
		id: "mega-quick-boost",
		name: "Mega Quick Boost",
		description: "One-time 4x multiplier for your next trade",
		multiplier: 4,
		duration: 0,
		price: 600,
		type: "oneTime",
	},
	{
		id: "ultra-quick-boost",
		name: "Ultra Quick Boost",
		description: "One-time 5x multiplier for your next trade",
		multiplier: 5,
		duration: 0,
		price: 1000,
		type: "oneTime",
	},
	{
		id: "half-day-boost",
		name: "Half Day Trader",
		description: "1.35x multiplier for 12 hours",
		multiplier: 1.35,
		duration: 12 * 60 * 60 * 1000,
		price: 400,
		type: "duration",
	},
	{
		id: "week-boost",
		name: "Weekly Warrior",
		description: "1.15x multiplier for 7 days",
		multiplier: 1.15,
		duration: 7 * 24 * 60 * 60 * 1000,
		price: 1000,
		type: "duration",
	},
	{
		id: "month-boost",
		name: "Monthly Master",
		description: "1.1x multiplier for 30 days",
		multiplier: 1.1,
		duration: 30 * 24 * 60 * 60 * 1000,
		price: 3000,
		type: "duration",
	},
	{
		id: "silver-permanent",
		name: "Silver Edge",
		description: "Permanent 1.15x multiplier",
		multiplier: 1.15,
		duration: 0,
		price: 3000,
		type: "permanent",
	},
	{
		id: "gold-permanent",
		name: "Gold Edge",
		description: "Permanent 1.2x multiplier",
		multiplier: 1.2,
		duration: 0,
		price: 5000,
		type: "permanent",
	},
	{
		id: "platinum-permanent",
		name: "Platinum Edge",
		description: "Permanent 1.25x multiplier",
		multiplier: 1.25,
		duration: 0,
		price: 8000,
		type: "permanent",
	},
	{
		id: "diamond-permanent",
		name: "Diamond Edge",
		description: "Permanent 1.3x multiplier",
		multiplier: 1.3,
		duration: 0,
		price: 12000,
		type: "permanent",
	},
];

export async function purchaseBooster(
	c: Context,
	boosterId: string,
	useExternalPayment = false,
): Promise<boolean> {
	const user = await getAuthenticatedUser(c);
	const booster = availableBoosters.find((b) => b.id === boosterId);

	if (!booster) return false;

	if (!useExternalPayment) {
		const userBalance = await db.query.user.findFirst({
			where: eq(schema.user.id, user.id),
		});

		if (!userBalance || userBalance.balance < booster.price) return false;

		// Use state.storage.transaction() API
		await c.env.DATABASE.prepare(`
			UPDATE user 
			SET balance = balance - ?, 
				updatedAt = ? 
			WHERE id = ?
		`)
			.bind(booster.price, new Date().toISOString(), user.id)
			.run();

		// Calculate expiration for duration boosters
		const now = Date.now();
		const expiresAt =
			booster.type === "duration"
				? new Date(now + booster.duration)
				: new Date(now + 1000 * 60 * 60);

		// Store the booster in the database
		await c.env.DATABASE.prepare(`
			INSERT INTO booster (
				id,
				userId,
				boosterId,
				activatedAt,
				expiresAt,
				type,
				multiplier,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
			.bind(
				nanoid(15),
				user.id,
				booster.id,
				new Date(now).toISOString(),
				expiresAt?.toISOString(),
				booster.type,
				booster.multiplier,
				new Date().toISOString(),
				new Date().toISOString(),
			)
			.run();
	} else {
		// Handle external payment case - just add the booster
		const now = Date.now();
		const expiresAt =
			booster.type === "duration"
				? new Date(now + booster.duration)
				: undefined;

		await c.env.DATABASE.prepare(`
			INSERT INTO booster (
				id,
				userId,
				boosterId,
				activatedAt,
				expiresAt,
				type,
				multiplier,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
			.bind(
				nanoid(15),
				user.id,
				booster.id,
				new Date(now).toISOString(),
				expiresAt?.toISOString(),
				booster.type,
				booster.multiplier,
				new Date().toISOString(),
				new Date().toISOString(),
			)
			.run();
	}

	return true;
}
export async function getActiveBoosterMultiplier(
	userId: string,
): Promise<number> {
	const now = Date.now();
	let totalMultiplier = 1;

	// Get all active boosters for the user
	const userBoosters = await db.query.booster.findMany({
		where: eq(schema.booster.userId, userId),
	});

	for (const booster of userBoosters) {
		if (booster.type === "permanent") {
			totalMultiplier *= booster.multiplier;
			continue;
		}

		if (booster.type === "oneTime") {
			totalMultiplier *= booster.multiplier;
			// Remove the one-time booster after use
			await db.delete(schema.booster).where(eq(schema.booster.id, booster.id));
			break;
		}

		if (booster.type === "duration" && booster.expiresAt) {
			const expiryTime = Number(booster.expiresAt);
			if (now <= expiryTime) {
				totalMultiplier *= booster.multiplier;
			} else {
				// Remove expired duration booster
				await db
					.delete(schema.booster)
					.where(eq(schema.booster.id, booster.id));
			}
		}
	}

	return totalMultiplier;
}

export async function getActiveBoostersForUser(
	c: Context,
): Promise<ActiveBooster[]> {
	const user = await getAuthenticatedUser(c);
	const now = Date.now();

	const dbBoosters = await db.query.booster.findMany({
		where: eq(schema.booster.userId, user.id),
	});

	return dbBoosters.map((dbBooster) => {
		const baseBooster = availableBoosters.find(
			(b) => b.id === dbBooster.boosterId,
		);

		if (!baseBooster) {
			throw new Error(
				`Booster ${dbBooster.boosterId} not found in available boosters`,
			);
		}

		return {
			...baseBooster,
			activatedAt: Number(dbBooster.activatedAt),
			userId: dbBooster.userId,
		};
	});
}

// New endpoint to get available boosters for the frontend
export async function getAvailableBoosters(): Promise<Booster[]> {
	return availableBoosters;
}
