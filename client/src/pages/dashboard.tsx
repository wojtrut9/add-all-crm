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
  TrendingUp,
  Target,
  Crown,
  Star,
  UserCheck,
  ShoppingCart,
} from "lucide-react";

function StatCard({ title, value, icon: Icon, subtitle, color }: {
  title: string; value: string | number; icon: any; subtitle?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
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
  return val.toLocaleString("pl-PL", { maximumFractionDigits: 0 }) + " PLN";
}

const POLISH_MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

function MonthlySalesWidget({ stats }: { stats: any }) {
  const monthSales = Number(stats?.monthSales || 0);
  const monthPlan = Number(stats?.monthPlan || 0);
  const workingDaysPassed = Number(stats?.workingDaysPassed || 0);
  const expectedSales = Number(stats?.expectedSales || 0);

  const onTrack = monthPlan === 0 || monthSales >= expectedSales;
  const progressPercent = monthPlan > 0 ? Math.min((monthSales / monthPlan) * 100, 100) : 0;
  const currentMonth = POLISH_MONTHS[new Date().getMonth()];

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
          Sprzedaż miesiąca — {currentMonth}
        </CardTitle>
        <Target
          className="w-5 h-5"
          style={{ color: onTrack ? "hsl(142 76% 35%)" : "hsl(0 84% 35%)" }}
        />
      </CardHeader>
      <CardContent className="space-y-4">
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
          className="text-sm text-center p-2 rounded-md"
          style={{
            backgroundColor: onTrack ? "hsl(142 76% 90%)" : "hsl(0 84% 90%)",
            color: onTrack ? "hsl(142 76% 25%)" : "hsl(0 84% 30%)",
          }}
          data-testid="text-daily-indicator"
        >
          Dzień {workingDaysPassed}/20 — powinno być: {formatPLN(expectedSales)}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyOrderWidget({ data }: { data: { name: string; totalClients: number; totalContacts: number; contacted: number; ordered: number } }) {
  const { name, totalClients, totalContacts, contacted, ordered } = data;
  const ratio = totalClients > 0 ? ordered / totalClients : 0;

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
      data-testid={`card-weekly-orders-${name.toLowerCase()}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" style={{ color: accentColor }} />
            <p className="text-sm font-medium" style={{ color: textColor }}>{name}</p>
          </div>
          <Badge
            variant="secondary"
            className="no-default-hover-elevate no-default-active-elevate"
            style={{ backgroundColor: accentColor, color: "#fff", border: "none" }}
          >
            {totalClients > 0 ? (ratio * 100).toFixed(0) : 0}%
          </Badge>
        </div>
        <p className="text-sm" style={{ color: textColor }}>
          Zamówienia ten tydzień
        </p>
        <p className="text-3xl font-bold" style={{ color: textColor }} data-testid={`text-weekly-orders-${name.toLowerCase()}`}>
          {ordered} / {totalClients}
        </p>
        <div className="text-xs space-y-0.5" style={{ color: textColor, opacity: 0.75 }}>
          <p>Kontakty w kalendarzu: {totalContacts}</p>
          <p>Obdzwonionych: {contacted}</p>
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
    if (hour < 12) return "Dzień dobry";
    if (hour < 18) return "Dzień dobry";
    return "Dobry wieczór";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{greeting()}, {user?.imie}!</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {(isHandlowiec || isAdmin) && (
          <Link href="/kalendarz">
            <Button data-testid="button-generate-week">
              <Calendar className="w-4 h-4 mr-2" />
              Kalendarz kontaktów
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
              <MonthlySalesWidget stats={stats} />
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredOrders.map((wo: any) => (
                <WeeklyOrderWidget key={wo.name} data={wo} />
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Klienci aktywni"
          value={stats?.activeClients || 0}
          icon={Users}
          subtitle={`z ${stats?.totalClients || 0} wszystkich`}
        />
        <StatCard
          title="Kontakty dzisiaj"
          value={stats?.todayContacts || 0}
          icon={Phone}
          subtitle="zaplanowane"
        />
        {(isAdmin || isLogistyka) && (
          <StatCard
            title="Dostawy jutro"
            value={stats?.tomorrowDeliveries || 0}
            icon={Truck}
            subtitle="do realizacji"
          />
        )}
        <StatCard
          title="Alerty klientów"
          value={stats?.alertClients || 0}
          icon={AlertTriangle}
          subtitle="brak zamówień >= 2"
          color={stats?.alertClients > 0 ? "bg-destructive" : "bg-muted"}
        />
      </div>

      {isAdmin && stats?.handlowcy && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.handlowcy.map((h: any) => (
            <Card key={h.name} data-testid={`card-handler-${h.name.toLowerCase()}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{h.name}</CardTitle>
                </div>
                <Link href={`/klienci?opiekun=${h.name}`}>
                  <Button variant="ghost" size="sm" data-testid={`button-view-clients-${h.name.toLowerCase()}`}>
                    Klienci <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Klienci</p>
                    <p className="text-xl font-bold" data-testid={`text-active-${h.name.toLowerCase()}`}>{h.activeClients}</p>
                    <p className="text-xs text-muted-foreground">z {h.totalClients} wszystkich</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <p className="text-xs text-muted-foreground">Premium</p>
                    </div>
                    <p className="text-xl font-bold" data-testid={`text-premium-${h.name.toLowerCase()}`}>{h.premiumClients}</p>
                  </div>
                  {h.standardClients > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-blue-500" />
                        <p className="text-xs text-muted-foreground">Standard</p>
                      </div>
                      <p className="text-xl font-bold" data-testid={`text-standard-${h.name.toLowerCase()}`}>{h.standardClients}</p>
                    </div>
                  )}
                  {h.weryfikacjaClients > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3 text-orange-500" />
                        <p className="text-xs text-muted-foreground">Weryfikacja</p>
                      </div>
                      <p className="text-xl font-bold" data-testid={`text-weryfikacja-${h.name.toLowerCase()}`}>{h.weryfikacjaClients}</p>
                    </div>
                  )}
                  {h.alertClients > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                        <p className="text-xs text-muted-foreground">Alerty</p>
                      </div>
                      <p className="text-xl font-bold" data-testid={`text-alerts-${h.name.toLowerCase()}`}>{h.alertClients}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(isHandlowiec || isAdmin) && todayContacts && todayContacts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">Kontakty na dzisiaj</CardTitle>
            <Link href="/kalendarz">
              <Button variant="ghost" size="sm">
                Zobacz wszystkie <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayContacts.slice(0, 8).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50">
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
                      Analiza sprzedaży
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
