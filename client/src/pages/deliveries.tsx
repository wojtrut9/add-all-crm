import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, ChevronRight, Download, Plus, Truck, Loader2,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { pl } from "date-fns/locale";

export default function DeliveriesPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    return format(tomorrow, "yyyy-MM-dd");
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["/api/deliveries", selectedDate],
    queryFn: async () => {
      const res = await authFetch(`/api/deliveries?date=${selectedDate}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["/api/drivers"],
    queryFn: async () => {
      const res = await authFetch("/api/drivers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const res = await authFetch("/api/vehicles");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateDelivery = async (id: number, field: string, value: any) => {
    try {
      await authFetch(`/api/deliveries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] });
    } catch {
      toast({ title: "Blad aktualizacji", variant: "destructive" });
    }
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const totalKm = deliveries.reduce((s: number, d: any) => s + Number(d.kilometry || 0), 0);
  const totalValue = deliveries.reduce((s: number, d: any) => s + Number(d.wartoscNettoWz || 0), 0);

  const handleExport = () => {
    const headers = ["Lp", "Klient", "Kierowca", "Opiekun", "Auto", "Platnosc", "Uwagi", "Km", "Wartosc netto", "Wina Skalo", "Windykacja"];
    const rows = deliveries.map((d: any, i: number) => [
      i + 1, d.clientName || "", d.kierowca || "", d.opiekun || "", d.auto || "",
      d.platnosc || "", d.uwagi || "", d.kilometry || "", d.wartoscNettoWz || "",
      d.winaSkalo ? "TAK" : "NIE", d.akcjaWindykacja || "brak",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dostawy_${selectedDate}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Dostawy</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-deliveries">
            <Download className="w-4 h-4 mr-1" /> Pobierz plan dnia
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => changeDate(-1)} data-testid="button-prev-day">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center min-w-[200px]">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-center"
            data-testid="input-delivery-date"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => changeDate(1)} data-testid="button-next-day">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDate(format(addDays(new Date(), 1), "yyyy-MM-dd"))}
        >
          Jutro
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Lp</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Kierowca</TableHead>
                  <TableHead>Opiekun</TableHead>
                  <TableHead>Auto</TableHead>
                  <TableHead>Platnosc</TableHead>
                  <TableHead>Uwagi</TableHead>
                  <TableHead className="w-20">Km</TableHead>
                  <TableHead className="w-28">Wartosc netto</TableHead>
                  <TableHead className="w-20">Wina Skalo</TableHead>
                  <TableHead>Windykacja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Brak dostaw na ten dzien
                    </TableCell>
                  </TableRow>
                )}
                {deliveries.map((d: any, i: number) => (
                  <TableRow key={d.id} data-testid={`row-delivery-${d.id}`}>
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell className="font-medium">{d.clientName || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={d.kierowca || "none"}
                        onValueChange={(v) => updateDelivery(d.id, "kierowca", v === "none" ? null : v)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Wybierz" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          {drivers.map((dr: any) => (
                            <SelectItem key={dr.id} value={dr.imie}>{dr.imie}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{d.opiekun || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={d.auto || "none"}
                        onValueChange={(v) => updateDelivery(d.id, "auto", v === "none" ? null : v)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Wybierz" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          {vehicles.map((v: any) => (
                            <SelectItem key={v.id} value={v.nazwa}>{v.nazwa}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={d.platnosc || "none"}
                        onValueChange={(v) => updateDelivery(d.id, "platnosc", v === "none" ? null : v)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Wybierz" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          <SelectItem value="gotowka">Gotowka</SelectItem>
                          <SelectItem value="karta">Karta</SelectItem>
                          <SelectItem value="przelew">Przelew</SelectItem>
                          <SelectItem value="do potwierdzenia">Do potwierdzenia</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={d.uwagi || ""}
                        onBlur={(e) => updateDelivery(d.id, "uwagi", e.target.value)}
                        className="w-[120px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={d.kilometry || ""}
                        onBlur={(e) => updateDelivery(d.id, "kilometry", e.target.value)}
                        className="w-[80px]"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {d.wartoscNettoWz ? `${Number(d.wartoscNettoWz).toLocaleString("pl-PL")} PLN` : "-"}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={d.winaSkalo || false}
                        onCheckedChange={(v) => updateDelivery(d.id, "winaSkalo", v)}
                        data-testid={`checkbox-wina-${d.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={d.akcjaWindykacja || "brak"}
                        onValueChange={(v) => updateDelivery(d.id, "akcjaWindykacja", v)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="brak">Brak</SelectItem>
                          <SelectItem value="Stopien 1">Stopien 1 - Przypomnienie</SelectItem>
                          <SelectItem value="Stopien 2">Stopien 2 - Wezwanie</SelectItem>
                          <SelectItem value="Stopien 3">Stopien 3 - Wstrzymanie</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Liczba dostaw</p>
            <p className="text-2xl font-bold">{deliveries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Suma km</p>
            <p className="text-2xl font-bold">{totalKm.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Suma wartosc netto</p>
            <p className="text-2xl font-bold">{totalValue.toLocaleString("pl-PL")} PLN</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
