const express = require("express");
const { z } = require("zod");
const { Role } = require("@prisma/client");
const prisma = require("../config/prisma");
const { auth, authorize } = require("../middleware/auth");
const { getPagination } = require("../utils/pagination");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const {
      name,
      batch,
      department,
      year,
      skills,
      company,
      domain,
    } = req.query;

    const term = name ? String(name).trim() : "";
    const where = {
      role: Role.ALUMNI,
      ...(term
        ? {
            OR: [
              { username: { contains: term.toLowerCase() } },
              { name: { contains: term } },
            ],
          }
        : {}),
      ...(batch ? { batch: Number(batch) } : {}),
      ...(department ? { department: { contains: department, mode: "insensitive" } } : {}),
      ...(year ? { year: Number(year) } : {}),
      ...(skills ? { skills: { contains: skills, mode: "insensitive" } } : {}),
      ...(company ? { company: { contains: company, mode: "insensitive" } } : {}),
      ...(domain ? { domain: { contains: domain, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          name: true,
          department: true,
          batch: true,
          year: true,
          company: true,
          domain: true,
          skills: true,
          bio: true,
          profilePicture: true,
          isVerifiedAlumni: true,
          mentorshipAvailable: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, role: Role.ALUMNI },
      select: {
        id: true,
        name: true,
        department: true,
        batch: true,
        year: true,
        company: true,
        domain: true,
        skills: true,
        bio: true,
        socialLinks: true,
        profilePicture: true,
        isVerifiedAlumni: true,
        mentorshipAvailable: true,
      },
    });
    if (!user) return res.status(404).json({ message: "Alumni not found" });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  company: z.string().optional(),
  domain: z.string().optional(),
  skills: z.string().optional(),
  bio: z.string().optional(),
  mentorshipAvailable: z.boolean().optional(),
});

router.put("/:id", auth, authorize(Role.ALUMNI, Role.ADMIN), async (req, res, next) => {
  try {
    const payload = updateSchema.parse(req.body);
    if (req.user.role === Role.ALUMNI && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "You can only update your profile" });
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: payload,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
