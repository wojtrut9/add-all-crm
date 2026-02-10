import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Target, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];

export default function PlanPage() {
  const [rok, setRok] = useState(2026);
  const [miesiac, setMiesiac] = useState(2);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/plan", rok, miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/plan?rok=${rok}&miesiac=${miesiac}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const planData = data?.plan || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6" /> Plan miesieczny
        </h1>
        <div className="flex items-center gap-2">
          <Select value={String(miesiac)} onValueChange={(v) => setMiesiac(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(rok)} onValueChange={(v) => setRok(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plan {MONTHS[miesiac - 1]} {rok}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klient</TableHead>
                  <TableHead className="text-right">Sprzedaz poprz. mc</TableHead>
                  <TableHead className="text-right">Cel</TableHead>
                  <TableHead className="text-right">Realizacja</TableHead>
                  <TableHead className="text-right">% realizacji</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Brak danych planowania dla wybranego okresu
                    </TableCell>
                  </TableRow>
                )}
                {planData.map((p: any) => {
                  const cel = Number(p.prevSales || 0) * 1.05;
                  const realizacja = Number(p.currentSales || 0);
                  const pct = cel > 0 ? (realizacja / cel * 100) : 0;
                  return (
                    <TableRow key={p.clientId} className={Number(p.prevSales || 0) === 0 ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-medium">{p.clientName}</TableCell>
                      <TableCell className="text-right">{Number(p.prevSales || 0).toLocaleString("pl-PL")}</TableCell>
                      <TableCell className="text-right">{cel.toLocaleString("pl-PL", { minimumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right">{realizacja.toLocaleString("pl-PL")}</TableCell>
                      <TableCell className={`text-right ${pct >= 100 ? '' : 'text-destructive'}`}>{pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
