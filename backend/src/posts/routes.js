const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const { Role, PostType } = require("@prisma/client");
const prisma = require("../config/prisma");
const { auth } = require("../middleware/auth");
const { uploadBuffer } = require("../utils/cloudinary");
const { getPagination } = require("../utils/pagination");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const postSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(5),
  type: z.enum([PostType.JOB, PostType.ACADEMIC, PostType.ANNOUNCEMENT, PostType.QUERY]),
});

const createAllowed = {
  [Role.ALUMNI]: [PostType.JOB, PostType.QUERY],
  [Role.FACULTY]: [PostType.ACADEMIC, PostType.QUERY],
  [Role.ADMIN]: [PostType.ANNOUNCEMENT, PostType.QUERY],
  [Role.STUDENT]: [PostType.QUERY],
};

router.post("/", auth, upload.single("image"), async (req, res, next) => {
  try {
    const payload = postSchema.parse(req.body);
    const allowed = createAllowed[req.user.role] || [];
    if (!allowed.includes(payload.type)) {
      return res.status(403).json({ message: "Role cannot create this post type" });
    }
    if (req.user.role === Role.ALUMNI && !req.user.isVerifiedAlumni && payload.type === PostType.JOB) {
      return res.status(403).json({ message: "Verified alumni required for job posts" });
    }

    let imageUrl;
    if (req.file) {
      imageUrl = await uploadBuffer(req.file.buffer, "college-connect/posts");
    }

    const post = await prisma.post.create({
      data: {
        title: payload.title,
        content: payload.content,
        type: payload.type,
        imageUrl,
        authorId: req.user.id,
      },
    });
    res.status(201).json(post);
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [items, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role: true,
              isVerifiedAlumni: true,
            },
          },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.post.count(),
    ]);
    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/like", auth, async (req, res, next) => {
  try {
    await prisma.postLike.upsert({
      where: { postId_userId: { postId: req.params.id, userId: req.user.id } },
      create: { postId: req.params.id, userId: req.user.id },
      update: {},
    });
    res.json({ message: "Post liked" });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/comment", auth, async (req, res, next) => {
  try {
    const payload = z.object({ content: z.string().min(1) }).parse(req.body);
    const comment = await prisma.comment.create({
      data: { postId: req.params.id, authorId: req.user.id, content: payload.content },
    });
    res.status(201).json(comment);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
