import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DollarSign, Calculator, TrendingUp, TrendingDown, CalendarDays,
  ChevronDown, ChevronRight, Target, ArrowUpRight, ArrowDownRight,
  Plus, Pencil, Trash2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { MONTHS_ASCII, formatPLN } from "@/lib/constants";
import { countPolishWorkdaysInMonth } from "@shared/polishHolidays";

const MONTHS = MONTHS_ASCII.map((label, i) => ({ value: String(i + 1), label }));

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function countWeekdays(year: number, month: number): number {
  return countPolishWorkdaysInMonth(year, month);
}

function fmt(n: number): string {
  return n.toLocaleString("pl-PL", { maximumFractionDigits: 0 });
}

type ExpenseItem = { id: number; name: string; total: number; typ: string };
type CostBreakdown = {
  departments: Array<{ name: string; total: number; categories: ExpenseItem[] }>;
  vatTotal: number;
  fixedTotal: number;
  ksefTotal: number;
  grandTotal: number;
  source: "manual";
};

const STANDARD_DEPTS = ["Kadry i place", "Biuro i administracja", "Flota"];

const MARZA = 0.354;

export default function DailyAnalysisPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear] = useState(now.getFullYear());
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const rok = selectedYear;
  const miesiac = Number(selectedMonth);

  // Formularz wydatku (dodawanie/edycja)
  const emptyForm = { id: null as number | null, dzial: STANDARD_DEPTS[0], dzialCustom: "", nazwa: "", kwota: "", typ: "staly" };
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const openAddExpense = (dzial?: string) => {
    setForm({ ...emptyForm, dzial: dzial && STANDARD_DEPTS.includes(dzial) ? dzial : (dzial ? "__custom__" : STANDARD_DEPTS[0]), dzialCustom: dzial && !STANDARD_DEPTS.includes(dzial) ? dzial : "" });
    setExpenseOpen(true);
  };
  const openEditExpense = (dzial: string, item: ExpenseItem) => {
    setForm({
      id: item.id,
      dzial: STANDARD_DEPTS.includes(dzial) ? dzial : "__custom__",
      dzialCustom: STANDARD_DEPTS.includes(dzial) ? "" : dzial,
      nazwa: item.name,
      kwota: String(item.total),
      typ: item.typ,
    });
    setExpenseOpen(true);
  };

  const invalidateAnalysis = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/daily-analysis", rok, miesiac] });
  };

  const saveExpense = useMutation({
    mutationFn: async () => {
      const dzial = form.dzial === "__custom__" ? form.dzialCustom.trim() : form.dzial;
      if (!dzial) throw new Error("Podaj nazwe dzialu");
      if (!form.nazwa.trim()) throw new Error("Podaj nazwe wydatku");
      const kwota = Number(form.kwota);
      if (!kwota || kwota <= 0) throw new Error("Podaj poprawna kwote");
      const payload: any = {
        nazwa: form.nazwa.trim(),
        dzial,
        kwota: String(kwota),
        typ: form.typ,
        rok: form.typ === "zmienny" ? rok : null,
        miesiac: form.typ === "zmienny" ? miesiac : null,
      };
      if (form.id != null) {
        await apiRequest("PATCH", `/api/manual-expenses/${form.id}`, payload);
      } else {
        await apiRequest("POST", "/api/manual-expenses", payload);
      }
    },
    onSuccess: () => {
      setExpenseOpen(false);
      invalidateAnalysis();
      toast({ title: form.id != null ? "Wydatek zaktualizowany" : "Wydatek dodany" });
    },
    onError: (err: any) => toast({ title: "Blad", description: err.message, variant: "destructive" }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/manual-expenses/${id}`); },
    onSuccess: () => { invalidateAnalysis(); toast({ title: "Wydatek usuniety" }); },
    onError: (err: any) => toast({ title: "Blad", description: err.message, variant: "destructive" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/daily-analysis", rok, miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/daily-analysis?rok=${rok}&miesiac=${miesiac}`);
      if (!res.ok) throw new Error("Blad pobierania danych");
      return res.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
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
  const dniRobocze = countWeekdays(rok, miesiac);
  const costBreakdown: CostBreakdown | null = data?.costBreakdown || null;
  const fixedCosts: number = costBreakdown?.grandTotal || data?.fixedCosts || 0;

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
    const sprzedaz = entryMap[d] ?? null;
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
            Sprzedaz dzienna vs koszt dzienny — {monthLabel} {rok}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Button onClick={() => openAddExpense()} data-testid="button-add-expense">
            <Plus className="w-4 h-4 mr-2" />
            Dodaj wydatek
          </Button>
        </div>
      </div>

      {/* WYNIK MIESIACA */}
      <Card className={`border-2 ${wynikMiesiaca >= 0 ? "border-green-500/30 bg-green-500/[0.02]" : "border-red-500/30 bg-red-500/[0.02]"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Wynik miesiaca (sprzedaz x marza – koszty stale)</p>
              <p className={`text-3xl font-bold tabular-nums ${wynikMiesiaca >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {wynikMiesiaca >= 0 ? "+" : ""}{formatPLN(wynikMiesiaca)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {dniZSprzedaza > 0
                  ? `Na podstawie ${dniZSprzedaza} dni z ${dniRobocze} roboczych`
                  : "Brak danych sprzedazy — zsynchronizuj iBiznes"}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Koszty miesieczne</p>
                <p className="text-lg font-bold tabular-nums" data-testid="text-fixed-costs">{formatPLN(fixedCosts)}</p>
                <p className="text-xs text-muted-foreground">Reczne wpisy</p>
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
                <p className="text-xs text-muted-foreground">{fixedCosts > 0 ? `${formatPLN(fixedCosts)} / ${dniRobocze} dni` : ""}</p>
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
                <p className="text-lg font-bold tabular-nums">{dniRobocze}</p>
                <p className="text-xs text-muted-foreground">pon-pt w {monthLabel.toLowerCase()}</p>
              </div>
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rozbicie kosztow na dzialy — reczne wpisy */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Koszty wg dzialow
            <Badge variant="outline" className="text-xs">Reczne wpisy</Badge>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => openAddExpense()}>
            <Plus className="w-4 h-4 mr-1" /> Dodaj
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {(!costBreakdown || costBreakdown.departments.length === 0) && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Brak wydatkow w tym miesiacu. Kliknij „Dodaj wydatek", aby zaczac.
            </p>
          )}
          {costBreakdown?.departments.map(dept => {
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
                <div className="flex items-center gap-1">
                  <CollapsibleTrigger asChild>
                    <button className="flex-1 flex items-center justify-between p-3 rounded-md hover:bg-muted/50 text-left">
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
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Dodaj wydatek do dzialu" onClick={() => openAddExpense(dept.name)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <CollapsibleContent>
                  <div className="ml-8 mr-2 mb-2 space-y-1">
                    {dept.categories.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between gap-2 py-1.5 px-2 text-sm rounded hover:bg-muted/30 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground truncate">{cat.name}</span>
                          <Badge variant={cat.typ === "staly" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                            {cat.typ === "staly" ? "Staly" : "Zmienny"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono tabular-nums">{formatPLN(cat.total)}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" title="Edytuj" onClick={() => openEditExpense(dept.name, cat)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" title="Usun" onClick={() => deleteExpense.mutate(cat.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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

      {/* Tabela dzienna — READ ONLY (dane z iBiznes sync) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tabela dzienna — {monthLabel} {rok}</CardTitle>
          <p className="text-xs text-muted-foreground">Sprzedaz dzienna pobierana automatycznie z iBiznes (WZ z danego dnia).</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Dzien</TableHead>
                  <TableHead className="text-right">Sprzedaz</TableHead>
                  <TableHead className="text-right">Koszt dzienny</TableHead>
                  <TableHead className="text-right">Zysk brutto</TableHead>
                  <TableHead className="text-right">Plus / minus</TableHead>
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
                      <TableCell className="text-right tabular-nums">{hasValue ? fmt(row.sprzedaz!) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(kosztDzienny)}</TableCell>
                      <TableCell className="text-right tabular-nums">{hasValue ? fmt(row.zyskBrutto) : "—"}</TableCell>
                      <TableCell className={`text-right tabular-nums ${hasValue ? (row.minusKoszty >= 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium") : ""}`}>
                        {hasValue ? `${row.minusKoszty >= 0 ? "+" : ""}${fmt(row.minusKoszty)}` : "—"}
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

      {/* Dialog: dodaj / edytuj wydatek */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id != null ? "Edytuj wydatek" : "Dodaj wydatek"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Dzial</Label>
              <Select value={form.dzial} onValueChange={(v) => setForm(f => ({ ...f, dzial: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STANDARD_DEPTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  <SelectItem value="__custom__">Inny (wpisz)…</SelectItem>
                </SelectContent>
              </Select>
              {form.dzial === "__custom__" && (
                <Input
                  placeholder="Nazwa dzialu"
                  value={form.dzialCustom}
                  onChange={(e) => setForm(f => ({ ...f, dzialCustom: e.target.value }))}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nazwa wydatku</Label>
              <Input
                placeholder="np. Wynagrodzenia, Najem, Paliwo"
                value={form.nazwa}
                onChange={(e) => setForm(f => ({ ...f, nazwa: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kwota (zl, netto/mies.)</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.kwota}
                onChange={(e) => setForm(f => ({ ...f, kwota: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Typ kosztu</Label>
              <RadioGroup
                value={form.typ}
                onValueChange={(v) => setForm(f => ({ ...f, typ: v }))}
                className="flex flex-col gap-2"
              >
                <label className="flex items-start gap-2 cursor-pointer">
                  <RadioGroupItem value="staly" className="mt-0.5" />
                  <span className="text-sm"><span className="font-medium">Staly</span> — liczony w kazdym miesiacu (core)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <RadioGroupItem value="zmienny" className="mt-0.5" />
                  <span className="text-sm"><span className="font-medium">Zmienny</span> — tylko w tym miesiacu ({monthLabel} {rok})</span>
                </label>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Anuluj</Button>
            <Button onClick={() => saveExpense.mutate()} disabled={saveExpense.isPending}>
              {saveExpense.isPending ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
