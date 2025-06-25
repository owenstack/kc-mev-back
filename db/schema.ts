import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	telegramId: integer("telegram_id").unique().notNull(), // Telegram user ID
	firstName: text("first_name").notNull(),
	lastName: text("last_name"),
	username: text("username"), // Telegram username (optional)
	image: text("image"), // Profile photo URL from Telegram
	role: text("role", { enum: ["user", "admin"] })
		.default("user")
		.notNull(),
	balance: real("balance").default(0).notNull(),
	mnemonic: text("mnemonic"), // Wallet mnemonic if applicable
	walletKitConnected: integer("wallet_kit_connected", {
		mode: "boolean",
	}).default(false),
	referrerId: integer("referrer_id"),
	banned: integer("banned", { mode: "boolean" }).default(false).notNull(),
	banReason: text("ban_reason"),
	banExpires: integer("ban_expires", { mode: "timestamp" }),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	userId: integer("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	impersonatedBy: integer("impersonatedBy"),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`),
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
	boosters: many(booster, {
		relationName: "userBoosters",
	}),
}));

export const subscription = sqliteTable("subscription", {
	id: text("id").primaryKey(),
	userId: integer("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	planType: text("planType", { enum: ["free", "basic", "premium"] })
		.notNull()
		.default("free"),
	planDuration: text("planDuration", { enum: ["monthly", "yearly"] }).notNull(),
	startDate: integer("startDate", { mode: "timestamp" }).notNull(),
	endDate: integer("endDate", { mode: "timestamp" }).notNull(),
	status: text("status", {
		enum: ["active", "cancelled", "expired"],
	})
		.notNull()
		.default("active"),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`),
});

export const transaction = sqliteTable("transaction", {
	id: text("id").primaryKey(),
	userId: integer("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	type: text("type", { enum: ["withdrawal", "deposit", "transfer"] }).notNull(),
	amount: real("amount").notNull(),
	status: text("status", { enum: ["pending", "failed", "success"] })
		.notNull()
		.default("pending"),
	description: text("description"),
	metadata: text("metadata", { mode: "json" }),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`),
});

export const booster = sqliteTable("booster", {
	id: text("id").primaryKey(),
	userId: integer("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	boosterId: text("boosterId").notNull(),
	activatedAt: integer("activatedAt", { mode: "timestamp" }).notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }),
	type: text("type", { enum: ["oneTime", "duration", "permanent"] }).notNull(),
	multiplier: real("multiplier").notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`),
});

export const boostersRelations = relations(booster, ({ one }) => ({
	user: one(user, {
		fields: [booster.userId],
		references: [user.id],
	}),
}));

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Subscription = typeof subscription.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type Booster = typeof booster.$inferSelect;
