const express = require("express");
const { z } = require("zod");
const multer = require("multer");
const prisma = require("../config/prisma");
const { auth } = require("../middleware/auth");
const { uploadBuffer } = require("../utils/cloudinary");
const { usernameSchema, normalizeUsernameInput } = require("../utils/username");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/** Empty string clears the field; undefined leaves it unchanged. */
const emptyToNull = (v) => {
  if (v === "" || v === null) return null;
  if (v === undefined) return undefined;
  return v;
};

const updateProfileSchema = z.object({
  name: z.string().optional(),
  department: z.string().optional(),
  batch: z.number().optional().nullable(),
  year: z.number().optional().nullable(),
  skills: z.string().optional(),
  bio: z.string().optional(),
  age: z.number().int().min(1).max(120).optional().nullable(),
  gender: z.string().max(64).optional().nullable(),
  education: z.string().max(500).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  currentPosition: z.string().max(200).optional().nullable(),
  experience: z.string().max(5000).optional().nullable(),
  socialLinks: z.string().optional(),
  company: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  mentorshipAvailable: z.boolean().optional(),
});

router.get("/search", auth, async (req, res, next) => {
  try {
    const q = (req.query.q ?? req.query.query ?? "").toString().trim().toLowerCase();
    if (q.length < 1) return res.json({ items: [] });

    const usernameOnly =
      req.query.usernameOnly === "1" ||
      req.query.usernameOnly === "true" ||
      req.query.by === "username";

    const items = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        ...(usernameOnly
          ? { username: { contains: q } }
          : { OR: [{ username: { contains: q } }, { name: { contains: q } }] }),
      },
      take: 30,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        department: true,
        profilePicture: true,
      },
      orderBy: { name: "asc" },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

router.put("/me", auth, upload.single("profilePicture"), async (req, res, next) => {
  try {
    let age;
    if (req.body.age === "") age = null;
    else if (req.body.age === undefined || req.body.age === null) age = undefined;
    else {
      const n = Number(req.body.age);
      age = Number.isNaN(n) ? undefined : n;
    }

    let usernameUpdate;
    if (req.body.username !== undefined && req.body.username !== null && req.body.username !== "") {
      usernameUpdate = usernameSchema.parse(req.body.username);
      const taken = await prisma.user.findFirst({
        where: { username: usernameUpdate, NOT: { id: req.user.id } },
      });
      if (taken) {
        return res.status(409).json({ message: "Username already taken" });
      }
    }

    const { username: _u, ...bodyForProfile } = req.body;

    const payload = updateProfileSchema.parse({
      ...bodyForProfile,
      batch:
        req.body.batch === "" || req.body.batch === null
          ? null
          : req.body.batch === undefined
            ? undefined
            : Number(req.body.batch),
      year:
        req.body.year === "" || req.body.year === null
          ? null
          : req.body.year === undefined
            ? undefined
            : Number(req.body.year),
      age,
      gender: emptyToNull(req.body.gender),
      education: emptyToNull(req.body.education),
      location: emptyToNull(req.body.location),
      currentPosition: emptyToNull(req.body.currentPosition),
      experience: emptyToNull(req.body.experience),
      company: emptyToNull(req.body.company),
      domain: emptyToNull(req.body.domain),
      mentorshipAvailable:
        req.body.mentorshipAvailable !== undefined
          ? req.body.mentorshipAvailable === "true" || req.body.mentorshipAvailable === true
          : undefined,
    });

    const updateData = { ...payload };
    if (usernameUpdate !== undefined) updateData.username = usernameUpdate;

    if (req.file) {
      const imageUrl = await uploadBuffer(req.file.buffer, "college-connect/profiles");
      updateData.profilePicture = imageUrl;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
