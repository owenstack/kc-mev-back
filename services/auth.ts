import { env } from "cloudflare:workers";
import { sha256 } from "@oslojs/crypto/sha2";
import {
	encodeBase32LowerCaseNoPadding,
	encodeHexLowerCase,
} from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../db";
import { type User, session, user } from "../db/schema";
import { getAuthenticatedUser } from "./helpers";
import { CORS_ORIGINS } from "./constants";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const SESSION_DURATION = MS_PER_DAY * 30;
const SESSION_REFRESH_THRESHOLD = MS_PER_DAY * 15;

export function generateSessionToken(): string {
	console.log("Generating new session token");
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const token = encodeBase32LowerCaseNoPadding(bytes);
	console.log("Generated token length:", token.length);
	return token;
}

export async function createSession(token: string, userId: number) {
	console.log("Creating session for user:", userId);
	try {
		const sessionId = encodeHexLowerCase(
			sha256(new TextEncoder().encode(token)),
		);
		console.log("Generated session ID:", sessionId);
		const now = new Date();
		const sessionData = {
			id: sessionId,
			userId,
			expiresAt: new Date(now.getTime() + SESSION_DURATION),
		};
		console.log("Session data:", sessionData);
		await db.insert(session).values(sessionData);
		console.log("Session created successfully");
		return { data: sessionData, error: null };
	} catch (error) {
		console.error("Error creating session:", error);
		return { error: (error as Error).message, data: null };
	}
}

export async function validateSessionToken(token: string) {
	console.log("Validating session token");
	try {
		const sessionId = encodeHexLowerCase(
			sha256(new TextEncoder().encode(token)),
		);
		console.log("Session ID to validate:", sessionId);
		const result = await db
			.select({ user: user, session: session })
			.from(session)
			.innerJoin(user, eq(session.userId, user.id))
			.where(eq(session.id, sessionId));

		if (result.length < 1) {
			console.log("No session found for ID:", sessionId);
			return { session: null, user: null, error: "Invalid session" };
		}

		const { user: userData, session: sessionData } = result[0];
		console.log("Found session data:", sessionData);
		console.log("Found user data:", userData);

		const now = Date.now();
		if (now >= sessionData.expiresAt.getTime()) {
			console.log("Session expired, deleting session");
			await db.delete(session).where(eq(session.id, sessionData.id));
			return { session: null, user: null, error: "Session expired" };
		}

		if (now >= sessionData.expiresAt.getTime() - SESSION_REFRESH_THRESHOLD) {
			console.log("Refreshing session expiry");
			const newExpiresAt = new Date(now + SESSION_DURATION);
			sessionData.expiresAt = newExpiresAt;
			await db
				.update(session)
				.set({
					expiresAt: newExpiresAt,
				})
				.where(eq(session.id, sessionData.id));
			console.log("Session refreshed, new expiry:", newExpiresAt);
		}

		return { session: sessionData, user: userData, error: null };
	} catch (error) {
		console.error("Error validating session:", error);
		return { session: null, user: null, error: (error as Error).message };
	}
}

export async function invalidateSession(sessionId: string) {
	console.log("Invalidating session:", sessionId);
	try {
		await db.delete(session).where(eq(session.id, sessionId));
		console.log("Session invalidated successfully");
		return { success: true };
	} catch (error) {
		console.error("Error invalidating session:", error);
		return { error: (error as Error).message };
	}
}

export async function invalidateAllSessions(userId: number) {
	console.log("Invalidating all sessions for user:", userId);
	try {
		await db.delete(session).where(eq(session.userId, userId));
		console.log("All sessions invalidated successfully");
		return { success: true };
	} catch (error) {
		console.error("Error invalidating all sessions:", error);
		return { error: (error as Error).message };
	}
}

export function setSessionTokenCookie(
	c: Context,
	token: string,
	expiresAt: Date,
) {
	console.log("Setting session cookie, expires:", expiresAt);
	const cookieOptions = {
		httpOnly: true,
		sameSite: "none" as const,
		expires: expiresAt.toUTCString(),
		path: "/",
		secure: true,
	};

	const cookieString = Object.entries(cookieOptions)
		.map(([key, value]) => {
			if (key === "httpOnly") return "HttpOnly";
			return `${key}=${value}`;
		})
		.join("; ");

	c.res.headers.set("Set-Cookie", `session=${token}; ${cookieString}`);
	console.log("Session cookie set successfully");
}

export function deleteSessionTokenCookie(c: Context) {
	console.log("Deleting session cookie");
	const cookieOptions = {
		httpOnly: true,
		sameSite: "Lax" as const,
		maxAge: "0",
		path: "/",
		secure: true,
	};

	const cookieString = Object.entries(cookieOptions)
		.map(([key, value]) => {
			if (key === "httpOnly") return "HttpOnly";
			return `${key}=${value}`;
		})
		.join("; ");

	c.res.headers.set("Set-Cookie", `session=; ${cookieString}`);
	console.log("Session cookie deleted successfully");
}

export async function handleRequest(c: Context) {
	console.log("Handling request");
	const request = c.req;
	const response = c.res;

	if (request.method !== "GET") {
		const origin = request.header("Origin");
		console.log("Non-GET request from origin:", origin);
		if (!origin || !CORS_ORIGINS.includes(origin)) {
			console.log("Invalid origin, returning 403");
			response.status = 403;
			return;
		}
	}

	const cookies = new Map(
		request
			.header("Cookie")
			?.split(";")
			.map((cookie) => {
				const [key, value] = cookie.trim().split("=");
				return [key, value];
			}) || [],
	);

	const token = cookies.get("session");
	if (!token) {
		console.log("No session token found, returning 401");
		response.status = 401;
		return;
	}

	console.log("Validating session token from cookie");
	const result = await validateSessionToken(token);
	if (!result.session) {
		console.log("Invalid session, deleting cookie and returning 401");
		deleteSessionTokenCookie(c);
		response.status = 401;
		return;
	}
	console.log("Session valid, refreshing cookie");
	setSessionTokenCookie(c, token, result.session.expiresAt);
}

export async function signOut(c: Context) {
	console.log("Processing sign out request");
	try {
		const cookies = new Map(
			c.req
				.header("Cookie")
				?.split(";")
				.map((cookie) => {
					const [key, value] = cookie.trim().split("=");
					return [key, value];
				}) || [],
		);

		const token = cookies.get("session");
		if (!token) {
			console.log("No session token found for sign out");
			return c.json({ error: "No session found" }, 400);
		}

		console.log("Validating session before sign out");
		const result = await validateSessionToken(token);
		if (result.session) {
			console.log("Invalidating session:", result.session.id);
			await invalidateSession(result.session.id);
		}

		console.log("Deleting session cookie");
		deleteSessionTokenCookie(c);
		return c.json({ success: true });
	} catch (error) {
		console.error("Error signing out:", error);
		return c.text(`Error: ${(error as Error).message}`, 500);
	}
}

export async function updateUser(c: Context) {
	console.log("Processing user update request");
	try {
		const userRes = await getAuthenticatedUser(c);
		console.log("Authenticated user:", userRes);
		const response: User = await c.res.json();
		console.log("Update data:", response);

		await db.update(user).set(response).where(eq(user.id, userRes.id));
		console.log("User updated successfully");

		return c.json({ success: true });
	} catch (error) {
		console.error("Error updating user:", error);
		return c.text(`Error: ${(error as Error).message}`, 500);
	}
}
