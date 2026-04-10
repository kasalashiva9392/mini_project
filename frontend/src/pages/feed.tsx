import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PenLine, X } from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Button, Card, Input, Textarea } from "../components/ui";

export function FeedPage() {
  const user = useAuthStore((s) => s.user);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("QUERY");

  const { data, refetch } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => (await api.get("/posts")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/posts", { title, content, type });
    },
    onSuccess: () => {
      refetch();
      setComposerOpen(false);
      setTitle("");
      setContent("");
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      await api.post(`/posts/${postId}/like`);
    },
    onSuccess: () => refetch(),
  });

  useEffect(() => {
    if (!composerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setComposerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [composerOpen]);

  const optionsByRole: Record<string, string[]> = {
    STUDENT: ["QUERY"],
    ALUMNI: ["QUERY", "JOB"],
    FACULTY: ["QUERY", "ACADEMIC"],
    ADMIN: ["QUERY", "ANNOUNCEMENT"],
  };

  const options = optionsByRole[user?.role || "STUDENT"];

  return (
    <div className="page-shell pb-24">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your feed — share updates, opportunities, and questions with your campus community.</p>
      </div>

      <div className="space-y-4">
        {data?.items?.map((post: any) => (
          <Card key={post.id} className="soft-panel">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{post.title}</h3>
              <span className="text-xs text-slate-500">{post.type}</span>
            </div>
            <p className="mt-2 text-sm">{post.content}</p>
            <p className="mt-2 text-xs text-slate-500">By {post.author?.name}</p>
            <Button className="mt-3" onClick={() => likeMutation.mutate(post.id)}>
              Like ({post._count?.likes ?? 0})
            </Button>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 md:right-8 md:left-auto md:translate-x-0">
        <Button
          type="button"
          size="lg"
          className="h-12 rounded-full px-6 shadow-[var(--shadow-md)] gap-2"
          onClick={() => setComposerOpen(true)}
        >
          <PenLine className="h-4 w-4" aria-hidden />
          Create post
        </Button>
      </div>

      {composerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 pb-8 sm:items-center sm:p-6"
          role="presentation"
          onClick={() => setComposerOpen(false)}
        >
          <Card
            className="soft-panel form-grid relative z-10 w-full max-w-lg shadow-[var(--shadow-md)] sm:max-h-[min(90vh,40rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="composer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="composer-title" className="text-lg font-semibold text-(--text-primary)">
                Create post
              </h2>
              <button
                type="button"
                className="rounded-md p-1.5 text-(--text-secondary) transition hover:bg-primary-light hover:text-primary"
                aria-label="Close"
                onClick={() => setComposerOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Write your post..." value={content} onChange={(e) => setContent(e.target.value)} />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <Button
              className="w-full"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Publishing…" : "Publish"}
            </Button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
