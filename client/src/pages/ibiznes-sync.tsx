import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, CheckCircle2, XCircle, Clock, Wifi, WifiOff, Database, Trash2, AlertTriangle, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

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
        <CardContent className="flex items-center justify-between gap-3">
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
