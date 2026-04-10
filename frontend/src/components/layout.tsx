import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { sanitizeUser } from "../utils/sanitizeUser";
import { Badge, Button } from "./ui";
import { GraduationCap } from "lucide-react";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

export function AppShell({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const hydratedForToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      hydratedForToken.current = null;
      return;
    }
    if (hydratedForToken.current === token) return;
    hydratedForToken.current = token;
    let cancelled = false;
    api
      .get("/users/me")
      .then((res) => {
        if (cancelled) return;
        setAuth(token, sanitizeUser(res.data as Record<string, unknown>));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, setAuth]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-40 bg-primary shadow-[0_2px_8px_rgba(0,53,107,0.25)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-0 md:px-8">
          {/* Brand */}
          <div className="flex items-center gap-2.5 py-3 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/15">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-white">Unified College Connect</p>
              <p className="text-[10px] text-white/60 uppercase tracking-widest">Career Acceleration Ecosystem</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex flex-1 flex-wrap items-center justify-center gap-0.5 text-sm py-0">
            <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
            <NavLink to="/alumni" className={navLinkClass}>Alumni</NavLink>
            <NavLink to="/mentorship" className={navLinkClass}>Mentorship</NavLink>
            <NavLink to="/events" className={navLinkClass}>Events</NavLink>
            <NavLink to="/ai-tools" className={navLinkClass}>AI tools</NavLink>
            <NavLink to="/chat" className={navLinkClass}>Chat</NavLink>
            <NavLink to="/profile" className={navLinkClass}>Profile</NavLink>
            {user?.role === "ADMIN" && (
              <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>
            )}
          </nav>

          {/* User controls */}
          <div className="flex items-center gap-2 shrink-0 py-3">
            <Badge variant="secondary" className="border-white/30 bg-white/15 text-white text-[10px] uppercase tracking-wide">
              {user?.role}
            </Badge>
            <Button
              variant="nav-ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
