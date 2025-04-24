/**
 * Service to generate simulated MEV bot and scalper performance data
 */
import { auth } from "./auth";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import * as schema from "../db/schema";
import { db } from "../db";
import {
	getAuthenticatedUser,
	getUserPlan,
	updateUserBalance,
} from "./helpers";

export interface DataPoint {
	timestamp: number; // Unix timestamp in milliseconds
	value: number; // The simulated profit/loss value
}

async function getUserPlanMultiplier(userId: string): Promise<number> {
	const userSub = await getUserPlan(userId);
	switch (userSub?.planType) {
		case "premium":
			return 1.5;
		case "basic":
			return 0.8;
		default:
			return 0.1; // Free plan starts very low
	}
}

async function getTimeBasedMultiplier(userId: string): Promise<number> {
	const user = await db.query.user.findFirst({
		where: eq(schema.user.id, userId),
	});

	if (!user) return 1;

	const accountAgeInWeeks =
		(Date.now() - user.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000);
	const maxMultiplier = 0.3; // Max multiplier for free plan after several weeks
	return Math.min(accountAgeInWeeks * 0.02, maxMultiplier);
}

export async function generateDataPoint(
	c: Context,
	min = 0,
	max = 1,
): Promise<DataPoint> {
	const currentUser = await getAuthenticatedUser(c);
	const userId = currentUser.id;
	const planMultiplier = await getUserPlanMultiplier(userId);
	const timeMultiplier = await getTimeBasedMultiplier(userId);
	const value =
		(min + Math.random() * (max - min)) * planMultiplier * timeMultiplier;
	await updateUserBalance(userId, value);
	return {
		timestamp: Date.now(),
		value,
	};
}

export async function generateHistoricalData(
	c: Context,
	count: number,
	min = 0,
	max = 1,
	startTime = Date.now() - count * 1000,
): Promise<DataPoint[]> {
	const currentUser = await getAuthenticatedUser(c);
	const userId = currentUser.id;
	const points: DataPoint[] = [];
	const planMultiplier = await getUserPlanMultiplier(userId);
	const timeMultiplier = await getTimeBasedMultiplier(userId);

	for (let i = 0; i < count; i++) {
		const value =
			(min + Math.random() * (max - min)) * planMultiplier * timeMultiplier;
		await updateUserBalance(userId, value);
		points.push({
			timestamp: startTime + i * 1000,
			value,
		});
	}

	return points;
}

export async function generateMEVData(
	c: Context,
	count: number,
	baseMin = 0.01,
	baseMax = 0.05,
	spikeChance = 0.05,
	spikeMin = 0.1,
	spikeMax = 1,
	startTime = Date.now() - count * 1000,
): Promise<DataPoint[]> {
	const currentUser = await getAuthenticatedUser(c);
	const userId = currentUser.id;
	const points: DataPoint[] = [];
	const planMultiplier = await getUserPlanMultiplier(userId);
	const timeMultiplier = await getTimeBasedMultiplier(userId);

	for (let i = 0; i < count; i++) {
		const isSpike = Math.random() < spikeChance;
		const min = isSpike ? spikeMin : baseMin;
		const max = isSpike ? spikeMax : baseMax;
		const value =
			(min + Math.random() * (max - min)) * planMultiplier * timeMultiplier;

		await updateUserBalance(userId, value);
		points.push({
			timestamp: startTime + i * 1000,
			value,
		});
	}

	return points;
}

export async function generateScalperData(
	c: Context,
	count: number,
	baseMin = -0.02,
	baseMax = 0.08,
	trendStrength = 0.03,
	startTime = Date.now() - count * 1000,
): Promise<DataPoint[]> {
	const currentUser = await getAuthenticatedUser(c);
	const userId = currentUser.id;
	const points: DataPoint[] = [];
	let trend = 0;
	const planMultiplier = await getUserPlanMultiplier(userId);
	const timeMultiplier = await getTimeBasedMultiplier(userId);

	for (let i = 0; i < count; i++) {
		if (Math.random() < 0.1) {
			trend = -1 + Math.random() * 2;
		}

		let value = baseMin + Math.random() * (baseMax - baseMin);
		value += trend * trendStrength;
		value = Math.max(-0.1, Math.min(value, 0.2));
		value *= planMultiplier * timeMultiplier;

		await updateUserBalance(userId, value);
		points.push({
			timestamp: startTime + i * 1000,
			value,
		});
	}

	return points;
}

export async function getLatestDataPoint(
	c: Context,
	type: "random" | "mev" | "scalper" = "random",
): Promise<DataPoint> {
	const currentUser = await getAuthenticatedUser(c);
	const userId = currentUser.id;
	const planMultiplier = await getUserPlanMultiplier(userId);
	const timeMultiplier = await getTimeBasedMultiplier(userId);

	switch (type) {
		case "mev": {
			const isMEVSpike = Math.random() < 0.05;
			const value = isMEVSpike
				? (0.1 + Math.random() * 0.9) * planMultiplier * timeMultiplier
				: (0.01 + Math.random() * 0.04) * planMultiplier * timeMultiplier;
			await updateUserBalance(userId, value);
			return {
				timestamp: Date.now(),
				value,
			};
		}

		case "scalper": {
			const value =
				(-0.02 + Math.random() * 0.1) * planMultiplier * timeMultiplier;
			await updateUserBalance(userId, value);
			return {
				timestamp: Date.now(),
				value,
			};
		}
		default: {
			const value = Math.random() * planMultiplier * timeMultiplier;
			await updateUserBalance(userId, value);
			return {
				timestamp: Date.now(),
				value,
			};
		}
	}
}

export async function getSimulatedData(
	c: Context,
	type: "random" | "mev" | "scalper" = "random",
	count = 100,
): Promise<DataPoint[]> {
	switch (type) {
		case "mev":
			return generateMEVData(c, count);

		case "scalper":
			return generateScalperData(c, count);
		default:
			return generateHistoricalData(c, count);
	}
}
