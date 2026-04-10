const { z } = require("zod");

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores are allowed")
  .transform((s) => s.toLowerCase());

function normalizeUsernameInput(raw) {
  if (raw === undefined || raw === null) return "";
  return String(raw).trim().replace(/^@+/, "").toLowerCase();
}

/**
 * When the client omits username, derive a unique handle from the email local-part
 * (same idea as scripts/backfill-usernames.js).
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function generateUniqueUsernameFromEmail(prisma, email) {
  const local = String(email)
    .split("@")[0]
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  let base = (local || "user").toLowerCase().slice(0, 24);
  let n = 0;
  for (;;) {
    const candidate = (n === 0 ? base : `${base}_${n}`).slice(0, 32);
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
    n += 1;
    if (n > 10_000) {
      throw new Error("Could not allocate a unique username; try again.");
    }
  }
}

module.exports = { usernameSchema, normalizeUsernameInput, generateUniqueUsernameFromEmail };
