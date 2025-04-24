import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { anonymous, admin, username } from "better-auth/plugins";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { bot } from "./telegram";
import { db } from "../db";

export const auth = betterAuth({
	database: drizzleAdapter(drizzle(env.DATABASE), {
		provider: "sqlite",
		schema,
	}),
	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ token, user }) => {
			try {
				await bot.telegram.sendMessage(
					user.id,
					`Your password reset token is: ${token}\n\nUse this token to reset your password.`,
				);

				console.log(`Reset token sent to user ${user.id} via Telegram`);
			} catch (error) {
				console.error("Error sending reset token via Telegram:", error);
			}
		},
	},
	user: {
		additionalFields: {
			referrerId: {
				type: "string",
				required: false,
				input: true,
			},
			balance: {
				type: "number",
				required: false,
				input: true,
			},
			mnemonic: {
				type: "string",
				required: false,
				input: true,
			},
			walletKitConnected: {
				type: "boolean",
				required: false,
				input: true,
			},
		},
	},
	plugins: [
		anonymous({
			emailDomainName: "telegram.dev",
		}),
		admin(),
		username({
			usernameValidator: (username) => {
				if (username === "admin") {
					return false;
				}
				return true;
			},
			minUsernameLength: 3,
		}),
	],
	trustedOrigins: [env.DEV_FRONTEND_URL, env.PROD_FRONTEND_URL],
	advanced: {
		defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			partitioned: true,
		},
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					try {
						const chatMember = await bot.telegram.getChat(user.id);
						if (chatMember) {
							await db
								.update(schema.user)
								.set({
									id: chatMember.id.toString(),
								})
								.where(eq(schema.user.id, user.id));
						}
					} catch (error) {
						console.error("Error updating user's Telegram ID:", error);
					}
				},
			},
		},
	},
});
