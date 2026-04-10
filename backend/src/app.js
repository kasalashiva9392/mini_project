const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const env = require("./config/env");
const { getCorsOptions } = require("./lib/corsConfig");
const authRoutes = require("./auth/routes");
const userRoutes = require("./users/routes");
const alumniRoutes = require("./alumni/routes");
const mentorshipRoutes = require("./mentorship/routes");
const postRoutes = require("./posts/routes");
const eventRoutes = require("./events/routes");
const aiRoutes = require("./ai/routes");
const chatRoutes = require("./chat/routes");
const adminRoutes = require("./admin/routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(cors(getCorsOptions(env)));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/alumni", alumniRoutes);
app.use("/mentorship", mentorshipRoutes);
app.use("/posts", postRoutes);
app.use("/events", eventRoutes);
app.use("/ai", aiRoutes);
app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);

app.use(errorHandler);

module.exports = app;
