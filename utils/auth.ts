import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { anonymous, admin, username } from "better-auth/plugins";
import { env } from "cloudflare:workers";
import { Telegraf } from "telegraf";
import { eq } from "drizzle-orm";

// Create a Telegram bot instance for password reset functionality
const getBotInstance = () => {
	const botToken =
		process.env.NODE_ENV === "development"
			? env.DEV_BOT_TOKEN
			: env.PROD_BOT_TOKEN;
	return new Telegraf(botToken);
};

export const auth = betterAuth({
	database: drizzleAdapter(drizzle(env.DATABASE), {
		provider: "sqlite",
		schema,
	}),
	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ token, user }) => {
			try {
				const bot = getBotInstance();

				// Send the reset token to the user via Telegram
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
				input: false,
			},
		},
	},
	plugins: [
		anonymous({
			emailDomainName: "efobi.dev",
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
			partitioned: true, // New browser standards will mandate this for foreign cookies
		},
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					const db = drizzle(env.DATABASE);
					const bot = getBotInstance();
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
