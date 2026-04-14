import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { apiUnreachableUserMessage } from "../lib/apiBase";
import { Button, Card, Input } from "../components/ui";
import { useAuthStore } from "../store/auth";
import { GraduationCap } from "lucide-react";

export function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { identifier: identifier.trim(), password });
      setAuth(data.token, data.user);
      navigate("/dashboard");
    } catch (err: any) {
      const net = err.code === "ERR_NETWORK" || err.message === "Network Error";
      setError(
        err.response?.data?.message ||
          (net ? apiUnreachableUserMessage() : null) ||
          "Login failed",
      );
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
          <h1 className="text-2xl font-bold text-(--text-primary)">Unified College Connect</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">Sign in to your account to continue</p>
        </div>

        <Card className="overflow-hidden">
          {/* Card header stripe */}
          <div className="bg-primary px-5 py-3">
            <p className="text-sm font-semibold text-white">Student / Alumni / Faculty Login</p>
          </div>
          <div className="p-6">
            <form onSubmit={onSubmit} className="form-grid">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Email or username</label>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@mgit.ac.in or your_username"
                  type="text"
                  autoComplete="username"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Password</label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
              </div>
              {error && (
                <p className="rounded-md border border-(--danger-border) bg-(--danger-bg) px-3 py-2 text-sm text-(--danger)">
                  {error}
                </p>
              )}
              <Button className="mt-1 w-full" type="submit">
                Sign In
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-(--text-secondary)">
              New user?{" "}
              <Link to="/register" className="font-semibold text-primary hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
