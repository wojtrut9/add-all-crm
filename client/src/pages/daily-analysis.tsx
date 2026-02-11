import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DollarSign, Calculator, TrendingUp, CalendarDays, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MONTHS = [
  { value: "1", label: "Styczen" },
  { value: "2", label: "Luty" },
  { value: "3", label: "Marzec" },
  { value: "4", label: "Kwiecien" },
  { value: "5", label: "Maj" },
  { value: "6", label: "Czerwiec" },
  { value: "7", label: "Lipiec" },
  { value: "8", label: "Sierpien" },
  { value: "9", label: "Wrzesien" },
  { value: "10", label: "Pazdziernik" },
  { value: "11", label: "Listopad" },
  { value: "12", label: "Grudzien" },
];

const MARZA = 0.354;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function fmt(n: number): string {
  return n.toLocaleString("pl-PL", { maximumFractionDigits: 0 });
}

export default function DailyAnalysisPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear] = useState(now.getFullYear());
  const [localDniRobocze, setLocalDniRobocze] = useState<number | null>(null);
  const [editingValues, setEditingValues] = useState<Record<number, string>>({});
  const { toast } = useToast();
  const dniRoboczeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rok = selectedYear;
  const miesiac = Number(selectedMonth);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/daily-analysis", rok, miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/daily-analysis?rok=${rok}&miesiac=${miesiac}`);
      if (!res.ok) throw new Error("Blad pobierania danych");
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
      toast({
        title: "Import zakonczony",
        description: `Zaciagnieto sprzedaz z ${data.daysImported} dni.`,
      });
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
  const fixedCosts: number = data?.fixedCosts || 0;
  const serverDniRobocze: number = data?.dniRobocze || 21;
  const dniRobocze = localDniRobocze ?? serverDniRobocze;

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
    if (sprzedaz != null) {
      cumulative += minusKoszty;
    }
    rows.push({ dzien: d, sprzedaz, zyskBrutto, minusKoszty, narastajaco: cumulative });
  }

  const totalSprzedaz = rows.reduce((s, r) => s + (r.sprzedaz ?? 0), 0);
  const totalZyskBrutto = totalSprzedaz * MARZA;
  const wynikMiesiaca = totalZyskBrutto - fixedCosts;
  const dniZSprzedaza = rows.filter(r => r.sprzedaz != null && r.sprzedaz > 0).length;
  const sredniaSprzedaz = dniZSprzedaza > 0 ? totalSprzedaz / dniZSprzedaza : 0;

  function handleSave(dzien: number) {
    const val = editingValues[dzien];
    const sprzedaz = val !== undefined && val !== "" ? val : null;
    updateMutation.mutate({ dzien, sprzedaz });
    setEditingValues(prev => {
      const next = { ...prev };
      delete next[dzien];
      return next;
    });
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-daily-analysis-title">Analiza dzienna</h1>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Koszty stale miesiecznie</p>
                <p className="text-xl font-bold" data-testid="text-fixed-costs">{fmt(fixedCosts)} PLN</p>
              </div>
              <DollarSign className="w-5 h-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Koszt dzienny</p>
                <p className="text-xl font-bold" data-testid="text-daily-cost">{fmt(kosztDzienny)} PLN</p>
              </div>
              <Calculator className="w-5 h-5 text-chart-2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Min. obrot dzienny (break-even)</p>
                <p className="text-xl font-bold" data-testid="text-min-turnover">{fmt(minObrotDzienny)} PLN</p>
                <p className="text-xs text-muted-foreground">Marza: {(MARZA * 100).toFixed(1)}%</p>
              </div>
              <TrendingUp className="w-5 h-5 text-chart-4" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Dni robocze w miesiacu</p>
                <Input
                  type="number"
                  className="mt-1 w-20 font-bold text-xl"
                  value={dniRobocze}
                  onChange={(e) => handleDniRobocze(e.target.value)}
                  min={1}
                  max={31}
                  data-testid="input-dni-robocze"
                />
              </div>
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Tabela dzienna - {monthLabel} {rok}</CardTitle>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
              variant="outline"
              data-testid="button-import-sales"
            >
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const hasValue = row.sprzedaz != null;
                  const narastColor = !hasValue
                    ? ""
                    : row.narastajaco > 0
                      ? "bg-green-50 dark:bg-green-950/30"
                      : row.narastajaco < 0
                        ? "bg-red-50 dark:bg-red-950/30"
                        : "";
                  const rowClass = !hasValue ? "opacity-50" : narastColor;

                  return (
                    <TableRow key={row.dzien} className={rowClass} data-testid={`row-day-${row.dzien}`}>
                      <TableCell className="font-medium">{row.dzien}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-[120px] bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
                          value={editingValues[row.dzien] !== undefined ? editingValues[row.dzien] : (row.sprzedaz != null ? String(row.sprzedaz) : "")}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, [row.dzien]: e.target.value }))}
                          onBlur={() => {
                            if (editingValues[row.dzien] !== undefined) handleSave(row.dzien);
                          }}
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
                      <TableCell className="text-right">{hasValue ? fmt(row.zyskBrutto) : "-"}</TableCell>
                      <TableCell className="text-right">{hasValue ? fmt(row.minusKoszty) : "-"}</TableCell>
                      <TableCell className={`text-right font-medium ${hasValue ? (row.narastajaco >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400") : ""}`}>
                        {hasValue ? fmt(row.narastajaco) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Podsumowanie miesiaca - {monthLabel} {rok}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sprzedaz miesiaca</p>
              <p className="text-lg font-bold" data-testid="text-summary-sprzedaz">{fmt(totalSprzedaz)} PLN</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Zysk brutto (po marzy)</p>
              <p className="text-lg font-bold" data-testid="text-summary-zysk">{fmt(totalZyskBrutto)} PLN</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Koszty stale miesiaca</p>
              <p className="text-lg font-bold" data-testid="text-summary-koszty">{fmt(fixedCosts)} PLN</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">WYNIK MIESIACA</p>
              <p
                className={`text-xl font-bold ${wynikMiesiaca >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                data-testid="text-summary-wynik"
              >
                {fmt(wynikMiesiaca)} PLN
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Dni z wpisana sprzedaza</p>
              <p className="text-lg font-bold" data-testid="text-summary-dni">{dniZSprzedaza}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Srednia sprzedaz/dzien</p>
              <p className="text-lg font-bold" data-testid="text-summary-srednia">{fmt(sredniaSprzedaz)} PLN</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
