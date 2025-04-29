import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Users table
export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	username: text("username").notNull().unique(),
	email: text("email").notNull().unique(),
	passphraseHash: text("passphrase_hash").notNull(),
	currentBalance: real("current_balance").default(0).notNull(),
	registrationDate: integer("registration_date", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	lastWithdrawalDate: integer("last_withdrawal_date", { mode: "timestamp" }),
	referrerId: integer("referrer_id"),
	active: integer("active", { mode: "boolean" }).default(true).notNull(),
	plan: text("plan", { enum: ["basic", "plus", "pro"] })
		.default("basic")
		.notNull(),
	planStartDate: integer("plan_start_date", { mode: "timestamp" }),
	planEndDate: integer("plan_end_date", { mode: "timestamp" }),
});

// Relations for referrals
export const usersRelations = relations(users, ({ one, many }) => ({
	referrer: one(users, {
		fields: [users.referrerId],
		references: [users.id],
	}),
	referrals: many(users, {
		relationName: "userReferrals",
	}),
}));

// Wallets table
export const wallets = sqliteTable("wallets", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	address: text("address").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const walletsRelations = relations(wallets, ({ one }) => ({
	user: one(users, {
		fields: [wallets.userId],
		references: [users.id],
	}),
}));

// Transactions table for tracking income and withdrawals
export const transactions = sqliteTable("transactions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	amount: real("amount").notNull(),
	type: text("type", {
		enum: [
			"passive_income",
			"referral_bonus",
			"withdrawal",
			"subscription_payment",
		],
	}).notNull(),
	status: text("status", { enum: ["pending", "completed", "failed"] })
		.notNull()
		.default("completed"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	description: text("description"),
	txHash: text("tx_hash"),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
	user: one(users, {
		fields: [transactions.userId],
		references: [users.id],
	}),
}));

// Subscriptions table for managing plans
export const subscriptions = sqliteTable("subscriptions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	plan: text("plan", { enum: ["basic", "plus", "pro"] }).notNull(),
	status: text("status", {
		enum: ["active", "cancelled", "expired"],
	}).notNull(),
	startDate: integer("start_date", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	endDate: integer("end_date", { mode: "timestamp" }),
	autoRenew: integer("auto_renew", { mode: "boolean" }).default(true).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id],
	}),
}));

// For tracking authentication attempts and sessions if needed
export const sessions = sqliteTable("sessions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	token: text("token").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

// Helper functions
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
