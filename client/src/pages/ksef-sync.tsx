import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Wifi, WifiOff, FileText, Tag, Plus, Trash2, AlertCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { MONTHS_ASCII, formatPLN } from "@/lib/constants";

const KATEGORIE = [
  "Leasing", "Paliwo", "Media/Prąd", "Transport", "Ubezpieczenia",
  "Księgowość", "Biuro", "Wysyłka/Poczta", "Płatności/Terminal",
  "IT/Serwis", "IT/Subskrypcje", "Serwis/Naprawa", "Towary/Produkty",
  "Wynagrodzenia", "ZUS", "Podatki (US)", "Medycyna pracy", "Inne",
];

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

interface KsefInvoiceRow {
  id: number;
  ksefNumber: string;
  invoiceNumber: string;
  issueDate: string;
  rok: number;
  miesiac: number;
  sellerNip: string;
  sellerName: string | null;
  buyerNip: string | null;
  netAmount: string;
  vatAmount: string | null;
  grossAmount: string | null;
  currency: string;
  kategoria: string | null;
  kategoriaManual: boolean;
}

interface SupplierRule {
  id: number;
  nip: string;
  nazwa: string | null;
  kategoria: string;
}

interface UnclassifiedRow {
  nip: string;
  nazwa: string | null;
  faktur: number;
  razem_netto: number;
}

export default function KsefSyncPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  if (user?.rola !== "admin") {
    setLocation("/");
    return null;
  }

  const now = new Date();
  const [rok, setRok] = useState(now.getFullYear());
  const [miesiac, setMiesiac] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<"invoices" | "unclassified" | "rules" | "logs">("invoices");

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/ksef/status"],
    queryFn: async () => (await authFetch("/api/ksef/status")).json(),
    refetchInterval: 30000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["/api/ksef/logs"],
    queryFn: async () => (await authFetch("/api/ksef/logs?limit=15")).json(),
    refetchInterval: 30000,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<KsefInvoiceRow[]>({
    queryKey: ["/api/ksef/invoices", rok, miesiac],
    queryFn: async () => (await authFetch(`/api/ksef/invoices?rok=${rok}&miesiac=${miesiac}`)).json(),
  });

  const { data: summary } = useQuery({
    queryKey: ["/api/ksef/summary", rok, miesiac],
    queryFn: async () => (await authFetch(`/api/ksef/summary?rok=${rok}&miesiac=${miesiac}`)).json(),
  });

  const { data: rules = [] } = useQuery<SupplierRule[]>({
    queryKey: ["/api/ksef/supplier-categories"],
    queryFn: async () => (await authFetch("/api/ksef/supplier-categories")).json(),
  });

  const { data: unclassified = [] } = useQuery<UnclassifiedRow[]>({
    queryKey: ["/api/ksef/unclassified"],
    queryFn: async () => (await authFetch("/api/ksef/unclassified?limit=30")).json(),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/ksef/sync", { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd synchronizacji");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Synchronizacja KSeF zakończona",
        description: `Pobrano ${data.invoicesSynced} faktur (${data.invoicesNew} nowych)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/unclassified"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-analysis"] });
    },
    onError: (err: any) => toast({ title: "Błąd synchronizacji", description: err.message, variant: "destructive" }),
  });

  const updateKategoriaMutation = useMutation({
    mutationFn: async (payload: { id: number; kategoria: string }) => {
      const res = await authFetch(`/api/ksef/invoices/${payload.id}/kategoria`, {
        method: "PATCH",
        body: JSON.stringify({ kategoria: payload.kategoria }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/unclassified"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-analysis"] });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const upsertRuleMutation = useMutation({
    mutationFn: async (payload: { nip: string; nazwa?: string | null; kategoria: string }) => {
      const res = await authFetch("/api/ksef/supplier-categories", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Reguła zapisana", description: `Przekategoryzowano ${data.recategorized} faktur.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/supplier-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/unclassified"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-analysis"] });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (nip: string) => {
      const res = await authFetch(`/api/ksef/supplier-categories/${nip}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Reguła usunięta", description: `Przekategoryzowano ${data.recategorized} faktur.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/supplier-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ksef/unclassified"] });
    },
  });

  const lastSync = status?.lastSync;
  const totalNet = useMemo(
    () => invoices.reduce((s, r) => s + Number(r.netAmount || 0), 0),
    [invoices],
  );

  // ── Dialog: dodaj/edytuj regułę NIP→kategoria
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ nip: "", nazwa: "", kategoria: "Inne" });
  const openRuleForNip = (row: { nip: string; nazwa: string | null }) => {
    setRuleForm({ nip: row.nip, nazwa: row.nazwa || "", kategoria: "Inne" });
    setRuleDialogOpen(true);
  };
  const submitRule = () => {
    if (!ruleForm.nip || !ruleForm.kategoria) return;
    upsertRuleMutation.mutate({ nip: ruleForm.nip, nazwa: ruleForm.nazwa || null, kategoria: ruleForm.kategoria });
    setRuleDialogOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6" /> Synchronizacja KSeF
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automatyczne pobieranie faktur kosztowych z Krajowego Systemu e-Faktur (Subject2 = nabywca = ADD ALL).
        </p>
      </div>

      {/* ── Status połączenia + ostatni sync ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            {statusLoading ? (
              <Badge variant="outline" className="animate-pulse">Sprawdzam...</Badge>
            ) : !status?.configured ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" /> Brak konfiguracji
              </Badge>
            ) : status?.connected ? (
              <Badge className="bg-green-100 text-green-800 border-transparent gap-1">
                <Wifi className="w-3 h-3" /> Połączony z KSeF
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="w-3 h-3" /> Brak połączenia
              </Badge>
            )}
            {status?.env && (
              <Badge variant="outline" className="text-xs">
                Środowisko: {status.env.toUpperCase()}
              </Badge>
            )}
            {status?.nip && (
              <Badge variant="outline" className="text-xs">
                NIP: {status.nip}
              </Badge>
            )}
          </div>

          {!status?.configured && (
            <p className="text-sm text-muted-foreground">
              Ustaw w środowisku: <code className="bg-muted px-1 rounded text-xs">KSEF_TOKEN</code>,{" "}
              <code className="bg-muted px-1 rounded text-xs">KSEF_NIP</code>,{" "}
              <code className="bg-muted px-1 rounded text-xs">KSEF_ENV</code> (test / demo / prod).
            </p>
          )}

          {status?.error && (
            <p className="text-sm text-destructive">Błąd: {status.error}</p>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-medium">Ostatnia synchronizacja</p>
              {lastSync ? (
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={lastSync.status} />
                  <span className="text-sm text-muted-foreground">{formatDate(lastSync.startedAt)}</span>
                  {lastSync.status === "success" && (
                    <span className="text-sm text-muted-foreground">
                      · {lastSync.invoicesSynced} faktur ({lastSync.invoicesNew} nowych)
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Brak synchronizacji</p>
              )}
            </div>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !status?.configured}
              className="gap-2"
              data-testid="button-ksef-sync"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Synchronizuję..." : "Synchronizuj teraz"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Wybór miesiąca + podsumowanie ─────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Rok</Label>
            <Select value={String(rok)} onValueChange={(v) => setRok(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Miesiąc</Label>
            <Select value={String(miesiac)} onValueChange={(v) => setMiesiac(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_ASCII.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Suma kosztów netto za miesiąc</p>
            <p className="text-2xl font-bold tabular-nums">{formatPLN(totalNet)}</p>
            <p className="text-xs text-muted-foreground">{invoices.length} faktur</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Podsumowanie wg kategorii ─────────────────────────────────────── */}
      {summary?.categories?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Koszty wg kategorii</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {summary.categories.map((c: any) => (
                <div key={c.kategoria} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{c.kategoria}</p>
                  <p className="text-lg font-bold tabular-nums">{formatPLN(c.netto)}</p>
                  <p className="text-xs text-muted-foreground">{c.faktur} FV</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Zakładki: faktury / nieskategoryzowane / reguły / logi ──────── */}
      <div className="flex gap-2 border-b">
        {[
          { id: "invoices", label: "Faktury" },
          { id: "unclassified", label: `Nieskategoryzowane (${unclassified.length})` },
          { id: "rules", label: `Reguły NIP→kategoria (${rules.length})` },
          { id: "logs", label: "Logi" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              activeTab === t.id ? "border-primary font-medium" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "invoices" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Sprzedawca</TableHead>
                    <TableHead>NIP</TableHead>
                    <TableHead>Nr FV</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead>Kategoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesLoading && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
                  )}
                  {!invoicesLoading && invoices.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Brak faktur za ten miesiąc. Wciśnij „Synchronizuj teraz".
                    </TableCell></TableRow>
                  )}
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs tabular-nums">{inv.issueDate}</TableCell>
                      <TableCell className="max-w-xs truncate" title={inv.sellerName || ""}>{inv.sellerName || "-"}</TableCell>
                      <TableCell className="text-xs tabular-nums">{inv.sellerNip}</TableCell>
                      <TableCell className="text-xs">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPLN(Number(inv.netAmount))}</TableCell>
                      <TableCell>
                        <Select
                          value={inv.kategoria || "Inne"}
                          onValueChange={(v) => updateKategoriaMutation.mutate({ id: inv.id, kategoria: v })}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue />
                            {inv.kategoriaManual && <Badge variant="outline" className="ml-1 text-[10px] h-4">M</Badge>}
                          </SelectTrigger>
                          <SelectContent>
                            {KATEGORIE.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "unclassified" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top dostawcy "Inne" — do nauczenia</CardTitle>
            <p className="text-xs text-muted-foreground">
              Dostawcy których faktury wpadły w kategorię "Inne". Kliknij „Dodaj regułę"
              żeby wszystkie kolejne faktury od tego NIP-u trafiały w wybraną kategorię.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIP</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead className="text-right">Faktur</TableHead>
                  <TableHead className="text-right">Razem netto</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unclassified.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Wszystkie faktury są skategoryzowane.
                  </TableCell></TableRow>
                )}
                {unclassified.map((row) => (
                  <TableRow key={row.nip}>
                    <TableCell className="text-xs tabular-nums">{row.nip}</TableCell>
                    <TableCell className="max-w-xs truncate" title={row.nazwa || ""}>{row.nazwa || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{row.faktur}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPLN(row.razem_netto)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openRuleForNip(row)} className="gap-1">
                        <Plus className="w-3 h-3" /> Dodaj regułę
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "rules" && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Reguły mapowania NIP → kategoria</CardTitle>
              <p className="text-xs text-muted-foreground">Reguły mają priorytet nad auto-kategoryzacją po słowach kluczowych.</p>
            </div>
            <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1" onClick={() => setRuleForm({ nip: "", nazwa: "", kategoria: "Inne" })}>
                  <Plus className="w-4 h-4" /> Nowa reguła
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reguła NIP → kategoria</DialogTitle>
                  <DialogDescription>Wszystkie faktury od tego dostawcy trafią w wybraną kategorię.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>NIP dostawcy</Label>
                    <Input
                      value={ruleForm.nip}
                      onChange={(e) => setRuleForm({ ...ruleForm, nip: e.target.value.replace(/[-\s]/g, "") })}
                      placeholder="1234567890"
                    />
                  </div>
                  <div>
                    <Label>Nazwa (opcjonalnie)</Label>
                    <Input value={ruleForm.nazwa} onChange={(e) => setRuleForm({ ...ruleForm, nazwa: e.target.value })} />
                  </div>
                  <div>
                    <Label>Kategoria</Label>
                    <Select value={ruleForm.kategoria} onValueChange={(v) => setRuleForm({ ...ruleForm, kategoria: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KATEGORIE.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Anuluj</Button>
                  <Button onClick={submitRule} disabled={!ruleForm.nip || upsertRuleMutation.isPending} className="gap-1">
                    <Tag className="w-4 h-4" /> Zapisz
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIP</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Brak reguł. Dodawane automatycznie z zakładki "Nieskategoryzowane".
                  </TableCell></TableRow>
                )}
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs tabular-nums">{r.nip}</TableCell>
                    <TableCell>{r.nazwa || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{r.kategoria}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => deleteRuleMutation.mutate(r.nip)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "logs" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Historia synchronizacji</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>Koniec</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">FV / Nowe</TableHead>
                  <TableHead>Komunikat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Brak logów</TableCell></TableRow>
                )}
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{formatDate(log.startedAt)}</TableCell>
                    <TableCell className="text-xs">{formatDate(log.finishedAt)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{log.trigger}</Badge></TableCell>
                    <TableCell><StatusBadge status={log.status} /></TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{log.invoicesSynced} / {log.invoicesNew}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={log.message || ""}>
                      {log.message || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
