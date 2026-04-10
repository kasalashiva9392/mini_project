import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Button, Card, Input, Textarea } from "../components/ui";

function formatCreateEventError(err: unknown): string {
  if (!isAxiosError(err)) return "Could not create event.";
  const data = err.response?.data as { message?: string; errors?: { path: (string | number)[]; message: string }[] };
  if (data?.errors?.length) {
    return [data.message || "Validation failed", ...data.errors.map((e) => `${e.path.join(".")}: ${e.message}`)].join(
      " — ",
    );
  }
  return data?.message || err.message || "Could not create event.";
}

export function EventsPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");

  const { data } = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await api.get("/events")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const organizerType =
        user?.role === "ADMIN" ? "ADMIN" : user?.role === "FACULTY" ? "FACULTY" : "FACULTY";
      const { data: created } = await api.post("/events", {
        title: title.trim(),
        description: description.trim(),
        organizerType,
        organizerName: (user?.name || "Organizer").trim(),
        location: location.trim(),
        eventDate,
      });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setTitle("");
      setDescription("");
      setLocation("");
      setEventDate("");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await api.post(`/events/${eventId}/register`);
    },
  });

  const canCreate = user?.role === "ADMIN" || user?.role === "FACULTY" || user?.role === "ALUMNI";

  const titleOk = title.trim().length >= 3;
  const descOk = description.trim().length >= 8;
  const locOk = location.trim().length >= 2;
  const dateOk = Boolean(eventDate);
  const canSubmitCreate = canCreate && titleOk && descOk && locOk && dateOk;

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Events & Registrations</h1>
        <p className="page-subtitle">Create and join workshops, meetups, and career acceleration events.</p>
      </div>
      {canCreate && (
        <Card className="soft-panel form-grid">
          <h2 className="font-semibold">Create Event</h2>
          <p className="text-xs text-(--text-secondary)">
            Title ≥ 3 characters, description ≥ 8, location ≥ 2. Choose date &amp; time.{" "}
            {user?.role === "ALUMNI" && !user?.isVerifiedAlumni && (
              <span className="text-(--danger)">Verified alumni only can publish events.</span>
            )}
          </p>
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !canSubmitCreate}
          >
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
          {createMutation.isError && (
            <p className="text-sm text-(--danger)" role="alert">
              {formatCreateEventError(createMutation.error)}
            </p>
          )}
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.items?.map((event: any) => (
          <Card key={event.id} className="soft-panel">
            <h3 className="font-semibold">{event.title}</h3>
            <p className="text-sm text-slate-600">{event.description}</p>
            <p className="mt-1 text-xs text-slate-500">{new Date(event.eventDate).toLocaleString()} • {event.location}</p>
            {user?.role === "STUDENT" && (
              <Button className="mt-3" onClick={() => registerMutation.mutate(event.id)}>
                Register
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
