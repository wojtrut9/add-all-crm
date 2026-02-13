import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Users, Car, Plus, Pencil, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";

const MONTHS = [
  { value: "1", label: "Styczen" },
  { value: "2", label: "Luty" },
  { value: "3", label: "Marzec" },
  { value: "4", label: "Kwiecien" },
  { value: "5", label: "Maj" },
  { value: "6", label: "Czerwiec" },
  { value: "7", label: "Lipiec" },
  { value: "8", label: "Sierpien" },
  { value: "9", label: "Wrzesien" },
  { value: "10", label: "Pazdziernik" },
  { value: "11", label: "Listopad" },
  { value: "12", label: "Grudzien" },
];

const COLORS = [
  "hsl(210, 92%, 45%)", "hsl(25, 95%, 42%)", "hsl(340, 82%, 38%)",
  "hsl(160, 65%, 35%)", "hsl(280, 75%, 40%)", "hsl(45, 85%, 45%)",
  "hsl(190, 80%, 40%)", "hsl(10, 85%, 50%)", "hsl(130, 60%, 38%)",
  "hsl(310, 70%, 45%)", "hsl(55, 75%, 40%)", "hsl(230, 65%, 50%)",
  "hsl(0, 70%, 45%)", "hsl(170, 55%, 42%)", "hsl(260, 60%, 48%)",
  "hsl(35, 80%, 43%)", "hsl(200, 75%, 42%)",
];

const KATEGORIE = [
  "Wynagrodzenia", "Operacyjne", "Samochody/Flota", "Transport",
  "Księgowość/Doradztwo", "Media", "Ubezpieczenia", "Wysyłka/Poczta",
  "Towary/Produkty", "Finansowanie/Raty", "IT/Oprogramowanie",
  "Serwis/Naprawy", "Biuro/Druk", "Opłaty bankowe", "Medycyna pracy",
  "Prowizje", "Inne",
];

type CostItem = {
  id: number;
  nazwa: string;
  firma?: string | null;
  dzial?: string | null;
  rodzaj?: string | null;
  kategoria?: string | null;
  netto?: string | null;
  koszt?: string | null;
  notatka?: string | null;
  aktywnyMiesiace?: Record<string, boolean> | null;
};

type CostFormData = {
  nazwa: string;
  kategoria: string;
  koszt: string;
  netto: string;
  dzial: string;
  notatka: string;
};

const emptyCostForm: CostFormData = {
  nazwa: "",
  kategoria: "Operacyjne",
  koszt: "",
  netto: "",
  dzial: "",
  notatka: "",
};

export default function FinancePage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<CostItem | null>(null);
  const [formData, setFormData] = useState<CostFormData>(emptyCostForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMonth, setImportMonth] = useState(String(now.getMonth() + 1));
  const [replaceMonth, setReplaceMonth] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/finance", selectedMonth],
    queryFn: async () => {
      const res = await authFetch(`/api/finance?miesiac=${selectedMonth}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await authFetch("/api/finance/costs", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Blad zapisu");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await authFetch(`/api/finance/costs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Blad aktualizacji");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/api/finance/costs/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Blad usuwania");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
      setDeleteConfirmId(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ file, miesiac, replace }: { file: File; miesiac: string; replace: boolean }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("miesiac", miesiac);
      fd.append("replaceMonth", String(replace));

      const token = localStorage.getItem("token");
      const res = await fetch("/api/finance/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Blad importu" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance", importMonth] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance", selectedMonth] });
      setImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Import zakonczony", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Blad importu", description: err.message, variant: "destructive" });
    },
  });

  function handleImportSubmit() {
    if (!importFile) return;
    importMutation.mutate({ file: importFile, miesiac: importMonth, replace: replaceMonth });
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingCost(null);
    setFormData(emptyCostForm);
  }

  function openAddDialog() {
    setEditingCost(null);
    setFormData(emptyCostForm);
    setDialogOpen(true);
  }

  function openEditDialog(cost: CostItem) {
    setEditingCost(cost);
    setFormData({
      nazwa: cost.nazwa || "",
      kategoria: cost.kategoria || "Operacyjne",
      koszt: cost.koszt || "",
      netto: cost.netto || "",
      dzial: cost.dzial || "",
      notatka: cost.notatka || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      nazwa: formData.nazwa,
      kategoria: formData.kategoria,
      koszt: formData.koszt || null,
      netto: formData.netto || null,
      dzial: formData.dzial || null,
      notatka: formData.notatka || null,
    };
    if (editingCost) {
      updateMutation.mutate({ id: editingCost.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const salariesList: any[] = data?.salaries || [];
  const costsList: CostItem[] = data?.costs || [];
  const fleetList: any[] = data?.fleet || [];

  const totalSalaries = salariesList.reduce((s: number, sal: any) => s + Number(sal.kosztPracodawcy || sal.koszt || 0), 0);
  const totalCosts = costsList.reduce((s: number, c: any) => s + Number(c.koszt || 0), 0);
  const totalFleet = fleetList.reduce((s: number, f: any) => s + Number(f.koszt || 0), 0);
  const totalMonthly = totalSalaries + totalCosts + totalFleet;

  const allItems = [
    ...salariesList.map(s => ({ ...s, _type: "salary" as const, _kategoria: "Wynagrodzenia", _koszt: Number(s.kosztPracodawcy || s.koszt || 0) })),
    ...costsList.map(c => ({ ...c, _type: "cost" as const, _kategoria: c.kategoria || "Operacyjne", _koszt: Number(c.koszt || 0) })),
    ...fleetList.map(f => ({ ...f, _type: "fleet" as const, _kategoria: "Samochody/Flota", _koszt: Number(f.koszt || 0) })),
  ];

  const byCategory: Record<string, typeof allItems> = {};
  for (const item of allItems) {
    const k = item._kategoria;
    if (!byCategory[k]) byCategory[k] = [];
    byCategory[k].push(item);
  }

  const categoryOrder = KATEGORIE;
  const sortedCategories = Object.keys(byCategory).sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const costPieData = sortedCategories.map(cat => ({
    name: cat,
    value: byCategory[cat].reduce((s, i) => s + i._koszt, 0),
  })).filter(d => d.value > 0);

  const deptData = salariesList.reduce((acc: any[], sal: any) => {
    const existing = acc.find(a => a.name === sal.dzial);
    const cost = Number(sal.kosztPracodawcy || 0);
    if (existing) {
      existing.value += cost;
    } else {
      acc.push({ name: sal.dzial, value: cost });
    }
    return acc;
  }, []);

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || "";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-finance-title">Panel finansowy</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} data-testid="button-import-finance">
            <Upload className="w-4 h-4 mr-1" />
            Import Excel
          </Button>
          <Label className="text-sm text-muted-foreground">Miesiac:</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Koszty miesiecznie</p>
                <p className="text-xl font-bold" data-testid="text-total-monthly">{totalMonthly.toLocaleString("pl-PL")} PLN</p>
              </div>
              <DollarSign className="w-5 h-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Wynagrodzenia</p>
                <p className="text-xl font-bold" data-testid="text-total-salaries">{totalSalaries.toLocaleString("pl-PL")} PLN</p>
              </div>
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Koszty operacyjne</p>
                <p className="text-xl font-bold" data-testid="text-total-costs">{totalCosts.toLocaleString("pl-PL")} PLN</p>
              </div>
              <TrendingUp className="w-5 h-5 text-chart-2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Flota</p>
                <p className="text-xl font-bold" data-testid="text-total-fleet">{totalFleet.toLocaleString("pl-PL")} PLN</p>
              </div>
              <Car className="w-5 h-5 text-chart-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rozklad kosztow - {monthLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {costPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={costPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {costPieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString("pl-PL")} PLN`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Brak danych</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wynagrodzenia wg dzialow</CardTitle>
          </CardHeader>
          <CardContent>
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={deptData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {deptData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString("pl-PL")} PLN`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Brak danych</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Wszystkie koszty - {monthLabel}</CardTitle>
            <Button onClick={openAddDialog} data-testid="button-add-cost">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj koszt
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kontrahent / Nazwa</TableHead>
                  <TableHead>Nr faktury / Dział</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map(cat => {
                  const items = byCategory[cat];
                  const catTotal = items.reduce((s, i) => s + i._koszt, 0);
                  const catNetto = items.reduce((s, i) => s + Number(i.netto || 0), 0);
                  return [
                    <TableRow key={`header-${cat}`} className="bg-muted/50">
                      <TableCell className="font-semibold text-sm">{cat} ({items.length})</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-semibold text-sm">{catNetto > 0 ? catNetto.toLocaleString("pl-PL") : "-"}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{catTotal.toLocaleString("pl-PL")} PLN</TableCell>
                      <TableCell></TableCell>
                    </TableRow>,
                    ...items.map((item: any) => (
                      <TableRow key={`${item._type}-${item.id}`} data-testid={`row-cost-${item._type}-${item.id}`}>
                        <TableCell className="font-medium text-sm">{item.nazwa || item.osoba || item.opis || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item._type === "cost" ? (item.firma || item.dzial || "-") : (item.dzial || item.formaZatrudnienia || item.rodzaj || "-")}</TableCell>
                        <TableCell className="text-right text-sm">{item.netto ? Number(item.netto).toLocaleString("pl-PL") : "-"}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{item._koszt.toLocaleString("pl-PL")} PLN</TableCell>
                        <TableCell>
                          {item._type === "cost" && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEditDialog(item)} data-testid={`button-edit-cost-${item.id}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(item.id)} data-testid={`button-delete-cost-${item.id}`}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )),
                  ];
                })}
                <TableRow className="font-bold bg-muted">
                  <TableCell colSpan={2}>RAZEM</TableCell>
                  <TableCell className="text-right">{allItems.reduce((s, i) => s + Number(i.netto || 0), 0).toLocaleString("pl-PL")} PLN</TableCell>
                  <TableCell className="text-right" data-testid="text-grand-total">{totalMonthly.toLocaleString("pl-PL")} PLN</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCost ? "Edytuj koszt" : "Dodaj nowy koszt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nazwa *</Label>
              <Input
                value={formData.nazwa}
                onChange={(e) => setFormData({ ...formData, nazwa: e.target.value })}
                data-testid="input-cost-nazwa"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategoria</Label>
              <Select value={formData.kategoria} onValueChange={(v) => setFormData({ ...formData, kategoria: v })}>
                <SelectTrigger data-testid="select-cost-kategoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KATEGORIE.map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Netto (PLN)</Label>
                <Input
                  type="number"
                  value={formData.netto}
                  onChange={(e) => setFormData({ ...formData, netto: e.target.value })}
                  data-testid="input-cost-netto"
                />
              </div>
              <div className="space-y-2">
                <Label>Koszt brutto (PLN) *</Label>
                <Input
                  type="number"
                  value={formData.koszt}
                  onChange={(e) => setFormData({ ...formData, koszt: e.target.value })}
                  data-testid="input-cost-koszt"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dzial / firma</Label>
              <Input
                value={formData.dzial}
                onChange={(e) => setFormData({ ...formData, dzial: e.target.value })}
                data-testid="input-cost-dzial"
              />
            </div>
            <div className="space-y-2">
              <Label>Notatka</Label>
              <Textarea
                value={formData.notatka}
                onChange={(e) => setFormData({ ...formData, notatka: e.target.value })}
                className="resize-none"
                rows={2}
                data-testid="input-cost-notatka"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-cost">Anuluj</Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.nazwa || !formData.koszt || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-cost"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potwierdzenie usuwania</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Czy na pewno chcesz usunac ten koszt? Tej operacji nie mozna cofnac.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">Anuluj</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Usuwanie..." : "Usun"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) { setImportDialogOpen(false); setImportFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import danych finansowych z Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Miesiac importu</Label>
              <Select value={importMonth} onValueChange={setImportMonth}>
                <SelectTrigger data-testid="select-import-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plik Excel (.xlsx, .xls)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                data-testid="input-import-file"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="replaceMonth"
                checked={replaceMonth}
                onCheckedChange={(v) => setReplaceMonth(!!v)}
                data-testid="checkbox-replace-month"
              />
              <Label htmlFor="replaceMonth" className="text-sm">
                Zastap dane tego miesiaca (ukryj istniejace wpisy)
              </Label>
            </div>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Format pliku:</p>
              <p>Raport <strong>Zestawienie Zakupu VAT</strong> z iBiznes (.xls / .xlsx)</p>
              <p>Kolumny: Lp., Numer, Data wystawienia, Dane kontrahenta, Stawka VAT, Netto, VAT, Brutto</p>
              <p>Listy plac zostana rozpoznane automatycznie jako wynagrodzenia, leasingi jako flota.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportFile(null); }} data-testid="button-cancel-import">
                Anuluj
              </Button>
              <Button
                onClick={handleImportSubmit}
                disabled={!importFile || importMutation.isPending}
                data-testid="button-submit-import"
              >
                {importMutation.isPending ? "Importowanie..." : "Importuj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
