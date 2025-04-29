import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	handleRequest,
	signIn,
	signOut,
	signUp,
	updateUser,
} from "../services/auth";
import { getSimulatedData } from "../services/axis-gen";
import {
	getActiveBoostersForUser,
	getAvailableBoosters,
	purchaseBooster,
} from "../services/boosters";
import {
	deleteUser,
	getAuthenticatedUser,
	getUserPlan,
	getUsers,
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

// Define route constants
const PUBLIC_PATHS = ["/api/auth/signin", "/api/auth/signup", "/"] as const;
const CORS_ORIGINS = [env.PROD_FRONTEND_URL, env.DEV_FRONTEND_URL];

const app = new Hono<{ Bindings: Env }>();

// Authentication middleware to handle request validation and user authentication
app.use("*", async (c, next) => {
	try {
		if (PUBLIC_PATHS.includes(c.req.path as (typeof PUBLIC_PATHS)[number])) {
			return next();
		}
		await handleRequest(c);
		return next();
	} catch (error) {
		return c.json(errorResponse(error), 401);
	}
});

app.use(
	"*",
	cors({
		origin: CORS_ORIGINS,
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);

app.get("/", (c) => c.text("Hello Galaxy MEV!"));

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

app.get("/api/admin/users", async (c) => {
	try {
		const users = await getUsers(c);
		return c.json(users);
	} catch (error) {
		console.error("Error fetching users:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/admin/update-user", async (c) => {
	try {
		const { userId, ...userData } = await c.req.json();
		const updatedUser = await updateUserAdmin(c, userId, userData);
		return c.json(updatedUser);
	} catch (error) {
		console.error("Error updating user:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/admin/delete-user", async (c) => {
	try {
		const { userId } = await c.req.json();
		await deleteUser(c, userId);
		return c.json({ success: true });
	} catch (error) {
		console.error("Error updating user:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/admin/transactions", async (c) => {
	try {
		const transactions = await getTransactions(c);
		return c.json(transactions);
	} catch (error) {
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/bot-data", async (c) => {
	try {
		const type = c.req.query("type") as "random" | "mev" | "scalper";
		const count = Number.parseInt(c.req.query("count") || "100");

		const data = await getSimulatedData(c, type, count);
		return c.json(data);
	} catch (error) {
		console.error("Error fetching bot data:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/transactions/create", async (c) => {
	try {
		await createTransaction(c);
		return c.json({ success: true }, 201);
	} catch (error) {
		console.error("Error creating transaction:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/transactions/get", async (c) => {
	try {
		const transactions = await getUserTransactions(c);
		return c.json(transactions);
	} catch (error) {
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/boosters", async (c) => {
	try {
		const boosters = await getAvailableBoosters();
		return c.json(boosters);
	} catch (error) {
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/boosters/active", async (c) => {
	try {
		const activeBoosters = await getActiveBoostersForUser(c);
		return c.json(activeBoosters);
	} catch (error) {
		console.error("Error fetching active boosters:", error);
		return c.json(errorResponse(error), 401);
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
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/auth/signup", signUp);
app.post("/api/auth/signin", signIn);
app.get("/api/auth/signout", signOut);

app.get("/api/auth/get-session", async (c) => {
	try {
		const user = await getAuthenticatedUser(c);
		return c.json({ user });
	} catch (error) {
		return c.json(errorResponse(error), 401);
	}
});

app.post("api/auth/update-user", updateUser);
export default app;
