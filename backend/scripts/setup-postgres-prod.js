require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), override: true });
const { execSync } = require("child_process");

const run = (command) => {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: "inherit" });
};

try {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
    throw new Error("Set DATABASE_URL to a PostgreSQL connection string before running this script.");
  }

  // Uses PostgreSQL-specific schema without touching local SQLite schema.
  run("npx prisma generate --schema prisma/schema.postgres.prisma");
  // No migration history in repo yet — sync schema (use `migrate dev` locally when you add migrations).
  const acceptLoss =
    process.env.PRISMA_ACCEPT_DATA_LOSS === "1" ? " --accept-data-loss" : "";
  run(`npx prisma db push --schema prisma/schema.postgres.prisma${acceptLoss}`);

  console.log("\nPostgreSQL production setup complete.");
} catch (error) {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
}
