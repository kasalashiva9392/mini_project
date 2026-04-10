const express = require("express");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const { z } = require("zod");
const prisma = require("../config/prisma");
const { auth } = require("../middleware/auth");
const { Role } = require("@prisma/client");
const { isLLMConfigured, chatCompletion } = require("../utils/openaiChat");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const SKILL_KEYWORDS = [
  "javascript",
  "typescript",
  "react",
  "nodejs",
  "express",
  "python",
  "java",
  "sql",
  "postgresql",
  "mongodb",
  "aws",
  "docker",
  "system design",
  "dsa",
  "communication",
];

const extractText = async (file) => {
  if (!file) return "";
  if (file.mimetype === "application/pdf") {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy();
    }
  }
  if (
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.originalname.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || "";
  }
  return file.buffer.toString("utf-8");
};

const parseSkills = (text) => {
  const lc = text.toLowerCase();
  return SKILL_KEYWORDS.filter((s) => lc.includes(s));
};

router.post("/resume-analyzer", auth, upload.single("resume"), async (req, res, next) => {
  try {
    const targetRole = (req.body.targetRole || "Software Engineer").toString();
    const text = await extractText(req.file);
    const foundSkills = parseSkills(text);
    const alumni = await prisma.user.findMany({
      where: { role: Role.ALUMNI, isVerifiedAlumni: true },
      select: { id: true, name: true, skills: true, company: true, domain: true },
    });

    const alumniTopSkills = alumni
      .flatMap((a) => a.skills.split(",").map((s) => s.trim().toLowerCase()))
      .filter(Boolean);

    const missingFromAlumni = [...new Set(alumniTopSkills)].filter(
      (s) => !foundSkills.includes(s) && s.length > 2,
    );

    const suggestions = [];
    if (!text.toLowerCase().includes("project")) suggestions.push("Add 2-3 measurable project bullets.");
    if (!text.toLowerCase().includes("experience")) suggestions.push("Include practical experience/internship details.");
    if (!text.toLowerCase().includes("education")) suggestions.push("Add concise education section with GPA/achievements.");
    if (foundSkills.length < 5) suggestions.push("Add more role-aligned technical skills to increase ATS relevance.");

    let chatgpt = null;
    if (isLLMConfigured()) {
      if (text.trim()) {
        try {
          const { text: feedback, model } = await chatCompletion({
            system:
              "You are a concise resume coach for university students. Respond in markdown with short sections: **Strengths**, **Gaps vs target role**, **Top 3 improvements**. Be specific. Under 400 words.",
            user: `Target role: ${targetRole}\n\nResume text:\n${text.slice(0, 14000)}`,
            maxTokens: 900,
          });
          chatgpt = { feedback, model };
        } catch (gptErr) {
          chatgpt = {
            error: gptErr.message || "GPT feedback failed",
            note: "Detected skills and checklist suggestions above do not require GPT.",
          };
        }
      } else {
        chatgpt = { hint: "Upload a resume file to get LLM feedback (Ollama or OpenAI)." };
      }
    } else {
      chatgpt = {
        disabled: true,
        hint: "Set OLLAMA_BASE_URL (e.g. http://127.0.0.1:11434) or OPENAI_API_KEY in backend .env for AI resume feedback.",
      };
    }

    res.json({
      targetRole,
      extractedSkills: foundSkills,
      missingSkills: missingFromAlumni.slice(0, 8),
      suggestions,
      alumniBenchmarks: alumni.slice(0, 5),
      chatgpt,
    });
  } catch (e) {
    next(e);
  }
});

const chatBodySchema = z.object({
  message: z.string().min(1).max(12000),
});

router.post("/chat", auth, async (req, res, next) => {
  try {
    const { message } = chatBodySchema.parse(req.body);
    if (!isLLMConfigured()) {
      return res.status(503).json({
        message:
          "No LLM configured. Set OLLAMA_BASE_URL (e.g. http://127.0.0.1:11434) or OPENAI_API_KEY in the backend environment.",
      });
    }
    const { text, model } = await chatCompletion({
      system:
        "You are a helpful career and academic advisor for a university platform (students, alumni, faculty). Be concise, practical, and encouraging. Use markdown when it helps readability.",
      user: message,
      maxTokens: 1200,
    });
    res.json({ reply: text, model });
  } catch (e) {
    next(e);
  }
});

router.post("/skill-matcher", auth, async (req, res, next) => {
  try {
    const payload = z.object({ studentId: z.string().optional() }).parse(req.body || {});
    const studentId = payload.studentId || req.user.id;

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const studentSkills = student.skills
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const mentors = await prisma.user.findMany({
      where: {
        mentorshipAvailable: true,
        OR: [{ role: Role.ALUMNI, isVerifiedAlumni: true }, { role: Role.FACULTY }],
      },
      select: {
        id: true,
        name: true,
        role: true,
        company: true,
        domain: true,
        skills: true,
      },
    });

    const scored = mentors
      .map((mentor) => {
        const mentorSkills = mentor.skills
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const overlap = mentorSkills.filter((s) => studentSkills.includes(s));
        const score = overlap.length * 10 + (mentor.role === Role.ALUMNI ? 5 : 3);
        return {
          mentor,
          score,
          overlap,
          missingSkillsToLearn: mentorSkills.filter((s) => !studentSkills.includes(s)).slice(0, 5),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    res.json({ studentId, studentSkills, matches: scored });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
