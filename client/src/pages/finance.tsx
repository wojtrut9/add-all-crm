import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Users,
  Settings,
  Car,
  Upload,
  ChevronDown,
  ChevronRight,
  Loader2,
  FolderOpen,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const MONTHS = [
  "Styczen", "Luty", "Marzec", "Kwiecien", "Maj", "Czerwiec",
  "Lipiec", "Sierpien", "Wrzesien", "Pazdziernik", "Listopad", "Grudzien",
];
const MONTH_KEYS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paz", "lis", "gru"];

function fmtPLN(val: number) {
  return Math.round(val).toLocaleString("pl-PL").replace(/,/g, " ") + " PLN";
}

const HR_CATEGORIES = ["Wynagrodzenia", "Wynagrodzenia zarząd (JDG)", "ZUS", "Podatki (US)", "Medycyna pracy"];
const FLEET_CATEGORIES = ["Leasing", "Paliwo"];
const DONUT_COLORS = ["hsl(215, 70%, 50%)", "hsl(215, 70%, 30%)", "hsl(145, 60%, 45%)", "hsl(30, 80%, 55%)", "hsl(220, 10%, 55%)"];
const CATEGORY_COLORS: Record<string, string> = {
  "Wynagrodzenia": "hsl(215, 70%, 50%)",
  "Wynagrodzenia zarząd (JDG)": "hsl(215, 70%, 30%)",
  "ZUS": "hsl(215, 50%, 60%)",
  "Podatki (US)": "hsl(215, 40%, 70%)",
  "Medycyna pracy": "hsl(215, 30%, 75%)",
  "Leasing": "hsl(145, 60%, 45%)",
  "Paliwo": "hsl(145, 40%, 55%)",
  "Transport": "hsl(30, 80%, 55%)",
  "Ubezpieczenia": "hsl(280, 40%, 55%)",
  "Księgowość": "hsl(350, 50%, 55%)",
  "Media/Prąd": "hsl(50, 60%, 50%)",
  "IT/Serwis": "hsl(190, 50%, 45%)",
  "IT/Subskrypcje": "hsl(190, 40%, 55%)",
  "Biuro": "hsl(100, 30%, 50%)",
  "Wysyłka/Poczta": "hsl(20, 50%, 50%)",
  "Płatności/Terminal": "hsl(260, 40%, 55%)",
  "Towary/Produkty": "hsl(0, 50%, 55%)",
  "Serwis/Naprawa": "hsl(330, 40%, 50%)",
  "Inne": "hsl(0, 0%, 55%)",
};

const BUDGET_BY_CATEGORY: Record<string, number> = {
  "Wynagrodzenia": 30000,
  "Wynagrodzenia zarząd (JDG)": 70000,
  "ZUS": 11000,
  "Podatki (US)": 2500,
  "Medycyna pracy": 1000,
  "Leasing": 8000,
  "Paliwo": 1500,
  "Transport": 9000,
  "Ubezpieczenia": 1600,
  "Księgowość": 6500,
  "Media/Prąd": 1200,
  "IT/Serwis": 600,
  "IT/Subskrypcje": 700,
  "Biuro": 1800,
  "Wysyłka/Poczta": 200,
  "Płatności/Terminal": 200,
  "Towary/Produkty": 1000,
  "Serwis/Naprawa": 400,
  "Inne": 500,
};

type CostItem = {
  id: number;
  nazwa: string;
  firma: string | null;
  dzial: string | null;
  rodzaj: string | null;
  kategoria: string | null;
  netto: string | null;
  koszt: string | null;
  notatka: string | null;
  aktywnyMiesiace: Record<string, boolean> | null;
};

export default function FinancePage() {
  const now = new Date();
  const rok = now.getFullYear();
  const [miesiac, setMiesiac] = useState(now.getMonth() + 1);
  const [widok, setWidok] = useState<"rzeczywiste" | "budzet" | "porownanie">("rzeczywiste");
  const [importing, setImporting] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const mKey = MONTH_KEYS[miesiac - 1];

  const { data, isLoading } = useQuery({
    queryKey: ["/api/finance", miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/finance?miesiac=${miesiac}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const importedCosts: CostItem[] = useMemo(() => {
    if (!data?.costs) return [];
    return data.costs.filter((c: CostItem) => c.firma === "IMPORT_VAT");
  }, [data]);

  const grouped = useMemo(() => {
    const map: Record<string, CostItem[]> = {};
    for (const c of importedCosts) {
      const cat = c.dzial || c.kategoria || "Inne";
      if (!map[cat]) map[cat] = [];
      map[cat].push(c);
    }
    return Object.entries(map)
      .map(([kategoria, items]) => ({
        kategoria,
        items: items.sort((a, b) => Number(b.netto || 0) - Number(a.netto || 0)),
        total: items.reduce((s, c) => s + Number(c.netto || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [importedCosts]);

  const totalNetto = grouped.reduce((s, g) => s + g.total, 0);

  const hrTotal = grouped
    .filter(g => HR_CATEGORIES.includes(g.kategoria))
    .reduce((s, g) => s + g.total, 0);
  const fleetTotal = grouped
    .filter(g => FLEET_CATEGORIES.includes(g.kategoria))
    .reduce((s, g) => s + g.total, 0);
  const opsTotal = totalNetto - hrTotal - fleetTotal;

  const donutData = useMemo(() => {
    const wynPracown = grouped
      .filter(g => ["Wynagrodzenia", "ZUS", "Podatki (US)", "Medycyna pracy"].includes(g.kategoria))
      .reduce((s, g) => s + g.total, 0);
    const wynZarzad = grouped
      .filter(g => g.kategoria === "Wynagrodzenia zarząd (JDG)")
      .reduce((s, g) => s + g.total, 0);
    const flota = fleetTotal;
    const transport = grouped
      .filter(g => g.kategoria === "Transport")
      .reduce((s, g) => s + g.total, 0);
    const pozostale = totalNetto - wynPracown - wynZarzad - flota - transport;

    return [
      { name: "Wynagrodzenia pracownikow", value: Math.round(wynPracown) },
      { name: "Wynagrodzenia zarzad JDG", value: Math.round(wynZarzad) },
      { name: "Flota", value: Math.round(flota) },
      { name: "Transport", value: Math.round(transport) },
      { name: "Pozostale operacyjne", value: Math.round(pozostale) },
    ].filter(d => d.value > 0);
  }, [grouped, totalNetto, fleetTotal]);

  const top10 = useMemo(() => {
    const byContractor: Record<string, { total: number; kategoria: string }> = {};
    for (const c of importedCosts) {
      const name = c.nazwa;
      const cat = c.dzial || c.kategoria || "Inne";
      if (!byContractor[name]) byContractor[name] = { total: 0, kategoria: cat };
      byContractor[name].total += Number(c.netto || 0);
    }
    return Object.entries(byContractor)
      .map(([name, d]) => ({ name: name.length > 25 ? name.slice(0, 25) + "..." : name, fullName: name, value: Math.round(d.total), kategoria: d.kategoria }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [importedCosts]);

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("miesiac", String(miesiac));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/finance/import", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast({ title: "Import VAT", description: result.message });
      queryClient.invalidateQueries({ queryKey: ["/api/finance", miesiac] });
    } catch (err: any) {
      toast({ title: "Blad importu", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <DollarSign className="w-6 h-6" /> Panel finansowy
          </h1>
          <p className="text-sm text-muted-foreground">
            {MONTHS[miesiac - 1]} {rok} — wszystkie kwoty netto
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(miesiac)} onValueChange={(v) => setMiesiac(Number(v))}>
            <SelectTrigger className="w-[140px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} data-testid="button-import">
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import Excel
          </Button>
          <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleImport} />
          <Select value={widok} onValueChange={(v: any) => setWidok(v)}>
            <SelectTrigger className="w-[160px]" data-testid="select-widok">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rzeczywiste">Rzeczywiste</SelectItem>
              <SelectItem value="budzet">Budzet</SelectItem>
              <SelectItem value="porownanie">Porownanie</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {importedCosts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">Brak danych za {MONTHS[miesiac - 1]} {rok}</p>
            <p className="text-sm text-muted-foreground mt-1">Zaimportuj plik "Zestawienie Zakupu VAT" z iBiznes</p>
          </CardContent>
        </Card>
      )}

      {widok === "porownanie" && importedCosts.length > 0 && (
        <ComparisonView grouped={grouped} totalNetto={totalNetto} />
      )}

      {widok !== "porownanie" && importedCosts.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              icon={<DollarSign className="w-5 h-5" />}
              label="Koszty miesiecznie"
              value={fmtPLN(totalNetto)}
              testId="kpi-total"
            />
            <KPICard
              icon={<Users className="w-5 h-5" />}
              label="Wynagrodzenia i HR"
              value={fmtPLN(hrTotal)}
              subtitle={totalNetto > 0 ? `${Math.round((hrTotal / totalNetto) * 100)}% kosztow` : ""}
              accent="blue"
              testId="kpi-hr"
            />
            <KPICard
              icon={<Settings className="w-5 h-5" />}
              label="Koszty operacyjne"
              value={fmtPLN(opsTotal)}
              subtitle={totalNetto > 0 ? `${Math.round((opsTotal / totalNetto) * 100)}% kosztow` : ""}
              accent="amber"
              testId="kpi-ops"
            />
            <KPICard
              icon={<Car className="w-5 h-5" />}
              label="Flota"
              value={fmtPLN(fleetTotal)}
              subtitle={totalNetto > 0 ? `${Math.round((fleetTotal / totalNetto) * 100)}% kosztow` : ""}
              accent="green"
              testId="kpi-fleet"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Struktura kosztow</p>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="45%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={800}
                      >
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtPLN(v)} />
                      <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-base font-bold">
                        {fmtPLN(totalNetto)}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {donutData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium">{fmtPLN(d.value)}</span>
                      <span className="text-muted-foreground">({totalNetto > 0 ? Math.round((d.value / totalNetto) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Top 10 kontrahentow</p>
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 60, top: 5, bottom: 5 }}>
                      <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmtPLN(v)} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={800} label={{ position: "right", formatter: (v: number) => fmtPLN(v), fontSize: 10 }}>
                        {top10.map((entry, i) => (
                          <Cell key={i} fill={CATEGORY_COLORS[entry.kategoria] || "hsl(220, 10%, 55%)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-4">Koszty wg kategorii</p>
              <div className="space-y-1">
                {grouped.map((g) => (
                  <Collapsible
                    key={g.kategoria}
                    open={openCategories.has(g.kategoria)}
                    onOpenChange={() => toggleCategory(g.kategoria)}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        className="w-full flex items-center justify-between p-3 rounded-md hover-elevate text-left"
                        data-testid={`category-toggle-${g.kategoria}`}
                      >
                        <div className="flex items-center gap-3">
                          {openCategories.has(g.kategoria)
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          }
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[g.kategoria] || "hsl(0,0%,55%)" }} />
                          <span className="font-medium">{g.kategoria}</span>
                          <Badge variant="secondary" className="text-xs">{g.items.length} poz.</Badge>
                        </div>
                        <span className="font-bold tabular-nums">{fmtPLN(g.total)}</span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 mr-2 mb-3 border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Kontrahent</TableHead>
                              <TableHead>Nr faktury</TableHead>
                              <TableHead>VAT</TableHead>
                              <TableHead className="text-right">Netto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.items.map((item, idx) => (
                              <TableRow key={item.id} className={idx % 2 === 1 ? "bg-muted/30" : ""} data-testid={`row-cost-${item.id}`}>
                                <TableCell className="font-medium">{item.nazwa}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{item.rodzaj || "-"}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{item.notatka || "-"}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">{fmtPLN(Number(item.netto || 0))}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                              <TableCell colSpan={3}>Suma</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">{fmtPLN(g.total)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-lg font-bold">RAZEM KOSZTY NETTO</span>
                <span className="text-lg font-bold tabular-nums" data-testid="text-total-costs">{fmtPLN(totalNetto)} ({importedCosts.length} pozycji)</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {widok === "budzet" && importedCosts.length === 0 && (
        <BudgetOnlyView />
      )}
    </div>
  );
}

function KPICard({ icon, label, value, subtitle, accent, testId }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  accent?: "blue" | "amber" | "green";
  testId: string;
}) {
  const accentClasses = {
    blue: "border-blue-500/30 dark:border-blue-400/30",
    amber: "border-amber-500/30 dark:border-amber-400/30",
    green: "border-green-500/30 dark:border-green-400/30",
  };
  const iconClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-green-600 dark:text-green-400",
  };

  return (
    <Card className={accent ? accentClasses[accent] : ""} data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={accent ? iconClasses[accent] : "text-muted-foreground"}>{icon}</div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function ComparisonView({ grouped, totalNetto }: { grouped: Array<{ kategoria: string; total: number }>; totalNetto: number }) {
  const allCategories = Array.from(new Set([...Object.keys(BUDGET_BY_CATEGORY), ...grouped.map(g => g.kategoria)]));
  const rows = allCategories.map(cat => {
    const budzet = BUDGET_BY_CATEGORY[cat] || 0;
    const rzeczywiste = grouped.find(g => g.kategoria === cat)?.total || 0;
    const roznica = rzeczywiste - budzet;
    const procent = budzet > 0 ? (rzeczywiste / budzet) * 100 : 0;
    return { kategoria: cat, budzet, rzeczywiste: Math.round(rzeczywiste), roznica: Math.round(roznica), procent: Math.round(procent) };
  }).sort((a, b) => b.rzeczywiste - a.rzeczywiste);

  const totalBudzet = rows.reduce((s, r) => s + r.budzet, 0);
  const totalRoznica = Math.round(totalNetto) - totalBudzet;
  const totalProcent = totalBudzet > 0 ? Math.round((totalNetto / totalBudzet) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium text-muted-foreground mb-4">Porownanie: Budzet vs Rzeczywiste</p>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategoria</TableHead>
                <TableHead className="text-right">Budzet (plan)</TableHead>
                <TableHead className="text-right">Rzeczywiste</TableHead>
                <TableHead className="text-right">Roznica</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={r.kategoria} className={idx % 2 === 1 ? "bg-muted/30" : ""} data-testid={`row-compare-${r.kategoria}`}>
                  <TableCell className="font-medium">{r.kategoria}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmtPLN(r.budzet)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmtPLN(r.rzeczywiste)}</TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${r.roznica > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    {r.roznica > 0 ? "+" : ""}{fmtPLN(r.roznica)}
                  </TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${r.procent > 100 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    {r.procent}%
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell className="text-base">RAZEM</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{fmtPLN(totalBudzet)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{fmtPLN(Math.round(totalNetto))}</TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${totalRoznica > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  {totalRoznica > 0 ? "+" : ""}{fmtPLN(totalRoznica)}
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${totalProcent > 100 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  {totalProcent}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetOnlyView() {
  const rows = Object.entries(BUDGET_BY_CATEGORY)
    .map(([kategoria, budzet]) => ({ kategoria, budzet }))
    .sort((a, b) => b.budzet - a.budzet);
  const total = rows.reduce((s, r) => s + r.budzet, 0);

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium text-muted-foreground mb-4">Budzet miesieczny (plan)</p>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategoria</TableHead>
                <TableHead className="text-right">Budzet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={r.kategoria} className={idx % 2 === 1 ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">{r.kategoria}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmtPLN(r.budzet)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell className="text-base">RAZEM</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{fmtPLN(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
