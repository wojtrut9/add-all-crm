import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Users, Car } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];
const COLORS = [
  "hsl(210, 92%, 45%)", "hsl(25, 95%, 42%)", "hsl(340, 82%, 38%)",
  "hsl(160, 65%, 35%)", "hsl(280, 75%, 40%)", "hsl(45, 85%, 45%)",
];

export default function FinancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/finance"],
    queryFn: async () => {
      const res = await authFetch("/api/finance");
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const salaries = data?.salaries || [];
  const costs = data?.costs || [];
  const fleetData = data?.fleet || [];

  const totalSalaries = salaries.reduce((s: number, sal: any) => s + Number(sal.kosztPracodawcy || sal.koszt || 0), 0);
  const totalCosts = costs.reduce((s: number, c: any) => s + Number(c.koszt || 0), 0);
  const totalFleet = fleetData.reduce((s: number, f: any) => s + Number(f.koszt || 0), 0);
  const totalMonthly = totalSalaries + totalCosts + totalFleet;

  const costPieData = [
    { name: "Wynagrodzenia", value: totalSalaries },
    { name: "Operacyjne", value: totalCosts },
    { name: "Flota", value: totalFleet },
  ];

  const deptData = salaries.reduce((acc: any[], sal: any) => {
    const existing = acc.find(a => a.name === sal.dzial);
    const cost = Number(sal.kosztPracodawcy || 0);
    if (existing) {
      existing.value += cost;
    } else {
      acc.push({ name: sal.dzial, value: cost });
    }
    return acc;
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Panel finansowy</h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Koszty miesieczne</p>
                <p className="text-xl font-bold">{totalMonthly.toLocaleString("pl-PL")} PLN</p>
              </div>
              <DollarSign className="w-5 h-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Wynagrodzenia</p>
                <p className="text-xl font-bold">{totalSalaries.toLocaleString("pl-PL")} PLN</p>
              </div>
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Koszty operacyjne</p>
                <p className="text-xl font-bold">{totalCosts.toLocaleString("pl-PL")} PLN</p>
              </div>
              <TrendingUp className="w-5 h-5 text-chart-2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Flota</p>
                <p className="text-xl font-bold">{totalFleet.toLocaleString("pl-PL")} PLN</p>
              </div>
              <Car className="w-5 h-5 text-chart-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rozklad kosztow</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={costPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                  {costPieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toLocaleString("pl-PL")} PLN`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wynagrodzenia wg dzialow</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={deptData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                  {deptData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toLocaleString("pl-PL")} PLN`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="salaries">
        <TabsList>
          <TabsTrigger value="salaries">Wynagrodzenia</TabsTrigger>
          <TabsTrigger value="costs">Koszty operacyjne</TabsTrigger>
          <TabsTrigger value="fleet">Flota</TabsTrigger>
        </TabsList>

        <TabsContent value="salaries" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Osoba</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Dzial</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead className="text-right">Netto</TableHead>
                      <TableHead className="text-right">Brutto</TableHead>
                      <TableHead className="text-right">Koszt pracodawcy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaries.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.osoba}</TableCell>
                        <TableCell>{s.firma}</TableCell>
                        <TableCell>{s.dzial}</TableCell>
                        <TableCell>{s.formaZatrudnienia || "-"}</TableCell>
                        <TableCell className="text-right">{s.netto ? Number(s.netto).toLocaleString("pl-PL") : "-"}</TableCell>
                        <TableCell className="text-right">{s.brutto ? Number(s.brutto).toLocaleString("pl-PL") : "-"}</TableCell>
                        <TableCell className="text-right font-medium">{s.kosztPracodawcy ? Number(s.kosztPracodawcy).toLocaleString("pl-PL") : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nazwa</TableHead>
                      <TableHead>Dzial</TableHead>
                      <TableHead className="text-right">Koszt miesieczny</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nazwa}</TableCell>
                        <TableCell>{c.dzial || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{Number(c.koszt || 0).toLocaleString("pl-PL")} PLN</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>RAZEM</TableCell>
                      <TableCell className="text-right">{totalCosts.toLocaleString("pl-PL")} PLN</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fleet" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opis</TableHead>
                      <TableHead>Rodzaj</TableHead>
                      <TableHead className="text-right">Koszt miesieczny</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fleetData.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.opis}</TableCell>
                        <TableCell>{f.rodzaj || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{Number(f.koszt || 0).toLocaleString("pl-PL")} PLN</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>RAZEM</TableCell>
                      <TableCell className="text-right">{totalFleet.toLocaleString("pl-PL")} PLN</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
