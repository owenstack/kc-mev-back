import { env } from "cloudflare:workers";
import { sha256 } from "@oslojs/crypto/sha2";
import {
	encodeBase32LowerCaseNoPadding,
	encodeHexLowerCase,
} from "@oslojs/encoding";
import { AuthDataValidator } from "@telegram-auth/server";
import { urlStrToAuthDataMap } from "@telegram-auth/server";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../db";
import { type User, session, user } from "../db/schema";
import { getAuthenticatedUser } from "./helpers";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const SESSION_DURATION = MS_PER_DAY * 30;
const SESSION_REFRESH_THRESHOLD = MS_PER_DAY * 15;

const validator = new AuthDataValidator({ botToken: env.PROD_BOT_TOKEN });

export function generateSessionToken(): string {
	const bytes = new Uint8Array(32); // Increased from 20 to 32 bytes for better security
	crypto.getRandomValues(bytes);
	const token = encodeBase32LowerCaseNoPadding(bytes);
	return token;
}

export async function createSession(token: string, userId: number) {
	try {
		const sessionId = encodeHexLowerCase(
			sha256(new TextEncoder().encode(token)),
		);
		const now = new Date();
		const sessionData = {
			id: sessionId,
			userId,
			createdAt: now,
			expiresAt: new Date(now.getTime() + SESSION_DURATION),
			updatedAt: now,
		};
		await db.insert(session).values(sessionData);
		return { data: sessionData, error: null };
	} catch (error) {
		return { error: (error as Error).message, data: null };
	}
}

export async function validateSessionToken(token: string) {
	try {
		const sessionId = encodeHexLowerCase(
			sha256(new TextEncoder().encode(token)),
		);
		const result = await db
			.select({ user: user, session: session })
			.from(session)
			.innerJoin(user, eq(session.userId, user.id))
			.where(eq(session.id, sessionId));
		if (result.length < 1) {
			return { session: null, user: null, error: "Invalid session" };
		}
		const { user: userData, session: sessionData } = result[0];
		const now = Date.now();
		if (now >= sessionData.expiresAt.getTime()) {
			await db.delete(session).where(eq(session.id, sessionData.id));
			return { session: null, user: null, error: "Session expired" };
		}
		if (now >= sessionData.expiresAt.getTime() - SESSION_REFRESH_THRESHOLD) {
			const newExpiresAt = new Date(now + SESSION_DURATION);
			sessionData.expiresAt = newExpiresAt;
			await db
				.update(session)
				.set({
					expiresAt: newExpiresAt,
					updatedAt: new Date(),
				})
				.where(eq(session.id, sessionData.id));
		}
		return { session: sessionData, user: userData, error: null };
	} catch (error) {
		return { session: null, user: null, error: (error as Error).message };
	}
}

export async function invalidateSession(sessionId: string) {
	try {
		await db.delete(session).where(eq(session.id, sessionId));
		return { success: true };
	} catch (error) {
		return { error: (error as Error).message };
	}
}

export async function invalidateAllSessions(userId: number) {
	try {
		await db.delete(session).where(eq(session.userId, userId));
		return { success: true };
	} catch (error) {
		return { error: (error as Error).message };
	}
}

export function setSessionTokenCookie(
	c: Context,
	token: string,
	expiresAt: Date,
) {
	const cookieOptions = {
		httpOnly: true,
		sameSite: "none" as const,
		expires: expiresAt.toUTCString(),
		path: "/",
		secure: process.env.NODE_ENV === "production",
	};

	const cookieString = Object.entries(cookieOptions)
		.map(([key, value]) => `${key === "httpOnly" ? "HttpOnly" : key}=${value}`)
		.join("; ");

	c.res.headers.set("Set-Cookie", `session=${token}; ${cookieString}`);
}

export function deleteSessionTokenCookie(c: Context) {
	const cookieOptions = {
		httpOnly: true,
		sameSite: "Lax" as const,
		maxAge: "0",
		path: "/",
		secure: process.env.NODE_ENV === "production",
	};

	const cookieString = Object.entries(cookieOptions)
		.map(([key, value]) => `${key === "httpOnly" ? "HttpOnly" : key}=${value}`)
		.join("; ");

	c.res.headers.set("Set-Cookie", `session=; ${cookieString}`);
}

export async function handleRequest(c: Context) {
	const request = c.req;
	const response = c.res;
	const trustedOrigins = [env.DEV_FRONTEND_URL, env.PROD_FRONTEND_URL];

	if (request.method !== "GET") {
		const origin = request.header("Origin");
		if (!origin || !trustedOrigins.includes(origin)) {
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
		response.status = 401;
		return;
	}

	const result = await validateSessionToken(token);
	if (!result.session) {
		deleteSessionTokenCookie(c);
		response.status = 401;
		return;
	}
	setSessionTokenCookie(c, token, result.session.expiresAt);
}

export async function signUp(c: Context) {
	try {
		const data = urlStrToAuthDataMap(c.req.url);
		const tgUser = await validator.validate(data);
		if (!tgUser) {
			return c.text("Invalid user data", 400);
		}

		const userData = {
			id: tgUser.id,
			firstName: tgUser.first_name,
			lastName: tgUser.last_name,
			image: tgUser.photo_url,
			role: "user" as const,
			username: tgUser.username,
			isPremium: tgUser.is_premium,
		};

		await db.insert(user).values(userData);
		const sessionToken = generateSessionToken();
		const { error } = await createSession(sessionToken, tgUser.id);
		if (error) {
			return c.text(error, 500);
		}

		setSessionTokenCookie(
			c,
			sessionToken,
			new Date(Date.now() + SESSION_DURATION),
		);
		return c.json({ success: true });
	} catch (error) {
		return c.text(
			`Something went wrong. Error: ${(error as Error).message}`,
			500,
		);
	}
}

export async function signIn(c: Context) {
	try {
		const data = urlStrToAuthDataMap(c.req.url);
		const tgUser = await validator.validate(data);
		if (!tgUser) {
			return c.text("Invalid user data", 400);
		}

		const result = await db
			.select()
			.from(user)
			.where(eq(user.id, tgUser.id))
			.execute();
		if (result.length < 1) {
			return c.text("User not found", 404);
		}

		const sessionToken = generateSessionToken();
		const { error } = await createSession(sessionToken, tgUser.id);
		if (error) {
			return c.text(error, 500);
		}

		setSessionTokenCookie(
			c,
			sessionToken,
			new Date(Date.now() + SESSION_DURATION),
		);
		return c.json({ success: true });
	} catch (error) {
		return c.text(
			`Something went wrong. Error: ${(error as Error).message}`,
			500,
		);
	}
}

export async function signOut(c: Context) {
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
			return c.json({ error: "No session found" }, 400);
		}

		const result = await validateSessionToken(token);
		if (result.session) {
			await invalidateSession(result.session.id);
		}

		deleteSessionTokenCookie(c);
		return c.json({ success: true });
	} catch (error) {
		return c.text(
			`Something went wrong. Error: ${(error as Error).message}`,
			500,
		);
	}
}

export async function updateUser(c: Context) {
	try {
		const userRes = await getAuthenticatedUser(c);
		const response: User = await c.res.json();
		const updatedUser = {
			...response,
			updatedAt: new Date(),
		};

		await db.update(user).set(updatedUser).where(eq(user.id, userRes.id));

		return c.json({ success: true });
	} catch (error) {
		return c.text(
			`Something went wrong. Error: ${(error as Error).message}`,
			500,
		);
	}
}
