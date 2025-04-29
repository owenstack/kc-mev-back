/**
 * Service to generate simulated MEV bot and scalper performance data
 */
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../db";
import * as schema from "../db/schema";
import {
	getAuthenticatedUser,
	getUserPlan,
	updateUserBalance,
} from "./helpers";

// Constants for multipliers and thresholds
const MULTIPLIERS = {
	PREMIUM: 1.5,
	BASIC: 0.8,
	FREE: 0.1,
	MAX_TIME_BASED: 0.3,
	TIME_GROWTH_RATE: 0.02,
};

const MEV_CONFIG = {
	BASE_MIN: 0.01,
	BASE_MAX: 0.05,
	SPIKE_CHANCE: 0.05,
	SPIKE_MIN: 0.1,
	SPIKE_MAX: 1,
};

const SCALPER_CONFIG = {
	BASE_MIN: -0.02,
	BASE_MAX: 0.08,
	TREND_STRENGTH: 0.03,
	TREND_CHANGE_CHANCE: 0.1,
	MIN_VALUE: -0.1,
	MAX_VALUE: 0.2,
};

export interface DataPoint {
	timestamp: number;
	value: number;
}

async function getUserPlanMultiplier(userId: number): Promise<number> {
	const userSub = await getUserPlan(userId);
	switch (userSub?.planType) {
		case "premium":
			return MULTIPLIERS.PREMIUM;
		case "basic":
			return MULTIPLIERS.BASIC;
		default:
			return MULTIPLIERS.FREE;
	}
}

async function getTimeBasedMultiplier(userId: number): Promise<number> {
	const user = await db.query.user.findFirst({
		where: eq(schema.user.id, userId),
	});

	if (!user) return 1;

	const accountAgeInWeeks =
		(Date.now() - user.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000);
	return Math.min(
		accountAgeInWeeks * MULTIPLIERS.TIME_GROWTH_RATE,
		MULTIPLIERS.MAX_TIME_BASED,
	);
}

async function calculateAdjustedValue(
	baseValue: number,
	userId: number,
): Promise<number> {
	const planMultiplier = await getUserPlanMultiplier(userId);
	const timeMultiplier = await getTimeBasedMultiplier(userId);
	return baseValue * planMultiplier * timeMultiplier;
}

export async function generateDataPoint(
	c: Context,
	min = 0,
	max = 1,
): Promise<DataPoint> {
	const currentUser = await getAuthenticatedUser(c);
	const baseValue = min + Math.random() * (max - min);
	const value = await calculateAdjustedValue(baseValue, currentUser.id);
	await updateUserBalance(currentUser.id, value);
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
	const points: DataPoint[] = [];

	for (let i = 0; i < count; i++) {
		const baseValue = min + Math.random() * (max - min);
		const value = await calculateAdjustedValue(baseValue, currentUser.id);
		await updateUserBalance(currentUser.id, value);
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
	baseMin = MEV_CONFIG.BASE_MIN,
	baseMax = MEV_CONFIG.BASE_MAX,
	spikeChance = MEV_CONFIG.SPIKE_CHANCE,
	spikeMin = MEV_CONFIG.SPIKE_MIN,
	spikeMax = MEV_CONFIG.SPIKE_MAX,
	startTime = Date.now() - count * 1000,
): Promise<DataPoint[]> {
	const currentUser = await getAuthenticatedUser(c);
	const points: DataPoint[] = [];

	for (let i = 0; i < count; i++) {
		const isSpike = Math.random() < spikeChance;
		const min = isSpike ? spikeMin : baseMin;
		const max = isSpike ? spikeMax : baseMax;
		const baseValue = min + Math.random() * (max - min);
		const value = await calculateAdjustedValue(baseValue, currentUser.id);

		await updateUserBalance(currentUser.id, value);
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
	baseMin = SCALPER_CONFIG.BASE_MIN,
	baseMax = SCALPER_CONFIG.BASE_MAX,
	trendStrength = SCALPER_CONFIG.TREND_STRENGTH,
	startTime = Date.now() - count * 1000,
): Promise<DataPoint[]> {
	const currentUser = await getAuthenticatedUser(c);
	const points: DataPoint[] = [];
	let trend = 0;

	for (let i = 0; i < count; i++) {
		if (Math.random() < SCALPER_CONFIG.TREND_CHANGE_CHANCE) {
			trend = -1 + Math.random() * 2;
		}

		let baseValue = baseMin + Math.random() * (baseMax - baseMin);
		baseValue += trend * trendStrength;
		baseValue = Math.max(
			SCALPER_CONFIG.MIN_VALUE,
			Math.min(baseValue, SCALPER_CONFIG.MAX_VALUE),
		);
		const value = await calculateAdjustedValue(baseValue, currentUser.id);

		await updateUserBalance(currentUser.id, value);
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
	let baseValue: number;

	switch (type) {
		case "mev": {
			const isMEVSpike = Math.random() < MEV_CONFIG.SPIKE_CHANCE;
			baseValue = isMEVSpike
				? MEV_CONFIG.SPIKE_MIN +
					Math.random() * (MEV_CONFIG.SPIKE_MAX - MEV_CONFIG.SPIKE_MIN)
				: MEV_CONFIG.BASE_MIN +
					Math.random() * (MEV_CONFIG.BASE_MAX - MEV_CONFIG.BASE_MIN);
			break;
		}
		case "scalper": {
			baseValue =
				SCALPER_CONFIG.BASE_MIN +
				Math.random() * (SCALPER_CONFIG.BASE_MAX - SCALPER_CONFIG.BASE_MIN);
			break;
		}
		default: {
			baseValue = Math.random();
		}
	}

	const value = await calculateAdjustedValue(baseValue, currentUser.id);
	await updateUserBalance(currentUser.id, value);
	return {
		timestamp: Date.now(),
		value,
	};
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
