import { useQuery } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, DollarSign, Calendar } from "lucide-react";

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
  const workdaysPassed = Math.floor((dayOfMonth / totalDaysInMonth) * 20);
  const workdaysLeft = 20 - workdaysPassed;

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
