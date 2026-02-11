import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const COLORS = [
  "hsl(210, 92%, 45%)", "hsl(25, 95%, 42%)", "hsl(340, 82%, 38%)",
  "hsl(160, 65%, 35%)", "hsl(280, 75%, 40%)", "hsl(45, 85%, 45%)",
];

const MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function fmtPLN(val: number) {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ZmianaIndicator({ zmiana }: { zmiana: number | null }) {
  if (zmiana === null || zmiana === undefined) return <span className="text-muted-foreground">-</span>;
  const isPositive = zmiana > 0;
  const isNeutral = Math.abs(zmiana) < 0.5;
  if (isNeutral) return <span className="text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" />{zmiana.toFixed(1)}%</span>;
  return (
    <span className={`flex items-center gap-1 ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? "+" : ""}{zmiana.toFixed(1)}%
    </span>
  );
}

export default function SalesAnalysisPage() {
  const [rok, setRok] = useState(2026);
  const [miesiac, setMiesiac] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const groups = data?.groups || [];
  const prevMiesiac = data?.prevMiesiac;
  const prevRok = data?.prevRok;
  const totalSales = groups.reduce((s: number, g: any) => s + Number(g.sprzedaz || 0), 0);
  const totalCost = groups.reduce((s: number, g: any) => s + Number(g.koszt || 0), 0);
  const totalProfit = groups.reduce((s: number, g: any) => s + Number(g.zysk || 0), 0);
  const totalMargin = totalSales > 0 ? (totalProfit / totalSales * 100) : 0;
  const totalPrev = groups.reduce((s: number, g: any) => s + Number(g.prevSprzedaz || 0), 0);
  const totalZmiana = totalPrev > 0 ? ((totalSales - totalPrev) / totalPrev * 100) : 0;
  const totalKlientow = groups.reduce((s: number, g: any) => s + (g.klientow || 0), 0);
  const totalAktywnych = groups.reduce((s: number, g: any) => s + (g.aktywnych || 0), 0);

  const prevMonthLabel = prevMiesiac ? `${MONTHS_SHORT[prevMiesiac - 1]} ${prevRok}` : "";

  const pieData = groups
    .filter((g: any) => Number(g.sprzedaz || 0) > 0)
    .map((g: any) => ({
      name: g.grupa,
      value: Number(g.sprzedaz || 0),
    }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Analiza sprzedaży</h1>
          <p className="text-sm text-muted-foreground">
            {MONTHS[miesiac - 1]} {rok} | Klientów aktywnych: {totalAktywnych}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Sprzedaż</p>
            <p className="text-xl font-bold" data-testid="text-total-sales">{fmtPLN(totalSales)} zł</p>
            <div className="flex justify-center mt-1"><ZmianaIndicator zmiana={totalZmiana} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Koszt</p>
            <p className="text-xl font-bold">{fmtPLN(totalCost)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Zysk</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-profit">{fmtPLN(totalProfit)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Marża</p>
            <p className="text-xl font-bold">{totalMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Udział grup w sprzedaży</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${fmtPLN(v)} zł`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Brak danych</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sprzedaż i zysk per grupa</CardTitle>
          </CardHeader>
          <CardContent>
            {groups.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={groups.map((g: any) => ({ ...g, grupa: g.grupa.replace("Weryfikacja ", "Wer. ") }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="grupa" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `${fmtPLN(Number(v))} zł`} />
                  <Bar dataKey="sprzedaz" name="Sprzedaż" fill="hsl(210, 92%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="zysk" name="Zysk" fill="hsl(160, 65%, 35%)" radius={[4, 4, 0, 0]} />
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
                  <TableHead className="text-right">Klientów</TableHead>
                  <TableHead className="text-right">Aktywni</TableHead>
                  <TableHead className="text-right">Sprzedaż</TableHead>
                  <TableHead className="text-right">Koszt</TableHead>
                  <TableHead className="text-right">Zysk</TableHead>
                  <TableHead className="text-right">Marża</TableHead>
                  <TableHead className="text-right">Sprzedaż {prevMonthLabel}</TableHead>
                  <TableHead className="text-right">Zmiana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g: any, i: number) => (
                  <TableRow key={i} className="cursor-pointer hover-elevate" onClick={() => toggleGroup(g.grupa)} data-testid={`row-group-${i}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        {expandedGroups.has(g.grupa) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {g.grupa}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{g.klientow}</TableCell>
                    <TableCell className="text-right">{g.aktywnych}</TableCell>
                    <TableCell className="text-right font-medium">{fmtPLN(g.sprzedaz)}</TableCell>
                    <TableCell className="text-right">{fmtPLN(g.koszt)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtPLN(g.zysk)}</TableCell>
                    <TableCell className="text-right">{Number(g.marza).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{fmtPLN(g.prevSprzedaz || 0)}</TableCell>
                    <TableCell className="text-right"><ZmianaIndicator zmiana={g.zmiana} /></TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>RAZEM</TableCell>
                  <TableCell className="text-right">{totalKlientow}</TableCell>
                  <TableCell className="text-right">{totalAktywnych}</TableCell>
                  <TableCell className="text-right">{fmtPLN(totalSales)}</TableCell>
                  <TableCell className="text-right">{fmtPLN(totalCost)}</TableCell>
                  <TableCell className="text-right">{fmtPLN(totalProfit)}</TableCell>
                  <TableCell className="text-right">{totalMargin.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{fmtPLN(totalPrev)}</TableCell>
                  <TableCell className="text-right"><ZmianaIndicator zmiana={totalZmiana} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {groups.map((g: any, gi: number) => (
        expandedGroups.has(g.grupa) && g.klienci && g.klienci.length > 0 && (
          <Card key={gi}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{g.grupa}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Aktywni: {g.aktywnych}/{g.klientow}</Badge>
                  <Badge variant="secondary">Sprzedaż: {fmtPLN(g.sprzedaz)} zł</Badge>
                  <Badge variant="secondary">Zysk: {fmtPLN(g.zysk)} zł</Badge>
                  <Badge variant="secondary">Marża: {Number(g.marza).toFixed(1)}%</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">Poz.</TableHead>
                      <TableHead>Klient</TableHead>
                      <TableHead className="text-right">Sprzedaż</TableHead>
                      <TableHead className="text-right">Koszt</TableHead>
                      <TableHead className="text-right">Zysk</TableHead>
                      <TableHead className="text-right">Marża</TableHead>
                      <TableHead className="text-right">Sprzedaż {prevMonthLabel}</TableHead>
                      <TableHead className="text-right">Zmiana</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.klienci.map((k: any, ki: number) => (
                      <TableRow key={ki} data-testid={`row-client-${k.id}`}>
                        <TableCell className="text-muted-foreground">{ki + 1}</TableCell>
                        <TableCell className="font-medium">{k.klient}</TableCell>
                        <TableCell className="text-right">{fmtPLN(k.sprzedaz)}</TableCell>
                        <TableCell className="text-right">{fmtPLN(k.koszt)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtPLN(k.zysk)}</TableCell>
                        <TableCell className="text-right">{k.marza.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{fmtPLN(k.prevSprzedaz)}</TableCell>
                        <TableCell className="text-right"><ZmianaIndicator zmiana={k.zmiana} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      ))}
    </div>
  );
}
