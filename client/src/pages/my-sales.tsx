import { useQuery } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, DollarSign, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";

const dayNames = ["Niedziela", "Poniedzialek", "Wtorek", "Sroda", "Czwartek", "Piatek", "Sobota"];
const workDayNames = ["Poniedzialek", "Wtorek", "Sroda", "Czwartek", "Piatek"];

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
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const monthSales = data?.monthSales || 0;
  const monthTarget = data?.monthTarget || 0;
  const prevMonthSales = data?.prevMonthSales || 0;
  const brakuje = Math.max(0, monthTarget - monthSales);
  const realizacja = monthTarget > 0 ? (monthSales / monthTarget) * 100 : 0;

  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentDayName = dayNames[currentDayIndex];
  const dayOfMonth = now.getDate();
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
  const workdaysPassed = countWorkdays(now.getFullYear(), now.getMonth(), dayOfMonth);
  const workdaysLeft = totalWorkdays - workdaysPassed;

  const dailyTarget = totalWorkdays > 0 ? monthTarget / totalWorkdays : 0;
  const expectedByNow = dailyTarget * workdaysPassed;
  const difference = monthSales - expectedByNow;
  const pacePercent = expectedByNow > 0 ? (monthSales / expectedByNow) * 100 : 0;
  const isOnTrack = monthSales >= expectedByNow;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold" data-testid="text-page-title">Moja sprzedaz - {user?.imie}</h1>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <p className="text-sm font-medium" data-testid="text-current-day">{currentDayName}, {dayOfMonth} dzien miesiaca</p>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-workdays-left">Pozostalo ok. {workdaysLeft} dni roboczych</p>
            </div>
            <div className="flex gap-1" data-testid="weekday-indicator">
              {workDayNames.map((name, i) => {
                const jsDay = i + 1;
                const isCurrentDay = jsDay === currentDayIndex;
                const isPast = jsDay < currentDayIndex;
                return (
                  <div
                    key={name}
                    className={`flex-1 py-2 px-1 rounded-md text-center text-xs font-medium transition-colors ${
                      isCurrentDay
                        ? "bg-primary text-primary-foreground"
                        : isPast
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted/30 text-muted-foreground/60"
                    }`}
                    data-testid={`weekday-${name.toLowerCase()}`}
                  >
                    {name.slice(0, 3)}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Realizacja celu miesiecznego</p>
            <div className="flex items-center justify-center gap-3">
              <Target className="w-8 h-8 text-primary" />
              <p className="text-4xl font-bold" data-testid="text-realizacja">{realizacja.toFixed(1)}%</p>
            </div>
            <Progress value={Math.min(100, realizacja)} className="h-3 max-w-md mx-auto" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mt-4">
              <div>
                <p className="text-xs text-muted-foreground">Sprzedaz</p>
                <p className="font-bold" data-testid="text-month-sales">{monthSales.toLocaleString("pl-PL")} PLN</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cel</p>
                <p className="font-bold" data-testid="text-month-target">{monthTarget.toLocaleString("pl-PL")} PLN</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Brakuje</p>
                <p className="font-bold text-destructive" data-testid="text-brakuje">{brakuje.toLocaleString("pl-PL")} PLN</p>
              </div>
            </div>

            <div className={`mt-4 p-4 rounded-md max-w-lg mx-auto ${isOnTrack ? "bg-chart-4/10" : "bg-destructive/10"}`} data-testid="pace-indicator">
              <div className="flex items-center justify-center gap-2 mb-2">
                {isOnTrack ? (
                  <CheckCircle2 className="w-5 h-5 text-chart-4" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                )}
                <p className={`text-sm font-bold ${isOnTrack ? "text-chart-4" : "text-destructive"}`}>
                  {isOnTrack ? "Na dobrej drodze" : "Ponizej tempa"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Powinno byc na dzis</p>
                  <p className="text-sm font-bold" data-testid="text-expected">{Math.round(expectedByNow).toLocaleString("pl-PL")} PLN</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isOnTrack ? "Nadwyzka" : "Do nadrobienia"}</p>
                  <p className={`text-sm font-bold ${isOnTrack ? "text-chart-4" : "text-destructive"}`} data-testid="text-difference">
                    {Math.abs(Math.round(difference)).toLocaleString("pl-PL")} PLN
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2" data-testid="text-daily-target">
                Cel dzienny: {Math.round(dailyTarget).toLocaleString("pl-PL")} PLN ({workdaysPassed}/{totalWorkdays} dni roboczych)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Poprzedni miesiac</p>
                <p className="text-xl font-bold" data-testid="text-prev-month">{prevMonthSales.toLocaleString("pl-PL")} PLN</p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            {prevMonthSales > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Zmiana: {((monthSales - prevMonthSales) / prevMonthSales * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Zamowien w tym miesiacu</p>
                <p className="text-xl font-bold" data-testid="text-orders-count">0</p>
              </div>
              <DollarSign className="w-5 h-5 text-chart-4" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
