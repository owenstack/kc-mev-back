import { Hono } from "hono";
import { cors } from "hono/cors";
import type { User } from "../db/schema";
import { getSimulatedData } from "../services/axis-gen";
import {
	getActiveBoostersForUser,
	getAvailableBoosters,
	purchaseBooster,
} from "../services/boosters";
import { CORS_ORIGINS, PUBLIC_PATHS } from "../services/constants";
import {
	deleteUser,
	getAuthenticatedUser,
	getUserPlan,
	getUsers,
	updateUser,
	updateUserAdmin,
} from "../services/helpers";
import { createBotHandler } from "../services/telegram";
import {
	createTransaction,
	getTransactions,
	getUserTransactions,
} from "../services/transactions";

// Define error response helper
const errorResponse = (error: unknown) => ({
	error: error instanceof Error ? error.message : "Internal server error",
});

const app = new Hono<{ Bindings: Env; Variables: { user: User } }>();

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

// Telegram Mini App Authentication middleware
app.use("*", async (c, next) => {
	try {
		// Allow OPTIONS requests to pass through without authentication
		if (c.req.method === "OPTIONS") {
			return next();
		}
		// Skip authentication for public paths
		if (PUBLIC_PATHS.includes(c.req.path as (typeof PUBLIC_PATHS)[number])) {
			return next();
		}
		// Authenticate user using Telegram initData
		const user = await getAuthenticatedUser(c);
		c.set("user", user);
		return next();
	} catch (error) {
		return c.json(errorResponse(error), 401);
	}
});

// Health check endpoint
app.get("/", (c) => c.text("Hello Galaxy MEV Telegram Mini App!"));

// Telegram bot webhook endpoint (public)
app.use("/api/bot", async (c) => {
	const botHandler = createBotHandler();
	return botHandler(c);
});

// User plan endpoint
app.get("/api/get-plan", async (c) => {
	try {
		const user = await getAuthenticatedUser(c);
		const plan = await getUserPlan(user.id);
		if (!plan) {
			return c.json({ error: "No plan found" }, 404);
		}
		return c.json(plan);
	} catch (error) {
		return c.json(errorResponse(error), 500);
	}
});

// Get current user info
app.get("/api/auth/me", async (c) => {
	try {
		const user = c.get("user");
		return c.json({ user });
	} catch (error) {
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/auth/update", async (c) => {
	try {
		const data = await c.req.json();
		// Update user information
		const updatedUser = await updateUser(c, data);
		return c.json(updatedUser);
	} catch (error) {
		return c.json(errorResponse(error), 500);
	}
});

// Admin endpoints
app.get("/api/admin/users", async (c) => {
	try {
		const users = await getUsers(c);
		return c.json(users);
	} catch (error) {
		console.error("Error fetching users:", error);
		return c.json(errorResponse(error), 403);
	}
});

app.post("/api/admin/update-user", async (c) => {
	try {
		const { userId, ...userData } = await c.req.json();
		const updatedUser = await updateUserAdmin(c, userId, userData);
		return c.json(updatedUser);
	} catch (error) {
		console.error("Error updating user:", error);
		return c.json(errorResponse(error), 403);
	}
});

app.post("/api/admin/delete-user", async (c) => {
	try {
		const { userId } = await c.req.json();
		await deleteUser(c, userId);
		return c.json({ success: true });
	} catch (error) {
		console.error("Error deleting user:", error);
		return c.json(errorResponse(error), 403);
	}
});

app.get("/api/admin/transactions", async (c) => {
	try {
		const transactions = await getTransactions(c);
		return c.json(transactions);
	} catch (error) {
		return c.json(errorResponse(error), 403);
	}
});

// Bot data endpoint
app.get("/api/bot-data", async (c) => {
	try {
		const type = c.req.query("type") as "random" | "mev" | "scalper";
		const count = Number.parseInt(c.req.query("count") || "100");

		const data = await getSimulatedData(c, type, count);
		return c.json(data);
	} catch (error) {
		console.error("Error fetching bot data:", error);
		return c.json(errorResponse(error), 500);
	}
});

// Transaction endpoints
app.post("/api/transactions/create", async (c) => {
	try {
		await createTransaction(c);
		return c.json({ success: true }, 201);
	} catch (error) {
		console.error("Error creating transaction:", error);
		return c.json(errorResponse(error), 500);
	}
});

app.get("/api/transactions/get", async (c) => {
	try {
		const transactions = await getUserTransactions(c);
		return c.json(transactions);
	} catch (error) {
		return c.json(errorResponse(error), 500);
	}
});

// Booster endpoints
app.get("/api/boosters", async (c) => {
	try {
		const boosters = await getAvailableBoosters();
		return c.json(boosters);
	} catch (error) {
		return c.json(errorResponse(error), 500);
	}
});

app.get("/api/boosters/active", async (c) => {
	try {
		const activeBoosters = await getActiveBoostersForUser(c);
		return c.json(activeBoosters);
	} catch (error) {
		console.error("Error fetching active boosters:", error);
		return c.json(errorResponse(error), 500);
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
		return c.json(errorResponse(error), 500);
	}
});

export default app;
