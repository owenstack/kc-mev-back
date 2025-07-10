import { env } from "cloudflare:workers";

export const frontendUrl =
	process.env.NODE_ENV === "development"
		? env.DEV_FRONTEND_URL
		: env.PROD_FRONTEND_URL;

export const token =
	process.env.NODE_ENV === "development"
		? env.DEV_BOT_TOKEN
		: env.PROD_BOT_TOKEN;

export const PUBLIC_PATHS = ["/api/bot", "/"] as const;
export const CORS_ORIGINS = [
	env.PROD_FRONTEND_URL,
	env.DEV_FRONTEND_URL,
	"https://solid-cockatoo-upright.ngrok-free.app",
];
