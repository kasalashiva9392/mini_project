import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api } from "../api/client";
import { Button, Card, Input, Textarea } from "../components/ui";

type ResumeResult = {
  targetRole: string;
  extractedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  alumniBenchmarks: { id: string; name: string; skills: string; company?: string; domain?: string }[];
  chatgpt?: {
    feedback?: string;
    model?: string;
    hint?: string;
    error?: string;
    note?: string;
    disabled?: boolean;
  };
};

type SkillMatchResult = {
  studentId: string;
  studentSkills: string[];
  matches: {
    mentor: { id: string; name: string; role: string; company?: string; domain?: string; skills: string };
    score: number;
    overlap: string[];
    missingSkillsToLearn: string[];
  }[];
};

export function AiToolsPage() {
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeResult, setResumeResult] = useState<ResumeResult | null>(null);

  const [chatMessage, setChatMessage] = useState("");
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [chatModel, setChatModel] = useState<string | null>(null);

  const [skillResult, setSkillResult] = useState<SkillMatchResult | null>(null);

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("targetRole", targetRole);
      if (resumeFile) fd.append("resume", resumeFile);
      const { data } = await api.post<ResumeResult>("/ai/resume-analyzer", fd);
      return data;
    },
    onSuccess: (data) => setResumeResult(data),
  });

  const chatMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ reply: string; model: string }>("/ai/chat", {
        message: chatMessage.trim(),
      });
      return data;
    },
    onSuccess: (data) => {
      setChatReply(data.reply);
      setChatModel(data.model);
    },
  });

  const skillMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<SkillMatchResult>("/ai/skill-matcher", {});
      return data;
    },
    onSuccess: (data) => setSkillResult(data),
  });

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" aria-hidden />
          <div>
            <h1 className="page-title">AI tools</h1>
            <p className="page-subtitle">
              Resume insights, mentor matching, and career Q&amp;A. Configure{" "}
              <code className="rounded bg-primary-light px-1 text-xs">OLLAMA_BASE_URL</code> (local Ollama) or{" "}
              <code className="rounded bg-primary-light px-1 text-xs">OPENAI_API_KEY</code> on the server — Ollama is
              used first when set.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="soft-panel form-grid">
          <h2 className="text-base font-semibold">Resume analyzer</h2>
          <p className="text-xs text-(--text-secondary)">
            Upload PDF or DOCX. You get keyword skills, suggestions, and optional GPT feedback if configured.
          </p>
          <Input
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="Target role (e.g. Software Engineer)"
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="text-sm text-(--text-secondary) file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            onClick={() => resumeMutation.mutate()}
            disabled={resumeMutation.isPending}
          >
            {resumeMutation.isPending ? "Analyzing…" : "Analyze resume"}
          </Button>
          {resumeMutation.isError && (
            <p className="text-sm text-(--danger)">
              {(resumeMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Request failed"}
            </p>
          )}
          {resumeResult && (
            <div className="mt-2 space-y-3 rounded-lg border border-(--border) bg-primary-light/30 p-3 text-sm">
              <p>
                <span className="font-semibold">Detected skills:</span> {resumeResult.extractedSkills.join(", ") || "—"}
              </p>
              {resumeResult.suggestions.length > 0 && (
                <ul className="list-inside list-disc space-y-1">
                  {resumeResult.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
              {resumeResult.chatgpt?.feedback && (
                <div className="prose prose-sm max-w-none border-t border-(--border) pt-2">
                  <p className="text-xs font-semibold text-(--text-muted)">GPT feedback {resumeResult.chatgpt.model && `(${resumeResult.chatgpt.model})`}</p>
                  <pre className="whitespace-pre-wrap font-sans text-(--text-primary)">{resumeResult.chatgpt.feedback}</pre>
                </div>
              )}
              {resumeResult.chatgpt?.hint && (
                <p className="text-xs text-(--text-muted)">{resumeResult.chatgpt.hint}</p>
              )}
              {resumeResult.chatgpt?.error && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <p className="font-medium">GPT section</p>
                  <p className="mt-1">{resumeResult.chatgpt.error}</p>
                  {resumeResult.chatgpt.note && (
                    <p className="mt-2 text-amber-900/90">{resumeResult.chatgpt.note}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="soft-panel form-grid">
          <h2 className="text-base font-semibold">Career assistant (chat)</h2>
          <p className="text-xs text-(--text-secondary)">Ask short questions about careers, interviews, or academics.</p>
          <Textarea
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="e.g. How should I prepare for a backend internship interview?"
            rows={4}
            className="min-h-[100px]"
          />
          <Button
            type="button"
            onClick={() => chatMutation.mutate()}
            disabled={chatMutation.isPending || !chatMessage.trim()}
          >
            {chatMutation.isPending ? "Thinking…" : "Ask"}
          </Button>
          {chatMutation.isError && (
            <p className="text-sm text-(--danger)">
              {(chatMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Chat failed"}
            </p>
          )}
          {chatReply && (
            <div className="rounded-lg border border-(--border) bg-white p-3 text-sm">
              {chatModel && <p className="mb-2 text-xs text-(--text-muted)">Model: {chatModel}</p>}
              <pre className="whitespace-pre-wrap font-sans text-(--text-primary)">{chatReply}</pre>
            </div>
          )}
        </Card>

        <Card className="soft-panel form-grid lg:col-span-2">
          <h2 className="text-base font-semibold">Skill–mentor matcher</h2>
          <p className="text-xs text-(--text-secondary)">
            Compare your profile skills with mentors and alumni who offer mentorship. Uses overlap scoring.
          </p>
          <Button type="button" onClick={() => skillMutation.mutate()} disabled={skillMutation.isPending}>
            {skillMutation.isPending ? "Matching…" : "Find mentor matches for my profile"}
          </Button>
          {skillMutation.isError && (
            <p className="text-sm text-(--danger)">Could not load matches.</p>
          )}
          {skillResult && (
            <div className="grid gap-3 md:grid-cols-2">
              {skillResult.matches.map((m, idx) => (
                <div key={m.mentor.id} className="rounded-lg border border-(--border) bg-primary-light/20 p-3 text-sm">
                  <p className="font-semibold">
                    #{idx + 1} {m.mentor.name}{" "}
                    <span className="text-xs font-normal text-(--text-muted)">({m.mentor.role})</span>
                  </p>
                  <p className="text-xs text-(--text-muted)">Score: {m.score}</p>
                  <p className="mt-1 text-xs">
                    <span className="font-medium">Overlap:</span> {m.overlap.join(", ") || "—"}
                  </p>
                  {m.missingSkillsToLearn.length > 0 && (
                    <p className="mt-1 text-xs text-(--text-secondary)">
                      Skills to explore: {m.missingSkillsToLearn.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
