import { useQuery } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Target,
  ShoppingCart,
  BarChart3,
  Crown,
  AlertTriangle,
  Phone,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const formatPLN = (val: number) => {
  return Math.round(val).toLocaleString("pl-PL").replace(/,/g, " ") + " PLN";
};

const formatPercent = (val: number) => {
  return val.toFixed(1) + "%";
};

export default function MySalesPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/my-sales"],
    queryFn: async () => {
      const res = await authFetch("/api/my-sales");
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-52" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const monthSales = data?.monthSales || 0;
  const monthTarget = data?.monthTarget || 0;
  const prevMonthSales = data?.prevMonthSales || 0;
  const recentOrders = data?.recentOrders || [];
  const monthOrdersCount = data?.monthOrdersCount || 0;
  const monthOrdersTotal = data?.monthOrdersTotal || 0;
  const conversionRate = data?.conversionRate || 0;
  const totalContacts = data?.totalContacts || 0;
  const weekSales = data?.weekSales || 0;
  const weekOrdersCount = data?.weekOrdersCount || 0;
  const bestClient = data?.bestClient || null;
  const urgentClients = data?.urgentClients || [];
  const noRecentContact = data?.noRecentContact || [];

  const realizacja = monthTarget > 0 ? (monthSales / monthTarget) * 100 : 0;

  const now = new Date();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const countWorkdays = (year: number, month: number, upToDay: number) => {
    let count = 0;
    for (let d = 1; d <= upToDay; d++) {
      const dow = new Date(year, month, d).getDay();
      if (dow >= 1 && dow <= 5) count++;
    }
    return count;
  };

  const totalWorkdays = countWorkdays(now.getFullYear(), now.getMonth(), totalDaysInMonth);
  const workdaysPassed = countWorkdays(now.getFullYear(), now.getMonth(), now.getDate());
  const workdaysLeft = totalWorkdays - workdaysPassed;

  const tempo = workdaysPassed > 0 ? monthSales / workdaysPassed : 0;
  const prognoza = workdaysPassed > 0 ? tempo * totalWorkdays : monthSales;
  const prognozaOnTrack = prognoza >= monthTarget;

  const changeVsPrev = prevMonthSales > 0 ? ((monthSales - prevMonthSales) / prevMonthSales) * 100 : 0;

  const progressColor = realizacja >= 80 ? "bg-green-500" : realizacja >= 50 ? "bg-yellow-500" : "bg-red-500";

  const conversionColor = conversionRate > 50 ? "bg-green-600 text-white" : conversionRate >= 30 ? "bg-yellow-600 text-white" : "bg-red-600 text-white";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold" data-testid="text-page-title">Moja sprzedaz - {user?.imie}</h1>

      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Cel miesieczny</p>

            <div className="flex items-center justify-center gap-3">
              <Target className="w-8 h-8 text-primary" />
              <p className="text-3xl sm:text-4xl font-bold" data-testid="text-realizacja">
                {formatPLN(monthSales)} / {formatPLN(monthTarget)}{" "}
                <span className={realizacja >= 80 ? "text-green-600" : realizacja >= 50 ? "text-yellow-600" : "text-red-600"}>
                  ({formatPercent(realizacja)})
                </span>
              </p>
            </div>

            <div className="max-w-lg mx-auto" data-testid="progress-target">
              <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressColor}`}
                  style={{ width: `${Math.min(100, realizacja)}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground" data-testid="text-tempo">
                Tempo: <span className="font-semibold text-foreground">{formatPLN(tempo)}/dzien roboczy</span>
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-prognoza">
                Prognoza na koniec miesiaca: <span className="font-semibold text-foreground">{formatPLN(prognoza)}</span>
              </p>
            </div>

            {monthTarget > 0 && (
              <div className={`p-3 rounded-md max-w-lg mx-auto ${prognozaOnTrack ? "bg-green-500/10" : "bg-red-500/10"}`} data-testid="pace-indicator">
                {prognozaOnTrack ? (
                  <p className="text-sm font-semibold text-green-600">Na dobrej drodze do celu!</p>
                ) : (
                  <p className="text-sm font-semibold text-red-600">
                    Brakuje okolo {formatPLN(monthTarget - prognoza)} — potrzebujesz {formatPLN(workdaysLeft > 0 ? (monthTarget - monthSales) / workdaysLeft : monthTarget - monthSales)}/dzien
                  </p>
                )}
              </div>
            )}

            {prevMonthSales > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground" data-testid="text-prev-comparison">
                Poprzedni miesiac: {formatPLN(prevMonthSales)} |
                <span className={`flex items-center gap-1 font-semibold ${changeVsPrev >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {changeVsPrev >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  Zmiana: {changeVsPrev >= 0 ? "+" : ""}{formatPercent(changeVsPrev)}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground" data-testid="text-workdays">
              {workdaysPassed}/{totalWorkdays} dni roboczych (pozostalo {workdaysLeft})
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Ten tydzien</p>
                <p className="text-xl font-bold mt-1" data-testid="text-week-sales">{formatPLN(weekSales)}</p>
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-week-orders">{weekOrdersCount} zamowien</p>
              </div>
              <ShoppingCart className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Konwersja</p>
                <p className="text-xl font-bold mt-1" data-testid="text-conversion">{formatPercent(conversionRate)}</p>
                <div className="mt-1">
                  <Badge className={conversionColor} data-testid="badge-conversion">
                    {monthOrdersCount}/{totalContacts} kontaktow
                  </Badge>
                </div>
              </div>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Najlepszy klient</p>
                {bestClient ? (
                  <>
                    <p className="text-sm font-bold mt-1 truncate max-w-[160px]" data-testid="text-best-client">{bestClient.name}</p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-best-client-kwota">{formatPLN(bestClient.kwota)}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Brak danych</p>
                )}
              </div>
              <Crown className="w-5 h-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={urgentClients.length > 0 ? "border-red-500/50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Uwaga!</p>
                <p className={`text-xl font-bold mt-1 ${urgentClients.length > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-urgent-count">
                  {urgentClients.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {urgentClients.length > 0 ? "klientow z brakami" : "brak alertow"}
                </p>
              </div>
              <AlertTriangle className={`w-5 h-5 ${urgentClients.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Ostatnie zamowienia</CardTitle>
          <p className="text-sm text-muted-foreground" data-testid="text-orders-summary">
            Zamowienia w tym miesiacu: <span className="font-semibold text-foreground">{monthOrdersCount}</span> | Laczna kwota: <span className="font-semibold text-foreground">{formatPLN(monthOrdersTotal)}</span>
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Brak zamowien</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-orders">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Klient</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Kwota</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order: any, i: number) => (
                    <tr key={i} className="border-b last:border-0" data-testid={`row-order-${i}`}>
                      <td className="p-3 text-muted-foreground">{order.data}</td>
                      <td className="p-3 font-medium">{order.clientName || "—"}</td>
                      <td className="p-3 text-right font-semibold">{formatPLN(Number(order.kwota || 0))}</td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary" className="bg-green-600/10 text-green-700">
                          {order.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(urgentClients.length > 0 || noRecentContact.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Moi klienci do kontaktu
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-contact-needed">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">Klient</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Braki zamowien</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Ostatni kontakt</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {urgentClients.map((c: any) => (
                    <tr key={`urgent-${c.id}`} className="border-b bg-red-500/5" data-testid={`row-urgent-${c.id}`}>
                      <td className="p-3 font-medium">{c.klient}</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-red-600 text-white">{c.brakiZamowien}</Badge>
                      </td>
                      <td className="p-3 text-center text-muted-foreground">—</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-red-600 text-white">Pilne</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Link href="/calendar">
                          <Button size="sm" variant="outline" data-testid={`button-call-${c.id}`}>
                            <Phone className="w-3 h-3 mr-1" />
                            Zadzwon
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {noRecentContact.map((c: any) => (
                    <tr key={`nocontact-${c.id}`} className="border-b bg-yellow-500/5" data-testid={`row-nocontact-${c.id}`}>
                      <td className="p-3 font-medium">{c.klient}</td>
                      <td className="p-3 text-center">
                        {c.brakiZamowien > 0 ? (
                          <Badge variant="secondary">{c.brakiZamowien}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-muted-foreground">
                        {c.ostatniKontakt || "Nigdy"}
                      </td>
                      <td className="p-3 text-center">
                        <Badge className="bg-yellow-600 text-white">
                          <Clock className="w-3 h-3 mr-1" />
                          &gt;7 dni
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Link href="/calendar">
                          <Button size="sm" variant="outline" data-testid={`button-call-${c.id}`}>
                            <Phone className="w-3 h-3 mr-1" />
                            Zadzwon
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
