const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const { Role, EventOrganizerType } = require("@prisma/client");
const prisma = require("../config/prisma");
const { auth, authorize } = require("../middleware/auth");
const { getPagination } = require("../utils/pagination");
const { uploadBuffer } = require("../utils/cloudinary");
const { sendEmail } = require("../utils/email");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(8),
  organizerType: z.enum([
    EventOrganizerType.CLUB,
    EventOrganizerType.DEPARTMENT,
    EventOrganizerType.FACULTY,
    EventOrganizerType.ADMIN,
  ]),
  organizerName: z.string().min(2),
  location: z.string().min(2),
  eventDate: z.string(),
});

router.post("/", auth, authorize(Role.FACULTY, Role.ADMIN, Role.ALUMNI), upload.single("image"), async (req, res, next) => {
  try {
    if (req.user.role === Role.ALUMNI && !req.user.isVerifiedAlumni) {
      return res.status(403).json({ message: "Only verified alumni can create events" });
    }
    const payload = eventSchema.parse(req.body);
    const eventDate = new Date(payload.eventDate);
    if (Number.isNaN(eventDate.getTime())) {
      return res.status(400).json({
        message: "Invalid event date — pick a date and time, or send ISO-8601 (e.g. 2026-04-15T14:00:00).",
      });
    }
    let imageUrl;
    if (req.file) {
      imageUrl = await uploadBuffer(req.file.buffer, "college-connect/events");
    }
    const event = await prisma.event.create({
      data: {
        ...payload,
        eventDate,
        imageUrl,
        createdById: req.user.id,
      },
    });

    const users = await prisma.user.findMany({ select: { email: true } });
    await Promise.allSettled(
      users.map((u) =>
        sendEmail({
          to: u.email,
          subject: `New College Event: ${event.title}`,
          html: `<p>${event.description}</p><p><strong>Date:</strong> ${event.eventDate.toISOString()}</p>`,
        }),
      ),
    );
    res.status(201).json(event);
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [items, total] = await Promise.all([
      prisma.event.findMany({
        skip,
        take: limit,
        orderBy: { eventDate: "asc" },
        include: { createdBy: { select: { id: true, name: true, role: true } } },
      }),
      prisma.event.count(),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

router.post("/:eventId/register", auth, authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const registration = await prisma.eventRegistration.upsert({
      where: { eventId_studentId: { eventId: req.params.eventId, studentId: req.user.id } },
      create: { eventId: req.params.eventId, studentId: req.user.id },
      update: {},
    });
    res.status(201).json(registration);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
