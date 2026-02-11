import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

function fmtPLN(val: number) {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function WeekInput({ weeklyId, initialValue, onSaved }: { weeklyId: number; initialValue: number; onSaved: () => void }) {
  const [value, setValue] = useState(String(initialValue || ""));
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();
  const isDisabled = !weeklyId || weeklyId <= 0;

  const mutation = useMutation({
    mutationFn: async (realizacja: number) => {
      if (isDisabled) throw new Error("Brak rekordu tygodniowego");
      await apiRequest("PATCH", `/api/plan/weekly/${weeklyId}`, { realizacja });
    },
    onSuccess: () => {
      setDirty(false);
      onSaved();
    },
    onError: () => {
      toast({ title: "Błąd zapisu", description: isDisabled ? "Brak rekordu w bazie" : undefined, variant: "destructive" });
    },
  });

  const handleBlur = useCallback(() => {
    const num = parseFloat(value) || 0;
    if (dirty && !isDisabled) {
      mutation.mutate(num);
    }
  }, [value, dirty, isDisabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const num = parseFloat(value) || 0;
      if (dirty && !isDisabled) {
        mutation.mutate(num);
      }
    }
  }, [value, dirty, isDisabled]);

  return (
    <Input
      type="number"
      step="0.01"
      className={`w-20 h-8 text-right text-sm ${isDisabled
        ? "bg-muted/50 border-muted text-muted-foreground cursor-not-allowed"
        : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700"
      }`}
      value={value}
      disabled={isDisabled}
      title={isDisabled ? "Brak rekordu tygodniowego w bazie" : undefined}
      onChange={(e) => { setValue(e.target.value); setDirty(true); }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      data-testid={`input-week-${weeklyId}`}
    />
  );
}

export default function PlanPage() {
  const [rok, setRok] = useState(2026);
  const [miesiac, setMiesiac] = useState(2);
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/plan", rok, miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/plan?rok=${rok}&miesiac=${miesiac}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/plan", rok, miesiac] });
  }, [rok, miesiac]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const groups = data?.groups || [];

  const allClients = groups.flatMap((g: any) => g.klienci || []);
  const totalCel = allClients.reduce((s: number, k: any) => s + (k.cel || 0), 0);
  const totalSty26 = allClients.reduce((s: number, k: any) => s + (k.sty26 || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Target className="w-6 h-6" /> Plan miesięczny
          </h1>
          <p className="text-sm text-muted-foreground">
            CEL = Sprzedaż {MONTHS[0]} 2026 + 5% | Tygodnie do edycji
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(miesiac)} onValueChange={(v) => setMiesiac(Number(v))}>
            <SelectTrigger className="w-[140px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(rok)} onValueChange={(v) => setRok(Number(v))}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Sprzedaż {MONTHS[0]} 2026</p>
            <p className="text-xl font-bold" data-testid="text-total-sty">{fmtPLN(totalSty26)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">CEL {MONTHS[miesiac - 1]} {rok}</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-total-cel">{fmtPLN(totalCel)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Suma realizacja</p>
            <p className="text-xl font-bold" data-testid="text-total-realizacja">
              {fmtPLN(allClients.reduce((s: number, k: any) => s + (k.tydz1 || 0) + (k.tydz2 || 0) + (k.tydz3 || 0) + (k.tydz4 || 0), 0))} zł
            </p>
          </CardContent>
        </Card>
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Brak danych planowania dla wybranego okresu
          </CardContent>
        </Card>
      )}

      {groups.map((g: any, gi: number) => {
        const klienci = g.klienci || [];
        const groupCel = klienci.reduce((s: number, k: any) => s + (k.cel || 0), 0);
        const groupSty = klienci.reduce((s: number, k: any) => s + (k.sty26 || 0), 0);
        const groupT1 = klienci.reduce((s: number, k: any) => s + (k.tydz1 || 0), 0);
        const groupT2 = klienci.reduce((s: number, k: any) => s + (k.tydz2 || 0), 0);
        const groupT3 = klienci.reduce((s: number, k: any) => s + (k.tydz3 || 0), 0);
        const groupT4 = klienci.reduce((s: number, k: any) => s + (k.tydz4 || 0), 0);
        const groupReal = groupT1 + groupT2 + groupT3 + groupT4;
        const groupDiff = groupReal - groupCel;
        const groupPct = groupCel > 0 ? (groupReal / groupCel * 100) : 0;
        const groupGru = klienci.reduce((s: number, k: any) => s + (k.gru25 || 0), 0);

        return (
          <Card key={gi}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{g.grupa}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Klientów: {klienci.length}</Badge>
                  <Badge variant="secondary">CEL: {fmtPLN(groupCel)} zł</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">Poz.</TableHead>
                      <TableHead className="min-w-[160px]">Klient</TableHead>
                      <TableHead className="text-right w-16">Rabat%</TableHead>
                      <TableHead className="text-right">Sprzedaż Sty 26</TableHead>
                      <TableHead className="text-right">CEL {MONTHS[miesiac - 1]}</TableHead>
                      <TableHead className="text-center">Tydz 1</TableHead>
                      <TableHead className="text-center">Tydz 2</TableHead>
                      <TableHead className="text-center">Tydz 3</TableHead>
                      <TableHead className="text-center">Tydz 4</TableHead>
                      <TableHead className="text-right">SUMA</TableHead>
                      <TableHead className="text-right">Różnica</TableHead>
                      <TableHead className="text-right">% Real.</TableHead>
                      <TableHead className="text-right">Śr. Tyg.</TableHead>
                      <TableHead className="text-right">Gru 25</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {klienci.map((k: any, ki: number) => {
                      const suma = (k.tydz1 || 0) + (k.tydz2 || 0) + (k.tydz3 || 0) + (k.tydz4 || 0);
                      const roznica = suma - (k.cel || 0);
                      const pctReal = k.cel > 0 ? (suma / k.cel * 100) : 0;
                      const isZeroSales = k.sty26 === 0;

                      return (
                        <TableRow
                          key={ki}
                          className={isZeroSales ? "bg-red-50 dark:bg-red-900/15" : ""}
                          data-testid={`row-plan-${k.clientId}`}
                        >
                          <TableCell className="text-muted-foreground text-sm">{ki + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{k.klient}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{k.rabat != null ? `${k.rabat}%` : "-"}</TableCell>
                          <TableCell className="text-right text-sm">{fmtPLN(k.sty26)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmtPLN(k.cel)}</TableCell>
                          <TableCell className="text-center">
                            <WeekInput weeklyId={k.weeklyIds[0]} initialValue={k.tydz1} onSaved={handleSaved} />
                          </TableCell>
                          <TableCell className="text-center">
                            <WeekInput weeklyId={k.weeklyIds[1]} initialValue={k.tydz2} onSaved={handleSaved} />
                          </TableCell>
                          <TableCell className="text-center">
                            <WeekInput weeklyId={k.weeklyIds[2]} initialValue={k.tydz3} onSaved={handleSaved} />
                          </TableCell>
                          <TableCell className="text-center">
                            <WeekInput weeklyId={k.weeklyIds[3]} initialValue={k.tydz4} onSaved={handleSaved} />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmtPLN(suma)}</TableCell>
                          <TableCell className={`text-right text-sm ${roznica >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {roznica >= 0 ? "+" : ""}{fmtPLN(roznica)}
                          </TableCell>
                          <TableCell className={`text-right text-sm ${pctReal >= 100 ? "text-green-600 dark:text-green-400" : k.cel > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                            {k.cel > 0 ? `${pctReal.toFixed(1)}%` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmtPLN(k.srTyg)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmtPLN(k.gru25)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell></TableCell>
                      <TableCell>RAZEM {g.grupa}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{fmtPLN(groupSty)}</TableCell>
                      <TableCell className="text-right">{fmtPLN(groupCel)}</TableCell>
                      <TableCell className="text-right">{fmtPLN(groupT1)}</TableCell>
                      <TableCell className="text-right">{fmtPLN(groupT2)}</TableCell>
                      <TableCell className="text-right">{fmtPLN(groupT3)}</TableCell>
                      <TableCell className="text-right">{fmtPLN(groupT4)}</TableCell>
                      <TableCell className="text-right">{fmtPLN(groupReal)}</TableCell>
                      <TableCell className={`text-right ${groupDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {groupDiff >= 0 ? "+" : ""}{fmtPLN(groupDiff)}
                      </TableCell>
                      <TableCell className={`text-right ${groupPct >= 100 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {groupCel > 0 ? `${groupPct.toFixed(1)}%` : "-"}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{fmtPLN(groupGru)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
