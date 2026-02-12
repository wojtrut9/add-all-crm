import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { Link } from "wouter";
import { authFetch } from "@/lib/auth";
import {
  Users,
  Calendar,
  Truck,
  AlertTriangle,
  Phone,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Target,
  Crown,
  Star,
  UserCheck,
  ShoppingCart,
} from "lucide-react";

function StatCard({ title, value, icon: Icon, subtitle, color, extra }: {
  title: string; value: string | number; icon: any; subtitle?: string; color?: string; extra?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
          </div>
          <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${color || 'bg-primary/10'}`}>
            <Icon className={`w-5 h-5 ${color === 'bg-muted' ? 'text-muted-foreground' : color ? 'text-white' : 'text-primary'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatPLN(val: number) {
  return Math.round(val).toLocaleString("pl-PL") + " PLN";
}

const POLISH_MONTHS = [
  "Styczen", "Luty", "Marzec", "Kwiecien", "Maj", "Czerwiec",
  "Lipiec", "Sierpien", "Wrzesien", "Pazdziernik", "Listopad", "Grudzien"
];

function MonthlySalesWidget({ stats, isHandlowiec, userName }: { stats: any; isHandlowiec: boolean; userName?: string }) {
  let monthSales = Number(stats?.monthSales || 0);
  let monthPlan = Number(stats?.monthPlan || 0);

  if (isHandlowiec && userName) {
    const wo = (stats?.weeklyOrders || []).find((w: any) => w.name === userName);
    if (wo) {
      monthSales = wo.handlowiecMonthSales || 0;
    }
  }

  const workingDaysPassed = Number(stats?.workingDaysPassed || 0);
  const totalWorkdays = Number(stats?.totalWorkdays || 20);
  const dailyTarget = totalWorkdays > 0 ? monthPlan / totalWorkdays : 0;

  const effectiveTempo = isHandlowiec
    ? (workingDaysPassed > 0 ? monthSales / workingDaysPassed : 0)
    : Number(stats?.tempo || 0);
  const effectivePrognoza = effectiveTempo * totalWorkdays;
  const effectivePrognozaOnTrack = effectivePrognoza >= monthPlan;

  const onTrack = monthPlan === 0 || effectivePrognozaOnTrack;
  const progressPercent = monthPlan > 0 ? Math.min((monthSales / monthPlan) * 100, 100) : 0;
  const currentMonth = POLISH_MONTHS[new Date().getMonth()];
  const brakuje = Math.max(0, monthPlan - monthSales);
  const nadwyzka = Math.max(0, monthSales - monthPlan);

  return (
    <Card
      className="border-2"
      style={{
        backgroundColor: onTrack ? "hsl(142 76% 96%)" : "hsl(0 84% 96%)",
        borderColor: onTrack ? "hsl(142 76% 80%)" : "hsl(0 84% 80%)",
      }}
      data-testid="card-monthly-sales"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle
          className="text-base"
          style={{ color: onTrack ? "hsl(142 76% 25%)" : "hsl(0 84% 30%)" }}
        >
          {isHandlowiec ? `Twoja sprzedaz — ${currentMonth}` : `Sprzedaz miesiaca — ${currentMonth}`}
        </CardTitle>
        <Target
          className="w-5 h-5"
          style={{ color: onTrack ? "hsl(142 76% 35%)" : "hsl(0 84% 35%)" }}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center space-y-1">
          <p
            className="text-4xl font-bold tracking-tight"
            style={{ color: onTrack ? "hsl(142 76% 20%)" : "hsl(0 84% 25%)" }}
            data-testid="text-monthly-sales-value"
          >
            {formatPLN(monthSales)}
          </p>
          <p
            className="text-lg font-medium"
            style={{ color: onTrack ? "hsl(142 76% 30%)" : "hsl(0 84% 35%)" }}
          >
            / {formatPLN(monthPlan)}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs" style={{ color: onTrack ? "hsl(142 76% 30%)" : "hsl(0 84% 35%)" }}>
            <span>{progressPercent.toFixed(1)}%</span>
            <span>100%</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: onTrack ? "hsl(142 76% 85%)" : "hsl(0 84% 85%)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: onTrack ? "hsl(142 76% 40%)" : "hsl(0 84% 45%)",
              }}
            />
          </div>
        </div>

        <div
          className="text-xs text-center p-2 rounded-md"
          style={{
            backgroundColor: onTrack ? "hsl(142 76% 90%)" : "hsl(0 84% 90%)",
            color: onTrack ? "hsl(142 76% 25%)" : "hsl(0 84% 30%)",
          }}
          data-testid="text-daily-indicator"
        >
          <p>Dzien {workingDaysPassed}/{totalWorkdays} — powinno byc: {formatPLN(dailyTarget * workingDaysPassed)}</p>
          <p className="mt-1">Tempo: {formatPLN(effectiveTempo)}/dzien | Prognoza: {formatPLN(effectivePrognoza)}</p>
        </div>

        {isHandlowiec && monthPlan > 0 && (
          <div
            className="text-sm text-center font-medium p-2 rounded-md"
            style={{
              backgroundColor: onTrack ? "hsl(142 76% 88%)" : "hsl(0 84% 88%)",
              color: onTrack ? "hsl(142 76% 20%)" : "hsl(0 84% 25%)",
            }}
            data-testid="text-motivation"
          >
            {monthSales >= monthPlan
              ? `Jestes ${formatPLN(nadwyzka)} nad celem!`
              : `Brakuje Ci ${formatPLN(brakuje)} do celu`
            }
          </div>
        )}

        <p
          className="text-xs text-center font-medium"
          style={{ color: onTrack ? "hsl(142 76% 30%)" : "hsl(0 84% 35%)" }}
        >
          {onTrack ? "Na dobrej drodze" : `Zagrozony — brakuje ~${formatPLN(Math.max(0, monthPlan - effectivePrognoza))}`}
        </p>
      </CardContent>
    </Card>
  );
}

function HandlerCard({ data, showDetails }: { data: any; showDetails: boolean }) {
  const { name, totalClients, totalContacts, contacted, ordered,
    premiumTotal, premiumOrdered, standardTotal, standardOrdered,
    weryfikacjaTotal, weryfikacjaOrdered, alertClients,
    weekSales, prevWeekSales } = data;
  const ratio = totalClients > 0 ? ordered / totalClients : 0;

  const weekChange = prevWeekSales > 0 ? ((weekSales - prevWeekSales) / prevWeekSales * 100) : 0;

  let bgColor: string;
  let borderColor: string;
  let textColor: string;
  let accentColor: string;

  if (ratio > 0.5) {
    bgColor = "hsl(142 76% 96%)";
    borderColor = "hsl(142 76% 80%)";
    textColor = "hsl(142 76% 25%)";
    accentColor = "hsl(142 76% 40%)";
  } else if (ratio >= 0.25) {
    bgColor = "hsl(45 93% 95%)";
    borderColor = "hsl(45 93% 70%)";
    textColor = "hsl(45 93% 25%)";
    accentColor = "hsl(45 93% 40%)";
  } else {
    bgColor = "hsl(0 84% 96%)";
    borderColor = "hsl(0 84% 80%)";
    textColor = "hsl(0 84% 30%)";
    accentColor = "hsl(0 84% 45%)";
  }

  return (
    <Card
      className="border-2"
      style={{ backgroundColor: bgColor, borderColor }}
      data-testid={`card-handler-${name.toLowerCase()}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" style={{ color: accentColor }} />
            <p className="text-sm font-bold" style={{ color: textColor }}>{name}</p>
          </div>
          <div className="flex items-center gap-2">
            {showDetails && (
              <Link href={`/klienci?opiekun=${name}`}>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" data-testid={`button-view-clients-${name.toLowerCase()}`}>
                  Klienci <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
            <Badge
              variant="secondary"
              className="no-default-hover-elevate no-default-active-elevate"
              style={{ backgroundColor: accentColor, color: "#fff", border: "none" }}
            >
              {totalClients > 0 ? (ratio * 100).toFixed(0) : 0}%
            </Badge>
          </div>
        </div>

        <p className="text-sm" style={{ color: textColor }}>
          Zamowienia ten tydzien
        </p>
        <p className="text-3xl font-bold" style={{ color: textColor }} data-testid={`text-weekly-orders-${name.toLowerCase()}`}>
          {ordered} / {totalClients}
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {premiumTotal > 0 && (
            <div className="text-center p-2 rounded-md" style={{ backgroundColor: `${accentColor}15` }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Crown className="w-3 h-3" style={{ color: accentColor }} />
                <p className="text-xs" style={{ color: textColor, opacity: 0.75 }}>Premium</p>
              </div>
              <p className="text-lg font-bold" style={{ color: textColor }} data-testid={`text-premium-${name.toLowerCase()}`}>
                {premiumOrdered}/{premiumTotal}
              </p>
            </div>
          )}
          {standardTotal > 0 && (
            <div className="text-center p-2 rounded-md" style={{ backgroundColor: `${accentColor}15` }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className="w-3 h-3" style={{ color: accentColor }} />
                <p className="text-xs" style={{ color: textColor, opacity: 0.75 }}>Standard</p>
              </div>
              <p className="text-lg font-bold" style={{ color: textColor }} data-testid={`text-standard-${name.toLowerCase()}`}>
                {standardOrdered}/{standardTotal}
              </p>
            </div>
          )}
          {weryfikacjaTotal > 0 && (
            <div className="text-center p-2 rounded-md" style={{ backgroundColor: `${accentColor}15` }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <ShoppingCart className="w-3 h-3" style={{ color: accentColor }} />
                <p className="text-xs" style={{ color: textColor, opacity: 0.75 }}>Weryfikacja</p>
              </div>
              <p className="text-lg font-bold" style={{ color: textColor }} data-testid={`text-weryfikacja-${name.toLowerCase()}`}>
                {weryfikacjaOrdered}/{weryfikacjaTotal}
              </p>
            </div>
          )}
        </div>

        <div className="text-xs space-y-1" style={{ color: textColor, opacity: 0.85 }}>
          <div className="flex items-center justify-between gap-2">
            <span>Sprzedaz tygodnia: {formatPLN(weekSales)}</span>
            {prevWeekSales > 0 && (
              <span className="flex items-center gap-0.5">
                {weekChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {weekChange >= 0 ? "+" : ""}{weekChange.toFixed(0)}%
              </span>
            )}
          </div>
          <p>Kontakty: {totalContacts} | Obdzwonionych: {contacted}</p>
          {showDetails && alertClients > 0 && (
            <p className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Alerty: {alertClients}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await authFetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: todayContacts } = useQuery({
    queryKey: ["/api/contacts/today"],
    queryFn: async () => {
      const res = await authFetch("/api/contacts/today");
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const isAdmin = user?.rola === "admin";
  const isHandlowiec = user?.rola === "handlowiec";
  const isLogistyka = user?.rola === "logistyka";

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 18) return "Dzien dobry";
    return "Dobry wieczor";
  };

  const todayDone = todayContacts ? todayContacts.filter((c: any) => c.status && c.status !== "Do zrobienia").length : 0;
  const todayOrdersSales = todayContacts
    ? todayContacts.filter((c: any) => c.status === "Zamowil").reduce((s: number, c: any) => s + Number(c.kwota || 0), 0)
    : 0;

  const myWeeklyData = isHandlowiec
    ? (stats?.weeklyOrders || []).find((wo: any) => wo.name === user?.imie)
    : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-greeting">{greeting()}, {user?.imie}!</h1>
          <p className="text-muted-foreground text-sm" data-testid="text-date">
            {new Date().toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {(isHandlowiec || isAdmin) && (
          <Link href="/kalendarz">
            <Button data-testid="button-generate-week">
              <Calendar className="w-4 h-4 mr-2" />
              Kalendarz kontaktow
            </Button>
          </Link>
        )}
      </div>

      {(isAdmin || isHandlowiec) && stats && (() => {
        const filteredOrders = isHandlowiec
          ? (stats.weeklyOrders || []).filter((wo: any) => wo.name === user?.imie)
          : (stats.weeklyOrders || []);
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <MonthlySalesWidget stats={stats} isHandlowiec={isHandlowiec} userName={user?.imie} />
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredOrders.map((wo: any) => (
                <HandlerCard key={wo.name} data={wo} showDetails={isAdmin} />
              ))}
              {isHandlowiec && myWeeklyData && (
                <Card className="border-2 border-primary/20">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Twoja konwersja tygodniowa</p>
                    <p className="text-3xl font-bold" data-testid="text-conversion">
                      {myWeeklyData.totalContacts > 0 ? ((myWeeklyData.ordered / myWeeklyData.totalContacts) * 100).toFixed(0) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {myWeeklyData.ordered} zamowien z {myWeeklyData.totalContacts} kontaktow
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Klienci z zamowieniem"
          value={`${stats?.uniqueOrderedClients || 0} / ${stats?.activeClients || 0}`}
          icon={Users}
          subtitle="w tym miesiacu"
        />
        <StatCard
          title="Kontakty dzisiaj"
          value={stats?.todayContacts || 0}
          icon={Phone}
          subtitle={`${stats?.todayContactsDone || 0} zrealizowanych`}
        />
        {(isAdmin || isLogistyka) && (
          <StatCard
            title="Dostawy jutro"
            value={stats?.tomorrowDeliveries || 0}
            icon={Truck}
            subtitle={stats?.tomorrowDeliveriesValue > 0 ? formatPLN(stats.tomorrowDeliveriesValue) : "do realizacji"}
          />
        )}
        <StatCard
          title="Alerty klientow"
          value={stats?.alertClients || 0}
          icon={AlertTriangle}
          subtitle="brak zamowien >= 2"
          color={stats?.alertClients > 0 ? "bg-destructive" : "bg-muted"}
        />
      </div>

      {(isHandlowiec || isAdmin) && todayContacts && todayContacts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-base">Kontakty na dzisiaj</CardTitle>
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-today-summary">
                {todayDone}/{todayContacts.length} zrealizowanych | Zamowienia: {formatPLN(todayOrdersSales)}
              </p>
            </div>
            <Link href="/kalendarz">
              <Button variant="ghost" size="sm">
                Zobacz wszystkie <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {todayContacts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50" data-testid={`contact-today-${c.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                      backgroundColor:
                        c.status === "Zamowil" ? "hsl(var(--chart-4))" :
                        c.status === "Nie zamowil" ? "hsl(var(--destructive))" :
                        c.status === "W trakcie" ? "hsl(var(--chart-2))" :
                        c.status === "Zrobione" ? "hsl(var(--chart-5))" :
                        "hsl(var(--muted-foreground))"
                    }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.clientName || "Klient"}</p>
                      <p className="text-xs text-muted-foreground">{c.formaKontaktu || c.typ}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.kwota && Number(c.kwota) > 0 && (
                      <span className="text-xs font-medium">{formatPLN(Number(c.kwota))}</span>
                    )}
                    {c.priorytet === "Pilny" && <Badge variant="destructive" className="text-xs">Pilny</Badge>}
                    {c.priorytet === "ASAP" && <Badge variant="destructive" className="text-xs">ASAP</Badge>}
                    <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(isAdmin || isLogistyka) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">Szybkie akcje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link href="/dostawy">
                <Button variant="outline">
                  <Truck className="w-4 h-4 mr-2" />
                  Dostawy na jutro
                </Button>
              </Link>
              {isAdmin && (
                <>
                  <Link href="/analiza">
                    <Button variant="outline">
                      <Target className="w-4 h-4 mr-2" />
                      Analiza sprzedazy
                    </Button>
                  </Link>
                  <Link href="/finanse">
                    <Button variant="outline">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Panel finansowy
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
