import { Hono } from "hono";
import { createBotHandler } from "../services/telegram";
import { auth } from "../services/auth";
import { cors } from "hono/cors";
import { env } from "cloudflare:workers";
import { getSimulatedData } from "../services/axis-gen";
import { getAuthenticatedUser, getUserPlan } from "../services/helpers";
import { createTransaction } from "../services/transactions";
import {
	purchaseBooster,
	getActiveBoostersForUser,
	getAvailableBoosters,
} from "../services/boosters";

const app = new Hono<{ Bindings: Env }>();

app.use(
	"*",
	cors({
		origin: [env.PROD_FRONTEND_URL, env.DEV_FRONTEND_URL],
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);

app.get("/", (c) => {
	return c.text("Hello Galaxy MEV!");
});

app.use("/api/bot", async (c) => {
	const botHandler = createBotHandler();
	return botHandler(c);
});

app.use("/api/get-plan", async (c) => {
	const user = await getAuthenticatedUser(c);
	const plan = await getUserPlan(user.id);
	if (!plan) {
		return c.json({ error: "No plan found" }, 404);
	}
	return c.json(plan);
});

app.get("/api/bot-data", async (c) => {
	try {
		const type = c.req.query("type") as "random" | "mev" | "scalper";
		const count = Number.parseInt(c.req.query("count") || "100");

		const data = await getSimulatedData(c, type, count);
		return c.json(data);
	} catch (error) {
		console.error("Error fetching bot data:", error);
		return c.json(
			{
				error: error instanceof Error ? error.message : "Internal server error",
			},
			401,
		);
	}
});

app.post("/api/transactions", async (c) => {
	try {
		await createTransaction(c);
		return c.json({ success: true }, 201);
	} catch (error) {
		console.error("Error creating transaction:", error);
		return c.json(
			{
				error: error instanceof Error ? error.message : "Internal server error",
			},
			401,
		);
	}
});

app.get("/api/boosters", async (c) => {
	const boosters = await getAvailableBoosters();
	return c.json(boosters);
});

app.get("/api/boosters/active", async (c) => {
	try {
		const activeBoosters = await getActiveBoostersForUser(c);
		return c.json(activeBoosters);
	} catch (error) {
		console.error("Error fetching active boosters:", error);
		return c.json(
			{
				error: error instanceof Error ? error.message : "Internal server error",
			},
			401,
		);
	}
});

app.post("/api/boosters/purchase", async (c) => {
	try {
		const { boosterId, useExternalPayment } = await c.req.json();
		const success = await purchaseBooster(c, boosterId, useExternalPayment);

		if (!success) {
			return c.json({ error: "Failed to purchase booster" }, 400);
		}

		return c.json({ success: true }, 201);
	} catch (error) {
		console.error("Error purchasing booster:", error);
		return c.json(
			{
				error: error instanceof Error ? error.message : "Internal server error",
			},
			401,
		);
	}
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	return auth.handler(c.req.raw);
});

export default app;
