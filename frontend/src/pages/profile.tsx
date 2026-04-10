import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { api } from "../api/client";
import { Button, Card, Input, Textarea, Badge } from "../components/ui";
import { useAuthStore } from "../store/auth";
import type { User } from "../types";
import { sanitizeUser } from "../utils/sanitizeUser";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">{label}</label>
      {children}
    </div>
  );
}

function appendProfileFormData(fd: FormData, fields: Record<string, string>) {
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const [username, setUsername] = useState(user?.username || "");
  const [name, setName] = useState(user?.name || "");
  const [age, setAge] = useState(user?.age != null ? String(user.age) : "");
  const [gender, setGender] = useState(user?.gender || "");
  const [education, setEducation] = useState(user?.education || "");
  const [location, setLocation] = useState(user?.location || "");
  const [currentPosition, setCurrentPosition] = useState(user?.currentPosition || "");
  const [skills, setSkills] = useState(user?.skills || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [experience, setExperience] = useState(user?.experience || "");
  const [company, setCompany] = useState(user?.company || "");
  const [domain, setDomain] = useState(user?.domain || "");
  const [message, setMessage] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username || "");
    setName(user.name);
    setAge(user.age != null ? String(user.age) : "");
    setGender(user.gender || "");
    setEducation(user.education || "");
    setLocation(user.location || "");
    setCurrentPosition(user.currentPosition || "");
    setSkills(user.skills || "");
    setBio(user.bio || "");
    setExperience(user.experience || "");
    setCompany(user.company || "");
    setDomain(user.domain || "");
  }, [
    user?.id,
    user?.username,
    user?.name,
    user?.age,
    user?.gender,
    user?.education,
    user?.location,
    user?.currentPosition,
    user?.skills,
    user?.bio,
    user?.experience,
    user?.company,
    user?.domain,
  ]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const buildTextFields = (u: User): Record<string, string> => {
    const base: Record<string, string> = {
      username,
      name,
      age,
      gender,
      education,
      location,
      currentPosition,
      skills,
      bio,
    };
    if (u.role === "ALUMNI" || u.role === "FACULTY") {
      base.experience = experience;
      base.company = company;
      base.domain = domain;
    }
    return base;
  };

  const mutation = useMutation({
    onMutate: () => {
      setMessage("");
      setPhotoError("");
    },
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const fields = buildTextFields(user);
      if (pendingFile) {
        const fd = new FormData();
        appendProfileFormData(fd, fields);
        fd.append("profilePicture", pendingFile);
        const { data } = await api.put("/users/me", fd);
        return data;
      }
      const { data } = await api.put("/users/me", fields);
      return data;
    },
    onSuccess: (raw) => {
      const updated = sanitizeUser(raw as Record<string, unknown>);
      if (token) setAuth(token, updated);
      setPendingFile(null);
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setMessage("Profile updated successfully");
      setPhotoError("");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setPhotoError(msg || "Could not update profile. Check image size or try again.");
    },
  });

  const displaySrc = previewUrl || user?.profilePicture || null;

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Image must be 5MB or smaller.");
      return;
    }
    setPhotoError("");
    setPendingFile(file);
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  if (!user) return null;

  const showProfessional = user.role === "ALUMNI" || user.role === "FACULTY";

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">
          Share your background so peers and mentors can connect with you more easily.
        </p>
      </div>

      <Card className="soft-panel form-grid">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex flex-col items-center gap-3 lg:items-start lg:shrink-0">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-2 border-(--border) bg-primary-light shadow-[var(--shadow-sm)]">
              {displaySrc ? (
                <img src={displaySrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-primary/40">
                  <UserRound className="h-16 w-16" strokeWidth={1.25} aria-hidden />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onPickPhoto}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {displaySrc ? "Change photo" : "Add photo"}
            </Button>
            {pendingFile && (
              <p className="max-w-[14rem] text-center text-xs text-(--text-secondary) lg:text-left">
                New photo selected — save profile to upload.
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{user.role}</Badge>
              {user.role === "ALUMNI" && user.isVerifiedAlumni && (
                <Badge className="bg-emerald-100 text-emerald-700">Verified Alumni</Badge>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" />
              </Field>
              <Field label="Username">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="your_handle"
                  className="font-mono"
                  autoComplete="username"
                />
                <p className="text-[11px] text-(--text-muted)">
                  Unique (3–32 chars: letters, numbers, underscore). Others find you by searching this. Share:{" "}
                  <strong>@{username || "…"}</strong>
                </p>
              </Field>
              <Field label="Email">
                <Input value={user.email} readOnly className="bg-primary-light/50 text-(--text-secondary)" />
              </Field>
              <Field label="Age">
                <Input
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="e.g. 21"
                />
              </Field>
              <Field label="Gender">
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Prefer not to say</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Education">
                <Input
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="Degree, field, institution"
                />
              </Field>
              <Field label="Location">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, state / country" />
              </Field>
              <Field label="Current position">
                <Input
                  value={currentPosition}
                  onChange={(e) => setCurrentPosition(e.target.value)}
                  placeholder="Role or title (e.g. Student, Engineer)"
                />
              </Field>
              <Field label="Skills">
                <Input
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Comma-separated skills"
                />
              </Field>
            </div>

            {showProfessional && (
              <div className="space-y-3 rounded-lg border border-(--border) bg-primary-light/30 p-4">
                <h3 className="text-sm font-semibold text-(--text-primary)">Professional background</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company / organization">
                    <Input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Employer or institution"
                    />
                  </Field>
                  <Field label="Domain / focus">
                    <Input
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="e.g. Software, Civil, Finance"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Experience">
                      <Textarea
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        placeholder="Roles, years of experience, key projects, or teaching focus…"
                        rows={5}
                        className="min-h-[120px]"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            <Field label="Bio">
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short introduction" rows={4} />
            </Field>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save profile"}
              </Button>
              {message && <p className="text-sm text-emerald-600">{message}</p>}
            </div>
            {photoError && <p className="text-sm text-(--danger)">{photoError}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
