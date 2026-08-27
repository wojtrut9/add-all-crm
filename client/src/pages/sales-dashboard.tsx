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
  LineChart, Line, LabelList,
} from "recharts";

import { MONTHS_SHORT as MONTHS } from "@/lib/constants";
import { countPolishWorkdays, countPolishWorkdaysInMonth } from "@shared/polishHolidays";

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

// Skrocona kwota do etykiet na wykresie — pelna liczba nie miesci sie
// przy poczatku linii i zaslaniala by sasiednie lata.
function formatSkrot(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(".", ",") + " mln";
  return Math.round(v / 1000).toLocaleString("pl-PL") + "k";
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
    refetchInterval: 60_000,
    staleTime: 30_000,
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

  // In edit mode we want to show the raw (stored) value for custom months, and
  // the auto +5% suggestion for non-custom months — so the user sees the same
  // numbers as the main plan but can still override them.
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
  const yearTotals = (history || []).map((h: any) => ({
    rok: h.rok,
    suma: Math.round((h.months || []).reduce((sum: number, m: any) => sum + Number(m.wartosc || 0), 0)),
    miesiecy: (h.months || []).length,
  }));
  // --- Prognoza na koniec biezacego roku ----------------------------------
  // Firmowa regula planu ("poprzedni miesiac x 1,05") stosowana rekurencyjnie:
  // ostatni zamkniety miesiac jest baza, kazdy nastepny liczy sie z miesiaca
  // policzonego przed chwila. Sam plan z API sie do tego nie nadaje, bo dla
  // miesiecy bez zrealizowanego poprzednika zwraca 0.
  //
  // Pierwszenstwo ma reczny plan, jesli ktos go wpisal — wtedy on wchodzi do
  // sumy i to on staje sie baza dla kolejnego miesiaca.
  const WSPOLCZYNNIK = 1.05;
  const biezacyRok = new Date().getFullYear();

  const miesiaceRoku = (rok: number): number[] => {
    const wpis = (history || []).find((h: any) => h.rok === rok);
    const out: number[] = new Array(12).fill(0);
    (wpis?.months || []).forEach((m: any) => {
      out[m.miesiac - 1] = Number(m.wartosc || 0);
    });
    return out;
  };
  const biezacy = miesiaceRoku(biezacyRok);
  const poprzedni = miesiaceRoku(biezacyRok - 1);

  // Ostatni miesiac z danymi zwykle trwa, wiec jest niepelny — nie moze byc
  // baza lancucha, bo zanizylby wszystkie kolejne miesiace.
  let ostatniZDanymi = 0;
  biezacy.forEach((v, i) => {
    if (v > 0) ostatniZDanymi = i + 1;
  });
  const zamkniete = Math.max(0, ostatniZDanymi - 1);
  const sumaZamknietych = biezacy.slice(0, zamkniete).reduce((a, b) => a + b, 0);

  const planReczny = (m: number): number => {
    const t = plan2026[m - 1];
    return t?.planObrotuCustom && Number(t.planObrotu) > 0 ? Number(t.planObrotu) : 0;
  };

  // Trwajacy miesiac ma juz czesciowe dane — zamiast zgadywac go regula +5%,
  // przeliczamy sprzedaz dotychczasowa na caly miesiac proporcja dni
  // roboczych (z polskimi swietami). Zwraca 0, gdy ostatni miesiac z danymi
  // nie jest miesiacem, w ktorym faktycznie jestesmy — wtedy nie ma czego
  // ekstrapolowac i zostaje regula +5%.
  const dzisiaj = new Date();
  const ekstrapolacjaTrwajacego = (): number => {
    if (ostatniZDanymi !== dzisiaj.getMonth() + 1) return 0;
    const doDzis = countPolishWorkdays(biezacyRok, ostatniZDanymi, dzisiaj.getDate());
    const wCalymMiesiacu = countPolishWorkdaysInMonth(biezacyRok, ostatniZDanymi);
    if (doDzis <= 0 || wCalymMiesiacu <= 0) return 0;
    return (biezacy[ostatniZDanymi - 1] * wCalymMiesiacu) / doDzis;
  };

  // Na poczatku roku nie ma jeszcze zamknietego miesiaca — wtedy baza jest
  // grudzien roku poprzedniego, tak samo jak w regule stosowanej przez API.
  let bazaLancucha = zamkniete > 0 ? biezacy[zamkniete - 1] : poprzedni[11];
  let prognozaRoku = sumaZamknietych;
  for (let m = zamkniete + 1; m <= 12; m++) {
    const reczny = planReczny(m);
    let wartosc = reczny > 0 ? reczny : bazaLancucha * WSPOLCZYNNIK;
    if (m === ostatniZDanymi) {
      const zDniRoboczych = ekstrapolacjaTrwajacego();
      // Ekstrapolacja opiera sie na realnych danych z tego miesiaca, wiec ma
      // pierwszenstwo przed regula +5%. Reczny plan bije jedno i drugie.
      if (reczny === 0 && zDniRoboczych > 0) wartosc = zDniRoboczych;
      // Nigdy ponizej tego, co juz zostalo sprzedane.
      wartosc = Math.max(wartosc, biezacy[m - 1]);
    }
    prognozaRoku += wartosc;
    bazaLancucha = wartosc;
  }

  // Etykiety sum stoja na wysokosci styczniowego punktu swojej linii, wiec
  // lata o zblizonym styczniu nachodzilyby na siebie. Kolizje wykrywamy w
  // wartosciach, a rozsuwamy w pikselach: wyzsza etykieta idzie w gore,
  // nizsza w dol.
  const ODSTEP_PX = 17;
  const WYS_WYKRESU_PX = 230;
  const maxWartosc = Math.max(
    1,
    ...historyChartData.flatMap((d: any) => years.map((y: number) => Number(d[`rok_${y}`] || 0)))
  );
  const progKolizji = (ODSTEP_PX * maxWartosc) / WYS_WYKRESU_PX;
  const odsunieciaEtykiet: Record<number, number> = {};
  const startyLinii: Array<{ rok: number; styczen: number }> = years.map((y: number) => ({
    rok: y,
    styczen: Number(historyChartData[0]?.[`rok_${y}`] || 0),
  }));
  startyLinii
    .sort((a, b) => b.styczen - a.styczen)
    .forEach((biezacy, idx, posortowane) => {
      if (idx === 0) return;
      const poprzedni = posortowane[idx - 1];
      if (poprzedni.styczen - biezacy.styczen < progKolizji) {
        odsunieciaEtykiet[poprzedni.rok] = (odsunieciaEtykiet[poprzedni.rok] || 0) - ODSTEP_PX / 2;
        odsunieciaEtykiet[biezacy.rok] = (odsunieciaEtykiet[biezacy.rok] || 0) + ODSTEP_PX / 2;
      }
    });

  const lineColors = ["hsl(210, 92%, 45%)", "hsl(25, 95%, 42%)", "hsl(340, 82%, 38%)", "hsl(160, 65%, 35%)", "hsl(280, 75%, 40%)", "hsl(45, 85%, 50%)"];

  const currentMonth = new Date().getMonth();
  const currentMonthData = plan2026[currentMonth];
  const monthPlan = Number(currentMonthData?.planObrotu || 0);
  const monthExec = Number(currentMonthData?.wykonanieObrotu || 0);
  const monthDiff = monthExec - monthPlan;
  const monthPct = monthPlan > 0 ? (monthExec / monthPlan * 100) : 0;
  const monthPlanIsCustom = Boolean(currentMonthData?.planObrotuCustom);

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
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Plan - {MONTHS_FULL[currentMonth]}
                  {monthPlanIsCustom ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">custom</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium" title="Realizacja poprzedniego miesiąca × 1,05">auto +5%</span>
                  )}
                </p>
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
                <YAxis width={96} tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `${Number(v).toLocaleString("pl-PL")} PLN`} />
                <Legend />
                {years.map((y: number, i: number) => {
                  const kolor = lineColors[i % lineColors.length];
                  const suma = yearTotals.find((t: { rok: number }) => t.rok === y)?.suma || 0;
                  return (
                    <Line key={y} type="monotone" dataKey={`rok_${y}`} name={String(y)} stroke={kolor} strokeWidth={y === 2026 ? 3 : 1.5} dot={false}>
                      <LabelList
                        content={(props: any) =>
                          props.index === 0 ? (
                            <text x={2} y={props.y + 4 + (odsunieciaEtykiet[y] || 0)} fontSize={12} fontWeight={700} fill={kolor} textAnchor="start">
                              {formatSkrot(suma)}
                            </text>
                          ) : null
                        }
                      />
                    </Line>
                  );
                })}
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Suma sprzedazy w latach</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {yearTotals.map((y: { rok: number; suma: number; miesiecy: number }, i: number) => {
                  const kolor = lineColors[i % lineColors.length];
                  return (
                    <div key={y.rok} className="rounded-md border p-2" data-testid={`card-year-total-${y.rok}`}>
                      <p className="text-xs font-semibold" style={{ color: kolor }}>
                        {y.rok}
                        {y.miesiecy < 12 && (
                          <span className="ml-1 font-normal text-muted-foreground">({y.miesiecy} mies.)</span>
                        )}
                      </p>
                      <p className="text-sm font-bold">
                        {y.suma.toLocaleString("pl-PL")} PLN
                        {y.rok === biezacyRok && prognozaRoku > 0 && (
                          <span
                            className="ml-1 text-xs font-normal text-muted-foreground"
                            title="Miesiace zamkniete wg rzeczywistej sprzedazy, kolejne wyliczane lancuchowo: poprzedni miesiac + 5%"
                          >
                            (prognoza {Math.round(prognozaRoku).toLocaleString("pl-PL")} PLN)
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
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
                    const isCustom = Boolean(p.planObrotuCustom);
                    cumPlan += plan;
                    cumExec += exec;
                    const diff = exec - plan;
                    const pct = plan > 0 ? (exec / plan * 100) : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{MONTHS[i]}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <EditablePlanCell
                              value={plan}
                              editing={editMode && isAdmin}
                              onChange={(v) => setEditedPlans(prev => ({ ...prev, [i]: v }))}
                              onSave={() => {}}
                            />
                            {!editMode && (
                              isCustom
                                ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">custom</span>
                                : <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium" title="Auto = realizacja poprzedniego miesiąca × 1,05">auto</span>
                            )}
                          </div>
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
