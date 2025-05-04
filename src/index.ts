import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	handleRequest,
	signOut,
	updateUser,
	validateSessionToken,
	setSessionTokenCookie,
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
import { CORS_ORIGINS, PUBLIC_PATHS } from "../services/constants";

// Define error response helper
const errorResponse = (error: unknown) => ({
	error: error instanceof Error ? error.message : "Internal server error",
});

const app = new Hono<{ Bindings: Env }>();

// Authentication middleware to handle request validation and user authentication
app.use("*", async (c, next) => {
	console.log(
		`[${new Date().toISOString()}] Incoming request to: ${c.req.method} ${c.req.path}`,
	);
	try {
		// Allow OPTIONS requests to pass through without authentication
		if (c.req.method === "OPTIONS") {
			console.log("OPTIONS request - bypassing authentication");
			return next();
		}

		if (PUBLIC_PATHS.includes(c.req.path as (typeof PUBLIC_PATHS)[number])) {
			console.log("Public path detected - bypassing authentication");
			return next();
		}
		console.log("Authenticating request...");
		await handleRequest(c);
		console.log("Authentication successful");
		return next();
	} catch (error) {
		console.error("Authentication error:", error);
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

app.get("/", (c) => {
	console.log("Serving root endpoint");
	return c.text("Hello Galaxy MEV!");
});

app.use("/api/bot", async (c) => {
	console.log("Handling bot request");
	const botHandler = createBotHandler();
	return botHandler(c);
});

app.use("/api/get-plan", async (c) => {
	console.log("Fetching user plan");
	const user = await getAuthenticatedUser(c);
	console.log("User authenticated, fetching plan for user:", user.id);
	const plan = await getUserPlan(user.id);
	if (!plan) {
		console.log("No plan found for user:", user.id);
		return c.json({ error: "No plan found" }, 404);
	}
	console.log("Plan found:", plan);
	return c.json(plan);
});

app.get("/api/admin/users", async (c) => {
	console.log("Fetching all users");
	try {
		const users = await getUsers(c);
		console.log(`Retrieved ${users.length} users`);
		return c.json(users);
	} catch (error) {
		console.error("Error fetching users:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/admin/update-user", async (c) => {
	try {
		const { userId, ...userData } = await c.req.json();
		console.log("Updating user:", userId, "with data:", userData);
		const updatedUser = await updateUserAdmin(c, userId, userData);
		console.log("User updated successfully:", updatedUser);
		return c.json(updatedUser);
	} catch (error) {
		console.error("Error updating user:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/admin/delete-user", async (c) => {
	try {
		const { userId } = await c.req.json();
		console.log("Deleting user:", userId);
		await deleteUser(c, userId);
		console.log("User deleted successfully");
		return c.json({ success: true });
	} catch (error) {
		console.error("Error deleting user:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/admin/transactions", async (c) => {
	console.log("Fetching all transactions");
	try {
		const transactions = await getTransactions(c);
		console.log(`Retrieved ${transactions.length} transactions`);
		return c.json(transactions);
	} catch (error) {
		console.error("Error fetching transactions:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/bot-data", async (c) => {
	try {
		const type = c.req.query("type") as "random" | "mev" | "scalper";
		const count = Number.parseInt(c.req.query("count") || "100");
		console.log("Fetching bot data:", { type, count });

		const data = await getSimulatedData(c, type, count);
		console.log(`Retrieved ${data.length} bot data entries`);
		return c.json(data);
	} catch (error) {
		console.error("Error fetching bot data:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/transactions/create", async (c) => {
	try {
		console.log("Creating new transaction");
		await createTransaction(c);
		console.log("Transaction created successfully");
		return c.json({ success: true }, 201);
	} catch (error) {
		console.error("Error creating transaction:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/transactions/get", async (c) => {
	console.log("Fetching user transactions");
	try {
		const transactions = await getUserTransactions(c);
		console.log(`Retrieved ${transactions.length} user transactions`);
		return c.json(transactions);
	} catch (error) {
		console.error("Error fetching user transactions:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/boosters", async (c) => {
	console.log("Fetching available boosters");
	try {
		const boosters = await getAvailableBoosters();
		console.log(`Retrieved ${boosters.length} available boosters`);
		return c.json(boosters);
	} catch (error) {
		console.error("Error fetching boosters:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/boosters/active", async (c) => {
	console.log("Fetching active boosters for user");
	try {
		const activeBoosters = await getActiveBoostersForUser(c);
		console.log(`Retrieved ${activeBoosters.length} active boosters`);
		return c.json(activeBoosters);
	} catch (error) {
		console.error("Error fetching active boosters:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.post("/api/boosters/purchase", async (c) => {
	try {
		const { boosterId, useExternalPayment } = await c.req.json();
		console.log("Purchasing booster:", { boosterId, useExternalPayment });
		const success = await purchaseBooster(c, boosterId, useExternalPayment);

		if (!success) {
			console.log("Booster purchase failed");
			return c.json({ error: "Failed to purchase booster" }, 400);
		}

		console.log("Booster purchased successfully");
		return c.json({ success: true }, 201);
	} catch (error) {
		console.error("Error purchasing booster:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.get("/api/auth/signout", (c) => {
	console.log("User signing out");
	return signOut(c);
});

app.get("/api/auth/get-session", async (c) => {
	console.log("Fetching user session");
	try {
		const user = await getAuthenticatedUser(c);
		console.log("Session retrieved for user:", user.id);
		return c.json({ user });
	} catch (error) {
		console.error("Error fetching session:", error);
		return c.json(errorResponse(error), 401);
	}
});

app.post("api/auth/update-user", (c) => {
	console.log("Updating user profile");
	return updateUser(c);
});

// Handle session initialization from URL
app.get("/api/auth/init", async (c) => {
	console.log("Initializing session from URL");
	const token = c.req.query("session");
	if (!token) {
		console.log("No session token provided");
		return c.json({ error: "No session token provided" }, 400);
	}

	console.log("Validating session token");
	const result = await validateSessionToken(token);
	if (!result.session || !result.user) {
		console.log("Invalid session token");
		return c.json({ error: "Invalid session token" }, 401);
	}

	console.log("Setting session token cookie");
	setSessionTokenCookie(c, token, result.session.expiresAt);
	console.log("Session initialized successfully");
	return c.json({ success: true });
});

export default app;
