import crypto from "crypto";
import { pool } from "./db";
import { nextId } from "./ids";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export async function getUserByUsername(username) {
  const { rows } = await pool.query(
    "SELECT user_id, name, username, password_hash, role, is_active FROM users WHERE username = $1",
    [username.trim().toLowerCase()]
  );
  return rows[0] || null;
}

export async function authenticateUser(username, password) {
  const user = await getUserByUsername(username);
  if (!user || !user.is_active) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return { userId: user.user_id, name: user.name, role: user.role };
}

export async function listUsers() {
  const { rows } = await pool.query(
    "SELECT user_id, name, username, role, is_active, created_at FROM users ORDER BY created_at ASC"
  );
  return rows;
}

export async function createUser({ name, username, password, role }) {
  const normalizedUsername = username.trim().toLowerCase();
  const existing = await getUserByUsername(normalizedUsername);
  if (existing) {
    throw new Error("That username is already taken.");
  }
  const userId = await nextId("users", "user_id", "USR-");
  await pool.query(
    "INSERT INTO users (user_id, name, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    [userId, name.trim(), normalizedUsername, hashPassword(password), role]
  );
  return userId;
}

async function activeAdminCount(excludingUserId) {
  const { rows } = await pool.query(
    "SELECT count(*) FROM users WHERE role = 'admin' AND is_active = true AND user_id != $1",
    [excludingUserId]
  );
  return Number(rows[0].count);
}

export async function setUserActive(userId, isActive) {
  if (!isActive) {
    const { rows } = await pool.query("SELECT role FROM users WHERE user_id = $1", [userId]);
    const user = rows[0];
    if (user?.role === "admin" && (await activeAdminCount(userId)) === 0) {
      throw new Error("Cannot deactivate the last active admin.");
    }
  }
  await pool.query("UPDATE users SET is_active = $1 WHERE user_id = $2", [isActive, userId]);
}

export async function setUserRole(userId, role) {
  if (role !== "admin") {
    const { rows } = await pool.query("SELECT role FROM users WHERE user_id = $1", [userId]);
    const user = rows[0];
    if (user?.role === "admin" && (await activeAdminCount(userId)) === 0) {
      throw new Error("Cannot remove the last active admin.");
    }
  }
  await pool.query("UPDATE users SET role = $1 WHERE user_id = $2", [role, userId]);
}

export async function setUserPassword(userId, newPassword) {
  const { rows } = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE user_id = $2 RETURNING name, username",
    [hashPassword(newPassword), userId]
  );
  return rows[0] || null;
}
