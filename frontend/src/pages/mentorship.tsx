import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Button, Card, Input } from "../components/ui";

export function MentorshipPage() {
  const [mentorId, setMentorId] = useState("");
  const [requestMsg, setRequestMsg] = useState("");

  const requestMutation = useMutation({
    mutationFn: async () => {
      await api.post("/mentorship/request", { mentorId, message: requestMsg });
    },
  });

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Mentorship</h1>
        <p className="page-subtitle">
          Request guidance from alumni or faculty. After approval, your conversation appears under{" "}
          <Link to="/chat" className="font-medium text-primary underline">
            Chat
          </Link>
          .
        </p>
      </div>
      <Card className="soft-panel form-grid max-w-lg">
        <h2 className="text-lg font-semibold">Request mentorship</h2>
        <p className="text-xs text-(--text-secondary)">Only students can send requests. Use the mentor&apos;s user ID.</p>
        <Input placeholder="Mentor ID" value={mentorId} onChange={(e) => setMentorId(e.target.value)} />
        <Input placeholder="Message" value={requestMsg} onChange={(e) => setRequestMsg(e.target.value)} />
        <Button onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>
          {requestMutation.isPending ? "Sending…" : "Send request"}
        </Button>
        {requestMutation.isSuccess && (
          <p className="text-sm text-emerald-600">Request sent. The mentor must approve it before a chat room is created.</p>
        )}
      </Card>
    </div>
  );
}
