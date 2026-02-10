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
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Target,
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
            <Icon className={`w-5 h-5 ${color ? 'text-white' : 'text-primary'}`} />
          </div>
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
    if (hour < 12) return "Dzien dobry";
    if (hour < 18) return "Dzien dobry";
    return "Dobry wieczor";
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
              Kalendarz kontaktow
            </Button>
          </Link>
        )}
      </div>

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
        {stats?.alertClients > 0 && (
          <StatCard
            title="Alerty klientow"
            value={stats?.alertClients || 0}
            icon={AlertTriangle}
            subtitle="brak zamowien >= 2"
            color="bg-destructive"
          />
        )}
        {isAdmin && (
          <StatCard
            title="Sprzedaz miesiaca"
            value={`${((stats?.monthSales || 0) / 1000).toFixed(0)} tys. PLN`}
            icon={TrendingUp}
            subtitle={`Plan: ${((stats?.monthPlan || 0) / 1000).toFixed(0)} tys. PLN`}
          />
        )}
      </div>

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
