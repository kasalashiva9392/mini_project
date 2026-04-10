const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../config/prisma");
const { signToken } = require("../utils/jwt");
const { Role } = require("@prisma/client");
const {
  usernameSchema,
  normalizeUsernameInput,
  generateUniqueUsernameFromEmail,
} = require("../utils/username");

const router = express.Router();
const ALLOWED_EMAIL_DOMAIN = "@mgit.ac.in";

const registerSchema = z.object({
  name: z.string().min(2),
  /** Optional: if omitted, empty, or null, a unique username is generated from the email local-part. */
  username: z.preprocess(
    (v) =>
      v === null || v === undefined || v === "" ? undefined : typeof v === "string" ? v : String(v),
    z.string().optional(),
  ),
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase().trim())
    .refine((value) => value.endsWith(ALLOWED_EMAIL_DOMAIN), {
      message: `Only ${ALLOWED_EMAIL_DOMAIN} email addresses are allowed`,
    }),
  password: z.string().min(8),
  role: z.enum([Role.STUDENT, Role.ALUMNI, Role.FACULTY, Role.ADMIN]),
  department: z.string().optional(),
  batch: z.number().optional(),
  year: z.number().optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(1).optional(),
  email: z.string().optional(),
  password: z.string().min(8),
});

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const emailTaken = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailTaken) return res.status(409).json({ message: "Email already exists" });

    const rawUsername = data.username?.trim();
    let username;
    if (rawUsername) {
      username = usernameSchema.parse(rawUsername);
      const userTaken = await prisma.user.findUnique({ where: { username } });
      if (userTaken) return res.status(409).json({ message: "Username already taken" });
    } else {
      username = await generateUniqueUsernameFromEmail(prisma, data.email);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        username,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        department: data.department,
        batch: data.batch,
        year: data.year,
        isVerifiedAlumni: data.role !== Role.ALUMNI ? false : false,
      },
    });

    const token = signToken({ id: user.id, role: user.role });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerifiedAlumni: user.isVerifiedAlumni,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const rawId = (data.identifier || data.email || "").trim();
    if (!rawId) return res.status(400).json({ message: "Email or username required" });

    let user;
    if (rawId.includes("@")) {
      user = await prisma.user.findUnique({ where: { email: rawId.toLowerCase() } });
    } else {
      const u = normalizeUsernameInput(rawId);
      user = await prisma.user.findUnique({ where: { username: u } });
    }
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken({ id: user.id, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        batch: user.batch,
        year: user.year,
        skills: user.skills,
        bio: user.bio,
        age: user.age,
        gender: user.gender,
        education: user.education,
        location: user.location,
        currentPosition: user.currentPosition,
        experience: user.experience,
        company: user.company,
        domain: user.domain,
        profilePicture: user.profilePicture,
        mentorshipAvailable: user.mentorshipAvailable,
        isVerifiedAlumni: user.isVerifiedAlumni,
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
