import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch, useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Target, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowRight, Upload, Wand2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MONTHS = ["Styczen", "Luty", "Marzec", "Kwiecien", "Maj", "Czerwiec", "Lipiec", "Sierpien", "Wrzesien", "Pazdziernik", "Listopad", "Grudzien"];
const MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];

function fmtPLN(val: number) {
  return Math.round(val).toLocaleString("pl-PL") + " PLN";
}

function TrendArrow({ prev1, prev2 }: { prev1: number; prev2: number }) {
  if (prev2 === 0 && prev1 === 0) return <span className="text-muted-foreground"><ArrowRight className="w-3 h-3 inline" /></span>;
  if (prev2 === 0) return <span className="text-green-600 dark:text-green-400"><ArrowUp className="w-3 h-3 inline" /></span>;
  const change = ((prev1 - prev2) / prev2) * 100;
  if (Math.abs(change) < 1) return <span className="text-muted-foreground"><ArrowRight className="w-3 h-3 inline" /></span>;
  if (change > 0) return <span className="text-green-600 dark:text-green-400"><ArrowUp className="w-3 h-3 inline" /></span>;
  return <span className="text-red-600 dark:text-red-400"><ArrowDown className="w-3 h-3 inline" /></span>;
}

function WeekInput({ weeklyId, initialValue, placeholder, onSaved, onLocalChange }: {
  weeklyId: number;
  initialValue: number;
  placeholder?: string;
  onSaved: () => void;
  onLocalChange?: (val: number) => void;
}) {
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
      toast({ title: "Blad zapisu", description: isDisabled ? "Brak rekordu w bazie" : undefined, variant: "destructive" });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setDirty(true);
    if (onLocalChange) {
      onLocalChange(parseFloat(e.target.value) || 0);
    }
  };

  if (isDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Input
            type="number"
            className="w-20 h-8 text-right text-sm bg-muted/50 border-muted text-muted-foreground cursor-not-allowed"
            value=""
            disabled
            data-testid={`input-week-${weeklyId}`}
          />
        </TooltipTrigger>
        <TooltipContent>Brak planu</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Input
      type="number"
      step="0.01"
      className="w-20 h-8 text-right text-sm bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700"
      value={value}
      placeholder={placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      data-testid={`input-week-${weeklyId}`}
    />
  );
}

function parsePlanCSV(content: string): Array<{klient: string; cel: number}> {
  const lines = content.split("\n").map(l => l.replace(/\r$/, "")).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return {
      klient: row["Klient"] || row["klient"] || "",
      cel: parseFloat(row["Cel"] || row["cel"] || "0") || 0,
    };
  }).filter(r => r.klient && r.cel > 0);
}

function ImportPlanModal({ open, onClose, defaultRok, defaultMiesiac }: {
  open: boolean;
  onClose: () => void;
  defaultRok: number;
  defaultMiesiac: number;
}) {
  const [importRok, setImportRok] = useState(defaultRok);
  const [importMiesiac, setImportMiesiac] = useState(defaultMiesiac);
  const [parsedData, setParsedData] = useState<Array<{klient: string; cel: number}>>([]);
  const [fileName, setFileName] = useState("");
  const [existsWarning, setExistsWarning] = useState(false);
  const [existsCount, setExistsCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (data: typeof parsedData) => {
      const res = await apiRequest("POST", "/api/plan/import", { rok: importRok, miesiac: importMiesiac, data });
      return res.json();
    },
    onSuccess: (result) => {
      const notFoundMsg = result.notFound?.length > 0 ? ` Nieznalezieni: ${result.notFound.join(", ")}` : "";
      toast({ title: `Plan na ${MONTHS[importMiesiac - 1]} ${importRok}`, description: `${result.imported} klientow, 4 tygodnie.${notFoundMsg}` });
      queryClient.invalidateQueries({ queryKey: ["/api/plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plan/available-months"] });
      resetAndClose();
    },
    onError: () => {
      toast({ title: "Blad importu planu", variant: "destructive" });
    },
  });

  const resetAndClose = () => {
    setParsedData([]);
    setFileName("");
    setExistsWarning(false);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setParsedData(parsePlanCSV(content));
      setExistsWarning(false);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    const checkRes = await authFetch(`/api/plan/check?rok=${importRok}&miesiac=${importMiesiac}`);
    const checkResult = await checkRes.json();
    if (checkResult.exists && !existsWarning) {
      setExistsWarning(true);
      setExistsCount(checkResult.count);
      return;
    }
    if (existsWarning) {
      await apiRequest("DELETE", `/api/plan/monthly?rok=${importRok}&miesiac=${importMiesiac}`);
    }
    importMutation.mutate(parsedData);
  };

  const totalCel = parsedData.reduce((s, r) => s + r.cel, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Import planu z CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={String(importMiesiac)} onValueChange={(v) => { setImportMiesiac(Number(v)); setExistsWarning(false); }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={String(importRok)} onValueChange={(v) => { setImportRok(Number(v)); setExistsWarning(false); }}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-upload-plan-csv">
              <Upload className="w-4 h-4 mr-2" /> {fileName || "Wybierz plik CSV"}
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </div>
          {existsWarning && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm">Plan na {MONTHS[importMiesiac - 1]} {importRok} juz istnieje ({existsCount} rekordow). Kliknij ponownie aby nadpisac.</span>
            </div>
          )}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Podglad: {parsedData.length} klientow, laczny CEL: {fmtPLN(totalCel)}</p>
              <div className="overflow-auto max-h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lp.</TableHead>
                      <TableHead>Klient</TableHead>
                      <TableHead className="text-right">CEL</TableHead>
                      <TableHead className="text-right">Tyg. plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.klient}</TableCell>
                        <TableCell className="text-right">{fmtPLN(r.cel)}</TableCell>
                        <TableCell className="text-right">{fmtPLN(r.cel / 4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Anuluj</Button>
          <Button onClick={handleImport} disabled={parsedData.length === 0 || importMutation.isPending} data-testid="button-do-plan-import">
            {importMutation.isPending ? "Importowanie..." : existsWarning ? "Nadpisz i importuj" : "Importuj plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutoGenerateModal({ open, onClose, defaultRok, defaultMiesiac }: {
  open: boolean;
  onClose: () => void;
  defaultRok: number;
  defaultMiesiac: number;
}) {
  const [genRok, setGenRok] = useState(defaultRok);
  const [genMiesiac, setGenMiesiac] = useState(defaultMiesiac);
  const [wspolczynnik, setWspolczynnik] = useState("1.05");
  const [existsWarning, setExistsWarning] = useState(false);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const checkRes = await authFetch(`/api/plan/check?rok=${genRok}&miesiac=${genMiesiac}`);
      const checkResult = await checkRes.json();
      if (checkResult.exists && !existsWarning) {
        setExistsWarning(true);
        throw new Error("EXISTS");
      }
      if (existsWarning) {
        await apiRequest("DELETE", `/api/plan/monthly?rok=${genRok}&miesiac=${genMiesiac}`);
      }
      const res = await apiRequest("POST", "/api/plan/auto-generate", { rok: genRok, miesiac: genMiesiac, wspolczynnik: parseFloat(wspolczynnik) || 1.05 });
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: `Plan na ${MONTHS[genMiesiac - 1]} ${genRok}`, description: `Wygenerowano dla ${result.generated} klientow. Pominietych: ${result.skipped}` });
      queryClient.invalidateQueries({ queryKey: ["/api/plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plan/available-months"] });
      setExistsWarning(false);
      onClose();
    },
    onError: (err: any) => {
      if (err.message === "EXISTS") return;
      toast({ title: "Blad generowania planu", variant: "destructive" });
    },
  });

  const pctLabel = ((parseFloat(wspolczynnik) || 1) - 1) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setExistsWarning(false); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generuj plan automatycznie</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={String(genMiesiac)} onValueChange={(v) => { setGenMiesiac(Number(v)); setExistsWarning(false); }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={String(genRok)} onValueChange={(v) => { setGenRok(Number(v)); setExistsWarning(false); }}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Wspolczynnik wzrostu</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                value={wspolczynnik}
                onChange={(e) => setWspolczynnik(e.target.value)}
                className="w-24"
                data-testid="input-wspolczynnik"
              />
              <span className="text-sm text-muted-foreground">({pctLabel >= 0 ? "+" : ""}{pctLabel.toFixed(0)}%)</span>
            </div>
            <p className="text-xs text-muted-foreground">CEL = sprzedaz poprz. miesiaca x wspolczynnik</p>
          </div>
          {existsWarning && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm">Plan juz istnieje. Kliknij ponownie aby nadpisac.</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setExistsWarning(false); onClose(); }}>Anuluj</Button>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-do-auto-generate">
            {generateMutation.isPending ? "Generowanie..." : existsWarning ? "Nadpisz i generuj" : "Generuj plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlanPage() {
  const now = new Date();
  const [rok, setRok] = useState(now.getFullYear());
  const [miesiac, setMiesiac] = useState(now.getMonth() + 1);
  const [initialized, setInitialized] = useState(false);
  const [localWeekValues, setLocalWeekValues] = useState<Record<string, Record<number, number>>>({});
  const [importPlanOpen, setImportPlanOpen] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.rola === "admin";

  const { data: availableMonths } = useQuery({
    queryKey: ["/api/plan/available-months"],
    queryFn: async () => {
      const res = await authFetch("/api/plan/available-months");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (availableMonths && availableMonths.length > 0 && !initialized) {
      const currentExists = availableMonths.some((m: any) => m.rok === rok && m.miesiac === miesiac);
      if (!currentExists) {
        setRok(availableMonths[0].rok);
        setMiesiac(availableMonths[0].miesiac);
      }
      setInitialized(true);
    }
  }, [availableMonths, initialized]);

  useEffect(() => {
    setLocalWeekValues({});
  }, [rok, miesiac]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/plan", rok, miesiac],
    queryFn: async () => {
      const res = await authFetch(`/api/plan?rok=${rok}&miesiac=${miesiac}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const handleSaved = useCallback(() => {
    setLocalWeekValues({});
    queryClient.invalidateQueries({ queryKey: ["/api/plan", rok, miesiac] });
  }, [rok, miesiac]);

  const goToPrev = () => {
    if (miesiac === 1) { setMiesiac(12); setRok(rok - 1); }
    else setMiesiac(miesiac - 1);
  };
  const goToNext = () => {
    if (miesiac === 12) { setMiesiac(1); setRok(rok + 1); }
    else setMiesiac(miesiac + 1);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const groups: any[] = data?.groups || [];
  const prev1Month = data?.prev1Month || 1;
  const prev1Year = data?.prev1Year || 2026;
  const prev2Month = data?.prev2Month || 12;
  const prev2Year = data?.prev2Year || 2025;
  const prevMonthTotalSales = Number(data?.prevMonthTotalSales || 0);

  const prev1Label = `${MONTHS_SHORT[prev1Month - 1]} ${String(prev1Year).slice(2)}`;
  const prev2Label = `${MONTHS_SHORT[prev2Month - 1]} ${String(prev2Year).slice(2)}`;

  const allClients = groups.flatMap((g: any) => g.klienci || []);
  const totalCel = allClients.reduce((s: number, k: any) => s + (k.cel || 0), 0);

  const getClientWeekVal = (clientId: number, week: number, original: number) => {
    const key = `${clientId}`;
    if (localWeekValues[key] && localWeekValues[key][week] !== undefined) return localWeekValues[key][week];
    return original;
  };

  const getClientSuma = (k: any) => {
    return getClientWeekVal(k.clientId, 1, k.tydz1) + getClientWeekVal(k.clientId, 2, k.tydz2) +
      getClientWeekVal(k.clientId, 3, k.tydz3) + getClientWeekVal(k.clientId, 4, k.tydz4);
  };

  const totalRealizacja = allClients.reduce((s: number, k: any) => s + getClientSuma(k), 0);
  const pctRealizacji = totalCel > 0 ? (totalRealizacja / totalCel * 100) : 0;

  const pctColor = pctRealizacji >= 80 ? "text-green-600 dark:text-green-400" : pctRealizacji >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const pctBg = pctRealizacji >= 80 ? "hsl(142, 76%, 40%)" : pctRealizacji >= 50 ? "hsl(45, 85%, 45%)" : "hsl(0, 84%, 45%)";

  const handleLocalChange = (clientId: number, week: number, val: number) => {
    setLocalWeekValues(prev => ({
      ...prev,
      [`${clientId}`]: { ...(prev[`${clientId}`] || {}), [week]: val },
    }));
  };

  let grandTotalPrev1 = 0, grandTotalPrev2 = 0, grandTotalCel = 0;
  let grandTotalT1 = 0, grandTotalT2 = 0, grandTotalT3 = 0, grandTotalT4 = 0;
  let grandTotalReal = 0;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Target className="w-6 h-6" /> Plan miesieczny
          </h1>
          <p className="text-sm text-muted-foreground">
            Planowanie i realizacja tygodniowa
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setImportPlanOpen(true)} data-testid="button-import-plan">
                <Upload className="w-4 h-4 mr-2" /> Import CSV
              </Button>
              <Button variant="outline" onClick={() => setAutoGenOpen(true)} data-testid="button-auto-gen">
                <Wand2 className="w-4 h-4 mr-2" /> Generuj auto
              </Button>
            </>
          )}
          <Button size="icon" variant="outline" onClick={goToPrev} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
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
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline" onClick={goToNext} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Sprzedaz {prev1Label}</p>
            <p className="text-xl font-bold" data-testid="text-prev-sales">{fmtPLN(prevMonthTotalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">CEL {MONTHS[miesiac - 1]}</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-total-cel">{fmtPLN(totalCel)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Realizacja</p>
            <p className="text-xl font-bold" data-testid="text-total-realizacja">{fmtPLN(totalRealizacja)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">% Realizacji</p>
            <p className={`text-3xl font-bold ${pctColor}`} data-testid="text-pct-realizacji">
              {pctRealizacji.toFixed(1)}%
            </p>
            <div className="w-full h-2.5 rounded-full overflow-hidden bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, pctRealizacji)}%`, backgroundColor: pctBg }}
              />
            </div>
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
        const groupPrev1 = klienci.reduce((s: number, k: any) => s + (k.prev1 || 0), 0);
        const groupPrev2 = klienci.reduce((s: number, k: any) => s + (k.prev2 || 0), 0);
        const groupT1 = klienci.reduce((s: number, k: any) => s + getClientWeekVal(k.clientId, 1, k.tydz1), 0);
        const groupT2 = klienci.reduce((s: number, k: any) => s + getClientWeekVal(k.clientId, 2, k.tydz2), 0);
        const groupT3 = klienci.reduce((s: number, k: any) => s + getClientWeekVal(k.clientId, 3, k.tydz3), 0);
        const groupT4 = klienci.reduce((s: number, k: any) => s + getClientWeekVal(k.clientId, 4, k.tydz4), 0);
        const groupReal = groupT1 + groupT2 + groupT3 + groupT4;
        const groupDiff = groupReal - groupCel;
        const groupPct = groupCel > 0 ? (groupReal / groupCel * 100) : 0;

        grandTotalPrev1 += groupPrev1;
        grandTotalPrev2 += groupPrev2;
        grandTotalCel += groupCel;
        grandTotalT1 += groupT1;
        grandTotalT2 += groupT2;
        grandTotalT3 += groupT3;
        grandTotalT4 += groupT4;
        grandTotalReal += groupReal;

        return (
          <Card key={gi}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{g.grupa}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">Klientow: {klienci.length}</Badge>
                  <Badge variant="secondary">CEL: {fmtPLN(groupCel)}</Badge>
                  <Badge variant="secondary">{groupPct.toFixed(1)}%</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">Lp.</TableHead>
                      <TableHead className="min-w-[160px]">Klient</TableHead>
                      <TableHead className="text-right w-16">Rabat%</TableHead>
                      <TableHead className="text-right">{prev2Label}</TableHead>
                      <TableHead className="text-right">{prev1Label}</TableHead>
                      <TableHead className="text-center w-10">Trend</TableHead>
                      <TableHead className="text-right">CEL</TableHead>
                      <TableHead className="text-center">Tydz 1</TableHead>
                      <TableHead className="text-center">Tydz 2</TableHead>
                      <TableHead className="text-center">Tydz 3</TableHead>
                      <TableHead className="text-center">Tydz 4</TableHead>
                      <TableHead className="text-right">SUMA</TableHead>
                      <TableHead className="text-right">Roznica</TableHead>
                      <TableHead className="text-right">% Real.</TableHead>
                      <TableHead className="text-right">Sr. Tyg.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {klienci.map((k: any, ki: number) => {
                      const suma = getClientSuma(k);
                      const roznica = suma - (k.cel || 0);
                      const pctReal = k.cel > 0 ? (suma / k.cel * 100) : 0;
                      const isPrevZero = k.prev1 === 0;
                      const isRealized = k.cel > 0 && suma >= k.cel;
                      const isZeroReal = suma === 0;
                      const srTygPlaceholder = k.srTyg > 0 ? String(k.srTyg) : undefined;

                      let rowBg = "";
                      if (isRealized) rowBg = "bg-green-50 dark:bg-green-950/20";
                      else if (isZeroReal && k.cel > 0) rowBg = "bg-muted/40";
                      else if (isPrevZero) rowBg = "bg-red-50 dark:bg-red-900/15";

                      let pctClass = "text-muted-foreground";
                      if (k.cel > 0) {
                        if (pctReal >= 100) pctClass = "text-green-600 dark:text-green-400 font-medium";
                        else if (pctReal >= 70) pctClass = "text-yellow-600 dark:text-yellow-400";
                        else pctClass = "text-red-600 dark:text-red-400";
                      }

                      return (
                        <TableRow key={ki} className={rowBg} data-testid={`row-plan-${k.clientId}`}>
                          <TableCell className="text-muted-foreground text-sm">{ki + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{k.klient}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{k.rabat != null ? `${k.rabat}%` : "-"}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmtPLN(k.prev2)}</TableCell>
                          <TableCell className="text-right text-sm">{fmtPLN(k.prev1)}</TableCell>
                          <TableCell className="text-center"><TrendArrow prev1={k.prev1} prev2={k.prev2} /></TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmtPLN(k.cel)}</TableCell>
                          <TableCell className="text-center">
                            <WeekInput weeklyId={k.weeklyIds[0]} initialValue={k.tydz1} placeholder={srTygPlaceholder} onSaved={handleSaved} onLocalChange={(v) => handleLocalChange(k.clientId, 1, v)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <WeekInput weeklyId={k.weeklyIds[1]} initialValue={k.tydz2} placeholder={srTygPlaceholder} onSaved={handleSaved} onLocalChange={(v) => handleLocalChange(k.clientId, 2, v)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <WeekInput weeklyId={k.weeklyIds[2]} initialValue={k.tydz3} placeholder={srTygPlaceholder} onSaved={handleSaved} onLocalChange={(v) => handleLocalChange(k.clientId, 3, v)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <WeekInput weeklyId={k.weeklyIds[3]} initialValue={k.tydz4} placeholder={srTygPlaceholder} onSaved={handleSaved} onLocalChange={(v) => handleLocalChange(k.clientId, 4, v)} />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmtPLN(suma)}</TableCell>
                          <TableCell className={`text-right text-sm ${roznica >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {roznica >= 0 ? "+" : ""}{fmtPLN(roznica)}
                          </TableCell>
                          <TableCell className={`text-right text-sm ${pctClass}`}>
                            {k.cel > 0 ? `${pctReal.toFixed(1)}%` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{k.srTyg > 0 ? fmtPLN(k.srTyg) : "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold bg-muted/50 border-t-2">
                      <TableCell></TableCell>
                      <TableCell className="text-base">RAZEM {g.grupa}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right text-base">{fmtPLN(groupPrev2)}</TableCell>
                      <TableCell className="text-right text-base">{fmtPLN(groupPrev1)}</TableCell>
                      <TableCell className="text-center"><TrendArrow prev1={groupPrev1} prev2={groupPrev2} /></TableCell>
                      <TableCell className="text-right text-base">{fmtPLN(groupCel)}</TableCell>
                      <TableCell className="text-right text-base">{fmtPLN(groupT1)}</TableCell>
                      <TableCell className="text-right text-base">{fmtPLN(groupT2)}</TableCell>
                      <TableCell className="text-right text-base">{fmtPLN(groupT3)}</TableCell>
                      <TableCell className="text-right text-base">{fmtPLN(groupT4)}</TableCell>
                      <TableCell className="text-right text-base">{fmtPLN(groupReal)}</TableCell>
                      <TableCell className={`text-right text-base ${groupDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {groupDiff >= 0 ? "+" : ""}{fmtPLN(groupDiff)}
                      </TableCell>
                      <TableCell className={`text-right text-base ${groupPct >= 100 ? "text-green-600 dark:text-green-400" : groupPct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                        {groupCel > 0 ? `${groupPct.toFixed(1)}%` : "-"}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {groups.length > 1 && (() => {
        const grandDiff = grandTotalReal - grandTotalCel;
        const grandPct = grandTotalCel > 0 ? (grandTotalReal / grandTotalCel * 100) : 0;
        return (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    <TableRow className="font-bold bg-muted border-t-2">
                      <TableCell className="w-8"></TableCell>
                      <TableCell className="min-w-[160px] text-lg">RAZEM WSZYSTKO</TableCell>
                      <TableCell className="w-16"></TableCell>
                      <TableCell className="text-right text-lg">{fmtPLN(grandTotalPrev2)}</TableCell>
                      <TableCell className="text-right text-lg">{fmtPLN(grandTotalPrev1)}</TableCell>
                      <TableCell className="text-center"><TrendArrow prev1={grandTotalPrev1} prev2={grandTotalPrev2} /></TableCell>
                      <TableCell className="text-right text-lg">{fmtPLN(grandTotalCel)}</TableCell>
                      <TableCell className="text-right text-lg">{fmtPLN(grandTotalT1)}</TableCell>
                      <TableCell className="text-right text-lg">{fmtPLN(grandTotalT2)}</TableCell>
                      <TableCell className="text-right text-lg">{fmtPLN(grandTotalT3)}</TableCell>
                      <TableCell className="text-right text-lg">{fmtPLN(grandTotalT4)}</TableCell>
                      <TableCell className="text-right text-lg">{fmtPLN(grandTotalReal)}</TableCell>
                      <TableCell className={`text-right text-lg ${grandDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {grandDiff >= 0 ? "+" : ""}{fmtPLN(grandDiff)}
                      </TableCell>
                      <TableCell className={`text-right text-lg ${grandPct >= 100 ? "text-green-600 dark:text-green-400" : grandPct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                        {grandTotalCel > 0 ? `${grandPct.toFixed(1)}%` : "-"}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {isAdmin && (
        <>
          <ImportPlanModal open={importPlanOpen} onClose={() => setImportPlanOpen(false)} defaultRok={rok} defaultMiesiac={miesiac} />
          <AutoGenerateModal open={autoGenOpen} onClose={() => setAutoGenOpen(false)} defaultRok={rok} defaultMiesiac={miesiac} />
        </>
      )}
    </div>
  );
}
