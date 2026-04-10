/**
 * Assigns unique usernames to users with null username (from email local-part + suffix).
 * Run: node scripts/backfill-usernames.js
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { username: null } });
  for (const u of users) {
    const local = u.email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    let base = (local || "user").toLowerCase().slice(0, 24);
    let n = 0;
    while (true) {
      const suffix = n === 0 ? "" : `_${n}`;
      const candidate = `${base}${suffix}`.slice(0, 32);
      const taken = await prisma.user.findFirst({ where: { username: candidate } });
      if (!taken) {
        await prisma.user.update({ where: { id: u.id }, data: { username: candidate } });
        console.log(`${u.email} -> ${candidate}`);
        break;
      }
      n += 1;
    }
  }
  console.log("Backfill usernames done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
