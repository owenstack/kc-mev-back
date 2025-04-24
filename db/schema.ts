import { relations } from "drizzle-orm";
import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("emailVerified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	referrerId: text("referrerId"),
	balance: real("balance").default(0).notNull(),
	mnemonic: text("mnemonic").unique(),
	walletKitConnected: integer("walletKitConnected", {
		mode: "boolean",
	}).default(false),
	isAnonymous: integer("isAnonymous", { mode: "boolean" }),
	role: text("role"),
	username: text("username").notNull().unique(),
	displayUsername: text("displayUsername"),
	banned: integer("banned", { mode: "boolean" }),
	banReason: text("banReason"),
	banExpires: integer("banExpires", { mode: "timestamp" }),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const usersRelations = relations(user, ({ one, many }) => ({
	referrer: one(user, {
		fields: [user.referrerId],
		references: [user.username],
	}),
	referrals: many(user, {
		relationName: "userReferrals",
	}),
	subscription: one(subscription, {
		fields: [user.id],
		references: [subscription.userId],
	}),
	transactions: many(transaction, {
		relationName: "userTransactions",
	}),
}));

export const subscription = sqliteTable("subscription", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	planType: text("planType", { enum: ["free", "basic", "premium"] })
		.notNull()
		.default("free"),
	planDuration: text("planDuration", { enum: ["monthly", "yearly"] }),
	startDate: integer("startDate", { mode: "timestamp" }).notNull(),
	endDate: integer("endDate", { mode: "timestamp" }).notNull(),
	status: text("status", {
		enum: ["active", "cancelled", "expired"],
	}).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const transaction = sqliteTable("transaction", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	type: text("type", { enum: ["withdrawal", "deposit", "transfer"] }).notNull(),
	amount: real("amount").notNull(),
	status: text("status", { enum: ["pending", "failed", "success"] })
		.notNull()
		.default("pending"),
	description: text("description"),
	metadata: text("metadata"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	token: text("token").notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	impersonatedBy: text("impersonatedBy"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
	refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
		mode: "timestamp",
	}),
	scope: text("scope"),
	idToken: text("idToken"),
	password: text("password"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const rateLimit = sqliteTable("rateLimit", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	endpoint: text("endpoint").notNull(),
	count: integer("count").notNull().default(0),
	resetAt: integer("resetAt", { mode: "timestamp" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const booster = sqliteTable("booster", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	boosterId: text("boosterId").notNull(),
	activatedAt: integer("activatedAt", { mode: "timestamp" }).notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }),
	type: text("type", { enum: ["oneTime", "duration", "permanent"] }).notNull(),
	multiplier: real("multiplier").notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const boostersRelations = relations(booster, ({ one }) => ({
	user: one(user, {
		fields: [booster.userId],
		references: [user.id],
	}),
}));

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type RateLimit = typeof rateLimit.$inferSelect;
export type Subscription = typeof subscription.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type Booster = typeof booster.$inferSelect;
