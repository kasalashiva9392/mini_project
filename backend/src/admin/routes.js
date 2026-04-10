const express = require("express");
const { z } = require("zod");
const { Role } = require("@prisma/client");
const prisma = require("../config/prisma");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();
const logsSelect = {
  id: true,
  actorEmail: true,
  action: true,
  targetUserId: true,
  targetRole: true,
  metadata: true,
  createdAt: true,
};

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPresetDateRange = (preset) => {
  const now = new Date();
  const end = new Date(now);
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start, to: end };
  }
  if (preset === "7d" || preset === "30d") {
    const days = preset === "7d" ? 7 : 30;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return { from: start, to: end };
  }
  return { from: null, to: null };
};

const buildAuditWhere = (query) => {
  const actorEmail = query.actorEmail ? String(query.actorEmail).trim() : "";
  const action = query.action ? String(query.action).trim() : "";
  const preset = query.preset ? String(query.preset).trim() : "";
  const presetRange = getPresetDateRange(preset);
  const from = parseDateSafe(query.from) || presetRange.from;
  const to = parseDateSafe(query.to) || presetRange.to;
  const where = {
    ...(actorEmail ? { actorEmail: { contains: actorEmail } } : {}),
    ...(action ? { action } : {}),
  };

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  return where;
};

const getAuditOrderBy = (query) => {
  const sortBy = query.sortBy ? String(query.sortBy).trim() : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  const allowedSortFields = new Set(["createdAt", "actorEmail", "action", "targetRole"]);
  const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";
  return { [safeSortBy]: sortOrder };
};

const toCsvCell = (value) => {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
};

const createAuditLog = async ({ actor, action, targetUserId, targetRole, metadata }) => {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      targetUserId,
      targetRole,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
};

router.get("/users", auth, authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        batch: true,
        year: true,
        isVerifiedAlumni: true,
        mentorshipAvailable: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

router.get("/stats", auth, authorize(Role.ADMIN), async (_req, res, next) => {
  try {
    const [students, alumni, faculty, admins, unverifiedAlumni] = await Promise.all([
      prisma.user.count({ where: { role: Role.STUDENT } }),
      prisma.user.count({ where: { role: Role.ALUMNI } }),
      prisma.user.count({ where: { role: Role.FACULTY } }),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.user.count({ where: { role: Role.ALUMNI, isVerifiedAlumni: false } }),
    ]);
    res.json({ students, alumni, faculty, admins, unverifiedAlumni });
  } catch (e) {
    next(e);
  }
});

router.get("/audit-logs", auth, authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const where = buildAuditWhere(req.query);
    const orderBy = getAuditOrderBy(req.query);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: logsSelect,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/audit-logs/export", auth, authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const where = buildAuditWhere(req.query);
    const orderBy = getAuditOrderBy(req.query);
    const logs = await prisma.auditLog.findMany({
      where,
      take: 1000,
      orderBy,
      select: logsSelect,
    });

    const header = ["createdAt", "actorEmail", "action", "targetRole", "targetUserId", "metadata"];
    const rows = logs.map((log) =>
      [
        toCsvCell(new Date(log.createdAt).toISOString()),
        toCsvCell(log.actorEmail),
        toCsvCell(log.action),
        toCsvCell(log.targetRole),
        toCsvCell(log.targetUserId),
        toCsvCell(log.metadata),
      ].join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"audit-logs.csv\"");
    res.status(200).send(csv);
  } catch (e) {
    next(e);
  }
});

router.put("/verify-alumni", auth, authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const payload = z.object({ alumniId: z.string(), verified: z.boolean().default(true) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: payload.alumniId } });
    if (!user || user.role !== Role.ALUMNI) {
      return res.status(404).json({ message: "Alumni user not found" });
    }
    const updated = await prisma.user.update({
      where: { id: payload.alumniId },
      data: { isVerifiedAlumni: payload.verified },
    });
    await createAuditLog({
      actor: req.user,
      action: payload.verified ? "VERIFY_ALUMNI" : "UNVERIFY_ALUMNI",
      targetUserId: updated.id,
      targetRole: updated.role,
      metadata: { name: updated.name, email: updated.email },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete("/remove-user", auth, authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const payload = z.object({ userId: z.string() }).parse(req.body);
    if (payload.userId === req.user.id) {
      return res.status(400).json({ message: "Admin cannot remove own account" });
    }
    const target = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!target) return res.status(404).json({ message: "User not found" });

    await prisma.user.delete({ where: { id: payload.userId } });
    await createAuditLog({
      actor: req.user,
      action: "REMOVE_USER",
      targetUserId: target.id,
      targetRole: target.role,
      metadata: { name: target.name, email: target.email },
    });
    res.json({ message: "User removed" });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
