import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { io, Socket } from "socket.io-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Search, Users, X } from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Button, Card, Input, Textarea } from "../components/ui";
import { getApiBaseUrl } from "../lib/apiBase";

type ChatRoomRow = {
  id: string;
  kind: "MENTORSHIP" | "DIRECT" | "GROUP";
  name: string | null;
  label: string;
  members: { id: string; username?: string; name: string; email?: string; role: string }[];
};

type Msg = {
  id: string;
  roomId: string;
  content: string;
  sender: { id: string; name: string; role: string };
};

type SearchUser = { id: string; username: string; name: string; role: string };

function conversationLine(r: ChatRoomRow, myId: string): string {
  if (r.kind === "DIRECT") {
    const other = r.members?.find((m) => m.id !== myId);
    if (other?.username) return `@${other.username}`;
    if (other?.name) return other.name;
  }
  if (r.kind === "GROUP") {
    return (r.name && r.name.trim()) || r.label || "Group";
  }
  return r.label || "Chat";
}

export function ChatPage() {
  const { user, token } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState("");
  const [chatText, setChatText] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMemberUsernames, setGroupMemberUsernames] = useState("");
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const selectedRoomRef = useRef("");
  selectedRoomRef.current = selectedRoom;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim().replace(/^@/, "").toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const { data: searchResult } = useQuery({
    queryKey: ["userSearch", "chat", debouncedQ],
    queryFn: async () =>
      (await api.get<{ items: SearchUser[] }>("/users/search", { params: { q: debouncedQ } })).data,
    enabled: !!user && debouncedQ.length >= 1,
  });

  const socket: Socket | null = useMemo(() => {
    if (!token) return null;
    return io(getApiBaseUrl(), {
      autoConnect: false,
      auth: { token },
    });
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    socket.connect();

    const onMsg = (msg: Msg) => {
      if (msg.roomId === selectedRoomRef.current) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const onConnect = () => {
      const id = selectedRoomRef.current;
      if (id) socket.emit("join_room", { roomId: id });
    };

    socket.on("new_message", onMsg);
    socket.on("connect", onConnect);
    if (socket.connected && selectedRoomRef.current) {
      socket.emit("join_room", { roomId: selectedRoomRef.current });
    }

    return () => {
      socket.off("new_message", onMsg);
      socket.off("connect", onConnect);
      socket.disconnect();
    };
  }, [socket]);

  const { data: rooms } = useQuery({
    queryKey: ["chatRooms"],
    queryFn: async () => (await api.get<ChatRoomRow[]>("/chat/rooms/me")).data,
    enabled: !!user,
  });

  useEffect(() => {
    if (!rooms?.length || !selectedRoom) return;
    if (!rooms.some((r) => r.id === selectedRoom)) setSelectedRoom("");
  }, [rooms, selectedRoom]);

  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }
    const roomId = selectedRoom;
    const ac = new AbortController();
    setMessagesLoading(true);

    api
      .get<Msg[]>(`/chat/room/${roomId}/messages`, { signal: ac.signal })
      .then((res) => {
        if (selectedRoomRef.current !== roomId) return;
        setMessages(res.data);
      })
      .catch(() => {
        if (selectedRoomRef.current !== roomId) return;
        setMessages([]);
      })
      .finally(() => {
        if (selectedRoomRef.current === roomId) setMessagesLoading(false);
      });

    socket?.emit("join_room", { roomId });

    return () => ac.abort();
  }, [selectedRoom, socket]);

  const directMutation = useMutation({
    mutationFn: async (payload: { peerUsername: string } | { peerId: string }) => {
      const { data } = await api.post("/chat/direct", payload);
      return data as { id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chatRooms"] });
      setSelectedRoom(data.id);
      setSearchQ("");
      setDebouncedQ("");
      queryClient.removeQueries({ queryKey: ["userSearch"] });
    },
  });

  const groupMutation = useMutation({
    mutationFn: async () => {
      const memberUsernames = groupMemberUsernames
        .split(/[,\s]+/)
        .map((s) => s.trim().replace(/^@/, ""))
        .filter(Boolean);
      const { data } = await api.post("/chat/groups", {
        name: groupName.trim(),
        memberIds: [],
        memberUsernames,
      });
      return data as { id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chatRooms"] });
      setSelectedRoom(data.id);
      setGroupName("");
      setGroupMemberUsernames("");
      setGroupSheetOpen(false);
    },
  });

  const sendMessage = () => {
    if (!selectedRoom || !chatText.trim()) return;
    socket?.emit("send_message", { roomId: selectedRoom, content: chatText.trim() });
    setChatText("");
  };

  const openDmByUsername = (uname: string) => {
    const u = uname.trim().replace(/^@/, "");
    if (!u) return;
    directMutation.mutate({ peerUsername: u });
  };

  const searchUsernameForDm = () => {
    const raw = searchQ.trim().replace(/^@/, "");
    if (raw.length < 3 || !/^[a-z0-9_]+$/.test(raw)) return;
    openDmByUsername(raw);
  };

  const canSubmitUsernameSearch =
    searchQ.trim().replace(/^@/, "").length >= 3 && /^[a-z0-9_]+$/.test(searchQ.trim().replace(/^@/, ""));

  const canCreateGroup = user?.role === "FACULTY" || user?.role === "ADMIN";

  useEffect(() => {
    if (!groupSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [groupSheetOpen]);

  useEffect(() => {
    if (!groupSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGroupSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupSheetOpen]);

  const selectedRoomData = rooms?.find((r) => r.id === selectedRoom);
  const chatHeading =
    selectedRoom && user
      ? selectedRoomData
        ? conversationLine(selectedRoomData, user.id)
        : rooms === undefined
          ? "Loading conversation…"
          : ""
      : "";

  return (
    <div className={`page-shell ${canCreateGroup ? "pb-28" : ""}`}>
      <div className="page-header">
        <h1 className="page-title">Messages</h1>
        <p className="page-subtitle">
          Mentorship chats appear here after approval; faculty and admins can create groups from the bottom bar.
        </p>
      </div>

      <div className="relative z-20 mb-4 rounded-xl border border-(--border) bg-(--surface) p-3 shadow-[var(--shadow-sm)]">
        <div className="relative min-w-0">
          <div className="flex gap-2 items-stretch">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)"
                aria-hidden
              />
              <Input
                value={searchQ}
                onChange={(e) =>
                  setSearchQ(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_@\s.-]/g, "")
                      .replace(/\s{2,}/g, " "),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (!canSubmitUsernameSearch) return;
                  e.preventDefault();
                  searchUsernameForDm();
                }}
                placeholder="Name or @username — pick from list, or type a handle and Search"
                autoComplete="off"
                className="w-full pl-9"
              />
            </div>
            <Button
              type="button"
              className="shrink-0 sm:min-w-[7.5rem]"
              onClick={searchUsernameForDm}
              disabled={directMutation.isPending || !canSubmitUsernameSearch}
            >
              {directMutation.isPending ? "…" : "Search"}
            </Button>
          </div>
          {debouncedQ.length >= 1 && searchResult?.items && searchResult.items.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-(--border) bg-white text-sm shadow-[var(--shadow-md)]">
              {searchResult.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-primary-light/40"
                    onClick={() => openDmByUsername(item.username)}
                    disabled={directMutation.isPending}
                  >
                    <span className="text-sm font-semibold text-(--text-primary)">{item.name}</span>
                    <span className="font-mono text-xs text-(--text-muted)">@{item.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {debouncedQ.length >= 1 && searchResult?.items?.length === 0 && (
            <p className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-(--border) bg-white px-3 py-2 text-xs text-(--text-muted) shadow-[var(--shadow-sm)]">
              No matches. Try another spelling, or type an exact @username and use Search to open a DM.
            </p>
          )}
        </div>
        {directMutation.isError && (
          <p className="mt-2 text-xs text-(--danger)">
            {(directMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
              "Failed"}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          {user && rooms && rooms.length > 0 ? (
            <Card className="soft-panel">
              <h2 className="mb-3 text-base font-semibold">Your conversations</h2>
              <ul className="max-h-[min(60vh,24rem)] space-y-1 overflow-y-auto">
                {rooms.map((r) => {
                  const line = conversationLine(r, user.id);
                  const active = selectedRoom === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRoom(r.id)}
                        className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-mono transition-colors ${
                          active
                            ? "bg-primary text-white"
                            : "bg-white text-(--text-primary) hover:bg-primary-light/60 border border-(--border)"
                        }`}
                      >
                        {line}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </div>

        <Card className="soft-panel flex min-h-[420px] flex-col">
          <h2 className="min-h-[1.75rem] border-b border-(--border) pb-2 text-base font-semibold font-mono text-(--text-primary)">
            {chatHeading}
          </h2>
          <div className="flex-1 overflow-y-auto rounded-md border border-(--border) bg-primary-light/20 p-3 my-3">
            {messagesLoading && (
              <p className="mb-2 text-xs text-(--text-muted)">Loading messages…</p>
            )}
            {!messagesLoading && selectedRoom && messages.length === 0 && (
              <p className="text-sm text-(--text-secondary)">
                No messages yet. Say hello below — history loads here for this chat.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="mb-2 text-sm">
                <span className="font-medium text-primary">{m.sender?.name}: </span>
                <span className="text-(--text-primary)">{m.content}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Type message…"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            />
            <Button type="button" onClick={sendMessage} disabled={!selectedRoom}>
              Send
            </Button>
          </div>
        </Card>
      </div>

      {canCreateGroup &&
        createPortal(
          <>
            <div
              className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
              style={{ visibility: groupSheetOpen ? "hidden" : "visible" }}
            >
              <div className="pointer-events-auto w-full max-w-md">
                <button
                  type="button"
                  onClick={() => setGroupSheetOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-t-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-[0_-6px_28px_rgba(0,53,107,0.28)] transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <Users className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
                  Create group
                  <ChevronUp className="h-4 w-4 shrink-0 opacity-85" aria-hidden />
                </button>
              </div>
            </div>

            {groupSheetOpen && (
              <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                <button
                  type="button"
                  className="animate-ucc-chat-backdrop absolute inset-0 bg-black/45"
                  aria-label="Close"
                  onClick={() => setGroupSheetOpen(false)}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="create-group-title"
                  className="animate-ucc-chat-sheet relative z-[1] mx-auto flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-(--border) bg-(--surface) shadow-[var(--shadow-md)]"
                >
                  <div className="flex max-h-full flex-col overflow-hidden p-5">
                    <div className="mb-1 flex shrink-0 items-center justify-between gap-3">
                      <h2 id="create-group-title" className="text-lg font-semibold text-(--text-primary)">
                        Create group
                      </h2>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-(--text-secondary) hover:bg-primary-light"
                        onClick={() => setGroupSheetOpen(false)}
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="mb-4 shrink-0 text-xs text-(--text-secondary)">
                      Faculty and admins only. You are added automatically. List members as @usernames separated by
                      commas or spaces.
                    </p>
                    <div className="form-grid min-h-0 flex-1 overflow-y-auto pb-1">
                      <Input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Group name"
                        autoFocus
                      />
                      <Textarea
                        value={groupMemberUsernames}
                        onChange={(e) => setGroupMemberUsernames(e.target.value)}
                        placeholder="@alice, bob_dev, carol"
                        rows={4}
                        className="min-h-[100px] font-mono text-sm"
                      />
                      <Button
                        type="button"
                        onClick={() => groupMutation.mutate()}
                        disabled={groupMutation.isPending || !groupName.trim()}
                        className="w-full sm:w-auto"
                      >
                        {groupMutation.isPending ? "Creating…" : "Create group"}
                      </Button>
                      {groupMutation.isError && (
                        <p className="text-xs text-(--danger)">
                          {(groupMutation.error as { response?: { data?: { message?: string } } })?.response?.data
                            ?.message || "Failed"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body,
        )}
    </div>
  );
}
