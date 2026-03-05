import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DollarSign, Calculator, TrendingUp, TrendingDown, CalendarDays, Download,
  ChevronDown, ChevronRight, Target, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { MONTHS_ASCII, formatPLN } from "@/lib/constants";

const MONTHS = MONTHS_ASCII.map((label, i) => ({ value: String(i + 1), label }));

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function fmt(n: number): string {
  return n.toLocaleString("pl-PL", { maximumFractionDigits: 0 });
}

type CostBreakdown = {
  departments: Array<{ name: string; total: number; categories: Array<{ name: string; total: number }> }>;
  vatTotal: number;
  fixedTotal: number;
  grandTotal: number;
  source: "vat_import" | "fixed_costs" | "both";
};

export default function DailyAnalysisPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear] = useState(now.getFullYear());
  const [localDniRobocze, setLocalDniRobocze] = useState<number | null>(null);
  const [editingValues, setEditingValues] = useState<Record<number, string>>({});
  const [customMarza, setCustomMarza] = useState<number | null>(null);
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const dniRoboczeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rok = selectedYear;
  const miesiac = Number(selectedMonth);

  const MARZA = customMarza ?? 0.354;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/daily-analysis", rok, miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/daily-analysis?rok=${rok}&miesiac=${miesiac}`);
      if (!res.ok) throw new Error("Blad pobierania danych");
      return res.json();
    },
  });

  const prevMonth = miesiac === 1 ? 12 : miesiac - 1;
  const { data: prevData } = useQuery({
    queryKey: ["/api/daily-analysis", rok, prevMonth, "prev"],
    queryFn: async () => {
      const prevRok = miesiac === 1 ? rok - 1 : rok;
      const res = await authFetch(`/api/daily-analysis?rok=${prevRok}&miesiac=${prevMonth}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ dzien, sprzedaz }: { dzien: number; sprzedaz: string | null }) => {
      const res = await authFetch("/api/daily-analysis", {
        method: "PATCH",
        body: JSON.stringify({ rok, miesiac, dzien, sprzedaz }),
      });
      if (!res.ok) throw new Error("Blad zapisu");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-analysis", rok, miesiac] });
    },
  });

  const dniRoboczeMutation = useMutation({
    mutationFn: async (dniRobocze: number) => {
      const res = await authFetch("/api/daily-analysis/dni-robocze", {
        method: "PATCH",
        body: JSON.stringify({ rok, miesiac, dniRobocze }),
      });
      if (!res.ok) throw new Error("Blad zapisu");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-analysis", rok, miesiac] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/daily-analysis/import", {
        method: "POST",
        body: JSON.stringify({ rok, miesiac }),
      });
      if (!res.ok) throw new Error("Blad importu");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-analysis", rok, miesiac] });
      toast({ title: "Import zakonczony", description: `Zaciagnieto sprzedaz z ${data.daysImported} dni.` });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const entries: any[] = data?.entries || [];
  const serverDniRobocze: number = data?.dniRobocze || 21;
  const dniRobocze = localDniRobocze ?? serverDniRobocze;
  const costBreakdown: CostBreakdown | null = data?.costBreakdown || null;

  const fixedCosts: number = costBreakdown?.grandTotal || data?.fixedCosts || 0;
  const prevFixedCosts: number = prevData?.costBreakdown?.grandTotal || prevData?.fixedCosts || 0;

  const kosztDzienny = dniRobocze > 0 ? fixedCosts / dniRobocze : 0;
  const minObrotDzienny = MARZA > 0 ? kosztDzienny / MARZA : 0;

  const totalDays = daysInMonth(rok, miesiac);
  const entryMap: Record<number, number | null> = {};
  for (const e of entries) {
    entryMap[e.dzien] = e.sprzedaz != null ? Number(e.sprzedaz) : null;
  }

  const rows: Array<{
    dzien: number;
    sprzedaz: number | null;
    zyskBrutto: number;
    minusKoszty: number;
    narastajaco: number;
  }> = [];

  let cumulative = 0;
  for (let d = 1; d <= totalDays; d++) {
    const sprzedaz = editingValues[d] !== undefined
      ? (editingValues[d] !== "" ? Number(editingValues[d]) : null)
      : (entryMap[d] ?? null);
    const zyskBrutto = sprzedaz != null ? sprzedaz * MARZA : 0;
    const minusKoszty = sprzedaz != null ? zyskBrutto - kosztDzienny : 0;
    if (sprzedaz != null) cumulative += minusKoszty;
    rows.push({ dzien: d, sprzedaz, zyskBrutto, minusKoszty, narastajaco: cumulative });
  }

  const totalSprzedaz = rows.reduce((s, r) => s + (r.sprzedaz ?? 0), 0);
  const totalZyskBrutto = totalSprzedaz * MARZA;
  const wynikMiesiaca = totalZyskBrutto - fixedCosts;
  const dniZSprzedaza = rows.filter(r => r.sprzedaz != null && r.sprzedaz > 0).length;
  const sredniaSprzedaz = dniZSprzedaza > 0 ? totalSprzedaz / dniZSprzedaza : 0;
  const prognozaMiesiaca = dniRobocze > 0 ? sredniaSprzedaz * dniRobocze : 0;
  const prognozaZysk = prognozaMiesiaca * MARZA - fixedCosts;
  const breakEvenProgress = fixedCosts > 0 ? Math.min((totalZyskBrutto / fixedCosts) * 100, 100) : 0;
  const dniDoBreakEven = sredniaSprzedaz > 0 && MARZA > 0
    ? Math.ceil(fixedCosts / (sredniaSprzedaz * MARZA))
    : null;

  function handleSave(dzien: number) {
    const val = editingValues[dzien];
    const sprzedaz = val !== undefined && val !== "" ? val : null;
    updateMutation.mutate({ dzien, sprzedaz });
    setEditingValues(prev => { const next = { ...prev }; delete next[dzien]; return next; });
  }

  function handleDniRobocze(value: string) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || n > 31) return;
    setLocalDniRobocze(n);
    if (dniRoboczeTimeout.current) clearTimeout(dniRoboczeTimeout.current);
    dniRoboczeTimeout.current = setTimeout(() => {
      dniRoboczeMutation.mutate(n);
      setLocalDniRobocze(null);
    }, 800);
  }

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || "";

  const chartData = rows
    .filter(r => r.sprzedaz != null)
    .map(r => ({
      dzien: r.dzien,
      sprzedaz: r.sprzedaz,
      breakEven: Math.round(minObrotDzienny),
      zysk: Math.round(r.minusKoszty),
    }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-daily-analysis-title">Analiza dzienna</h1>
          <p className="text-sm text-muted-foreground">
            Obroty vs koszty — {monthLabel} {rok}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Miesiac:</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* WYNIK MIESIACA - hero */}
      <Card className={`border-2 ${wynikMiesiaca >= 0 ? "border-green-500/30 bg-green-500/[0.02]" : "border-red-500/30 bg-red-500/[0.02]"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Wynik miesiaca (obroty – koszty)</p>
              <p className={`text-3xl font-bold tabular-nums ${wynikMiesiaca >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {wynikMiesiaca >= 0 ? "+" : ""}{formatPLN(wynikMiesiaca)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {dniZSprzedaza > 0
                  ? `Na podstawie ${dniZSprzedaza} dni z ${dniRobocze} roboczych`
                  : "Brak danych sprzedazy — wpisz lub zaimportuj"}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Obroty</p>
                <p className="text-lg font-bold tabular-nums">{formatPLN(totalSprzedaz)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Zysk brutto ({(MARZA * 100).toFixed(1)}%)</p>
                <p className="text-lg font-bold tabular-nums">{formatPLN(totalZyskBrutto)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Koszty</p>
                <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{formatPLN(fixedCosts)}</p>
              </div>
            </div>
          </div>

          {dniZSprzedaza > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Postep do break-even (pokrycie kosztow)</span>
                <span className="font-medium tabular-nums">{breakEvenProgress.toFixed(0)}%</span>
              </div>
              <Progress value={breakEvenProgress} className="h-3" />
              {dniDoBreakEven != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {breakEvenProgress >= 100
                    ? "Koszty pokryte — jestes na plusie!"
                    : `Szacunkowo ${dniDoBreakEven} dni roboczych do break-even (przy sredniej ${formatPLN(sredniaSprzedaz)}/dzien)`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Koszty miesieczne</p>
                <p className="text-lg font-bold tabular-nums" data-testid="text-fixed-costs">{formatPLN(fixedCosts)}</p>
                <p className="text-xs text-muted-foreground">
                  {costBreakdown?.source === "vat_import" ? "Z importu VAT" : "Koszty stale"}
                </p>
              </div>
              <DollarSign className="w-4 h-4 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Koszt dzienny</p>
                <p className="text-lg font-bold tabular-nums" data-testid="text-daily-cost">{formatPLN(kosztDzienny)}</p>
                <p className="text-xs text-muted-foreground">{fixedCosts > 0 && dniRobocze > 0 ? `${formatPLN(fixedCosts)} / ${dniRobocze} dni` : ""}</p>
              </div>
              <Calculator className="w-4 h-4 text-chart-2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Min. obrot/dzien</p>
                <p className="text-lg font-bold tabular-nums" data-testid="text-min-turnover">{formatPLN(minObrotDzienny)}</p>
                <p className="text-xs text-muted-foreground">Break-even przy marzy {(MARZA * 100).toFixed(1)}%</p>
              </div>
              <Target className="w-4 h-4 text-chart-4" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Prognoza miesiaca</p>
                <p className={`text-lg font-bold tabular-nums ${prognozaZysk >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {prognozaZysk >= 0 ? "+" : ""}{formatPLN(prognozaZysk)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dniZSprzedaza > 0 ? `Sred. ${formatPLN(sredniaSprzedaz)}/dzien x ${dniRobocze} dni` : "Brak danych"}
                </p>
              </div>
              {prognozaZysk >= 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Dni robocze</p>
                <Input
                  type="number"
                  className="mt-1 w-16 font-bold text-lg h-8"
                  value={dniRobocze}
                  onChange={(e) => handleDniRobocze(e.target.value)}
                  min={1} max={31}
                  data-testid="input-dni-robocze"
                />
              </div>
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">Marza %</p>
              <Input
                type="number"
                className="mt-0.5 w-16 font-bold text-sm h-7"
                value={customMarza != null ? (customMarza * 100).toFixed(1) : (0.354 * 100).toFixed(1)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0 && v < 100) setCustomMarza(v / 100);
                }}
                step="0.1"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rozbicie kosztów na działy */}
      {costBreakdown && costBreakdown.departments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Koszty wg dzialow
              <Badge variant="outline" className="text-xs">
                {costBreakdown.source === "vat_import" ? "Import VAT" : "Koszty stale"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {costBreakdown.departments.map(dept => {
              const pct = fixedCosts > 0 ? (dept.total / fixedCosts) * 100 : 0;
              const isOpen = openDepts.has(dept.name);
              return (
                <Collapsible key={dept.name} open={isOpen} onOpenChange={() => {
                  setOpenDepts(prev => {
                    const next = new Set(prev);
                    if (next.has(dept.name)) next.delete(dept.name); else next.add(dept.name);
                    return next;
                  });
                }}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-3 rounded-md hover:bg-muted/50 text-left">
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-medium">{dept.name}</span>
                        <Badge variant="secondary" className="text-xs">{dept.categories.length} poz.</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
                        <span className="font-bold tabular-nums">{formatPLN(dept.total)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">({formatPLN(dniRobocze > 0 ? dept.total / dniRobocze : 0)}/dzien)</span>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mr-2 mb-2 space-y-1">
                      {dept.categories.map(cat => (
                        <div key={cat.name} className="flex items-center justify-between py-1.5 px-2 text-sm rounded hover:bg-muted/30">
                          <span className="text-muted-foreground">{cat.name}</span>
                          <span className="font-mono tabular-nums">{formatPLN(cat.total)}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
            <div className="mt-3 pt-3 border-t flex items-center justify-between font-bold">
              <span>RAZEM KOSZTY</span>
              <span className="tabular-nums">{formatPLN(fixedCosts)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wykres */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sprzedaz dzienna vs break-even</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="dzien" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => formatPLN(v)} />
                  <ReferenceLine y={minObrotDzienny} stroke="hsl(0, 70%, 50%)" strokeDasharray="5 5" label={{ value: "Break-even", position: "insideTopRight", fontSize: 10 }} />
                  <Bar dataKey="sprzedaz" radius={[4, 4, 0, 0]} animationDuration={400}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.sprzedaz! >= minObrotDzienny ? "hsl(145, 60%, 45%)" : "hsl(0, 60%, 55%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela dzienna */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Tabela dzienna — {monthLabel} {rok}</CardTitle>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending} variant="outline" data-testid="button-import-sales">
              <Download className="w-4 h-4 mr-1" />
              {importMutation.isPending ? "Importowanie..." : "Pobierz sprzedaz z zamowien"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Dzien</TableHead>
                  <TableHead className="w-[140px]">Sprzedaz</TableHead>
                  <TableHead className="text-right">Zysk brutto</TableHead>
                  <TableHead className="text-right">Minus koszty</TableHead>
                  <TableHead className="text-right">Narastajaco</TableHead>
                  <TableHead className="text-center w-[50px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const hasValue = row.sprzedaz != null;
                  const isAboveBreakEven = hasValue && row.sprzedaz! >= minObrotDzienny;
                  const narastColor = !hasValue ? ""
                    : row.narastajaco > 0 ? "bg-green-50 dark:bg-green-950/30"
                    : row.narastajaco < 0 ? "bg-red-50 dark:bg-red-950/30" : "";

                  return (
                    <TableRow key={row.dzien} className={!hasValue ? "opacity-40" : narastColor} data-testid={`row-day-${row.dzien}`}>
                      <TableCell className="font-medium">{row.dzien}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-[120px] bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
                          value={editingValues[row.dzien] !== undefined ? editingValues[row.dzien] : (row.sprzedaz != null ? String(row.sprzedaz) : "")}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, [row.dzien]: e.target.value }))}
                          onBlur={() => { if (editingValues[row.dzien] !== undefined) handleSave(row.dzien); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSave(row.dzien);
                              const nextInput = document.querySelector(`[data-testid="row-day-${row.dzien + 1}"] input`) as HTMLInputElement;
                              if (nextInput) nextInput.focus();
                            }
                          }}
                          placeholder="0"
                          data-testid={`input-sprzedaz-${row.dzien}`}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{hasValue ? fmt(row.zyskBrutto) : "—"}</TableCell>
                      <TableCell className={`text-right tabular-nums ${hasValue ? (row.minusKoszty >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400") : ""}`}>
                        {hasValue ? fmt(row.minusKoszty) : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-medium tabular-nums ${hasValue ? (row.narastajaco >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400") : ""}`}>
                        {hasValue ? fmt(row.narastajaco) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasValue && (
                          isAboveBreakEven
                            ? <ArrowUpRight className="w-4 h-4 text-green-600 inline" />
                            : <ArrowDownRight className="w-4 h-4 text-red-600 inline" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Podsumowanie miesiaca */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Podsumowanie — {monthLabel} {rok}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Obroty</p>
              <p className="text-lg font-bold tabular-nums" data-testid="text-summary-sprzedaz">{formatPLN(totalSprzedaz)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Zysk brutto</p>
              <p className="text-lg font-bold tabular-nums" data-testid="text-summary-zysk">{formatPLN(totalZyskBrutto)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Koszty</p>
              <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400" data-testid="text-summary-koszty">{formatPLN(fixedCosts)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">WYNIK</p>
              <p className={`text-lg font-bold tabular-nums ${wynikMiesiaca >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-summary-wynik">
                {wynikMiesiaca >= 0 ? "+" : ""}{formatPLN(wynikMiesiaca)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Srednia/dzien</p>
              <p className="text-lg font-bold tabular-nums" data-testid="text-summary-srednia">{formatPLN(sredniaSprzedaz)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Dni z danymi</p>
              <p className="text-lg font-bold" data-testid="text-summary-dni">{dniZSprzedaza} / {dniRobocze}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
