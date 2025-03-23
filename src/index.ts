import { Hono } from "hono";
import { createBotHandler } from "../telegram/handler";
import { auth } from "../utils/auth";
import { cors } from "hono/cors";
import { env } from "cloudflare:workers";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
	return c.text("Hello Galaxy MEV!");
});

app.use("/api/bot", async (c) => {
	const botHandler = createBotHandler();
	return botHandler(c);
});

app.use(
	"/api/auth/*", // or replace with "*" to enable cors for all routes
	cors({
		origin: env.DEV_FRONTEND_URL,
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	return auth.handler(c.req.raw);
});

export default app;
