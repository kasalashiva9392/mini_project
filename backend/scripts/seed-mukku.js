/**
 * Adds test student "Mukku" without wiping the database.
 * Run from backend: node scripts/seed-mukku.js
 */
const bcrypt = require("bcryptjs");
const { PrismaClient, Role } = require("@prisma/client");

const prisma = new PrismaClient();

const MUKKU = {
  name: "Mukku",
  username: "mukku",
  email: "mukku@mgit.ac.in",
  passwordPlain: "Password@123",
  department: "CSE",
  year: 2,
  batch: 2028,
  skills: "testing,chat",
  bio: "Test student for messaging.",
};

async function main() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: MUKKU.username }, { email: MUKKU.email }] },
  });

  const password = await bcrypt.hash(MUKKU.passwordPlain, 10);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: MUKKU.name,
        username: MUKKU.username,
        email: MUKKU.email,
        password,
        role: Role.STUDENT,
        department: MUKKU.department,
        year: MUKKU.year,
        batch: MUKKU.batch,
        skills: MUKKU.skills,
        bio: MUKKU.bio,
      },
    });
    console.log("Updated existing Mukku user.");
  } else {
    await prisma.user.create({
      data: {
        name: MUKKU.name,
        username: MUKKU.username,
        email: MUKKU.email,
        password,
        role: Role.STUDENT,
        department: MUKKU.department,
        year: MUKKU.year,
        batch: MUKKU.batch,
        skills: MUKKU.skills,
        bio: MUKKU.bio,
      },
    });
    console.log("Created Mukku user.");
  }

  console.log("");
  console.log("Log in as Mukku (or message from another account):");
  console.log(`  Email or username: ${MUKKU.email}  OR  ${MUKKU.username}`);
  console.log(`  Password: ${MUKKU.passwordPlain}`);
  console.log("");
  console.log("In Chat, search: mukku  or  Mukku  — then pick the row or open DM with handle mukku.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
