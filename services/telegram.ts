import { env } from "cloudflare:workers";
import type { Context } from "hono";
import { Markup, Telegraf, session, type Context as TgContext } from "telegraf";
import {
	ERROR_MESSAGE,
	frontendUrl,
	HELP_MESSAGE,
	WELCOME_MESSAGE,
} from "./constants";
import { user } from "../db/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { generateSessionToken, createSession } from "./auth";

console.log("Initializing Telegram bot with token:", env.PROD_BOT_TOKEN);
export const bot = new Telegraf(env.PROD_BOT_TOKEN);

async function handleUserCreation(ctx: TgContext) {
	console.log("Creating new user for Telegram ID:", ctx.from?.id);
	const profileImage = await ctx.telegram.getUserProfilePhotos(
		ctx.from?.id ?? 0,
		1,
	);
	console.log("Retrieved profile photos:", profileImage);
	const fileUrl = await ctx.telegram.getFileLink(
		profileImage.photos[0][0].file_id,
	);
	console.log("Got file URL:", fileUrl.toString());

	const userData = {
		id: ctx.from?.id,
		firstName: ctx.from?.first_name,
		lastName: ctx.from?.last_name,
		image: fileUrl.toString(),
		role: "user" as const,
		username: ctx.from?.username,
		isPremium: ctx.from?.is_premium,
	};
	console.log("Attempting to insert user data:", userData);

	await db.insert(user).values(userData).onConflictDoNothing();
	console.log("User creation completed");
	return generateSessionToken();
}

async function createUserSession(sessionToken: string, userId: number) {
	console.log("Creating session for user:", userId);
	const { error } = await createSession(sessionToken, userId);
	if (error) {
		console.error("Error creating session:", error);
		throw new Error("Session creation failed");
	}
	console.log("Session created successfully");
	return sessionToken;
}

export function createBotHandler() {
	console.log("Setting up bot handler");
	bot.use(session());

	bot.start(async (ctx) => {
		console.log("Received start command from user:", ctx.from.id);
		try {
			const existingUser = await db.query.user.findFirst({
				where: eq(user.id, ctx.from.id),
			});
			console.log("Existing user check result:", existingUser);

			const sessionToken = existingUser
				? await createUserSession(generateSessionToken(), ctx.from.id)
				: await handleUserCreation(ctx).then((token) =>
						createUserSession(token, ctx.from.id),
					);
			console.log("Generated session token:", sessionToken);

			const webAppUrl = new URL(frontendUrl);
			webAppUrl.searchParams.set("session", sessionToken);
			console.log("Generated web app URL:", webAppUrl.toString());

			const keyboard = Markup.inlineKeyboard([
				[
					{
						text: "🚀 Start Earning",
						web_app: { url: webAppUrl.toString() },
					},
				],
			]);

			console.log("Sending welcome message to user");
			return ctx.reply(WELCOME_MESSAGE(ctx.from.first_name), keyboard);
		} catch (error) {
			console.error("Error in start command:", error);
			return ctx.reply(ERROR_MESSAGE);
		}
	});

	bot.help(async (ctx) => {
		console.log("Received help command from user:", ctx.from.id);
		await ctx.reply(HELP_MESSAGE);
	});

	return async (c: Context) => {
		console.log("Received webhook request");
		try {
			const body = await c.req.json();
			console.log("Webhook body:", body);
			await bot.handleUpdate(body);
			console.log("Successfully processed webhook");
			return new Response("OK", { status: 200 });
		} catch (error) {
			console.error("Error handling Telegram webhook:", error);
			return new Response("Error processing webhook", { status: 500 });
		}
	};
}
