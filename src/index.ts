import { Hono } from "hono";
import { cors } from "hono/cors";
import { CORS_ORIGINS } from "../services/constants";
import { createBotHandler } from "../services/telegram";

const app = new Hono<{ Bindings: Env }>();

// CORS middleware - must come first
app.use(
	"*",
	cors({
		origin: CORS_ORIGINS,
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);

// Health check endpoint
app.get("/", (c) => c.text("Hello Galaxy MEV Telegram Mini App!"));

// Telegram bot webhook endpoint (public)
app.use("/api/bot", async (c) => {
	const botHandler = createBotHandler();
	return botHandler(c);
});

export default app;
