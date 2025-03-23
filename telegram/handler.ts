import { Telegraf, Markup, session } from "telegraf";
import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { user, type User, verification } from "../db/schema";
import { sql, eq, and } from "drizzle-orm";
import { auth } from "../utils/auth";
import { env } from "cloudflare:workers";

export function createBotHandler() {
	const db = drizzle(env.DATABASE);
	const botToken =
		process.env.NODE_ENV === "development"
			? env.DEV_BOT_TOKEN
			: env.PROD_BOT_TOKEN;
	const frontendUrl =
		process.env.NODE_ENV === "development"
			? env.DEV_FRONTEND_URL
			: env.PROD_FRONTEND_URL;

	const bot = new Telegraf(botToken);
	bot.use(session());

	bot.start(async (ctx) => {
		const sender = ctx.message.from;
		try {
			const existingUser = await db
				.select()
				.from(user)
				.where(eq(user.id, sender.id.toString()))
				.execute();

			if (!existingUser.length) {
				const anonUser = await auth.api.signInAnonymous();
				const updateData: Partial<User> = { id: sender.id.toString() };

				if (ctx.text?.includes("ref")) {
					const referrerId = ctx.text.split("ref=")[1];
					updateData.referrerId = referrerId;
				}

				await db
					.update(user)
					.set(updateData)
					.where(eq(user.id, anonUser?.user.id as string))
					.execute();
			}
		} catch (error) {
			console.error("Error in start handler:", error);
			return ctx.reply(
				`Something went wrong. Error: ${error instanceof Error ? error.message : "Internal server error"}`,
			);
		}

		const keyboard = Markup.inlineKeyboard([
			[
				{
					text: "Open Galaxy MEV",
					web_app: { url: frontendUrl },
				},
			],
		]);

		return ctx.reply("Welcome to Galaxy MEV!", keyboard);
	});

	// Add a reset password command
	bot.command("reset-password", async (ctx) => {
		const sender = ctx.message.from;

		try {
			// Find the user in our database
			const existingUser = await db
				.select()
				.from(user)
				.where(eq(user.id, sender.id.toString()))
				.execute();

			if (!existingUser.length) {
				return ctx.reply(
					"You don't have an account linked to this Telegram profile yet. Please start by using the /start command.",
				);
			}

			// Instruct the user how to reset their password
			await ctx.reply(
				"To reset your password, please visit the app and use the 'Forgot Password' option with your registered email. " +
					"I'll send you the reset token here, which you can use to create a new password.",
			);
		} catch (error) {
			console.error("Error in reset password handler:", error);
			return ctx.reply("Something went wrong while processing your request.");
		}
	});

	// Add a command to verify if a reset token is valid
	bot.command("verify-token", async (ctx) => {
		const args = ctx.message.text.split(" ");
		if (args.length < 2) {
			return ctx.reply("Please provide your token: /verifytoken YOUR_TOKEN");
		}

		const token = args[1];

		try {
			// Check if the token exists in the verification table
			const verificationRecord = await db
				.select()
				.from(verification)
				.where(eq(verification.value, token))
				.execute();

			if (verificationRecord.length > 0) {
				return ctx.reply(
					"This token is valid. You can use it to reset your password.",
				);
			}
			return ctx.reply("This token is invalid or has expired.");
		} catch (error) {
			console.error("Error verifying token:", error);
			return ctx.reply("Something went wrong while verifying your token.");
		}
	});

	bot.help(async (ctx) => {
		await ctx.reply(
			"Need help? Contact our support team or visit our documentation.\n\n" +
				"Available commands:\n" +
				"/start - Start using the bot\n" +
				"/reset-password - Get instructions for password reset\n" +
				"/verify-token TOKEN - Verify if a reset token is valid",
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
