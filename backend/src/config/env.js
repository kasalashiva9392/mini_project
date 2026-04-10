const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("5000"),
  /** Comma-separated browser origins. Required when NODE_ENV=production (set in process env). */
  CLIENT_URL: z.string().optional(),
  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  /** e.g. http://127.0.0.1:11434 — when set, chat + resume GPT use Ollama before OpenAI */
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;
const clientTrim = raw.CLIENT_URL?.trim();
if (!clientTrim) {
  if (raw.NODE_ENV === "production") {
    console.error("Invalid environment configuration:");
    console.error({
      CLIENT_URL: ["Required in production — set comma-separated frontend origins (e.g. https://app.example.com)"],
    });
    process.exit(1);
  }
  raw.CLIENT_URL = "http://localhost:5173";
} else {
  raw.CLIENT_URL = clientTrim;
}

module.exports = raw;
