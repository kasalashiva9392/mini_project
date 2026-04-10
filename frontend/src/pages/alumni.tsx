import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, Input, Badge, Button } from "../components/ui";

function AlumniHandle({ username, id }: { username: string; id: string }) {
  const [copied, setCopied] = useState<"handle" | "id" | null>(null);
  const handle = `@${username}`;
  return (
    <div className="mt-3 space-y-2 border-t border-(--border) pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--text-muted)">Username</span>
        <code className="max-w-[min(100%,14rem)] truncate rounded bg-primary-light px-1.5 py-0.5 font-mono text-xs text-(--text-primary)">
          {handle}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => {
            void navigator.clipboard.writeText(username).then(() => {
              setCopied("handle");
              setTimeout(() => setCopied(null), 2000);
            });
          }}
        >
          {copied === "handle" ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--text-muted)">User ID</span>
        <code className="max-w-[min(100%,14rem)] truncate rounded bg-primary-light px-1.5 py-0.5 font-mono text-[10px] text-(--text-secondary)">
          {id}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => {
            void navigator.clipboard.writeText(id).then(() => {
              setCopied("id");
              setTimeout(() => setCopied(null), 2000);
            });
          }}
        >
          {copied === "id" ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function AlumniDirectoryPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["alumni", search],
    queryFn: async () => {
      const response = await api.get("/alumni", { params: { name: search, limit: 20 } });
      return response.data;
    },
  });

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Alumni Directory</h1>
        <p className="page-subtitle">
          Search mentors and alumni by name or <strong>@username</strong>. In <strong>Chat</strong>, start a DM or add
          group members using those usernames.
        </p>
      </div>
      <Input
        placeholder="Search by name, company, skills..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isLoading ? (
        <p>Loading alumni...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.items?.map((alumni: { id: string; username?: string; name: string; company?: string; domain?: string; skills?: string; department?: string; batch?: number; isVerifiedAlumni?: boolean }) => (
            <Card key={alumni.id} className="soft-panel">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{alumni.name}</h3>
                  {alumni.username && (
                    <p className="font-mono text-xs text-(--text-muted)">@{alumni.username}</p>
                  )}
                </div>
                {alumni.isVerifiedAlumni && (
                  <Badge className="bg-emerald-100 text-emerald-700">Verified Alumni</Badge>
                )}
              </div>
              <p className="text-sm text-slate-600">
                {alumni.company || "N/A"} • {alumni.domain || "N/A"}
              </p>
              <p className="mt-2 text-sm">{alumni.skills}</p>
              <p className="mt-1 text-xs text-slate-500">
                {alumni.department} • Batch {alumni.batch ?? "-"}
              </p>
              {alumni.username ? (
                <AlumniHandle username={alumni.username} id={alumni.id} />
              ) : (
                <p className="mt-2 text-xs text-(--text-muted)">No username on file — ask them to set one in Profile.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
