import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CheckCircle2, XCircle, Clock, Wifi, WifiOff, Database, Trash2, AlertTriangle, BarChart3, UserPlus } from "lucide-react";
import { useLocation } from "wouter";

const OPIEKUN_OPTIONS = ["Gosia", "Magda", "Weryfikacja"];
const SEGMENT_OPTIONS = ["Premium", "Standard", "Weryfikacja"];
const STATUS_OPTIONS = ["Aktywny", "Nieaktywny", "Weryfikacja", "Zawieszony"];
const GRUPA_OPTIONS = ["Gosia Premium", "Magda Premium", "Magda Standard", "Weryfikacja - zostana", "Weryfikacja - odejda"];

function formatDate(val: string | null | undefined) {
  if (!val) return "-";
  const d = new Date(val);
  return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge className="bg-green-100 text-green-800 border-transparent gap-1"><CheckCircle2 className="w-3 h-3" /> Sukces</Badge>;
  if (status === "error") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Błąd</Badge>;
  return <Badge variant="outline" className="gap-1 animate-pulse"><Clock className="w-3 h-3" /> W trakcie</Badge>;
}

export default function IbizneSyncPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  if (user?.rola !== "admin") { setLocation("/"); return null; }

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/ibiznes/status"],
    queryFn: async () => {
      const res = await authFetch("/api/ibiznes/status");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["/api/ibiznes/logs"],
    queryFn: async () => {
      const res = await authFetch("/api/ibiznes/logs?limit=15");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/ibiznes/sync", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd synchronizacji");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Synchronizacja zakończona",
        description: `Faktury: ${data.invoicesSynced}, Dopasowani: ${data.clientsMatched}, Niedopasowani: ${data.clientsUnmatched}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Błąd synchronizacji", description: err.message, variant: "destructive" });
    },
  });

  const purgeResyncMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/ibiznes/purge-and-resync", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Odbudowa zakończona",
        description: `Tabela wyczyszczona i przeładowana z iBiznes: ${data.invoicesSynced} WZ, ${data.clientsMatched} dopasowanych.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/unmatched"] });
    },
    onError: (err: any) => {
      toast({ title: "Błąd odbudowy", description: err.message, variant: "destructive" });
    },
  });

  const clearNipMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/clients/clear-nip", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd czyszczenia");
      return data;
    },
    onSuccess: () => {
      toast({ title: "NIPy wyczyszczone", description: "Wszystkie wartości NIP zostały usunięte z bazy." });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const { data: unmatched = [], isLoading: unmatchedLoading } = useQuery({
    queryKey: ["/api/ibiznes/unmatched"],
    queryFn: async () => {
      const res = await authFetch("/api/ibiznes/unmatched");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // --- Unmatched WZ: ignore + add-as-client mutations ---
  const ignoreUnmatchedMutation = useMutation({
    mutationFn: async (row: { nip: string; alias: string | null; source: string }) => {
      const res = await authFetch("/api/ibiznes/unmatched/ignore", {
        method: "POST",
        body: JSON.stringify({ nip: row.nip || "", alias: row.alias, source: row.source }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Usunięto z niedopasowanych",
        description: `Skasowano ${data.removed} WZ. Obroty zostały przeliczone.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/unmatched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plan/realization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/audit"] });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addClientForm, setAddClientForm] = useState({
    nip: "",
    alias: "" as string | null,
    source: "" as string,
    klient: "",
    opiekun: "Weryfikacja",
    segment: "Weryfikacja",
    grupaMvp: "",
    status: "Aktywny",
    telefon: "",
    email: "",
    ibiznesAlias: "",
  });

  const addAsClientMutation = useMutation({
    mutationFn: async (payload: typeof addClientForm) => {
      const res = await authFetch("/api/ibiznes/unmatched/add-as-client", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Klient dodany",
        description: `${data.client?.klient || "Nowy klient"} dopisany do CRM. WZ zostały przepisane na niego.`,
      });
      setAddClientOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/unmatched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plan/realization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-dashboard"] });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const openAddClient = (row: any) => {
    setAddClientForm({
      nip: row.nip || "",
      alias: row.alias || null,
      source: row.source || "",
      klient: row.alias || "",
      opiekun: "Weryfikacja",
      segment: "Weryfikacja",
      grupaMvp: "",
      status: "Aktywny",
      telefon: "",
      email: "",
      ibiznesAlias: row.alias || "",
    });
    setAddClientOpen(true);
  };

  const [diagDays, setDiagDays] = useState(90);
  const [diagEnabled, setDiagEnabled] = useState(false);
  const { data: diag, isLoading: diagLoading, refetch: refetchDiag } = useQuery({
    queryKey: ["/api/ibiznes/diagnostics", diagDays],
    queryFn: async () => {
      const res = await authFetch(`/api/ibiznes/diagnostics?days=${diagDays}`);
      return res.json();
    },
    enabled: diagEnabled,
  });

  const [auditEnabled, setAuditEnabled] = useState(false);
  const { data: audit, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["/api/ibiznes/audit"],
    queryFn: async () => {
      const res = await authFetch("/api/ibiznes/audit?days=120");
      return res.json();
    },
    enabled: auditEnabled,
  });

  function monthKey(rok: number, miesiac: number) {
    return `${rok}-${String(miesiac).padStart(2, "0")}`;
  }

  const auditMerged = (() => {
    if (!audit) return null;
    const map = new Map<string, any>();
    const put = (key: string, field: string, value: any) => {
      if (!map.has(key)) map.set(key, { key });
      map.get(key)[field] = value;
    };
    for (const r of audit.iBiznesLive.spZoo || []) {
      const k = monthKey(r.rok, r.miesiac);
      put(k, "spZooAll", r.allWz_netto);
      put(k, "spZooActive", r.activeWz_netto);
      put(k, "spZooAnul", r.anulowane_netto);
      put(k, "spZooByRejKo", r.byRejKo);
      put(k, "spZooByMag", r.byMag);
    }
    for (const r of audit.iBiznesLive.firma || []) {
      const k = monthKey(r.rok, r.miesiac);
      put(k, "firmaAll", r.allWz_netto);
      put(k, "firmaActive", r.activeWz_netto);
      put(k, "firmaAnul", r.anulowane_netto);
      put(k, "firmaByRejKo", r.byRejKo);
      put(k, "firmaByMag", r.byMag);
    }
    for (const r of audit.ourInvoices || []) {
      const k = monthKey(Number(r.rok), Number(r.miesiac));
      put(k, "invTotal", Number(r.total));
      put(k, "invMatched", Number(r.matched));
      put(k, "invUnmatched", Number(r.unmatched));
      put(k, "invCount", Number(r.cnt));
    }
    for (const r of audit.ourClientSales || []) {
      const k = monthKey(Number(r.rok), Number(r.miesiac));
      put(k, "csTotal", Number(r.total));
    }
    for (const r of audit.ourDaily || []) {
      const k = monthKey(Number(r.rok), Number(r.miesiac));
      put(k, "dailyTotal", Number(r.total));
    }
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  })();

  const lastSync = status?.lastSync;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6" /> Synchronizacja iBiznes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automatyczny import faktur z systemu iBiznes do CRM. Sync działa codziennie o 05:00.
        </p>
      </div>

      {/* Connection status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status połączenia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            {statusLoading ? (
              <Badge variant="outline" className="animate-pulse">Sprawdzam...</Badge>
            ) : status?.connected ? (
              <Badge className="bg-green-100 text-green-800 border-transparent gap-1">
                <Wifi className="w-3 h-3" /> Połączony z iBiznes
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="w-3 h-3" /> Brak połączenia
              </Badge>
            )}
          </div>

          {!status?.connected && (
            <p className="text-sm text-muted-foreground">
              Ustaw zmienną <code className="bg-muted px-1 rounded text-xs">IBIZNES_DB_URL</code> w Railway (Environment Variables) z connection stringiem do MySQL iBiznes.
              Format: <code className="bg-muted px-1 rounded text-xs">mysql://user:pass@host:3306/dbname</code>
            </p>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ostatnia synchronizacja</p>
              {lastSync ? (
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={lastSync.status} />
                  <span className="text-xs text-muted-foreground">{formatDate(lastSync.finishedAt || lastSync.startedAt)}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Brak danych</p>
              )}
            </div>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !status?.connected}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Synchronizuję..." : "Uruchom sync"}
            </Button>
          </div>

          {lastSync?.status === "success" && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xl font-bold">{lastSync.invoicesSynced ?? 0}</p>
                <p className="text-xs text-muted-foreground">Faktur</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xl font-bold text-green-600">{lastSync.clientsMatched ?? 0}</p>
                <p className="text-xs text-muted-foreground">Dopasowanych</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xl font-bold text-amber-600">{lastSync.clientsUnmatched ?? 0}</p>
                <p className="text-xs text-muted-foreground">Niedopasowanych NIP</p>
              </div>
            </div>
          )}
          {lastSync?.status === "error" && lastSync.message && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded-md">
              {lastSync.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* AUDYT WARSTW — najważniejsze narzędzie do znalezienia rozbieżności */}
      <Card className="border-purple-300 dark:border-purple-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" /> AUDYT — porównanie 3 warstw danych per miesiąc
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pokazuje ile per miesiąc pokazuje <strong>iBiznes (live)</strong>, ile mamy w <strong>ibiznes_invoices</strong> (nasza tabela po sync) i ile liczy <strong>client_sales</strong> (to co czyta Dashboard). Jeśli warstwy się rozjeżdżają — widać dokładnie która.
          </p>

          <Button
            size="sm"
            onClick={() => {
              setAuditEnabled(true);
              refetchAudit();
            }}
            disabled={auditLoading || !status?.connected}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <RefreshCw className={`w-3 h-3 ${auditLoading ? "animate-spin" : ""}`} />
            {auditLoading ? "Analizuję..." : "Uruchom pełny audyt (120 dni)"}
          </Button>

          {auditMerged && auditMerged.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="align-bottom">Miesiąc</TableHead>
                      <TableHead colSpan={3} className="text-center bg-blue-50 dark:bg-blue-950/30">iBiznes LIVE (spec-tables)</TableHead>
                      <TableHead colSpan={3} className="text-center bg-amber-50 dark:bg-amber-950/30">ibiznes_invoices (nasza tabela)</TableHead>
                      <TableHead colSpan={2} className="text-center bg-green-50 dark:bg-green-950/30">Dashboard (client_sales)</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30 text-xs">Wszystkie WZ netto</TableHead>
                      <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30 text-xs">Aktywne (niezanulowane)</TableHead>
                      <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30 text-xs">Anulowane</TableHead>
                      <TableHead className="text-right bg-amber-50 dark:bg-amber-950/30 text-xs">Razem (#)</TableHead>
                      <TableHead className="text-right bg-amber-50 dark:bg-amber-950/30 text-xs">Dopasowane</TableHead>
                      <TableHead className="text-right bg-amber-50 dark:bg-amber-950/30 text-xs">Niedop.</TableHead>
                      <TableHead className="text-right bg-green-50 dark:bg-green-950/30 text-xs">client_sales</TableHead>
                      <TableHead className="text-right bg-green-50 dark:bg-green-950/30 text-xs">daily_analysis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditMerged.map((r: any) => {
                      const liveAll = (r.spZooAll || 0) + (r.firmaAll || 0);
                      const liveActive = (r.spZooActive || 0) + (r.firmaActive || 0);
                      const liveAnul = (r.spZooAnul || 0) + (r.firmaAnul || 0);
                      return (
                        <TableRow key={r.key}>
                          <TableCell className="font-mono text-sm font-medium">{r.key}</TableCell>
                          <TableCell className="text-right text-xs bg-blue-50/50 dark:bg-blue-950/20">
                            {Math.round(liveAll).toLocaleString("pl-PL")}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold bg-blue-50/50 dark:bg-blue-950/20">
                            {Math.round(liveActive).toLocaleString("pl-PL")}
                          </TableCell>
                          <TableCell className="text-right text-xs bg-blue-50/50 dark:bg-blue-950/20 text-amber-700">
                            {liveAnul > 0 ? Math.round(liveAnul).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs bg-amber-50/50 dark:bg-amber-950/20">
                            {r.invTotal != null ? `${Math.round(r.invTotal).toLocaleString("pl-PL")} (${r.invCount})` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs bg-amber-50/50 dark:bg-amber-950/20">
                            {r.invMatched != null ? Math.round(r.invMatched).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs bg-amber-50/50 dark:bg-amber-950/20 text-amber-700">
                            {r.invUnmatched != null ? Math.round(r.invUnmatched).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold bg-green-50/50 dark:bg-green-950/20">
                            {r.csTotal != null ? Math.round(r.csTotal).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs bg-green-50/50 dark:bg-green-950/20">
                            {r.dailyTotal != null ? Math.round(r.dailyTotal).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-2">
                <p><strong>Jak czytać:</strong></p>
                <p>• <span className="text-blue-700 dark:text-blue-400">Niebieski</span> = co pokazuje iBiznes teraz (live query)</p>
                <p>• <span className="text-amber-700 dark:text-amber-400">Pomarańczowy</span> = co mamy w naszej tabeli po ostatnim sync</p>
                <p>• <span className="text-green-700 dark:text-green-400">Zielony</span> = co faktycznie czyta Dashboard</p>
                <p>• Jeśli <strong>niebieski ≠ pomarańczowy</strong> → sync nie przeliczył z nowym kodem (zrób Uruchom sync)</p>
                <p>• Jeśli <strong>pomarańczowy ≠ zielony</strong> → agregacja ma błąd</p>
                <p>• Jeśli <strong>niebieski ≈ pomarańczowy ≈ zielony</strong> a zespół mówi inaczej → iBiznes ma więcej WZ niż powinno trafiać do analityki</p>
              </div>

              {/* Breakdown per RejKo/Mag for April to identify cost-WZ */}
              {(() => {
                const apr = auditMerged.find((r: any) => r.key === "2026-04");
                if (!apr) return null;
                return (
                  <div className="space-y-2 pt-3 border-t">
                    <p className="text-sm font-semibold">Kwiecień 2026 — rozkład aktywnych WZ per RejKo i Mag</p>
                    <p className="text-xs text-muted-foreground">
                      Jeśli widzisz tu różne wartości RejKo (rejestr księgowy) lub Mag (magazyn), to sygnał że iBiznes grupuje różne typy WZ (sprzedażowe vs kosztowe vs wewnętrzne) po innym polu niż Typ.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium mb-1">Sp. z o.o. — per RejKo</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">RejKo</TableHead>
                              <TableHead className="text-right text-xs">Dok.</TableHead>
                              <TableHead className="text-right text-xs">Netto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(apr.spZooByRejKo || []).map((r: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs font-mono">{r.rejKo}</TableCell>
                                <TableCell className="text-right text-xs">{r.count}</TableCell>
                                <TableCell className="text-right text-xs">{Math.round(r.totalNetto).toLocaleString("pl-PL")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1">Sp. z o.o. — per Mag</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Magazyn</TableHead>
                              <TableHead className="text-right text-xs">Dok.</TableHead>
                              <TableHead className="text-right text-xs">Netto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(apr.spZooByMag || []).map((r: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs font-mono">{r.mag}</TableCell>
                                <TableCell className="text-right text-xs">{r.count}</TableCell>
                                <TableCell className="text-right text-xs">{Math.round(r.totalNetto).toLocaleString("pl-PL")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {audit?.syncLogs && audit.syncLogs.length > 0 && (
                <details className="text-xs pt-2">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Ostatnie {audit.syncLogs.length} sync (czy faktycznie trafił nowy kod?)
                  </summary>
                  <div className="mt-2 space-y-1">
                    {audit.syncLogs.map((log: any) => (
                      <div key={log.id} className="p-2 rounded bg-muted/50 text-xs font-mono">
                        #{log.id} [{log.status}] {formatDate(log.startedAt)} → {log.invoicesSynced ?? 0} WZ, {log.clientsMatched ?? 0} dopasowanych, {log.clientsUnmatched ?? 0} nie ({log.trigger})
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Diagnostyka */}
      <Card className="border-blue-200 dark:border-blue-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" /> Diagnostyka danych iBiznes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sprawdza jakie <strong>typy dokumentów</strong> istnieją w iBiznes (WZ, FZ, korekty, PZ itp.) oraz jakie aliasy generują WZ bez przypisanego NIP-u.
            Pomaga wykryć, czy <code className="bg-muted px-1 rounded text-xs">Typ='WZ'</code> łapie dokumenty kosztowe zamiast sprzedażowych.
          </p>

          <div className="flex items-center gap-2">
            <label className="text-sm">Ostatnie</label>
            <select
              className="border rounded px-2 py-1 text-sm bg-background"
              value={diagDays}
              onChange={(e) => setDiagDays(Number(e.target.value))}
            >
              <option value={30}>30 dni</option>
              <option value={60}>60 dni</option>
              <option value={90}>90 dni</option>
              <option value={180}>180 dni</option>
              <option value={365}>1 rok</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDiagEnabled(true);
                refetchDiag();
              }}
              disabled={diagLoading || !status?.connected}
              className="gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${diagLoading ? "animate-spin" : ""}`} />
              {diagLoading ? "Analizuję..." : "Uruchom diagnostykę"}
            </Button>
          </div>

          {diag?.typeStats && diag.typeStats.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Od: {diag.since}</p>
              <p className="text-sm font-medium mt-2">Typy dokumentów w spec-tables</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Źródło</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Dokumentów</TableHead>
                    <TableHead className="text-right">Suma PLN</TableHead>
                    <TableHead>Zakres dat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diag.typeStats.map((row: any, i: number) => (
                    <TableRow key={i} className={row.typ === "WZ" ? "bg-green-50 dark:bg-green-950/20" : ""}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.source === "sp_zoo" ? "Sp. z o.o." : "JDG"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">{row.typ || "(puste)"}</TableCell>
                      <TableCell className="text-right text-sm">{row.documentsCount}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {Math.round(row.totalPln).toLocaleString("pl-PL")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.minDate} → {row.maxDate}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <p className="text-xs text-muted-foreground pt-2">
                Obecnie synchronizujemy <strong>tylko Typ = 'WZ'</strong> (zielone wiersze). Jeśli widzisz inne typy z podobnymi wartościami, daj znać — mogą wymagać filtracji (np. korekty albo WZ wewnętrzne).
              </p>
            </div>
          )}

          {diag?.deepDiagnostics && diag.deepDiagnostics.length > 0 && (
            <div className="space-y-3 pt-3 border-t">
              <p className="text-sm font-medium">WZ miesięcznie — z różnymi kolumnami cen</p>
              <p className="text-xs text-muted-foreground">
                Pokazuje ile WZ jest w każdym miesiącu i jakie sumy wychodzą z różnych kolumn cenowych.
                Jeśli np. <code className="bg-muted px-1 rounded">Cb</code> ≈ <code className="bg-muted px-1 rounded">Cn</code> × 1.23, to <code className="bg-muted px-1 rounded">Cb</code> jest brutto.
                Szukamy kolumny netto.
              </p>

              {diag.deepDiagnostics.map((s: any) => (
                <div key={s.source} className="space-y-2">
                  <p className="text-sm font-semibold">
                    {s.source === "sp_zoo" ? "Sp. z o.o." : "JDG"} ({s.table})
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Miesiąc</TableHead>
                        <TableHead className="text-right">Dok.</TableHead>
                        <TableHead className="text-right" title="Il × Cb (obecne)">SUM(Il×Cb)</TableHead>
                        <TableHead className="text-right" title="Il × Cn, jeśli kolumna istnieje">SUM(Il×Cn)</TableHead>
                        <TableHead className="text-right" title="SUM(Wn) — wartość netto, jeśli istnieje">SUM(Wn)</TableHead>
                        <TableHead className="text-right" title="SUM(Wb) — wartość brutto, jeśli istnieje">SUM(Wb)</TableHead>
                        <TableHead className="text-right bg-blue-50 dark:bg-blue-950/20" title="SUM(Koszt) — kolumna Koszt na linii WZ">SUM(Koszt)</TableHead>
                        <TableHead className="text-right bg-blue-100 dark:bg-blue-900/30 font-bold" title="SUM(il × Cz) — iloczyn ilości i ceny zakupu (Cz). To odpowiada kolumnie Koszt w UI iBiznes.">SUM(il×Cz) ✓</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.monthlyWZ.map((m: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">
                            {m.rok}-{String(m.miesiac).padStart(2, "0")}
                          </TableCell>
                          <TableCell className="text-right text-sm">{m.documentsCount}</TableCell>
                          <TableCell className="text-right text-sm font-medium bg-red-50 dark:bg-red-950/20">
                            {Math.round(m.totalCb).toLocaleString("pl-PL")}
                          </TableCell>
                          <TableCell className="text-right text-sm bg-green-50 dark:bg-green-950/20">
                            {m.totalCn != null ? Math.round(m.totalCn).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm bg-green-50 dark:bg-green-950/20">
                            {m.totalWn != null ? Math.round(m.totalWn).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {m.totalWb != null ? Math.round(m.totalWb).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium bg-blue-50 dark:bg-blue-950/20">
                            {m.totalKoszt != null ? Math.round(m.totalKoszt).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-bold bg-blue-100 dark:bg-blue-900/30">
                            {m.totalCz != null ? Math.round(m.totalCz).toLocaleString("pl-PL") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Kolumny tabeli {s.table} ({s.columns.length})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.columns.map((c: any) => (
                        <Badge
                          key={c.name}
                          variant="outline"
                          className={`text-xs font-mono ${
                            ["Cn", "Cb", "Wn", "Wb", "Il", "Vat", "VatPr", "Rabat"].includes(c.name)
                              ? "border-blue-400 text-blue-700 dark:text-blue-300"
                              : ""
                          }`}
                          title={`${c.type}${c.nullable === "YES" ? " (nullable)" : ""}`}
                        >
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  </details>

                  {s.sampleWZ.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Przykładowe {s.sampleWZ.length} wiersze WZ
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded-md overflow-x-auto text-[10px] leading-tight">
                        {JSON.stringify(s.sampleWZ, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {diag?.unmatchedFromIbiznes && diag.unmatchedFromIbiznes.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <p className="text-sm font-medium">Top aliasy w WZ (żeby zobaczyć co tam jest)</p>
              <p className="text-xs text-muted-foreground">
                Tych aliasów możesz użyć do weryfikacji czy to klienci sprzedażowi. Jeśli są to dostawcy/kosztowe — sygnał że <code className="bg-muted px-1 rounded">Typ='WZ'</code> jest za szeroki.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Źródło</TableHead>
                    <TableHead>Alias</TableHead>
                    <TableHead>NIP</TableHead>
                    <TableHead className="text-right">Dok.</TableHead>
                    <TableHead className="text-right">Suma PLN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diag.unmatchedFromIbiznes.slice(0, 30).map((row: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.source === "sp_zoo" ? "Sp. z o.o." : "JDG"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{row.alias || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.nip || "—"}</TableCell>
                      <TableCell className="text-right text-sm">{row.documentsCount}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {Math.round(row.totalPln).toLocaleString("pl-PL")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-red-600 dark:text-red-400">Narzędzia naprawcze</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Odbuduj tabelę ibiznes_invoices</p>
              <p className="text-xs text-muted-foreground">Usuwa wszystkie wpisy w tabeli <code className="bg-muted px-1 rounded">ibiznes_invoices</code> i ciągnie świeże z iBiznes. Używaj gdy sync zadublował rekordy.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { if (confirm("Na pewno wyczyścić ibiznes_invoices i odpalić świeży sync? Dane zostaną pobrane ponownie z iBiznes.")) purgeResyncMutation.mutate(); }}
              disabled={purgeResyncMutation.isPending}
              className="gap-2 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${purgeResyncMutation.isPending ? "animate-spin" : ""}`} />
              {purgeResyncMutation.isPending ? "Odbudowuję..." : "Odbuduj od zera"}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Wyczyść wszystkie NIPy</p>
              <p className="text-xs text-muted-foreground">Usuwa pole NIP u wszystkich klientów — użyj gdy NIPy zostały błędnie wgrane.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { if (confirm("Na pewno wyczyścić wszystkie NIPy?")) clearNipMutation.mutate(); }}
              disabled={clearNipMutation.isPending}
              className="gap-2 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {clearNipMutation.isPending ? "Czyszczę..." : "Wyczyść NIPy"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Unmatched iBiznes clients */}
      <Card className={unmatched.length > 0 ? "border-amber-300 dark:border-amber-700" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {unmatched.length > 0 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
            Niedopasowane faktury z iBiznes
            {unmatched.length > 0 && (
              <Badge variant="outline" className="ml-auto text-amber-600 border-amber-400">{unmatched.length} firm</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unmatchedLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          ) : unmatched.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Wszystkie faktury są dopasowane do klientów CRM.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Poniższe firmy z iBiznes nie mają dopasowania w CRM. Wejdź w kartę klienta → Edytuj → uzupełnij pole <strong>NIP</strong>, a następnie uruchom sync ponownie.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alias / Nazwa</TableHead>
                    <TableHead>NIP</TableHead>
                    <TableHead>Źródło</TableHead>
                    <TableHead className="text-right">Faktur</TableHead>
                    <TableHead className="text-right">Wartość (PLN)</TableHead>
                    <TableHead className="text-right">Ostatnia</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatched.map((row: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{row.alias || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.nip}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{row.source === "sp_zoo" ? "Sp. z o.o." : "JDG"}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{row.invoice_count}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {Math.round(row.total).toLocaleString("pl-PL")}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{row.last_date}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1"
                            onClick={() => openAddClient(row)}
                            title="Dodaj jako klienta CRM (przepisze WZ na niego)"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Dodaj
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                            disabled={ignoreUnmatchedMutation.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Usunąć ${row.invoice_count} WZ (${Math.round(row.total).toLocaleString("pl-PL")} PLN) z obrotu?\n\nKlucz zostanie zapamiętany — kolejne sync też je pominą.`
                                )
                              ) {
                                ignoreUnmatchedMutation.mutate({ nip: row.nip, alias: row.alias, source: row.source });
                              }
                            }}
                            title="Usuń z niedopasowanych i odlicz od obrotu"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Usuń
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to match clients */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Jak dopasować klientów?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Sync dopasowuje faktury z iBiznes do klientów w CRM na podstawie <strong>numeru NIP</strong>.</p>
          <p>Żeby klient był dopasowany, wejdź w jego kartę → Edytuj → wpisz pole <strong>NIP (iBiznes sync)</strong> z tym samym NIP-em co w systemie iBiznes (bez kresek, np. <code className="bg-muted px-1 rounded">1234567890</code>).</p>
          <p>Po uzupełnieniu NIP-ów uruchom sync ponownie — faktury zostaną przypisane, a <strong>realizacja sprzedaży</strong> zaktualizuje się automatycznie.</p>
        </CardContent>
      </Card>

      {/* Add as client dialog */}
      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Dodaj klienta z iBiznes</DialogTitle>
            <DialogDescription>
              NIP i alias zostaną automatycznie powiązane z WZ z iBiznes — od następnego sync ten klient nie będzie już niedopasowany.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Nazwa klienta *</Label>
              <Input
                value={addClientForm.klient}
                onChange={(e) => setAddClientForm({ ...addClientForm, klient: e.target.value })}
                placeholder="np. Orzo Konstytucji sp. z o.o."
              />
            </div>
            <div>
              <Label className="text-xs">NIP</Label>
              <Input
                value={addClientForm.nip}
                onChange={(e) => setAddClientForm({ ...addClientForm, nip: e.target.value })}
                placeholder="bez kresek"
              />
            </div>
            <div>
              <Label className="text-xs">Alias iBiznes</Label>
              <Input
                value={addClientForm.ibiznesAlias}
                onChange={(e) => setAddClientForm({ ...addClientForm, ibiznesAlias: e.target.value })}
                placeholder="dokładnie jak w iBiznes"
              />
            </div>

            <div>
              <Label className="text-xs">Opiekun *</Label>
              <Select value={addClientForm.opiekun} onValueChange={(v) => setAddClientForm({ ...addClientForm, opiekun: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPIEKUN_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Segment *</Label>
              <Select value={addClientForm.segment} onValueChange={(v) => setAddClientForm({ ...addClientForm, segment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Grupa MVP</Label>
              <Select value={addClientForm.grupaMvp || "__none"} onValueChange={(v) => setAddClientForm({ ...addClientForm, grupaMvp: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— brak —</SelectItem>
                  {GRUPA_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={addClientForm.status} onValueChange={(v) => setAddClientForm({ ...addClientForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Telefon</Label>
              <Input
                value={addClientForm.telefon}
                onChange={(e) => setAddClientForm({ ...addClientForm, telefon: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                value={addClientForm.email}
                onChange={(e) => setAddClientForm({ ...addClientForm, email: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClientOpen(false)}>Anuluj</Button>
            <Button
              onClick={() => {
                if (!addClientForm.klient.trim()) {
                  toast({ title: "Brak nazwy klienta", variant: "destructive" });
                  return;
                }
                addAsClientMutation.mutate(addClientForm);
              }}
              disabled={addAsClientMutation.isPending}
            >
              {addAsClientMutation.isPending ? "Dodaję..." : "Dodaj klienta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historia synchronizacji</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak historii. Uruchom pierwszą synchronizację.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start justify-between gap-2 p-2 rounded-md border text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={log.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.startedAt)}
                    </span>
                    <Badge variant="outline" className="text-xs">{log.trigger}</Badge>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    {log.status === "success" ? (
                      <span>{log.invoicesSynced} faktur · {log.clientsMatched} dop.</span>
                    ) : log.message ? (
                      <span className="text-red-500 max-w-48 block truncate">{log.message}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
