import { env } from "cloudflare:workers";

export const frontendUrl =
	process.env.NODE_ENV === "development"
		? env.DEV_FRONTEND_URL
		: env.PROD_FRONTEND_URL;

export const PUBLIC_PATHS = [
	"/",
	"/api/auth/signup",
	"/api/auth/signin",
	"/api/auth/init",
	"/api/bot",
	"/api/auth/get-session",
] as const;

export const CORS_ORIGINS = [
	env.PROD_FRONTEND_URL,
	env.DEV_FRONTEND_URL,
	"https://solid-cockatoo-upright.ngrok-free.app",
];

// Constants for messages and error handling
export const WELCOME_MESSAGE = (username: string) =>
	`Welcome ${username}! 👋\n\nGalaxy MEV enables you to earn passive income through:\n\n🔹 MEV Opportunities\n🔹 Scalping Strategies\n🔹 Market Arbitrage\n\nClick below to begin your journey!`;

export const ERROR_MESSAGE =
	"Sorry, there was an error. Please try again later.";
export const HELP_MESSAGE =
	"Need help? Contact our support team or visit our documentation.\n\n" +
	"Available commands:\n" +
	"/start - Start using the bot\n";
