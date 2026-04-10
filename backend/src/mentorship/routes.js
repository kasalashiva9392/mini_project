const express = require("express");
const { z } = require("zod");
const { Role, MentorshipStatus, ChatRoomKind } = require("@prisma/client");
const prisma = require("../config/prisma");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

const requestSchema = z.object({
  mentorId: z.string().min(1),
  message: z.string().optional(),
});

router.post("/request", auth, authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const payload = requestSchema.parse(req.body);
    const mentor = await prisma.user.findUnique({ where: { id: payload.mentorId } });
    if (!mentor || (mentor.role !== Role.ALUMNI && mentor.role !== Role.FACULTY)) {
      return res.status(404).json({ message: "Mentor not found" });
    }
    if (mentor.role === Role.ALUMNI && !mentor.isVerifiedAlumni) {
      return res.status(400).json({ message: "Mentor alumni is not verified yet" });
    }
    if (!mentor.mentorshipAvailable) {
      return res.status(400).json({ message: "Mentor is not accepting requests" });
    }

    const request = await prisma.mentorshipRequest.create({
      data: {
        studentId: req.user.id,
        mentorId: payload.mentorId,
        message: payload.message,
      },
      include: { student: true, mentor: true },
    });
    res.status(201).json(request);
  } catch (e) {
    next(e);
  }
});

router.get("/:mentorId", auth, async (req, res, next) => {
  try {
    if (req.user.role !== Role.ADMIN && req.user.id !== req.params.mentorId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const requests = await prisma.mentorshipRequest.findMany({
      where: { mentorId: req.params.mentorId },
      include: { student: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (e) {
    next(e);
  }
});

router.post("/:requestId/approve", auth, async (req, res, next) => {
  try {
    const request = await prisma.mentorshipRequest.findUnique({
      where: { id: req.params.requestId },
    });
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (req.user.role !== Role.ADMIN && req.user.id !== request.mentorId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await prisma.mentorshipRequest.update({
      where: { id: request.id },
      data: { status: MentorshipStatus.APPROVED },
    });

    await prisma.chatRoom.upsert({
      where: { mentorshipRequestId: request.id },
      create: {
        kind: ChatRoomKind.MENTORSHIP,
        mentorshipRequestId: request.id,
        mentorId: request.mentorId,
        studentId: request.studentId,
        members: {
          create: [{ userId: request.studentId }, { userId: request.mentorId }],
        },
      },
      update: {},
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.get("/chat/rooms/me", auth, async (req, res, next) => {
  try {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        kind: ChatRoomKind.MENTORSHIP,
        ...(req.user.role === Role.STUDENT
          ? { studentId: req.user.id }
          : { mentorId: req.user.id }),
      },
      include: {
        mentor: { select: { id: true, name: true, role: true } },
        student: { select: { id: true, name: true, role: true } },
      },
    });
    res.json(rooms);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
