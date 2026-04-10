const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const { auth, authorize } = require("../middleware/auth");
const { Role, ChatRoomKind } = require("@prisma/client");
const { userCanAccessRoomById } = require("../lib/chatRoomAccess");

const router = express.Router();

const roomInclude = {
  student: { select: { id: true, name: true, role: true } },
  mentor: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  members: {
    include: { user: { select: { id: true, username: true, name: true, role: true, email: true } } },
  },
};

router.get("/rooms/me", auth, async (req, res, next) => {
  try {
    const uid = req.user.id;
    const rooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          {
            kind: ChatRoomKind.MENTORSHIP,
            OR: [{ studentId: uid }, { mentorId: uid }],
          },
          {
            kind: { in: [ChatRoomKind.DIRECT, ChatRoomKind.GROUP] },
            members: { some: { userId: uid } },
          },
        ],
      },
      include: roomInclude,
      orderBy: { createdAt: "desc" },
    });
    const shaped = rooms.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      student: r.student,
      mentor: r.mentor,
      createdBy: r.createdBy,
      members: r.members?.map((m) => m.user) ?? [],
      label: roomLabel(r, uid),
    }));
    res.json(shaped);
  } catch (e) {
    next(e);
  }
});

function roomLabel(room, viewerId) {
  if (room.kind === ChatRoomKind.GROUP) {
    return room.name || "Group";
  }
  if (room.kind === ChatRoomKind.MENTORSHIP) {
    return `${room.student?.name ?? "?"} ↔ ${room.mentor?.name ?? "?"}`;
  }
  const others = (room.members || [])
    .map((m) => m.user)
    .filter((u) => u && u.id !== viewerId);
  if (others.length === 1) {
    const o = others[0];
    return o.username ? `@${o.username}` : o.name;
  }
  return "Direct message";
}

router.post("/direct", auth, async (req, res, next) => {
  try {
    const body = z
      .object({
        peerId: z.string().optional(),
        peerUsername: z.string().optional(),
      })
      .parse(req.body);

    let peerId = body.peerId?.trim();
    if (!peerId && body.peerUsername?.trim()) {
      const { normalizeUsernameInput } = require("../utils/username");
      const u = normalizeUsernameInput(body.peerUsername);
      const peer = await prisma.user.findUnique({ where: { username: u } });
      if (!peer) return res.status(404).json({ message: "User not found" });
      peerId = peer.id;
    }
    if (!peerId) return res.status(400).json({ message: "peerId or peerUsername required" });

    if (peerId === req.user.id) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }
    const peer = await prisma.user.findUnique({ where: { id: peerId } });
    if (!peer) return res.status(404).json({ message: "User not found" });

    const existing = await prisma.chatRoom.findMany({
      where: {
        kind: ChatRoomKind.DIRECT,
        members: { some: { userId: req.user.id } },
      },
      include: { members: true },
    });
    const found = existing.find(
      (r) => r.members.length === 2 && r.members.some((m) => m.userId === peerId),
    );
    if (found) {
      const full = await prisma.chatRoom.findUnique({
        where: { id: found.id },
        include: roomInclude,
      });
      return res.json(full);
    }

    const room = await prisma.chatRoom.create({
      data: {
        kind: ChatRoomKind.DIRECT,
        members: {
          create: [{ userId: req.user.id }, { userId: peerId }],
        },
      },
      include: roomInclude,
    });
    res.status(201).json(room);
  } catch (e) {
    next(e);
  }
});

router.post(
  "/groups",
  auth,
  authorize(Role.FACULTY, Role.ADMIN),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          name: z.string().min(1).max(120),
          memberIds: z.array(z.string()).max(40).default([]),
          memberUsernames: z.array(z.string()).max(40).default([]),
        })
        .parse(req.body);

      const { normalizeUsernameInput } = require("../utils/username");
      const fromNames = [];
      for (const raw of body.memberUsernames) {
        const u = normalizeUsernameInput(raw);
        if (!u) continue;
        const nu = await prisma.user.findUnique({ where: { username: u }, select: { id: true } });
        if (nu) fromNames.push(nu.id);
      }

      const ids = [...new Set([req.user.id, ...body.memberIds, ...fromNames])];
      const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
      if (users.length !== ids.length) {
        return res.status(400).json({ message: "One or more users not found" });
      }

      const room = await prisma.chatRoom.create({
        data: {
          kind: ChatRoomKind.GROUP,
          name: body.name,
          createdById: req.user.id,
          members: {
            create: ids.map((userId) => ({ userId })),
          },
        },
        include: roomInclude,
      });
      res.status(201).json(room);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/room/:roomId/messages", auth, async (req, res, next) => {
  try {
    const room = await prisma.chatRoom.findUnique({
      where: { id: req.params.roomId },
      include: { members: true },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (!(await userCanAccessRoomById(req.user.id, room.id))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const messages = await prisma.message.findMany({
      where: { roomId: req.params.roomId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    res.json(messages);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
