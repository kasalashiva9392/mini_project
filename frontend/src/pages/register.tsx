import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { Button, Card, Input } from "../components/ui";
import { GraduationCap } from "lucide-react";

const roles = ["STUDENT", "ALUMNI", "FACULTY"] as const;

export function RegisterPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("STUDENT");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith("@mgit.ac.in")) {
      setError("Only @mgit.ac.in email addresses are allowed");
      return;
    }
    const u = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (u.length < 3 || u.length > 32) {
      setError("Username must be 3–32 characters (letters, numbers, underscore only)");
      return;
    }
    try {
      await api.post("/auth/register", { name, username: u, email: normalizedEmail, password, role });
      navigate("/login");
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-md">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-(--text-primary)">Create Your Account</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">Join your unified college ecosystem in minutes</p>
        </div>

        <Card className="overflow-hidden">
          <div className="bg-primary px-5 py-3">
            <p className="text-sm font-semibold text-white">New Member Registration</p>
          </div>
          <div className="p-6">
            <form onSubmit={onSubmit} className="form-grid">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Full Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="your_unique_handle"
                  className="font-mono"
                  autoComplete="username"
                />
                <p className="text-xs text-(--text-secondary)">Unique on this campus app. Others search you by this (3–32 chars).</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@mgit.ac.in" type="email" />
                <p className="text-xs text-(--text-secondary)">Only official college emails are allowed.</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Password</label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as (typeof roles)[number])}>
                  {roles.map((r) => (
                    <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              {error && (
                <p className="rounded-md border border-(--danger-border) bg-(--danger-bg) px-3 py-2 text-sm text-(--danger)">
                  {error}
                </p>
              )}
              <Button className="mt-1 w-full" type="submit">
                Create Account
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-(--text-secondary)">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
