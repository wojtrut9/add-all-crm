import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Target, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];

export default function SalesDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-dashboard"],
    queryFn: async () => {
      const res = await authFetch("/api/sales-dashboard");
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

  const plan2026 = data?.plan2026 || [];
  const history = data?.history || [];

  const chartData = MONTHS.map((m, i) => ({
    name: m,
    plan: plan2026[i]?.planObrotu || 0,
    wykonanie: plan2026[i]?.wykonanieObrotu || 0,
  }));

  const historyChartData = MONTHS.map((m, i) => {
    const entry: any = { name: m };
    (history || []).forEach((h: any) => {
      const monthData = h.months.find((md: any) => md.miesiac === i + 1);
      entry[`rok_${h.rok}`] = monthData?.wartosc || 0;
    });
    return entry;
  });

  const years = (history || []).map((h: any) => h.rok);
  const lineColors = ["hsl(210, 92%, 45%)", "hsl(25, 95%, 42%)", "hsl(340, 82%, 38%)", "hsl(160, 65%, 35%)", "hsl(280, 75%, 40%)", "hsl(45, 85%, 50%)"];

  const totalPlan = plan2026.reduce((s: number, p: any) => s + Number(p.planObrotu || 0), 0);
  const totalExec = plan2026.reduce((s: number, p: any) => s + Number(p.wykonanieObrotu || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Panel sprzedazowy 2026</h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Plan roczny</p>
                <p className="text-xl font-bold">{(totalPlan / 1000).toFixed(0)} tys.</p>
              </div>
              <Target className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Wykonanie</p>
                <p className="text-xl font-bold">{(totalExec / 1000).toFixed(0)} tys.</p>
              </div>
              <DollarSign className="w-5 h-5 text-chart-4" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Roznica</p>
                <p className={`text-xl font-bold ${totalExec - totalPlan >= 0 ? '' : 'text-destructive'}`}>
                  {((totalExec - totalPlan) / 1000).toFixed(0)} tys.
                </p>
              </div>
              {totalExec >= totalPlan ? <TrendingUp className="w-5 h-5 text-chart-4" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Realizacja %</p>
                <p className="text-xl font-bold">{totalPlan > 0 ? ((totalExec / totalPlan) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Plan vs Wykonanie 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `${Number(v).toLocaleString("pl-PL")} PLN`} />
                <Legend />
                <Bar dataKey="plan" name="Plan" fill="hsl(210, 92%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wykonanie" name="Wykonanie" fill="hsl(160, 65%, 35%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historia sprzedazy</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `${Number(v).toLocaleString("pl-PL")} PLN`} />
                <Legend />
                {years.map((y: number, i: number) => (
                  <Line key={y} type="monotone" dataKey={`rok_${y}`} name={String(y)} stroke={lineColors[i % lineColors.length]} strokeWidth={y === 2026 ? 3 : 1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Miesieczne zestawienie 2026</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Miesiac</TableHead>
                  <TableHead className="text-right">Plan</TableHead>
                  <TableHead className="text-right">Wykonanie</TableHead>
                  <TableHead className="text-right">Roznica</TableHead>
                  <TableHead className="text-right">% realizacji</TableHead>
                  <TableHead className="text-right">Plan narastajaco</TableHead>
                  <TableHead className="text-right">Wykonanie narastajaco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  let cumPlan = 0, cumExec = 0;
                  return plan2026.map((p: any, i: number) => {
                    const plan = Number(p.planObrotu || 0);
                    const exec = Number(p.wykonanieObrotu || 0);
                    cumPlan += plan;
                    cumExec += exec;
                    const diff = exec - plan;
                    const pct = plan > 0 ? (exec / plan * 100) : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{MONTHS[i]}</TableCell>
                        <TableCell className="text-right">{plan.toLocaleString("pl-PL")}</TableCell>
                        <TableCell className="text-right">{exec.toLocaleString("pl-PL")}</TableCell>
                        <TableCell className={`text-right ${diff >= 0 ? '' : 'text-destructive'}`}>{diff.toLocaleString("pl-PL")}</TableCell>
                        <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{cumPlan.toLocaleString("pl-PL")}</TableCell>
                        <TableCell className="text-right">{cumExec.toLocaleString("pl-PL")}</TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
