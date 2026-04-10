import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Badge, Button, Card, Input } from "../components/ui";
import { useAuthStore } from "../store/auth";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "ALUMNI" | "FACULTY" | "ADMIN";
  department?: string;
  batch?: number;
  year?: number;
  isVerifiedAlumni: boolean;
};

type AuditLog = {
  id: string;
  actorEmail: string;
  action: string;
  targetUserId?: string;
  targetRole?: AdminUser["role"];
  metadata?: string;
  createdAt: string;
};

type DatePreset = "custom" | "today" | "7d" | "30d";
type AuditSortBy = "createdAt" | "actorEmail" | "action" | "targetRole";
type AuditSortOrder = "asc" | "desc";
type AuditColumn = "time" | "actor" | "action" | "targetRole" | "metadata";

type SavedAuditFilterPreset = {
  id: string;
  name: string;
  filters: {
    actorEmailFilter: string;
    actionFilter: string;
    fromDateFilter: string;
    toDateFilter: string;
    datePreset: DatePreset;
    sortBy: AuditSortBy;
    sortOrder: AuditSortOrder;
  };
};

const FILTER_PRESETS_STORAGE_KEY = "ucc_admin_audit_filter_presets";
const COLUMN_VISIBILITY_STORAGE_KEY = "ucc_admin_audit_column_visibility";

function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const loadSavedPresets = (): SavedAuditFilterPreset[] => {
  try {
    const raw = localStorage.getItem(FILTER_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadColumnVisibility = (): Record<AuditColumn, boolean> => {
  const defaults: Record<AuditColumn, boolean> = {
    time: true,
    actor: true,
    action: true,
    targetRole: true,
    metadata: true,
  };
  try {
    const raw = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
};

export function AdminPage() {
  const token = useAuthStore((s) => s.token);
  const [search, setSearch] = useState("");
  const [verifyDialogUser, setVerifyDialogUser] = useState<AdminUser | null>(null);
  const [removeDialogUser, setRemoveDialogUser] = useState<AdminUser | null>(null);
  const [actorEmailFilter, setActorEmailFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("custom");
  const [logsPage, setLogsPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [sortBy, setSortBy] = useState<AuditSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<AuditSortOrder>("desc");
  const [isExporting, setIsExporting] = useState(false);
  const [savedPresets, setSavedPresets] = useState<SavedAuditFilterPreset[]>(loadSavedPresets);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [selectedSavedPresetId, setSelectedSavedPresetId] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Record<AuditColumn, boolean>>(loadColumnVisibility);

  const debouncedActorEmailFilter = useDebouncedValue(actorEmailFilter, 350);

  useEffect(() => {
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const statsQuery = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
  });

  const usersQuery = useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => (await api.get("/admin/users")).data as AdminUser[],
  });

  const logsQuery = useQuery({
    queryKey: [
      "adminLogs",
      debouncedActorEmailFilter,
      actionFilter,
      fromDateFilter,
      toDateFilter,
      datePreset,
      logsPage,
      sortBy,
      sortOrder,
    ],
    queryFn: async () =>
      (
        await api.get("/admin/audit-logs", {
          params: {
            page: logsPage,
            limit: 20,
            sortBy,
            sortOrder,
            actorEmail: debouncedActorEmailFilter || undefined,
            action: actionFilter || undefined,
            preset: datePreset !== "custom" ? datePreset : undefined,
            from: fromDateFilter || undefined,
            to: toDateFilter || undefined,
          },
        })
      ).data as {
        items: AuditLog[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ alumniId, verified }: { alumniId: string; verified: boolean }) => {
      await api.put("/admin/verify-alumni", { alumniId, verified });
    },
    onSuccess: () => {
      setVerifyDialogUser(null);
      usersQuery.refetch();
      statsQuery.refetch();
      logsQuery.refetch();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete("/admin/remove-user", { data: { userId } });
    },
    onSuccess: () => {
      setRemoveDialogUser(null);
      usersQuery.refetch();
      statsQuery.refetch();
      logsQuery.refetch();
    },
  });

  const filteredUsers = (usersQuery.data || []).filter((u) => {
    const key = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(key) ||
      u.email.toLowerCase().includes(key) ||
      u.role.toLowerCase().includes(key)
    );
  });

  const handleExportCsv = async () => {
    if (!token) return;
    try {
      setIsExporting(true);
      const response = await api.get("/admin/audit-logs/export", {
        params: {
          sortBy,
          sortOrder,
          actorEmail: debouncedActorEmailFilter || undefined,
          action: actionFilter || undefined,
          preset: datePreset !== "custom" ? datePreset : undefined,
          from: fromDateFilter || undefined,
          to: toDateFilter || undefined,
        },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-logs.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const updateDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      setFromDateFilter("");
      setToDateFilter("");
    }
    setLogsPage(1);
    setPageInput("1");
  };

  const clearAllLogFilters = () => {
    setActorEmailFilter("");
    setActionFilter("");
    setFromDateFilter("");
    setToDateFilter("");
    setDatePreset("custom");
    setLogsPage(1);
    setPageInput("1");
  };

  const saveCurrentFiltersAsPreset = () => {
    const name = presetNameInput.trim();
    if (!name) return;
    const preset: SavedAuditFilterPreset = {
      id: `${Date.now()}`,
      name,
      filters: {
        actorEmailFilter,
        actionFilter,
        fromDateFilter,
        toDateFilter,
        datePreset,
        sortBy,
        sortOrder,
      },
    };
    setSavedPresets((prev) => [preset, ...prev].slice(0, 20));
    setPresetNameInput("");
  };

  const applySavedPreset = (presetId: string) => {
    setSelectedSavedPresetId(presetId);
    const preset = savedPresets.find((p) => p.id === presetId);
    if (!preset) return;
    const f = preset.filters;
    setActorEmailFilter(f.actorEmailFilter);
    setActionFilter(f.actionFilter);
    setFromDateFilter(f.fromDateFilter);
    setToDateFilter(f.toDateFilter);
    setDatePreset(f.datePreset);
    setSortBy(f.sortBy);
    setSortOrder(f.sortOrder);
    setLogsPage(1);
    setPageInput("1");
  };

  const deleteSavedPreset = () => {
    if (!selectedSavedPresetId) return;
    setSavedPresets((prev) => prev.filter((p) => p.id !== selectedSavedPresetId));
    setSelectedSavedPresetId("");
  };

  const handleSort = (column: "createdAt" | "actorEmail" | "action" | "targetRole") => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setLogsPage(1);
    setPageInput("1");
  };

  const renderSortLabel = (label: string, column: "createdAt" | "actorEmail" | "action" | "targetRole") => {
    if (sortBy !== column) return `${label} <>`;
    return `${label} ${sortOrder === "asc" ? "^" : "v"}`;
  };

  const goToPage = () => {
    const parsed = Number(pageInput);
    const totalPages = logsQuery.data?.totalPages || 1;
    if (!Number.isFinite(parsed)) return;
    const safePage = Math.min(Math.max(Math.floor(parsed), 1), totalPages);
    setLogsPage(safePage);
    setPageInput(String(safePage));
  };

  const toggleColumn = (column: AuditColumn) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Moderate users, verify alumni, and track governance through audit logs.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Students</p>
          <p className="text-2xl font-semibold">{statsQuery.data?.students ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Alumni</p>
          <p className="text-2xl font-semibold">{statsQuery.data?.alumni ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Faculty</p>
          <p className="text-2xl font-semibold">{statsQuery.data?.faculty ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Admins</p>
          <p className="text-2xl font-semibold">{statsQuery.data?.admins ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Unverified Alumni</p>
          <p className="text-2xl font-semibold">{statsQuery.data?.unverifiedAlumni ?? "-"}</p>
        </Card>
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Moderation Actions</h2>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." />
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{user.name}</td>
                  <td className="px-3 py-2 text-slate-600">{user.email}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{user.role}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{user.department || "-"}</td>
                  <td className="px-3 py-2">
                    {user.role === "ALUMNI" && user.isVerifiedAlumni ? (
                      <Badge variant="success">Verified Alumni</Badge>
                    ) : (
                      <Badge variant="outline">-</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {user.role === "ALUMNI" && (
                        <Button variant="outline" size="sm" onClick={() => setVerifyDialogUser(user)}>
                          {user.isVerifiedAlumni ? "Unverify" : "Verify"}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setRemoveDialogUser(user)}>
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Recent Admin Audit Logs</h2>
        <div className="grid gap-2 md:grid-cols-4">
          <Input
            value={presetNameInput}
            onChange={(e) => setPresetNameInput(e.target.value)}
            placeholder="Preset name"
          />
          <Button variant="outline" onClick={saveCurrentFiltersAsPreset}>
            Save Current Filters
          </Button>
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={selectedSavedPresetId}
            onChange={(e) => applySavedPreset(e.target.value)}
          >
            <option value="">Apply saved preset</option>
            {savedPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={deleteSavedPreset} disabled={!selectedSavedPresetId}>
            Delete Preset
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            value={actorEmailFilter}
            onChange={(e) => {
              setActorEmailFilter(e.target.value);
              setLogsPage(1);
            }}
            placeholder="Filter by actor email"
          />
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setLogsPage(1);
            }}
          >
            <option value="">All Actions</option>
            <option value="VERIFY_ALUMNI">VERIFY_ALUMNI</option>
            <option value="UNVERIFY_ALUMNI">UNVERIFY_ALUMNI</option>
            <option value="REMOVE_USER">REMOVE_USER</option>
          </select>
          <Input
            type="date"
            value={fromDateFilter}
            onChange={(e) => {
              setDatePreset("custom");
              setFromDateFilter(e.target.value);
              setLogsPage(1);
            }}
          />
          <Input
            type="date"
            value={toDateFilter}
            onChange={(e) => {
              setDatePreset("custom");
              setToDateFilter(e.target.value);
              setLogsPage(1);
            }}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="w-full" onClick={clearAllLogFilters}>
              Clear
            </Button>
            <Button className="w-full" onClick={handleExportCsv} disabled={isExporting}>
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={datePreset === "today" ? "default" : "outline"} size="sm" onClick={() => updateDatePreset("today")}>
            Today
          </Button>
          <Button variant={datePreset === "7d" ? "default" : "outline"} size="sm" onClick={() => updateDatePreset("7d")}>
            7d
          </Button>
          <Button variant={datePreset === "30d" ? "default" : "outline"} size="sm" onClick={() => updateDatePreset("30d")}>
            30d
          </Button>
          <Button variant={datePreset === "custom" ? "default" : "outline"} size="sm" onClick={() => updateDatePreset("custom")}>
            Custom
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 p-2">
          <span className="text-sm text-slate-600">Columns:</span>
          <Button variant={visibleColumns.time ? "default" : "outline"} size="sm" onClick={() => toggleColumn("time")}>
            Time
          </Button>
          <Button variant={visibleColumns.actor ? "default" : "outline"} size="sm" onClick={() => toggleColumn("actor")}>
            Actor
          </Button>
          <Button variant={visibleColumns.action ? "default" : "outline"} size="sm" onClick={() => toggleColumn("action")}>
            Action
          </Button>
          <Button
            variant={visibleColumns.targetRole ? "default" : "outline"}
            size="sm"
            onClick={() => toggleColumn("targetRole")}
          >
            Target Role
          </Button>
          <Button
            variant={visibleColumns.metadata ? "default" : "outline"}
            size="sm"
            onClick={() => toggleColumn("metadata")}
          >
            Metadata
          </Button>
        </div>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                {visibleColumns.time && (
                  <th className="px-3 py-2">
                    <button className="font-medium" onClick={() => handleSort("createdAt")}>
                      {renderSortLabel("Time", "createdAt")}
                    </button>
                  </th>
                )}
                {visibleColumns.actor && (
                  <th className="px-3 py-2">
                    <button className="font-medium" onClick={() => handleSort("actorEmail")}>
                      {renderSortLabel("Actor", "actorEmail")}
                    </button>
                  </th>
                )}
                {visibleColumns.action && (
                  <th className="px-3 py-2">
                    <button className="font-medium" onClick={() => handleSort("action")}>
                      {renderSortLabel("Action", "action")}
                    </button>
                  </th>
                )}
                {visibleColumns.targetRole && (
                  <th className="px-3 py-2">
                    <button className="font-medium" onClick={() => handleSort("targetRole")}>
                      {renderSortLabel("Target Role", "targetRole")}
                    </button>
                  </th>
                )}
                {visibleColumns.metadata && <th className="px-3 py-2">Metadata</th>}
              </tr>
            </thead>
            <tbody>
              {(logsQuery.data?.items || []).map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  {visibleColumns.time && <td className="px-3 py-2 text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>}
                  {visibleColumns.actor && <td className="px-3 py-2">{log.actorEmail}</td>}
                  {visibleColumns.action && (
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{log.action}</Badge>
                    </td>
                  )}
                  {visibleColumns.targetRole && <td className="px-3 py-2">{log.targetRole || "-"}</td>}
                  {visibleColumns.metadata && (
                    <td className="max-w-[260px] truncate px-3 py-2 text-slate-600">{log.metadata || "-"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Page {logsQuery.data?.page || 1} of {logsQuery.data?.totalPages || 1} • Total {logsQuery.data?.total || 0} logs
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(logsQuery.data?.page || 1) <= 1}
              onClick={() => {
                setLogsPage((p) => Math.max(1, p - 1));
                setPageInput(String(Math.max(1, (logsQuery.data?.page || 1) - 1)));
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(logsQuery.data?.page || 1) >= (logsQuery.data?.totalPages || 1)}
              onClick={() =>
                {
                  const nextPage = Math.min(logsQuery.data?.totalPages || logsPage, (logsQuery.data?.page || logsPage) + 1);
                  setLogsPage(nextPage);
                  setPageInput(String(nextPage));
                }
              }
            >
              Next
            </Button>
            <Input
              className="h-8 w-20"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToPage();
              }}
              placeholder="Page"
            />
            <Button variant="outline" size="sm" onClick={goToPage}>
              Go
            </Button>
          </div>
        </div>
      </Card>

      {verifyDialogUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-md space-y-3 p-4">
            <h3 className="text-lg font-semibold">{verifyDialogUser.isVerifiedAlumni ? "Unverify alumni?" : "Verify alumni?"}</h3>
            <p className="text-sm text-slate-600">
              Confirm action for <strong>{verifyDialogUser.name}</strong> ({verifyDialogUser.email}).
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVerifyDialogUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  verifyMutation.mutate({
                    alumniId: verifyDialogUser.id,
                    verified: !verifyDialogUser.isVerifiedAlumni,
                  })
                }
              >
                Confirm
              </Button>
            </div>
          </Card>
        </div>
      )}

      {removeDialogUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-md space-y-3 p-4">
            <h3 className="text-lg font-semibold">Remove user account?</h3>
            <p className="text-sm text-slate-600">
              This will permanently remove <strong>{removeDialogUser.name}</strong> ({removeDialogUser.email}) and related records.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoveDialogUser(null)}>
                Cancel
              </Button>
              <Button onClick={() => removeMutation.mutate(removeDialogUser.id)}>Confirm Remove</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
