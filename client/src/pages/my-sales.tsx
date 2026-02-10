import { useQuery } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, DollarSign, Calendar } from "lucide-react";

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
  const recentOrders = data?.recentOrders || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Moja sprzedaz - {user?.imie}</h1>

      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Realizacja celu miesiecznego</p>
            <div className="flex items-center justify-center gap-3">
              <Target className="w-8 h-8 text-primary" />
              <p className="text-4xl font-bold">{realizacja.toFixed(1)}%</p>
            </div>
            <Progress value={Math.min(100, realizacja)} className="h-3 max-w-md mx-auto" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mt-4">
              <div>
                <p className="text-xs text-muted-foreground">Sprzedaz</p>
                <p className="font-bold">{monthSales.toLocaleString("pl-PL")} PLN</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cel</p>
                <p className="font-bold">{monthTarget.toLocaleString("pl-PL")} PLN</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Brakuje</p>
                <p className="font-bold text-destructive">{brakuje.toLocaleString("pl-PL")} PLN</p>
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
                <p className="text-xl font-bold">{prevMonthSales.toLocaleString("pl-PL")} PLN</p>
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
                <p className="text-xl font-bold">{recentOrders.length}</p>
              </div>
              <DollarSign className="w-5 h-5 text-chart-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {recentOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ostatnie zamowienia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentOrders.map((o: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{o.clientName}</p>
                    <p className="text-xs text-muted-foreground">{o.data}</p>
                  </div>
                  <p className="font-medium text-sm">{Number(o.kwota || 0).toLocaleString("pl-PL")} PLN</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
