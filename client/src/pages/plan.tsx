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
import { Target, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowRight, Upload, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { MONTHS_ASCII as MONTHS } from "@/lib/constants";

function fmtPLN(val: number) {
  return Math.round(val).toLocaleString("pl-PL") + " PLN";
}

function fmtNum(val: number) {
  return Math.round(val).toLocaleString("pl-PL");
}

type SortKey = "klient" | "opiekun" | "cel" | "celNaDzis" | "realizacja" | "roznica" | "procent";
type SortDir = "asc" | "desc";

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
      setSortDir(key === "klient" || key === "opiekun" ? "asc" : "desc");
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

  const isAbovePlan = sumaRealizacja >= sumaCelNaDzis;
  const statusDiff = Math.abs(sumaRealizacja - sumaCelNaDzis);

  const SortableHead = ({ label, field, className }: { label: string; field: SortKey; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none hover-elevate ${className || ""}`}
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === field && (
          sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        )}
      </span>
    </TableHead>
  );

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
          {isAdmin && (
            <Button variant="outline" onClick={() => setImportWzOpen(true)} data-testid="button-import-wz">
              <Upload className="w-4 h-4 mr-2" /> Import WZ
            </Button>
          )}
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
            <p className="text-sm text-muted-foreground">Cel miesiaca</p>
            <p className="text-xl font-bold" data-testid="text-cel-miesiaca">{fmtPLN(sumaCel)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Cel na dzis</p>
            <p className="text-xl font-bold" data-testid="text-cel-na-dzis">{fmtPLN(sumaCelNaDzis)}</p>
            <p className="text-xs text-muted-foreground">{fmtPLN(sumaCel)} / {dniRoboczeMiesiac} x {dniRoboczeMiniete}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Realizacja (WZ)</p>
            <p className="text-xl font-bold" data-testid="text-realizacja">{fmtPLN(sumaRealizacja)}</p>
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
              <SortableHead label="Klient" field="klient" />
              <SortableHead label="Opiekun" field="opiekun" />
              <TableHead>Grupa</TableHead>
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
                <TableCell className="font-medium">{row.klient}</TableCell>
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

      <ImportWzModal open={importWzOpen} onClose={() => setImportWzOpen(false)} defaultRok={rok} defaultMiesiac={miesiac} />
    </div>
  );
}