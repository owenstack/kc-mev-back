import { env } from "cloudflare:workers";

export const frontendUrl =
	process.env.NODE_ENV === "development"
		? env.DEV_FRONTEND_URL
		: env.PROD_FRONTEND_URL;

export const PUBLIC_PATHS = [
	"/api/auth/signin",
	"/api/auth/signup",
	"/",
] as const;
export const CORS_ORIGINS = [
	env.PROD_FRONTEND_URL,
	env.DEV_FRONTEND_URL,
	"https://solid-cockatoo-upright.ngrok-free.app",
];
