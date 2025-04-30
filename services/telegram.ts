import { env } from "cloudflare:workers";
import type { Context } from "hono";
import { Markup, Telegraf, session } from "telegraf";
import { frontendUrl } from "./constants";
import { user } from "../db/schema";
import { db } from "../db";
import { generateSessionToken, createSession } from "./auth";

export const bot = new Telegraf(env.PROD_BOT_TOKEN);

export function createBotHandler() {
	bot.use(session());

	bot.start(async (ctx) => {
		try {
			const profileImage = await ctx.telegram.getUserProfilePhotos(ctx.from.id);
			const fileUrl = await ctx.telegram.getFileLink(
				profileImage.photos[0][0].file_id,
			);
			const userData = {
				id: ctx.from.id,
				firstName: ctx.from.first_name,
				lastName: ctx.from.last_name,
				image: fileUrl.toString(),
				role: "user" as const,
				username: ctx.from.username,
				isPremium: ctx.from.is_premium,
				// Create or update user
			};
			await db.insert(user).values(userData).onConflictDoNothing();

			// Create a new session
			const sessionToken = generateSessionToken();
			const { error } = await createSession(sessionToken, ctx.from.id);

			if (error) {
				console.error("Error creating session:", error);
				return ctx.reply("Sorry, there was an error. Please try again later.");
			}

			// Add session token to web app URL
			const webAppUrl = new URL(frontendUrl);
			webAppUrl.searchParams.set("session", sessionToken);

			const keyboard = Markup.inlineKeyboard([
				[
					{
						text: "🚀 Start Earning",
						web_app: { url: webAppUrl.toString() },
					},
				],
			]);

			return ctx.reply(
				`Welcome ${ctx.from.first_name}! 👋\n\nGalaxy MEV enables you to earn passive income through:\n\n🔹 MEV Opportunities\n🔹 Scalping Strategies\n🔹 Market Arbitrage\n\nClick below to begin your journey!`,
				keyboard,
			);
		} catch (error) {
			console.error("Error in start command:", error);
			return ctx.reply("Sorry, there was an error. Please try again later.");
		}
	});
	bot.help(async (ctx) => {
		await ctx.reply(
			"Need help? Contact our support team or visit our documentation.\n\n" +
				"Available commands:\n" +
				"/start - Start using the bot\n",
		);
	});

	return async (c: Context) => {
		try {
			const body = await c.req.json();
			await bot.handleUpdate(body);
			return new Response("OK", { status: 200 });
		} catch (error) {
			console.error("Error handling Telegram webhook:", error);
			return new Response("Error processing webhook", { status: 500 });
		}
	};
}
