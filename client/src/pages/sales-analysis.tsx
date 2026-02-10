import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Download, BarChart3 } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const COLORS = [
  "hsl(210, 92%, 45%)", "hsl(25, 95%, 42%)", "hsl(340, 82%, 38%)",
  "hsl(160, 65%, 35%)", "hsl(280, 75%, 40%)", "hsl(45, 85%, 45%)",
];

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];

export default function SalesAnalysisPage() {
  const [rok, setRok] = useState(2026);
  const [miesiac, setMiesiac] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-analysis", rok, miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/sales-analysis?rok=${rok}&miesiac=${miesiac}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const groups = data?.groups || [];
  const totalSales = groups.reduce((s: number, g: any) => s + Number(g.sprzedaz || 0), 0);
  const totalProfit = groups.reduce((s: number, g: any) => s + Number(g.zysk || 0), 0);
  const totalMargin = totalSales > 0 ? (totalProfit / totalSales * 100) : 0;

  const pieData = groups.map((g: any) => ({
    name: g.grupa,
    value: Number(g.sprzedaz || 0),
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Analiza sprzedazy</h1>
        <div className="flex items-center gap-2">
          <Select value={String(miesiac)} onValueChange={(v) => setMiesiac(Number(v))}>
            <SelectTrigger className="w-[120px]" data-testid="select-month">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Sprzedaz</p>
            <p className="text-2xl font-bold">{totalSales.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Zysk</p>
            <p className="text-2xl font-bold">{totalProfit.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Marza</p>
            <p className="text-2xl font-bold">{totalMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Udzial grup w sprzedazy</CardTitle>
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
                  <Tooltip formatter={(v: number) => `${v.toLocaleString("pl-PL")} PLN`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Brak danych</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sprzedaz per grupa</CardTitle>
          </CardHeader>
          <CardContent>
            {groups.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={groups}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="grupa" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${Number(v).toLocaleString("pl-PL")} PLN`} />
                  <Bar dataKey="sprzedaz" name="Sprzedaz" fill="hsl(210, 92%, 45%)" radius={[4, 4, 0, 0]} />
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
          <CardTitle className="text-base">Podsumowanie grup - {MONTHS[miesiac - 1]} {rok}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupa</TableHead>
                  <TableHead className="text-right">Klientow</TableHead>
                  <TableHead className="text-right">Aktywnych</TableHead>
                  <TableHead className="text-right">Sprzedaz</TableHead>
                  <TableHead className="text-right">Koszt</TableHead>
                  <TableHead className="text-right">Zysk</TableHead>
                  <TableHead className="text-right">Marza %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{g.grupa}</TableCell>
                    <TableCell className="text-right">{g.klientow}</TableCell>
                    <TableCell className="text-right">{g.aktywnych}</TableCell>
                    <TableCell className="text-right">{Number(g.sprzedaz || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{Number(g.koszt || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-medium">{Number(g.zysk || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{Number(g.marza || 0).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>RAZEM</TableCell>
                  <TableCell className="text-right">{groups.reduce((s: number, g: any) => s + (g.klientow || 0), 0)}</TableCell>
                  <TableCell className="text-right">{groups.reduce((s: number, g: any) => s + (g.aktywnych || 0), 0)}</TableCell>
                  <TableCell className="text-right">{totalSales.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{groups.reduce((s: number, g: any) => s + Number(g.koszt || 0), 0).toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{totalProfit.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{totalMargin.toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
