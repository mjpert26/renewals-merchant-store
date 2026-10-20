import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import type { User } from "@/lib/domain/types";
import { DomainError } from "@/lib/domain/errors";
import type { Actor } from "@/lib/domain/audit";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createToken, verifyToken } from "./token";

type UserRow = { id: string; email: string; name: string; role: "merchant" | "admin"; title: string | null; merchant_id: string | null };

function findUser(id: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, title: row.title, merchantId: row.merchant_id };
}

export function listDemoUsers(): User[] {
  return (getDb().prepare("SELECT * FROM users ORDER BY role DESC, name").all() as UserRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    title: row.title,
    merchantId: row.merchant_id,
  }));
}

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifyToken(token);
  if (!payload) return null;
  return findUser(payload.uid);
});

export async function startSession(userId: string) {
  if (!findUser(userId)) throw new DomainError("not_found", "That demo account does not exist.");
  (await cookies()).set(SESSION_COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export function toActor(user: User): Actor {
  return { id: user.id, name: user.name };
}

// ----- Page guards (redirect) -----

export async function requireMerchantPage(): Promise<User & { merchantId: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "merchant" || !user.merchantId) redirect("/admin");
  return user as User & { merchantId: string };
}

export async function requireAdminPage(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}

// ----- Server Function / Route Handler guards (throw) -----

export async function requireMerchant(): Promise<User & { merchantId: string }> {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("unauthenticated", "Your session ended. Please sign in again.");
  if (user.role !== "merchant" || !user.merchantId) throw new DomainError("forbidden", "This action is only available to merchants.");
  return user as User & { merchantId: string };
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("unauthenticated", "Your session ended. Please sign in again.");
  if (user.role !== "admin") throw new DomainError("forbidden", "Staff access is required.");
  return user;
}
