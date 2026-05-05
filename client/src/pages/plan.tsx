import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, ArrowRight, Upload, TrendingUp, TrendingDown, RefreshCw, Wand2, FileSpreadsheet, Pencil, AlertTriangle, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { MONTHS_ASCII as MONTHS } from "@/lib/constants";

function fmtPLN(val: number) {
  return Math.round(val).toLocaleString("pl-PL") + " PLN";
}

function fmtNum(val: number) {
  return Math.round(val).toLocaleString("pl-PL");
}

type SortKey = "opiekun" | "grupa" | "cel" | "celNaDzis" | "realizacja" | "roznica" | "procent";
type SortDir = "asc" | "desc";

// "Premium" > "Standard" > "Weryfikacja" > "Inne" — useful when sorting by group.
const GRUPA_RANK: Record<string, number> = { premium: 3, standard: 2, weryfikacja: 1 };
function grupaRank(g: string | null | undefined): number {
  const k = (g || "").toLowerCase();
  for (const key of Object.keys(GRUPA_RANK)) if (k.includes(key)) return GRUPA_RANK[key];
  return 0;
}

function ImportPlanuModal({ open, onClose, defaultRok, defaultMiesiac }: {
  open: boolean; onClose: () => void; defaultRok: number; defaultMiesiac: number;
}) {
  const [importRok, setImportRok] = useState(defaultRok);
  const [importMiesiac, setImportMiesiac] = useState(defaultMiesiac);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetAndClose = () => { setResult(null); setLoading(false); onClose(); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("rok", String(importRok));
    formData.append("miesiac", String(importMiesiac));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/plan/import-excel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/plan/realization"] });
      toast({ title: `Plan ${MONTHS[importMiesiac - 1]} ${importRok} wgrany`, description: `Zaimportowano ${data.imported} klientow.` });
    } catch (err: any) {
      toast({ title: "Blad importu planu", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Import planu z Excel</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={String(importMiesiac)} onValueChange={v => setImportMiesiac(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(importRok)} onValueChange={v => setImportRok(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> {loading ? "Importowanie..." : "Wybierz plik XLSX"}
            </Button>
            <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} />
          </div>
          <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200">
            Wgraj plik z arkuszem <strong>"PLAN ..."</strong> (np. <em>Analiza_Styczen2026_Plan_Luty.xlsx</em>). System automatycznie wyczyta klientow i ich cele miesięczne.
          </div>
          {result && (
            <div className="space-y-2">
              <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-300">
                <p className="text-sm font-medium">Zaimportowano: {result.imported} klientow</p>
              </div>
              {result.notFound?.length > 0 && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-300">
                  <p className="text-sm font-medium mb-1">Nieznalezieni ({result.notFound.length}):</p>
                  <ul className="text-xs space-y-0.5">{result.notFound.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={resetAndClose}>Zamknij</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerujPlanModal({ open, onClose, defaultRok, defaultMiesiac }: {
  open: boolean; onClose: () => void; defaultRok: number; defaultMiesiac: number;
}) {
  const [rok, setRok] = useState(defaultRok);
  const [miesiac, setMiesiac] = useState(defaultMiesiac);
  const [wspolczynnik, setWspolczynnik] = useState(5);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const prevMonth = miesiac === 1 ? 12 : miesiac - 1;
  const prevMonthName = MONTHS[prevMonth - 1];

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/plan/auto-generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rok, miesiac, wspolczynnik: 1 + wspolczynnik / 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/plan/realization"] });
      toast({ title: `Plan ${MONTHS[miesiac - 1]} ${rok} wygenerowany`, description: `${data.generated} klientow, wspolczynnik +${wspolczynnik}%` });
    } catch (err: any) {
      toast({ title: "Blad generowania", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => { setResult(null); setLoading(false); onClose(); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Generuj plan z poprzedniego miesiąca</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Generuj plan na:</Label>
              <div className="flex gap-2">
                <Select value={String(miesiac)} onValueChange={v => setMiesiac(Number(v))}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(rok)} onValueChange={v => setRok(Number(v))}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            Podstawa: <strong>obroty {prevMonthName} {rok}</strong> × <strong>+{wspolczynnik}%</strong>
          </div>
          <div>
            <Label className="text-sm mb-1 block">Wzrost planu (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={wspolczynnik}
                onChange={e => setWspolczynnik(Number(e.target.value))}
                className="w-24"
                min={-50}
                max={200}
                step={1}
              />
              <span className="text-sm text-muted-foreground">
                {wspolczynnik >= 0 ? "+" : ""}{wspolczynnik}% vs poprzedni miesiąc
              </span>
            </div>
          </div>
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            Zastąpi istniejący plan {MONTHS[miesiac - 1]} {rok}. Klienci bez danych z poprzedniego miesiąca dostają plan ze średniej 2-3 miesięcy wstecz.
          </div>
          {result && (
            <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-300">
              <p className="text-sm font-medium">Wygenerowano: {result.generated} klientow</p>
              {result.skipped > 0 && <p className="text-xs text-muted-foreground">Pominięto (brak danych): {result.skipped}</p>}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetAndClose}>Zamknij</Button>
          <Button onClick={handleGenerate} disabled={loading}>
            <Wand2 className="w-4 h-4 mr-2" /> {loading ? "Generowanie..." : "Generuj plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportWzModal({ open, onClose, defaultRok, defaultMiesiac }: {
  open: boolean;
  onClose: () => void;
  defaultRok: number;
  defaultMiesiac: number;
}) {
  const [importRok, setImportRok] = useState(defaultRok);
  const [importMiesiac, setImportMiesiac] = useState(defaultMiesiac);
  const [result, setResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{details: Array<{name: string; value: number}>; total: number; notFound: string[]; imported: number} | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetAndClose = () => {
    setResult(null);
    setPreview(null);
    setImporting(false);
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setPreview(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("rok", String(importRok));
    formData.append("miesiac", String(importMiesiac));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/wz/import", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setResult(data);
      toast({
        title: `Zastapiono dane za ${MONTHS[importMiesiac - 1]} ${importRok}`,
        description: `Zaimportowano ${data.imported} klientow. Laczna sprzedaz netto: ${fmtPLN(data.total)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/plan/realization"] });
    } catch (err: any) {
      toast({ title: "Blad importu WZ", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Import WZ (obroty z iBiznes)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={String(importMiesiac)} onValueChange={(v) => setImportMiesiac(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={String(importRok)} onValueChange={(v) => setImportRok(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} data-testid="button-upload-wz">
              <Upload className="w-4 h-4 mr-2" /> {importing ? "Importowanie..." : "Wybierz plik XLS/XLSX"}
            </Button>
            <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileUpload} />
          </div>

          <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            Import WZ zastapi WSZYSTKIE dane sprzedazowe za wybrany miesiac. Plik WZ powinien zawierac pelny zakres dat dla danego miesiaca.
          </div>

          <p className="text-xs text-muted-foreground">
            Plik XLS/XLSX z iBiznes. Kolumna A = Typ (filtruje WZ), G = Klient, R = Wartosc netto.
          </p>

          {result && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700">
                <p className="text-sm font-medium">Zaimportowano: {result.imported} klientow, wartosc: {fmtPLN(result.total)}</p>
              </div>

              {result.notFound?.length > 0 && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
                  <p className="text-sm font-medium mb-1">Nieznalezieni klienci ({result.notFound.length}):</p>
                  <ul className="text-xs space-y-1">
                    {result.notFound.map((n: string, i: number) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.details?.length > 0 && (
                <div className="overflow-auto max-h-[250px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lp.</TableHead>
                        <TableHead>Klient</TableHead>
                        <TableHead className="text-right">Wartosc netto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.details
                        .sort((a: any, b: any) => b.value - a.value)
                        .map((d: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell className="text-right">{fmtPLN(d.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Zamknij</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerifyDataModal({
  open, onClose, rok, miesiac,
}: {
  open: boolean; onClose: () => void; rok: number; miesiac: number;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [onlyMismatch, setOnlyMismatch] = useState(true);

  // Fire the fetch whenever the modal opens for a new month.
  const seedKey = `${open ? "o" : "c"}-${rok}-${miesiac}`;
  const lastSeed = useRef<string>("");
  if (open && lastSeed.current !== seedKey) {
    lastSeed.current = seedKey;
    setData(null);
    setLoading(true);
    authFetch(`/api/plan/verify?rok=${rok}&miesiac=${miesiac}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => {
        setLoading(false);
        toast({ title: "Błąd weryfikacji", description: e?.message || "Nie udało się pobrać danych", variant: "destructive" });
      });
  }

  const rows: any[] = data?.rows || [];
  const shown = onlyMismatch ? rows.filter((r) => r.status !== "ok") : rows;

  const badgeFor = (s: string) => {
    if (s === "ok") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">OK</span>;
    if (s === "agg_mismatch") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-medium" title="client_sales ≠ ibiznes_invoices — uruchom agregację">agregacja</span>;
    if (s === "sync_mismatch") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-medium" title="ibiznes_invoices ≠ iBiznes LIVE — uruchom Synchronizuj teraz">sync</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200 font-medium" title="Oba rozjazdy">agg+sync</span>;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Weryfikacja danych sprzedaży — {MONTHS[miesiac - 1]} {rok}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Pobieranie z iBiznes LIVE… (może potrwać kilka sekund)
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 text-xs">
              <p className="mb-1">Porównujemy 3 warstwy:</p>
              <ul className="space-y-0.5 ml-4 list-disc">
                <li><strong>A</strong> = <code>client_sales.sprzedaz</code> (co widać na planie)</li>
                <li><strong>B</strong> = <code>SUM(ibiznes_invoices.koszt)</code> (nasz cache WZ)</li>
                <li><strong>C</strong> = WZ prosto z iBiznes LIVE (MySQL, tu i teraz)</li>
              </ul>
              <p className="mt-1">Idealnie: A = B = C. <span className="text-orange-700 dark:text-orange-400">A ≠ B</span> → uruchom <em>Synchronizuj teraz</em> (agregacja). <span className="text-red-700 dark:text-red-400">B ≠ C</span> → cache out-of-date, też <em>Synchronizuj teraz</em>.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="border rounded-md p-3 text-center">
                <p className="text-xs text-muted-foreground">Klienci OK</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-400">{data.counts.ok}</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-xs text-muted-foreground">Rozjazd agregacji (A≠B)</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{data.counts.aggMismatch}</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-xs text-muted-foreground">Rozjazd sync (B≠C)</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{data.counts.syncMismatch}</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-xs text-muted-foreground">Nieznane WZ (bez klienta)</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmtNum(data.unmatchedLive.sum)}</p>
                <p className="text-[11px] text-muted-foreground">{data.unmatchedLive.count} dok.</p>
              </div>
            </div>

            <div className="border rounded-md p-3 bg-muted/30 text-xs grid grid-cols-3 gap-2">
              <div><span className="text-muted-foreground">Suma A (client_sales):</span> <strong>{fmtPLN(data.totals.clientSales)}</strong></div>
              <div><span className="text-muted-foreground">Suma B (cache WZ):</span> <strong>{fmtPLN(data.totals.ibiznesInvoices)}</strong></div>
              <div><span className="text-muted-foreground">Suma C (LIVE):</span> <strong>{fmtPLN(data.totals.ibiznesLive)}</strong></div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyMismatch} onChange={(e) => setOnlyMismatch(e.target.checked)} />
                Pokaż tylko rozjazdy ({data.counts.aggMismatch + data.counts.syncMismatch})
              </label>
              <p className="text-xs text-muted-foreground">{shown.length} / {rows.length} klientów</p>
            </div>

            <div className="border rounded-md max-h-[380px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Klient</TableHead>
                    <TableHead className="text-right">A — client_sales</TableHead>
                    <TableHead className="text-right">B — cache WZ</TableHead>
                    <TableHead className="text-right">C — iBiznes LIVE</TableHead>
                    <TableHead className="text-right">Δ A−B</TableHead>
                    <TableHead className="text-right">Δ B−C</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r: any) => (
                    <TableRow key={r.clientId} className={r.status === "ok" ? "" : "bg-amber-50/50 dark:bg-amber-900/10"}>
                      <TableCell className="font-medium text-sm">
                        {r.klient}
                        <div className="text-[10px] text-muted-foreground font-mono">
                          NIP: {r.nip || "—"} {r.alias && <span>| alias: {r.alias}</span>}
                          {" | "}WZ: {r.cachedWzCount} cache / {r.liveWzCount} live
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtNum(r.a_clientSales)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtNum(r.b_ibiznesInvoices)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtNum(r.c_ibiznesLive)}</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${Math.abs(r.diffAB) > 1 ? "text-orange-600 dark:text-orange-400 font-bold" : "text-muted-foreground"}`}>
                        {r.diffAB > 0 ? "+" : ""}{fmtNum(r.diffAB)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${Math.abs(r.diffBC) > 1 ? "text-red-600 dark:text-red-400 font-bold" : "text-muted-foreground"}`}>
                        {r.diffBC > 0 ? "+" : ""}{fmtNum(r.diffBC)}
                      </TableCell>
                      <TableCell>{badgeFor(r.status)}</TableCell>
                    </TableRow>
                  ))}
                  {shown.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-green-700 dark:text-green-400 py-6">
                        ✅ Brak rozjazdów. Wszystkie warstwy się zgadzają.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {data.unmatchedLive.topNips?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Top {data.unmatchedLive.topNips.length} niedopasowanych WZ (brak klienta w CRM)
                </summary>
                <div className="mt-2 border rounded-md max-h-[200px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NIP / Alias</TableHead>
                        <TableHead className="text-right">Liczba WZ</TableHead>
                        <TableHead className="text-right">Netto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.unmatchedLive.topNips.map((u: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{u.nip || "—"} {u.alias && <span className="text-muted-foreground">| {u.alias}</span>}</TableCell>
                          <TableCell className="text-right">{u.count}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(u.sum)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zamknij</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTargetsModal({
  open, onClose, rok, miesiac, planData,
}: {
  open: boolean;
  onClose: () => void;
  rok: number;
  miesiac: number;
  planData: any;
}) {
  const { toast } = useToast();
  const rows: any[] = planData?.rows || [];
  const celMiesiacaCurrent: number = planData?.celMiesiaca || 0;
  const celMiesiacaIsCustom: boolean = Boolean(planData?.celMiesiacaIsCustom);
  const defaultCel: number = planData?.defaultCelMiesiaca || 0;
  const prevMonthRealizacja: number = planData?.prevMonthRealizacja || 0;

  // Local editable state, seeded each time the modal opens.
  const [celMiesiaca, setCelMiesiaca] = useState<string>("");
  const [clientCele, setClientCele] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed on open + when data changes.
  const seedKey = `${rok}-${miesiac}-${rows.length}-${celMiesiacaCurrent}`;
  const lastSeed = useRef<string>("");
  if (open && lastSeed.current !== seedKey) {
    lastSeed.current = seedKey;
    setCelMiesiaca(celMiesiacaIsCustom ? String(celMiesiacaCurrent) : "");
    const initial: Record<number, string> = {};
    for (const r of rows) initial[r.clientId] = String(r.cel || 0);
    setClientCele(initial);
    setSearch("");
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) Month-level target: empty string → reset to default (null).
      const celVal = celMiesiaca.trim() === "" ? null : Number(celMiesiaca.replace(/\s/g, ""));
      if (celVal != null && (!Number.isFinite(celVal) || celVal < 0)) {
        throw new Error("Cel miesiąca musi być liczbą ≥ 0");
      }
      const r1 = await authFetch("/api/plan/target", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rok, miesiac, planObrotu: celVal }),
      });
      if (!r1.ok) {
        const b = await r1.json().catch(() => ({}));
        throw new Error(b.message || "Nie udało się zapisać celu miesiąca");
      }

      // 2) Per-client targets — only those actually changed.
      const changed: Array<{ clientId: number; cel: number }> = [];
      for (const r of rows) {
        const newVal = Number(String(clientCele[r.clientId] ?? r.cel).replace(/\s/g, ""));
        if (!Number.isFinite(newVal) || newVal < 0) continue;
        if (Math.round(newVal) !== Math.round(Number(r.cel))) {
          changed.push({ clientId: r.clientId, cel: newVal });
        }
      }
      for (const c of changed) {
        const r2 = await authFetch("/api/plan/client-target", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rok, miesiac, clientId: c.clientId, cel: c.cel }),
        });
        if (!r2.ok) {
          const b = await r2.json().catch(() => ({}));
          throw new Error(b.message || `Błąd zapisu klienta #${c.clientId}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/plan/realization"] });
      toast({
        title: "Cele zapisane",
        description: `Cel miesiąca${celVal == null ? " przywrócony do domyślnego" : ""}. Zaktualizowano klientów: ${changed.length}.`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: "Błąd zapisu", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = search.trim()
    ? rows.filter((r) => (r.klient || "").toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edytuj cele — {MONTHS[miesiac - 1]} {rok}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 text-sm">
            <p className="font-medium mb-1">Cel miesiąca (globalny)</p>
            <p className="text-xs text-muted-foreground mb-2">
              Domyślny = realizacja poprzedniego miesiąca × 1,05 = <strong>{fmtPLN(defaultCel)}</strong>{" "}
              (realizacja prev: {fmtPLN(prevMonthRealizacja)}). Zostaw puste, aby używać domyślnego.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                placeholder={`domyślny: ${fmtNum(defaultCel)}`}
                value={celMiesiaca}
                onChange={(e) => setCelMiesiaca(e.target.value)}
                className="max-w-[220px]"
              />
              <span className="text-sm text-muted-foreground">PLN</span>
              {celMiesiacaIsCustom && celMiesiaca !== "" && (
                <Button size="sm" variant="ghost" onClick={() => setCelMiesiaca("")}>
                  Przywróć domyślny
                </Button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <Label className="text-sm font-medium">Cele per klient</Label>
              <Input
                placeholder="Szukaj klienta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-[240px]"
              />
            </div>
            <div className="border rounded-md max-h-[350px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Klient</TableHead>
                    <TableHead className="text-right w-[120px]">Realizacja</TableHead>
                    <TableHead className="text-right w-[170px]">Cel (PLN)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.clientId}>
                      <TableCell className="font-medium text-sm">{r.klient}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {fmtNum(r.realizacja)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={clientCele[r.clientId] ?? String(r.cel || 0)}
                          onChange={(e) =>
                            setClientCele((prev) => ({ ...prev, [r.clientId]: e.target.value }))
                          }
                          className="text-right font-mono h-8"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Brak klientów pasujących do wyszukiwania.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz cele"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getRowBgClass(procent: number, realizacja: number) {
  if (realizacja === 0) return "bg-muted/30 italic";
  if (procent >= 100) return "bg-green-50 dark:bg-green-900/10";
  if (procent >= 70) return "";
  if (procent >= 50) return "bg-yellow-50 dark:bg-yellow-900/10";
  return "bg-red-50 dark:bg-red-900/10";
}

function StatusIcon({ procent, realizacja }: { procent: number; realizacja: number }) {
  if (realizacja === 0) return <span className="text-muted-foreground">-</span>;
  if (procent >= 100) return <ArrowUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
  if (procent >= 90) return <ArrowRight className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
  return <ArrowDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
}

export default function PlanPage() {
  const now = new Date();
  const [rok, setRok] = useState(now.getFullYear());
  const [miesiac, setMiesiac] = useState(now.getMonth() + 1);
  const [importWzOpen, setImportWzOpen] = useState(false);
  const [importPlanuOpen, setImportPlanuOpen] = useState(false);
  const [generujPlanOpen, setGenerujPlanOpen] = useState(false);
  const [editTargetsOpen, setEditTargetsOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("procent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterOpiekun, setFilterOpiekun] = useState("all");
  const [filterGrupa, setFilterGrupa] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const { user } = useAuth();
  const isAdmin = user?.rola === "admin";
  const isHandlowiec = user?.rola === "handlowiec";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/plan/realization", rok, miesiac, isHandlowiec ? user?.imie : "all"],
    queryFn: async () => {
      let url = `/api/plan/realization?rok=${rok}&miesiac=${miesiac}`;
      if (isHandlowiec && user?.imie) {
        url += `&opiekun=${encodeURIComponent(user.imie)}`;
      }
      const res = await authFetch(url);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const goToPrev = () => {
    if (miesiac === 1) { setMiesiac(12); setRok(rok - 1); }
    else setMiesiac(miesiac - 1);
  };
  const goToNext = () => {
    if (miesiac === 12) { setMiesiac(1); setRok(rok + 1); }
    else setMiesiac(miesiac + 1);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      // Strings (opiekun / grupa) default to ascending, numbers descending.
      setSortDir(key === "opiekun" || key === "grupa" ? "asc" : "desc");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const rows: any[] = data?.rows || [];
  const dniRoboczeMiniete = data?.dniRoboczeMiniete || 0;
  const dniRoboczeMiesiac = data?.dniRoboczeMiesiac || 0;
  const sumaCel = data?.sumaCel || 0;
  const sumaCelNaDzis = data?.sumaCelNaDzis || 0;
  const sumaRealizacja = data?.sumaRealizacja || 0;
  const sumaRoznica = data?.sumaRoznica || 0;
  const sumaProcent = data?.sumaProcent || 0;
  const celMiesiaca = data?.celMiesiaca || 0;
  const celMiesiacaIsCustom = Boolean(data?.celMiesiacaIsCustom);
  const defaultCelMiesiaca = data?.defaultCelMiesiaca || 0;
  const celMiesiacaNaDzis = data?.celMiesiacaNaDzis || 0;
  const prevMonthRealizacja = data?.prevMonthRealizacja || 0;
  const perOpiekun: Record<string, {realizacja: number; celNaDzis: number; cel: number}> = data?.perOpiekun || {};

  let filteredRows = rows;
  if (filterOpiekun !== "all") {
    filteredRows = filteredRows.filter(r => r.opiekun === filterOpiekun);
  }
  if (filterGrupa !== "all") {
    filteredRows = filteredRows.filter(r => {
      const g = (r.grupa || "").toLowerCase();
      if (filterGrupa === "Premium") return g.includes("premium");
      if (filterGrupa === "Standard") return g.includes("standard");
      if (filterGrupa === "Weryfikacja") return g.includes("weryfikacja");
      return true;
    });
  }
  if (filterStatus !== "all") {
    filteredRows = filteredRows.filter(r => {
      if (filterStatus === "above") return r.procent >= 100;
      if (filterStatus === "below") return r.procent < 100;
      return true;
    });
  }

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortKey === "grupa") {
      const aRank = grupaRank(a.grupa);
      const bRank = grupaRank(b.grupa);
      return sortDir === "asc" ? aRank - bRank : bRank - aRank;
    }
    let aVal = a[sortKey];
    let bVal = b[sortKey];
    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = (bVal || "").toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const filteredSumaCel = filteredRows.reduce((s, r) => s + r.cel, 0);
  const filteredSumaCelNaDzis = filteredRows.reduce((s, r) => s + r.celNaDzis, 0);
  const filteredSumaRealizacja = filteredRows.reduce((s, r) => s + r.realizacja, 0);
  const filteredSumaRoznica = filteredSumaRealizacja - filteredSumaCelNaDzis;
  const filteredSumaProcent = filteredSumaCelNaDzis > 0 ? (filteredSumaRealizacja / filteredSumaCelNaDzis) * 100 : 0;

  const isAbovePlan = sumaRealizacja >= celMiesiacaNaDzis;
  const statusDiff = Math.abs(sumaRealizacja - celMiesiacaNaDzis);
  const rozjazdCount = rows.filter((r: any) => r.rozjazdIbiznes).length;

  const SortableHead = ({ label, field, className }: { label: string; field: SortKey; className?: string }) => {
    const isActive = sortKey === field;
    const isRight = (className || "").includes("text-right");
    return (
      <TableHead
        className={`cursor-pointer select-none hover-elevate ${className || ""}`}
        onClick={() => handleSort(field)}
        data-testid={`sort-${field}`}
      >
        <span className={`flex items-center gap-1 ${isRight ? "justify-end" : ""}`}>
          {label}
          {isActive ? (
            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-30" />
          )}
        </span>
      </TableHead>
    );
  };

  const grupaShort = (g: string) => {
    if (!g) return "-";
    if (g.toLowerCase().includes("premium")) return "Premium";
    if (g.toLowerCase().includes("standard")) return "Standard";
    if (g.toLowerCase().includes("weryfikacja")) return "Weryf.";
    return "Inne";
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Target className="w-6 h-6" /> Plan miesieczny
          </h1>
          <p className="text-sm text-muted-foreground">
            Tracking realizacji — {MONTHS[miesiac - 1]} {rok} (dni robocze: {dniRoboczeMiniete}/{dniRoboczeMiesiac})
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/plan/realization"] })} data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Odswiez
          </Button>
          {isAdmin && (<>
            <Button variant="outline" onClick={() => setVerifyOpen(true)} data-testid="button-verify-plan">
              <ShieldCheck className="w-4 h-4 mr-2" /> Weryfikuj dane
            </Button>
            <Button variant="outline" onClick={() => setEditTargetsOpen(true)} data-testid="button-edit-targets">
              <Pencil className="w-4 h-4 mr-2" /> Edytuj cele
            </Button>
            <Button variant="outline" onClick={() => setImportPlanuOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Import planu
            </Button>
            <Button variant="outline" onClick={() => setGenerujPlanOpen(true)}>
              <Wand2 className="w-4 h-4 mr-2" /> Generuj plan
            </Button>
            <Button variant="outline" onClick={() => setImportWzOpen(true)} data-testid="button-import-wz">
              <Upload className="w-4 h-4 mr-2" /> Import WZ
            </Button>
          </>)}
          <Button size="icon" variant="outline" onClick={goToPrev} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Select value={String(miesiac)} onValueChange={(v) => setMiesiac(Number(v))}>
            <SelectTrigger className="w-[140px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(rok)} onValueChange={(v) => setRok(Number(v))}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline" onClick={goToNext} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              Cel miesiaca
              {celMiesiacaIsCustom ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">custom</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium" title="Domyślny cel = realizacja z poprzedniego miesiąca × 1,05">auto +5%</span>
              )}
            </p>
            <p className="text-xl font-bold" data-testid="text-cel-miesiaca">{fmtPLN(celMiesiaca)}</p>
            <p className="text-xs text-muted-foreground">
              Suma per klient: {fmtPLN(sumaCel)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Cel na dzis</p>
            <p className="text-xl font-bold" data-testid="text-cel-na-dzis">{fmtPLN(celMiesiacaNaDzis)}</p>
            <p className="text-xs text-muted-foreground">{fmtPLN(celMiesiaca)} / {dniRoboczeMiesiac} x {dniRoboczeMiniete}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Realizacja (WZ)</p>
            <p className="text-xl font-bold" data-testid="text-realizacja">{fmtPLN(sumaRealizacja)}</p>
            {rozjazdCount > 0 && isAdmin && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1 mt-1" title="Liczba klientów u których client_sales różni się od ibiznes_invoices. Uruchom ponowną synchronizację.">
                <AlertTriangle className="w-3 h-3" /> {rozjazdCount} klient. z rozjazdem vs iBiznes
              </p>
            )}
          </CardContent>
        </Card>
        <Card className={isAbovePlan ? "border-green-400 dark:border-green-600" : "border-red-400 dark:border-red-600"}>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Status</p>
            <div className={`flex items-center justify-center gap-1 ${isAbovePlan ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {isAbovePlan ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <p className="text-lg font-bold" data-testid="text-status">
                {isAbovePlan ? "Powyzej planu" : "Ponizej planu"} {isAbovePlan ? "+" : "-"}{fmtPLN(statusDiff)}
              </p>
            </div>
            <p className="text-sm font-medium">{sumaProcent.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {isAdmin && (
          <Select value={filterOpiekun} onValueChange={setFilterOpiekun}>
            <SelectTrigger className="w-[140px]" data-testid="filter-opiekun">
              <SelectValue placeholder="Opiekun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy</SelectItem>
              <SelectItem value="Gosia">Gosia</SelectItem>
              <SelectItem value="Magda">Magda</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={filterGrupa} onValueChange={setFilterGrupa}>
          <SelectTrigger className="w-[140px]" data-testid="filter-grupa">
            <SelectValue placeholder="Grupa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="Premium">Premium</SelectItem>
            <SelectItem value="Standard">Standard</SelectItem>
            <SelectItem value="Weryfikacja">Weryfikacja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy</SelectItem>
            <SelectItem value="above">Powyzej planu</SelectItem>
            <SelectItem value="below">Ponizej planu</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {sortedRows.length} klientow
        </span>
      </div>

      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Klient</TableHead>
              <SortableHead label="Opiekun" field="opiekun" />
              <SortableHead label="Grupa" field="grupa" />
              <SortableHead label="Cel miesiaca" field="cel" className="text-right" />
              <SortableHead label="Cel na dzis" field="celNaDzis" className="text-right" />
              <SortableHead label="Realizacja (WZ)" field="realizacja" className="text-right" />
              <SortableHead label="Roznica" field="roznica" className="text-right" />
              <SortableHead label="%" field="procent" className="text-right" />
              <TableHead className="w-10">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, idx) => (
              <TableRow key={row.clientId} className={getRowBgClass(row.procent, row.realizacja)} data-testid={`row-plan-${row.clientId}`}>
                <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1">
                    {row.klient}
                    {row.rozjazdIbiznes && isAdmin && (
                      <span
                        className="text-amber-600 dark:text-amber-400"
                        title={`Rozjazd: client_sales ${fmtNum(row.realizacja)} vs iBiznes ${fmtNum(row.realizacjaIbiznes)}. Odśwież sync.`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>{row.opiekun}</TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{grupaShort(row.grupa)}</span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{fmtNum(row.cel)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmtNum(row.celNaDzis)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">{fmtNum(row.realizacja)}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${row.roznica >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {row.roznica >= 0 ? "+" : ""}{fmtNum(row.roznica)}
                </TableCell>
                <TableCell className={`text-right font-mono text-sm font-medium ${row.procent >= 100 ? "text-green-600 dark:text-green-400" : row.procent >= 90 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                  {row.realizacja === 0 ? "-" : `${row.procent.toFixed(1)}%`}
                </TableCell>
                <TableCell className="text-center">
                  <StatusIcon procent={row.procent} realizacja={row.realizacja} />
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold border-t-2">
              <TableCell />
              <TableCell className="text-base">RAZEM</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="text-right font-mono">{fmtNum(filteredSumaCel)}</TableCell>
              <TableCell className="text-right font-mono">{fmtNum(filteredSumaCelNaDzis)}</TableCell>
              <TableCell className="text-right font-mono">{fmtNum(filteredSumaRealizacja)}</TableCell>
              <TableCell className={`text-right font-mono ${filteredSumaRoznica >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {filteredSumaRoznica >= 0 ? "+" : ""}{fmtNum(filteredSumaRoznica)}
              </TableCell>
              <TableCell className={`text-right font-mono ${filteredSumaProcent >= 100 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {filteredSumaProcent.toFixed(1)}%
              </TableCell>
              <TableCell className="text-center">
                <StatusIcon procent={filteredSumaProcent} realizacja={filteredSumaRealizacja || 1} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {Object.keys(perOpiekun).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(perOpiekun).map(([name, stats]) => {
            const pct = stats.celNaDzis > 0 ? (stats.realizacja / stats.celNaDzis) * 100 : 0;
            const isAbove = pct >= 100;
            return (
              <Card key={name} className={isAbove ? "border-green-300 dark:border-green-700" : "border-red-300 dark:border-red-700"}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-bold text-lg">{name}</p>
                      <p className="text-sm text-muted-foreground">Cel miesiaca: {fmtPLN(stats.cel)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${isAbove ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {pct.toFixed(1)}%
                      </p>
                      <p className="text-sm">
                        Realizacja <span className="font-medium">{fmtPLN(stats.realizacja)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Cel na dzis: {fmtPLN(stats.celNaDzis)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ImportPlanuModal open={importPlanuOpen} onClose={() => setImportPlanuOpen(false)} defaultRok={rok} defaultMiesiac={miesiac} />
      <GenerujPlanModal open={generujPlanOpen} onClose={() => setGenerujPlanOpen(false)} defaultRok={rok} defaultMiesiac={miesiac} />
      <ImportWzModal open={importWzOpen} onClose={() => setImportWzOpen(false)} defaultRok={rok} defaultMiesiac={miesiac} />
      {isAdmin && (
        <EditTargetsModal
          open={editTargetsOpen}
          onClose={() => setEditTargetsOpen(false)}
          rok={rok}
          miesiac={miesiac}
          planData={data}
        />
      )}
      {isAdmin && (
        <VerifyDataModal
          open={verifyOpen}
          onClose={() => setVerifyOpen(false)}
          rok={rok}
          miesiac={miesiac}
        />
      )}
    </div>
  );
}