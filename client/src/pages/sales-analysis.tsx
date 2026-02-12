import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch, useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Star, ArrowUp, ArrowDown, ArrowRight, Upload, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";

const COLORS = [
  "hsl(210, 92%, 45%)", "hsl(25, 95%, 42%)", "hsl(340, 82%, 38%)",
  "hsl(160, 65%, 35%)", "hsl(280, 75%, 40%)", "hsl(45, 85%, 45%)",
  "hsl(190, 70%, 40%)", "hsl(0, 0%, 55%)",
];

const MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function fmtPLN(val: number) {
  return Math.round(val).toLocaleString("pl-PL") + " PLN";
}

function fmtMarza(val: number) {
  return val.toFixed(1) + "%";
}

function marzaColor(marza: number): string {
  if (marza > 35) return "hsl(142, 76%, 30%)";
  if (marza >= 20) return "hsl(45, 85%, 40%)";
  return "hsl(0, 84%, 40%)";
}

function ZmianaArrow({ zmiana }: { zmiana: number | null }) {
  if (zmiana === null || zmiana === undefined) return <span className="text-muted-foreground">-</span>;
  const isNeutral = Math.abs(zmiana) < 1;
  if (isNeutral) return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <ArrowRight className="w-3 h-3" />
      {zmiana >= 0 ? "+" : ""}{zmiana.toFixed(1)}%
    </span>
  );
  const isPositive = zmiana > 0;
  return (
    <span className={`flex items-center gap-1 font-medium ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {isPositive ? "+" : ""}{zmiana.toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, prevValue, prevLabel, isMarza }: {
  label: string;
  value: number;
  prevValue: number;
  prevLabel: string;
  isMarza?: boolean;
}) {
  const displayValue = isMarza ? fmtMarza(value) : fmtPLN(value);
  const displayPrev = isMarza ? fmtMarza(prevValue) : fmtPLN(prevValue);

  let changeText: string;
  let changeColor: string;
  if (isMarza) {
    const diff = value - prevValue;
    const sign = diff >= 0 ? "+" : "";
    changeText = `${sign}${diff.toFixed(1)}pp`;
    changeColor = diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  } else {
    if (prevValue === 0 && value === 0) {
      changeText = "\u2192 0%";
      changeColor = "text-muted-foreground";
    } else if (prevValue === 0) {
      changeText = "\u2191 nowy";
      changeColor = "text-green-600 dark:text-green-400";
    } else {
      const pctChange = ((value - prevValue) / prevValue * 100);
      const sign = pctChange >= 0 ? "+" : "";
      const arrow = pctChange > 0 ? "\u2191" : pctChange < 0 ? "\u2193" : "\u2192";
      changeText = `${arrow} ${sign}${pctChange.toFixed(1)}%`;
      changeColor = pctChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    }
  }

  const isProfit = label === "Zysk";

  return (
    <Card data-testid={`card-kpi-${label.toLowerCase()}`}>
      <CardContent className="p-4 text-center space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold ${isProfit ? "text-green-600 dark:text-green-400" : ""}`} data-testid={`text-kpi-${label.toLowerCase()}`}>
          {displayValue}
        </p>
        <p className="text-xs text-muted-foreground">
          vs {prevLabel}: {displayPrev}{" "}
          <span className={`font-medium ${changeColor}`}>({changeText})</span>
        </p>
      </CardContent>
    </Card>
  );
}

function parseCSVContent(content: string): Array<{klient: string; sprzedaz: number; koszt: number; zysk: number; marza: number}> {
  const lines = content.split("\n").map(l => l.replace(/\r$/, "")).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return {
      klient: row["Klient"] || row["klient"] || "",
      sprzedaz: parseFloat(row["Sprzedaz"] || row["sprzedaz"] || "0") || 0,
      koszt: parseFloat(row["Koszt"] || row["koszt"] || "0") || 0,
      zysk: parseFloat(row["Zysk"] || row["zysk"] || "0") || 0,
      marza: parseFloat(row["Marza"] || row["marza"] || "0") || 0,
    };
  }).filter(r => r.klient);
}

function ImportSalesModal({ open, onClose, defaultRok, defaultMiesiac }: {
  open: boolean;
  onClose: () => void;
  defaultRok: number;
  defaultMiesiac: number;
}) {
  const [importRok, setImportRok] = useState(defaultRok);
  const [importMiesiac, setImportMiesiac] = useState(defaultMiesiac);
  const [parsedData, setParsedData] = useState<Array<{klient: string; sprzedaz: number; koszt: number; zysk: number; marza: number}>>([]);
  const [fileName, setFileName] = useState("");
  const [existsWarning, setExistsWarning] = useState(false);
  const [existsCount, setExistsCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/sales-data/check?rok=${importRok}&miesiac=${importMiesiac}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/sales-data?rok=${importRok}&miesiac=${importMiesiac}`);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: typeof parsedData) => {
      const res = await apiRequest("POST", "/api/sales-data/import", { rok: importRok, miesiac: importMiesiac, data });
      return res.json();
    },
    onSuccess: (result) => {
      const notFoundMsg = result.notFound?.length > 0 ? ` Nieznalezieni: ${result.notFound.join(", ")}` : "";
      toast({ title: `Zaimportowano dane za ${MONTHS[importMiesiac - 1]} ${importRok}`, description: `${result.imported} klientow.${notFoundMsg}` });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-analysis"] });
      resetAndClose();
    },
    onError: () => {
      toast({ title: "Blad importu", variant: "destructive" });
    },
  });

  const resetAndClose = () => {
    setParsedData([]);
    setFileName("");
    setExistsWarning(false);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const data = parseCSVContent(content);
      setParsedData(data);
      setExistsWarning(false);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    const checkResult = await checkMutation.mutateAsync();
    if (checkResult.exists && !existsWarning) {
      setExistsWarning(true);
      setExistsCount(checkResult.count);
      return;
    }

    if (existsWarning) {
      await deleteMutation.mutateAsync();
    }

    importMutation.mutate(parsedData);
  };

  const totalSprzedaz = parsedData.reduce((s, r) => s + r.sprzedaz, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Import danych sprzedazowych</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={String(importMiesiac)} onValueChange={(v) => { setImportMiesiac(Number(v)); setExistsWarning(false); }}>
              <SelectTrigger className="w-[140px]" data-testid="select-import-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(importRok)} onValueChange={(v) => { setImportRok(Number(v)); setExistsWarning(false); }}>
              <SelectTrigger className="w-[100px]" data-testid="select-import-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-upload-csv">
              <Upload className="w-4 h-4 mr-2" /> {fileName || "Wybierz plik CSV"}
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </div>

          {existsWarning && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm">Dane za {MONTHS[importMiesiac - 1]} {importRok} juz istnieja ({existsCount} rekordow). Kliknij ponownie aby nadpisac.</span>
            </div>
          )}

          {parsedData.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Podglad: {parsedData.length} klientow, laczna sprzedaz: {fmtPLN(totalSprzedaz)}</p>
              <div className="overflow-auto max-h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lp.</TableHead>
                      <TableHead>Klient</TableHead>
                      <TableHead className="text-right">Sprzedaz</TableHead>
                      <TableHead className="text-right">Koszt</TableHead>
                      <TableHead className="text-right">Zysk</TableHead>
                      <TableHead className="text-right">Marza</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.klient}</TableCell>
                        <TableCell className="text-right">{fmtPLN(r.sprzedaz)}</TableCell>
                        <TableCell className="text-right">{fmtPLN(r.koszt)}</TableCell>
                        <TableCell className="text-right">{fmtPLN(r.zysk)}</TableCell>
                        <TableCell className="text-right">{r.marza.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                    {parsedData.length > 50 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">...i {parsedData.length - 50} wiecej</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} data-testid="button-cancel-import">Anuluj</Button>
          <Button onClick={handleImport} disabled={parsedData.length === 0 || importMutation.isPending} data-testid="button-do-import">
            {importMutation.isPending ? "Importowanie..." : existsWarning ? "Nadpisz i importuj" : "Importuj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SalesAnalysisPage() {
  const [rok, setRok] = useState(2026);
  const [miesiac, setMiesiac] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.rola === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-analysis", rok, miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/sales-analysis?rok=${rok}&miesiac=${miesiac}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const toggleGroup = (grupa: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(grupa)) next.delete(grupa);
      else next.add(grupa);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const groups: any[] = data?.groups || [];
  const prevMiesiac = data?.prevMiesiac;
  const prevRok = data?.prevRok;
  const totalSales = groups.reduce((s: number, g: any) => s + Number(g.sprzedaz || 0), 0);
  const totalCost = groups.reduce((s: number, g: any) => s + Number(g.koszt || 0), 0);
  const totalProfit = groups.reduce((s: number, g: any) => s + Number(g.zysk || 0), 0);
  const totalMargin = totalSales > 0 ? (totalProfit / totalSales * 100) : 0;
  const totalKlientow = groups.reduce((s: number, g: any) => s + (g.klientow || 0), 0);
  const totalAktywnych = groups.reduce((s: number, g: any) => s + (g.aktywnych || 0), 0);
  const totalPrev = groups.reduce((s: number, g: any) => s + Number(g.prevSprzedaz || 0), 0);
  const totalZmiana = totalPrev > 0 ? ((totalSales - totalPrev) / totalPrev * 100) : 0;

  const prevTotalSales = Number(data?.prevTotalSales || 0);
  const prevTotalCost = Number(data?.prevTotalCost || 0);
  const prevTotalProfit = Number(data?.prevTotalProfit || 0);
  const prevTotalMarza = Number(data?.prevTotalMarza || 0);

  const prevMonthLabel = prevMiesiac ? `${MONTHS_SHORT[prevMiesiac - 1]} ${String(prevRok).slice(2)}` : "";

  const pieThreshold = 3;
  const pieRaw = groups
    .filter((g: any) => Number(g.sprzedaz || 0) > 0)
    .map((g: any) => ({
      name: g.grupa,
      value: Number(g.sprzedaz || 0),
      pct: totalSales > 0 ? (Number(g.sprzedaz || 0) / totalSales * 100) : 0,
    }));

  const pieMain = pieRaw.filter(p => p.pct >= pieThreshold);
  const pieInne = pieRaw.filter(p => p.pct < pieThreshold);
  const pieInneTotal = pieInne.reduce((s, p) => s + p.value, 0);
  const pieData = pieInneTotal > 0
    ? [...pieMain, { name: "Inne", value: pieInneTotal, pct: totalSales > 0 ? (pieInneTotal / totalSales * 100) : 0 }]
    : pieMain;

  const barData = groups.map((g: any) => ({
    grupa: g.grupa.length > 15 ? g.grupa.replace("Weryfikacja ", "Wer. ") : g.grupa,
    sprzedaz: Number(g.sprzedaz || 0),
    prevSprzedaz: Number(g.prevSprzedaz || 0),
  }));

  const renderPieLabel = ({ name, pct }: any) => {
    const shortName = name.length > 12 ? name.replace("Weryfikacja ", "W.").replace("Premium", "P.").replace("Standard", "St.") : name;
    return `${shortName} ${pct.toFixed(1)}%`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Analiza sprzedazy</h1>
          <p className="text-sm text-muted-foreground">
            {MONTHS[miesiac - 1]} {rok} | Klientow aktywnych: {totalAktywnych}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-sales">
              <Upload className="w-4 h-4 mr-2" /> Import danych
            </Button>
          )}
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
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Sprzedaz" value={totalSales} prevValue={prevTotalSales} prevLabel={prevMonthLabel} />
        <KpiCard label="Koszt" value={totalCost} prevValue={prevTotalCost} prevLabel={prevMonthLabel} />
        <KpiCard label="Zysk" value={totalProfit} prevValue={prevTotalProfit} prevLabel={prevMonthLabel} />
        <KpiCard label="Marza" value={totalMargin} prevValue={prevTotalMarza} prevLabel={prevMonthLabel} isMarza />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Udzial grup w sprzedazy</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {pieData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtPLN(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Brak danych</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sprzedaz: biezacy vs poprzedni miesiac</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="grupa" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={55} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => fmtPLN(Number(v))} />
                  <Legend />
                  <Bar dataKey="prevSprzedaz" name={`${prevMonthLabel}`} fill="hsl(0, 0%, 75%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sprzedaz" name={`${MONTHS_SHORT[miesiac - 1]} ${String(rok).slice(2)}`} fill="hsl(210, 92%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Brak danych</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Podsumowanie grup — {MONTHS[miesiac - 1]} {rok}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupa</TableHead>
                  <TableHead className="text-right">Aktywni / Wszyscy</TableHead>
                  <TableHead className="text-right">Sprzedaz</TableHead>
                  <TableHead className="text-right">Udzial %</TableHead>
                  <TableHead className="text-right">Koszt</TableHead>
                  <TableHead className="text-right">Zysk</TableHead>
                  <TableHead className="text-right">Marza</TableHead>
                  <TableHead className="text-right">Zmiana vs poprz.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g: any, i: number) => {
                  const udzial = totalSales > 0 ? (Number(g.sprzedaz || 0) / totalSales * 100) : 0;
                  return (
                    <TableRow key={i} className="cursor-pointer hover-elevate" onClick={() => toggleGroup(g.grupa)} data-testid={`row-group-${i}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {expandedGroups.has(g.grupa) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          {g.grupa}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{g.aktywnych} / {g.klientow}</TableCell>
                      <TableCell className="text-right font-medium">{fmtPLN(g.sprzedaz)}</TableCell>
                      <TableCell className="text-right">{udzial.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{fmtPLN(g.koszt)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtPLN(g.zysk)}</TableCell>
                      <TableCell className="text-right">{fmtMarza(Number(g.marza))}</TableCell>
                      <TableCell className="text-right"><ZmianaArrow zmiana={g.zmiana} /></TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold text-base">RAZEM</TableCell>
                  <TableCell className="text-right font-bold text-base">{totalAktywnych} / {totalKlientow}</TableCell>
                  <TableCell className="text-right font-bold text-base">{fmtPLN(totalSales)}</TableCell>
                  <TableCell className="text-right font-bold text-base">100%</TableCell>
                  <TableCell className="text-right font-bold text-base">{fmtPLN(totalCost)}</TableCell>
                  <TableCell className="text-right font-bold text-base">{fmtPLN(totalProfit)}</TableCell>
                  <TableCell className="text-right font-bold text-base">{fmtMarza(totalMargin)}</TableCell>
                  <TableCell className="text-right font-bold text-base"><ZmianaArrow zmiana={totalZmiana} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {groups.map((g: any, gi: number) => {
        if (!expandedGroups.has(g.grupa) || !g.klienci || g.klienci.length === 0) return null;

        const activeClients = g.klienci.filter((k: any) => k.sprzedaz > 0);
        const inactiveClients = g.klienci.filter((k: any) => k.sprzedaz <= 0);
        activeClients.sort((a: any, b: any) => b.sprzedaz - a.sprzedaz);
        const topClientId = activeClients.length > 0 ? activeClients[0].id : null;
        const allSorted = [...activeClients, ...inactiveClients];

        return (
          <Card key={gi}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{g.grupa}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">Aktywni: {g.aktywnych}/{g.klientow}</Badge>
                  <Badge variant="secondary">Sprzedaz: {fmtPLN(g.sprzedaz)}</Badge>
                  <Badge variant="secondary">Zysk: {fmtPLN(g.zysk)}</Badge>
                  <Badge variant="secondary">Marza: {fmtMarza(Number(g.marza))}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Lp.</TableHead>
                      <TableHead>Klient</TableHead>
                      <TableHead className="text-right">Sprzedaz</TableHead>
                      <TableHead className="text-right">Koszt</TableHead>
                      <TableHead className="text-right">Zysk</TableHead>
                      <TableHead className="text-right">Marza</TableHead>
                      <TableHead className="text-right">Sprzedaz {prevMonthLabel}</TableHead>
                      <TableHead className="text-right">Zmiana</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSorted.map((k: any, ki: number) => {
                      const isInactive = k.sprzedaz <= 0;
                      const isTop = k.id === topClientId;
                      const bigDrop = k.zmiana !== null && k.zmiana < -50;

                      let rowClass = "";
                      if (bigDrop && !isInactive) rowClass = "bg-red-50 dark:bg-red-950/30";
                      if (isInactive) rowClass = "bg-muted/40";

                      return (
                        <TableRow key={ki} className={rowClass} data-testid={`row-client-${k.id}`}>
                          <TableCell className={`text-muted-foreground ${isInactive ? "italic" : ""}`}>{ki + 1}</TableCell>
                          <TableCell className={`${isTop ? "font-bold" : ""} ${isInactive ? "italic text-muted-foreground" : "font-medium"}`}>
                            <div className="flex items-center gap-1">
                              {isTop && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                              {k.klient}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right ${isInactive ? "italic text-muted-foreground" : ""}`}>{fmtPLN(k.sprzedaz)}</TableCell>
                          <TableCell className={`text-right ${isInactive ? "italic text-muted-foreground" : ""}`}>{fmtPLN(k.koszt)}</TableCell>
                          <TableCell className={`text-right font-medium ${isInactive ? "italic text-muted-foreground" : ""}`}>{fmtPLN(k.zysk)}</TableCell>
                          <TableCell className="text-right">
                            <span style={{ color: isInactive ? "inherit" : marzaColor(k.marza) }} className={isInactive ? "italic text-muted-foreground" : "font-medium"}>
                              {fmtMarza(k.marza)}
                            </span>
                          </TableCell>
                          <TableCell className={`text-right ${isInactive ? "italic text-muted-foreground" : ""}`}>{fmtPLN(k.prevSprzedaz)}</TableCell>
                          <TableCell className="text-right"><ZmianaArrow zmiana={k.zmiana} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {isAdmin && <ImportSalesModal open={importOpen} onClose={() => setImportOpen(false)} defaultRok={rok} defaultMiesiac={miesiac} />}
    </div>
  );
}
