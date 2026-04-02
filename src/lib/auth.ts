import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { compare, hash } from "bcryptjs";
import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "jira_lite_session";
const SESSION_TTL_DAYS = 14;

function getSessionExpiry() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_TTL_DAYS);
  return expiry;
}

export async function createUserSession(userId: string) {
  const token = randomBytes(48).toString("hex");
  const expiresAt = getSessionExpiry();

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireManager() {
  const user = await requireUser();
  if (user.role !== UserRole.MANAGER) redirect("/sign-in");
  return user;
}

export async function registerManager(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.MANAGER,
    },
  });

  await createUserSession(user.id);
  return user;
}

export async function loginManager(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("Invalid credentials.");
  }

  if (user.role !== UserRole.MANAGER) {
    throw new Error("Only Manager accounts can sign in right now.");
  }

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    throw new Error("Invalid credentials.");
  }

  await createUserSession(user.id);
  return user;
}
