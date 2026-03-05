import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch, useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Target, DollarSign, RefreshCw, Save, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

import { MONTHS_SHORT as MONTHS } from "@/lib/constants";

function EditablePlanCell({ value, onChange, onSave, editing }: { value: number; onChange: (v: number) => void; onSave: () => void; editing: boolean }) {
  if (!editing) {
    return <span>{value.toLocaleString("pl-PL")}</span>;
  }
  return (
    <Input
      type="number"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      onBlur={onSave}
      onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
      className="w-24 text-right"
      data-testid="input-plan-value"
    />
  );
}

export default function SalesDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.rola === "admin";
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedPlans, setEditedPlans] = useState<Record<number, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-dashboard"],
    queryFn: async () => {
      const res = await authFetch("/api/sales-dashboard");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const updateTargetsMutation = useMutation({
    mutationFn: async (targets: Array<{miesiac: number; planObrotu: number}>) => {
      const res = await apiRequest("PATCH", "/api/sales-targets", { rok: new Date().getFullYear(), targets });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Zapisano plany sprzedazowe" });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-dashboard"] });
      setEditMode(false);
      setEditedPlans({});
    },
    onError: () => {
      toast({ title: "Blad zapisu", variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sales-targets/sync-execution", { rok: new Date().getFullYear() });
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "Zsynchronizowano wykonanie", description: `Zaktualizowano ${result.updated} miesiecy` });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-dashboard"] });
    },
    onError: () => {
      toast({ title: "Blad synchronizacji", variant: "destructive" });
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

  const getEditedPlan = (i: number) => {
    if (i in editedPlans) return editedPlans[i];
    return Number(plan2026[i]?.planObrotu || 0);
  };

  const chartData = MONTHS.map((m, i) => ({
    name: m,
    plan: editMode ? getEditedPlan(i) : Number(plan2026[i]?.planObrotu || 0),
    wykonanie: Number(plan2026[i]?.wykonanieObrotu || 0),
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

  const currentMonth = new Date().getMonth();
  const currentMonthData = plan2026[currentMonth];
  const monthPlan = Number(currentMonthData?.planObrotu || 0);
  const monthExec = Number(currentMonthData?.wykonanieObrotu || 0);
  const monthDiff = monthExec - monthPlan;
  const monthPct = monthPlan > 0 ? (monthExec / monthPlan * 100) : 0;

  const MONTHS_FULL = ["Styczen", "Luty", "Marzec", "Kwiecien", "Maj", "Czerwiec", "Lipiec", "Sierpien", "Wrzesien", "Pazdziernik", "Listopad", "Grudzien"];

  const handleSaveTargets = () => {
    const targets = MONTHS.map((_, i) => ({
      miesiac: i + 1,
      planObrotu: getEditedPlan(i),
    }));
    updateTargetsMutation.mutate(targets);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Panel sprzedazowy 2026</h1>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} data-testid="button-sync-execution">
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} /> Synchronizuj wykonanie
            </Button>
            {!editMode ? (
              <Button variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-targets">
                <Pencil className="w-4 h-4 mr-2" /> Edytuj plany
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setEditMode(false); setEditedPlans({}); }}>Anuluj</Button>
                <Button onClick={handleSaveTargets} disabled={updateTargetsMutation.isPending} data-testid="button-save-targets">
                  <Save className="w-4 h-4 mr-2" /> Zapisz plany
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Plan - {MONTHS_FULL[currentMonth]}</p>
                <p className="text-xl font-bold" data-testid="text-month-plan">{monthPlan.toLocaleString("pl-PL")} PLN</p>
              </div>
              <Target className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Wykonanie - {MONTHS_FULL[currentMonth]}</p>
                <p className="text-xl font-bold" data-testid="text-month-exec">{monthExec.toLocaleString("pl-PL")} PLN</p>
              </div>
              <DollarSign className="w-5 h-5 text-chart-4" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Roznica - {MONTHS_FULL[currentMonth]}</p>
                <p className={`text-xl font-bold ${monthDiff >= 0 ? '' : 'text-destructive'}`} data-testid="text-month-diff">
                  {monthDiff.toLocaleString("pl-PL")} PLN
                </p>
              </div>
              {monthDiff >= 0 ? <TrendingUp className="w-5 h-5 text-chart-4" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Realizacja - {MONTHS_FULL[currentMonth]}</p>
                <p className="text-xl font-bold">{monthPct.toFixed(1)}%</p>
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
                    const plan = editMode ? getEditedPlan(i) : Number(p.planObrotu || 0);
                    const exec = Number(p.wykonanieObrotu || 0);
                    cumPlan += plan;
                    cumExec += exec;
                    const diff = exec - plan;
                    const pct = plan > 0 ? (exec / plan * 100) : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{MONTHS[i]}</TableCell>
                        <TableCell className="text-right">
                          <EditablePlanCell
                            value={plan}
                            editing={editMode && isAdmin}
                            onChange={(v) => setEditedPlans(prev => ({ ...prev, [i]: v }))}
                            onSave={() => {}}
                          />
                        </TableCell>
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
