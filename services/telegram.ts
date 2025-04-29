import { env } from "cloudflare:workers";
import type { Context } from "hono";
import { Markup, Telegraf, session } from "telegraf";

const botToken =
	process.env.NODE_ENV === "development"
		? env.DEV_BOT_TOKEN
		: env.PROD_BOT_TOKEN;
const frontendUrl =
	process.env.NODE_ENV === "development"
		? env.DEV_FRONTEND_URL
		: env.PROD_FRONTEND_URL;

export const bot = new Telegraf(botToken);

export function createBotHandler() {
	bot.use(session());

	bot.start(async (ctx) => {
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
