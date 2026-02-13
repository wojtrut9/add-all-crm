import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DollarSign, TrendingUp, Users, Car, Plus, Pencil, Trash2, Upload, FileSpreadsheet, ChevronDown, ChevronRight, Briefcase, Building2, CreditCard, Truck, Shield, BookOpen, Zap, Monitor, Stethoscope, Package, Wrench, Mail, Landmark, ShoppingCart, HelpCircle, Receipt } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
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
];

const KATEGORIE_ALL = [
  "Wynagrodzenia zarząd (JDG)", "Wynagrodzenia", "ZUS", "Leasing", "Transport",
  "Księgowość", "Podatki (US)", "Ubezpieczenia", "Biuro", "Paliwo", "Media/Prąd",
  "IT/Subskrypcje", "IT/Serwis", "Medycyna pracy", "Towary/Produkty",
  "Serwis/Naprawa", "Wysyłka/Poczta", "Płatności/Terminal", "Inne",
];

const WYNAGRODZENIA_CATS = ["Wynagrodzenia", "Wynagrodzenia zarząd (JDG)", "ZUS", "Podatki (US)", "Medycyna pracy"];
const FLOTA_CATS = ["Leasing", "Paliwo"];

const CATEGORY_ICONS: Record<string, any> = {
  "Wynagrodzenia": Users,
  "Wynagrodzenia zarząd (JDG)": Briefcase,
  "ZUS": Landmark,
  "Podatki (US)": Receipt,
  "Medycyna pracy": Stethoscope,
  "Leasing": Car,
  "Paliwo": Car,
  "Transport": Truck,
  "Ubezpieczenia": Shield,
  "Księgowość": BookOpen,
  "Media/Prąd": Zap,
  "IT/Serwis": Monitor,
  "IT/Subskrypcje": Monitor,
  "Biuro": Building2,
  "Wysyłka/Poczta": Mail,
  "Płatności/Terminal": CreditCard,
  "Towary/Produkty": Package,
  "Serwis/Naprawa": Wrench,
  "Inne": HelpCircle,
};

function fmtPLN(val: number): string {
  return Math.round(val).toLocaleString("pl-PL") + " PLN";
}

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
  rodzaj: string;
  notatka: string;
};

const emptyCostForm: CostFormData = {
  nazwa: "",
  kategoria: "Inne",
  koszt: "",
  netto: "",
  rodzaj: "",
  notatka: "",
};

export default function FinancePage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [viewMode, setViewMode] = useState<"rzeczywiste" | "budzet" | "porownanie">("rzeczywiste");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<CostItem | null>(null);
  const [formData, setFormData] = useState<CostFormData>(emptyCostForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMonth, setImportMonth] = useState(String(now.getMonth() + 1));
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
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
      const res = await apiRequest("POST", "/api/finance/costs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance", selectedMonth] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/finance/costs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance", selectedMonth] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/finance/costs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance", selectedMonth] });
      setDeleteConfirmId(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ file, miesiac }: { file: File; miesiac: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("miesiac", miesiac);
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
    importMutation.mutate({ file: importFile, miesiac: importMonth });
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
      kategoria: cost.kategoria || "Inne",
      koszt: cost.koszt || "",
      netto: cost.netto || "",
      rodzaj: cost.rodzaj || "",
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
      rodzaj: formData.rodzaj || null,
      notatka: formData.notatka || null,
    };
    if (editingCost) {
      updateMutation.mutate({ id: editingCost.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleCategory(cat: string) {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
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

  const importedCosts = costsList.filter(c => c.firma === "IMPORT_VAT");
  const budgetSalaries = salariesList;
  const budgetCosts = costsList.filter(c => c.firma !== "IMPORT_VAT");
  const budgetFleet = fleetList;

  const hasImportedData = importedCosts.length > 0;

  const effectiveMode = viewMode === "rzeczywiste" && !hasImportedData ? "budzet" : viewMode;

  const byCategory: Record<string, CostItem[]> = {};
  if (effectiveMode === "rzeczywiste" || effectiveMode === "porownanie") {
    for (const c of importedCosts) {
      const k = c.kategoria || "Inne";
      if (!byCategory[k]) byCategory[k] = [];
      byCategory[k].push(c);
    }
  }

  const sortedCategories = Object.keys(byCategory).sort((a, b) => {
    const ia = KATEGORIE_ALL.indexOf(a);
    const ib = KATEGORIE_ALL.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const catTotals: Record<string, { netto: number; brutto: number; count: number }> = {};
  for (const cat of sortedCategories) {
    const items = byCategory[cat];
    catTotals[cat] = {
      count: items.length,
      netto: items.reduce((s, c) => s + Number(c.netto || 0), 0),
      brutto: items.reduce((s, c) => s + Number(c.koszt || 0), 0),
    };
  }

  const totalWynagrodzenia = sortedCategories
    .filter(c => WYNAGRODZENIA_CATS.includes(c))
    .reduce((s, c) => s + (catTotals[c]?.brutto || 0), 0);
  const totalFlota = sortedCategories
    .filter(c => FLOTA_CATS.includes(c))
    .reduce((s, c) => s + (catTotals[c]?.brutto || 0), 0);
  const totalOperacyjne = sortedCategories
    .filter(c => !WYNAGRODZENIA_CATS.includes(c) && !FLOTA_CATS.includes(c))
    .reduce((s, c) => s + (catTotals[c]?.brutto || 0), 0);
  const totalAll = totalWynagrodzenia + totalFlota + totalOperacyjne;

  const budgetTotalSal = budgetSalaries.reduce((s: number, sal: any) => s + Number(sal.kosztPracodawcy || sal.koszt || 0), 0);
  const budgetTotalCosts = budgetCosts.reduce((s: number, c: any) => s + Number(c.koszt || 0), 0);
  const budgetTotalFleet = budgetFleet.reduce((s: number, f: any) => s + Number(f.koszt || 0), 0);
  const budgetTotal = budgetTotalSal + budgetTotalCosts + budgetTotalFleet;

  const grandNetto = sortedCategories.reduce((s, c) => s + (catTotals[c]?.netto || 0), 0);

  const pieData = [
    { name: "Wynagrodzenia i HR", value: Math.round(totalWynagrodzenia) },
    { name: "Flota", value: Math.round(totalFlota) },
    { name: "Transport", value: Math.round(catTotals["Transport"]?.brutto || 0) },
    { name: "Księgowość", value: Math.round(catTotals["Księgowość"]?.brutto || 0) },
  ].filter(d => d.value > 0);

  const remainingOp = totalOperacyjne - (catTotals["Transport"]?.brutto || 0) - (catTotals["Księgowość"]?.brutto || 0);
  if (remainingOp > 0) {
    pieData.push({ name: "Pozostałe koszty operacyjne", value: Math.round(remainingOp) });
  }

  const salPieData = [
    { name: "Zarząd (JDG)", value: Math.round(catTotals["Wynagrodzenia zarząd (JDG)"]?.brutto || 0) },
    { name: "Pracownicy", value: Math.round(catTotals["Wynagrodzenia"]?.brutto || 0) },
    { name: "ZUS", value: Math.round(catTotals["ZUS"]?.brutto || 0) },
    { name: "Podatki", value: Math.round(catTotals["Podatki (US)"]?.brutto || 0) },
    { name: "Medycyna", value: Math.round(catTotals["Medycyna pracy"]?.brutto || 0) },
  ].filter(d => d.value > 0);

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || "";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-finance-title">Panel finansowy</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} data-testid="button-import-finance">
            <Upload className="w-4 h-4 mr-1" />
            Import VAT
          </Button>
          <div className="flex rounded-md border">
            <Button
              variant={effectiveMode === "rzeczywiste" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("rzeczywiste")}
              data-testid="button-view-rzeczywiste"
            >
              Rzeczywiste
            </Button>
            <Button
              variant={effectiveMode === "budzet" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("budzet")}
              data-testid="button-view-budzet"
            >
              Budżet
            </Button>
            <Button
              variant={effectiveMode === "porownanie" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("porownanie")}
              data-testid="button-view-porownanie"
            >
              Porównanie
            </Button>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]" data-testid="select-month">
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

      {effectiveMode === "porownanie" ? (
        <ComparisonView
          budgetSal={budgetTotalSal}
          budgetOp={budgetTotalCosts}
          budgetFleet={budgetTotalFleet}
          budgetTotal={budgetTotal}
          actualSal={totalWynagrodzenia}
          actualOp={totalOperacyjne}
          actualFleet={totalFlota}
          actualTotal={totalAll}
          monthLabel={monthLabel}
        />
      ) : effectiveMode === "budzet" ? (
        <BudgetView
          salaries={budgetSalaries}
          costs={budgetCosts}
          fleet={budgetFleet}
          totalSal={budgetTotalSal}
          totalCosts={budgetTotalCosts}
          totalFleet={budgetTotalFleet}
          totalAll={budgetTotal}
          monthLabel={monthLabel}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Koszty miesiecznie</p>
                    <p className="text-xl font-bold" data-testid="text-total-monthly">{fmtPLN(totalAll)}</p>
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
                    <p className="text-xl font-bold" data-testid="text-total-salaries">{fmtPLN(totalWynagrodzenia)}</p>
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
                    <p className="text-xl font-bold" data-testid="text-total-costs">{fmtPLN(totalOperacyjne)}</p>
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
                    <p className="text-xl font-bold" data-testid="text-total-fleet">{fmtPLN(totalFlota)}</p>
                  </div>
                  <Car className="w-5 h-5 text-chart-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          {pieData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Rozkład kosztów - {monthLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtPLN(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Wynagrodzenia wg działów</CardTitle>
                </CardHeader>
                <CardContent>
                  {salPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={salPieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                          {salPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtPLN(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Brak danych</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">Koszty - {monthLabel} (Rzeczywiste)</CardTitle>
                <Button onClick={openAddDialog} data-testid="button-add-cost">
                  <Plus className="w-4 h-4 mr-1" />
                  Dodaj koszt
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-0">
                {sortedCategories.map(cat => {
                  const items = byCategory[cat];
                  const totals = catTotals[cat];
                  const isOpen = openCategories[cat] !== false;
                  const IconComp = CATEGORY_ICONS[cat] || HelpCircle;

                  return (
                    <Collapsible key={cat} open={isOpen} onOpenChange={() => toggleCategory(cat)}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b cursor-pointer hover-elevate" data-testid={`trigger-category-${cat}`}>
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            <IconComp className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">{cat} ({totals.count})</span>
                          </div>
                          <span className="font-bold text-sm">{fmtPLN(totals.brutto)}</span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Kontrahent/Nazwa</TableHead>
                              <TableHead>Nr faktury</TableHead>
                              <TableHead className="text-right">Netto</TableHead>
                              <TableHead className="text-right">Brutto</TableHead>
                              <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => (
                              <TableRow key={item.id} data-testid={`row-cost-${item.id}`}>
                                <TableCell className="text-sm font-medium">{item.nazwa || "-"}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item.rodzaj || "-"}</TableCell>
                                <TableCell className="text-right text-sm">{item.netto ? fmtPLN(Number(item.netto)) : "-"}</TableCell>
                                <TableCell className="text-right text-sm font-medium">{fmtPLN(Number(item.koszt || 0))}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(item)} data-testid={`button-edit-cost-${item.id}`}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(item.id)} data-testid={`button-delete-cost-${item.id}`}>
                                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={2} className="font-semibold text-xs">RAZEM {cat}</TableCell>
                              <TableCell className="text-right font-semibold text-xs">{fmtPLN(totals.netto)}</TableCell>
                              <TableCell className="text-right font-semibold text-xs">{fmtPLN(totals.brutto)}</TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
                <div className="flex items-center justify-between px-4 py-3 bg-muted border-t font-bold text-sm">
                  <span>RAZEM WSZYSTKIE KOSZTY</span>
                  <span data-testid="text-grand-total">{fmtPLN(grandNetto)} netto | {fmtPLN(totalAll)} brutto</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {!hasImportedData && (
            <Card>
              <CardContent className="py-12 text-center">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">Brak zaimportowanych danych za {monthLabel}</p>
                <Button variant="outline" onClick={() => setImportDialogOpen(true)} data-testid="button-import-empty">
                  <Upload className="w-4 h-4 mr-1" />
                  Importuj Zestawienie VAT
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

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
                  {KATEGORIE_ALL.map(k => (
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
                <Label>Brutto (PLN) *</Label>
                <Input
                  type="number"
                  value={formData.koszt}
                  onChange={(e) => setFormData({ ...formData, koszt: e.target.value })}
                  data-testid="input-cost-koszt"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nr faktury</Label>
              <Input
                value={formData.rodzaj}
                onChange={(e) => setFormData({ ...formData, rodzaj: e.target.value })}
                data-testid="input-cost-rodzaj"
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
          <p className="text-sm text-muted-foreground">Czy na pewno chcesz usunac ten koszt?</p>
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
              Import Zestawienie Zakupu VAT
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
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Format pliku:</p>
              <p>Raport <strong>Zestawienie Zakupu VAT</strong> z iBiznes (.xls / .xlsx)</p>
              <p>Miesiąc i rok zostaną odczytane automatycznie z pliku.</p>
              <p>Ponowny import za ten sam miesiąc <strong>zastąpi</strong> poprzednie dane.</p>
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

function ComparisonView({ budgetSal, budgetOp, budgetFleet, budgetTotal, actualSal, actualOp, actualFleet, actualTotal, monthLabel }: any) {
  const rows = [
    { name: "Wynagrodzenia", budget: budgetSal, actual: actualSal },
    { name: "Koszty operacyjne", budget: budgetOp, actual: actualOp },
    { name: "Flota", budget: budgetFleet, actual: actualFleet },
    { name: "RAZEM", budget: budgetTotal, actual: actualTotal },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Porównanie Budżet vs Rzeczywiste - {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategoria</TableHead>
              <TableHead className="text-right">Budżet</TableHead>
              <TableHead className="text-right">Rzeczywiste</TableHead>
              <TableHead className="text-right">Różnica</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => {
              const diff = r.actual - r.budget;
              const isTotal = r.name === "RAZEM";
              return (
                <TableRow key={r.name} className={isTotal ? "font-bold bg-muted" : ""} data-testid={`row-compare-${r.name}`}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{fmtPLN(r.budget)}</TableCell>
                  <TableCell className="text-right">{fmtPLN(r.actual)}</TableCell>
                  <TableCell className={`text-right ${diff > 0 ? "text-destructive" : diff < 0 ? "text-green-600" : ""}`}>
                    {diff > 0 ? "+" : ""}{fmtPLN(diff)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BudgetView({ salaries, costs, fleet, totalSal, totalCosts, totalFleet, totalAll, monthLabel }: any) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Budżet miesięczny</p>
                <p className="text-xl font-bold">{fmtPLN(totalAll)}</p>
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
                <p className="text-xl font-bold">{fmtPLN(totalSal)}</p>
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
                <p className="text-xl font-bold">{fmtPLN(totalCosts)}</p>
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
                <p className="text-xl font-bold">{fmtPLN(totalFleet)}</p>
              </div>
              <Car className="w-5 h-5 text-chart-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Budżet - {monthLabel} (planowane koszty stałe)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategoria</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead className="text-right">Kwota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salaries.length > 0 && (
                <>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold text-sm">Wynagrodzenia ({salaries.length})</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmtPLN(totalSal)}</TableCell>
                  </TableRow>
                  {salaries.map((s: any) => (
                    <TableRow key={`sal-${s.id}`}>
                      <TableCell className="text-xs text-muted-foreground">{s.dzial || s.formaZatrudnienia || "-"}</TableCell>
                      <TableCell className="text-sm">{s.osoba}</TableCell>
                      <TableCell className="text-right text-sm">{fmtPLN(Number(s.kosztPracodawcy || s.koszt || 0))}</TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              {costs.length > 0 && (
                <>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold text-sm">Koszty operacyjne ({costs.length})</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmtPLN(totalCosts)}</TableCell>
                  </TableRow>
                  {costs.map((c: any) => (
                    <TableRow key={`cost-${c.id}`}>
                      <TableCell className="text-xs text-muted-foreground">{c.kategoria || "-"}</TableCell>
                      <TableCell className="text-sm">{c.nazwa}</TableCell>
                      <TableCell className="text-right text-sm">{fmtPLN(Number(c.koszt || 0))}</TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              {fleet.length > 0 && (
                <>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold text-sm">Flota ({fleet.length})</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmtPLN(totalFleet)}</TableCell>
                  </TableRow>
                  {fleet.map((f: any) => (
                    <TableRow key={`fleet-${f.id}`}>
                      <TableCell className="text-xs text-muted-foreground">{f.rodzaj || "-"}</TableCell>
                      <TableCell className="text-sm">{f.opis}</TableCell>
                      <TableCell className="text-right text-sm">{fmtPLN(Number(f.koszt || 0))}</TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              <TableRow className="font-bold bg-muted">
                <TableCell colSpan={2}>RAZEM BUDŻET</TableCell>
                <TableCell className="text-right">{fmtPLN(totalAll)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {salaries.length === 0 && costs.length === 0 && fleet.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Brak danych budżetowych za {monthLabel}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
