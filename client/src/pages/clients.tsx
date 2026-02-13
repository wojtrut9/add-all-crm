import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search, Download, Upload, Plus, AlertTriangle, Phone,
  MapPin, Users, Pencil, Save, X, Trash2, Wrench,
} from "lucide-react";
import type { Client } from "@shared/schema";

const OPIEKUN_OPTIONS = ["Gosia", "Magda", "Weryfikacja"];
const SEGMENT_OPTIONS = ["Premium", "Standard", "Weryfikacja"];
const STATUS_OPTIONS = ["Aktywny", "Nieaktywny", "Weryfikacja", "Zawieszony"];
const GRUPA_OPTIONS = ["Gosia Premium", "Magda Premium", "Magda Standard", "Weryfikacja - zostana", "Weryfikacja - odejda"];
const RYTM_OPTIONS = ["1x/tydz", "2x/mies", "1x/mies", "1x/2tyg", "Na zamowienie"];
const FORMA_KONTAKTU_OPTIONS = ["Telefon", "Sms", "Email", "WhatsApp"];

function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  const hasAlert = (client.brakiZamowien || 0) >= 2;
  return (
    <div
      className={`p-4 rounded-md border cursor-pointer hover-elevate transition-colors ${hasAlert ? 'border-destructive/50 bg-destructive/5' : ''}`}
      onClick={onClick}
      data-testid={`card-client-${client.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{client.klient}</p>
            {hasAlert && <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{client.clientId}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {client.miasto && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />{client.miasto}
              </span>
            )}
            {client.telefon && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />{client.telefon}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant="secondary" className={`text-xs border-transparent ${client.segment === "Premium" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}`}>
            {client.segment}
          </Badge>
          <Badge variant={client.aktywny ? "outline" : "secondary"} className={`text-xs ${!client.aktywny ? "bg-[#e6e6e6] text-[#0f0f0f] border-transparent" : ""}`}>
            {client.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${alert ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`input-edit-${label.toLowerCase().replace(/\s/g, '-')}`}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger data-testid={`select-edit-${label.toLowerCase().replace(/\s/g, '-')}`}>
          <SelectValue placeholder={`Wybierz ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    klient: client.klient,
    opiekun: client.opiekun,
    segment: client.segment,
    grupaMvp: client.grupaMvp || "",
    status: client.status,
    telefon: client.telefon || "",
    telefonDodatkowy: client.telefonDodatkowy || "",
    email: client.email || "",
    emailDodatkowe: client.emailDodatkowe || "",
    dniZamowien: client.dniZamowien || "",
    rytmKontaktu: client.rytmKontaktu || "",
    miasto: client.miasto || "",
    rabatProcent: client.rabatProcent ? String(client.rabatProcent) : "",
    warunkiPlatnosci: client.warunkiPlatnosci || "",
    terminPlatnosciDni: client.terminPlatnosciDni ? String(client.terminPlatnosciDni) : "",
    limitKredytowy: client.limitKredytowy ? String(client.limitKredytowy) : "",
    osobaKontaktowa: client.osobaKontaktowa || "",
    notatki: client.notatki || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/clients/${client.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Zapisano zmiany" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditing(false);
      onClose();
    },
    onError: () => {
      toast({ title: "Błąd zapisu", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/clients/${client.id}`);
    },
    onSuccess: () => {
      toast({ title: `Usunięto klienta ${client.klient}` });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Błąd usuwania klienta", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      klient: form.klient,
      opiekun: form.opiekun,
      segment: form.segment,
      grupaMvp: form.grupaMvp || null,
      status: form.status,
      telefon: form.telefon || null,
      telefonDodatkowy: form.telefonDodatkowy || null,
      email: form.email || null,
      emailDodatkowe: form.emailDodatkowe || null,
      dniZamowien: form.dniZamowien || null,
      rytmKontaktu: form.rytmKontaktu || null,
      miasto: form.miasto || null,
      rabatProcent: form.rabatProcent ? Number(form.rabatProcent) : null,
      warunkiPlatnosci: form.warunkiPlatnosci || null,
      terminPlatnosciDni: form.terminPlatnosciDni ? Number(form.terminPlatnosciDni) : null,
      limitKredytowy: form.limitKredytowy ? Number(form.limitKredytowy) : null,
      osobaKontaktowa: form.osobaKontaktowa || null,
      notatki: form.notatki || null,
    });
  };

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  if (editing) {
    return (
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj klienta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditField label="Nazwa" value={form.klient} onChange={(v) => setField("klient", v)} />
            <SelectField label="Opiekun" value={form.opiekun} onChange={(v) => setField("opiekun", v)} options={OPIEKUN_OPTIONS} />
            <SelectField label="Segment" value={form.segment} onChange={(v) => setField("segment", v)} options={SEGMENT_OPTIONS} />
            <SelectField label="Grupa MVP" value={form.grupaMvp} onChange={(v) => setField("grupaMvp", v)} options={GRUPA_OPTIONS} />
            <SelectField label="Status" value={form.status} onChange={(v) => setField("status", v)} options={STATUS_OPTIONS} />
            <EditField label="Telefon" value={form.telefon} onChange={(v) => setField("telefon", v)} />
            <EditField label="Telefon dodatkowy" value={form.telefonDodatkowy} onChange={(v) => setField("telefonDodatkowy", v)} />
            <EditField label="Email" value={form.email} onChange={(v) => setField("email", v)} />
            <EditField label="Email dodatkowe" value={form.emailDodatkowe} onChange={(v) => setField("emailDodatkowe", v)} />
            <EditField label="Dni zamówień" value={form.dniZamowien} onChange={(v) => setField("dniZamowien", v)} />
            <SelectField label="Rytm kontaktu" value={form.rytmKontaktu} onChange={(v) => setField("rytmKontaktu", v)} options={RYTM_OPTIONS} />
            <EditField label="Miasto" value={form.miasto} onChange={(v) => setField("miasto", v)} />
            <EditField label="Rabat %" value={form.rabatProcent} onChange={(v) => setField("rabatProcent", v)} type="number" />
            <EditField label="Warunki płatności" value={form.warunkiPlatnosci} onChange={(v) => setField("warunkiPlatnosci", v)} />
            <EditField label="Termin płatności (dni)" value={form.terminPlatnosciDni} onChange={(v) => setField("terminPlatnosciDni", v)} type="number" />
            <EditField label="Limit kredytowy" value={form.limitKredytowy} onChange={(v) => setField("limitKredytowy", v)} type="number" />
            <EditField label="Osoba kontaktowa" value={form.osobaKontaktowa} onChange={(v) => setField("osobaKontaktowa", v)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notatki</Label>
            <Textarea
              value={form.notatki}
              onChange={(e) => setField("notatki", e.target.value)}
              className="resize-none"
              rows={3}
              data-testid="textarea-edit-notatki"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
            <X className="w-4 h-4 mr-1" /> Anuluj
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-edit">
            <Save className="w-4 h-4 mr-1" /> {updateMutation.isPending ? "Zapisuję..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <DialogTitle className="flex items-center gap-2">
            {client.klient}
            <Badge variant={client.segment === "Premium" ? "default" : "secondary"}>{client.segment}</Badge>
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-client">
              <Pencil className="w-4 h-4 mr-1" /> Edytuj
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" data-testid="button-delete-client">
                  <Trash2 className="w-4 h-4 mr-1" /> Usuń
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Czy na pewno chcesz usunąć tego klienta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Klient <strong>{client.klient}</strong> zostanie trwale usunięty. Tej operacji nie można cofnąć.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "Usuwam..." : "Usuń klienta"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="ID" value={client.clientId} />
          <InfoRow label="Opiekun" value={client.opiekun} />
          <InfoRow label="Grupa MVP" value={client.grupaMvp || "-"} />
          <InfoRow label="Status" value={client.status} />
          <InfoRow label="Miasto" value={client.miasto || "-"} />
          <InfoRow label="Kraj" value={client.kraj || "-"} />
          <InfoRow label="Telefon" value={client.telefon || "-"} />
          <InfoRow label="Telefon dodatkowy" value={client.telefonDodatkowy || "-"} />
          <InfoRow label="Email" value={client.email || "-"} />
          <InfoRow label="Email dodatkowe" value={client.emailDodatkowe || "-"} />
          <InfoRow label="Forma kontaktu" value={client.preferowanaFormaKontaktu || "-"} />
          <InfoRow label="Zamówienia gdzie" value={client.zamowieniaGdzie || "-"} />
          <InfoRow label="Dni zamówień" value={client.dniZamowien || "-"} />
          <InfoRow label="Rytm kontaktu" value={client.rytmKontaktu || "-"} />
          <InfoRow label="Rabat %" value={client.rabatProcent ? `${client.rabatProcent}%` : "-"} />
          <InfoRow label="Warunki płatności" value={client.warunkiPlatnosci || "-"} />
          <InfoRow label="Termin płatności" value={client.terminPlatnosciDni ? `${client.terminPlatnosciDni} dni` : "-"} />
          <InfoRow label="Limit kredytowy" value={client.limitKredytowy ? `${Number(client.limitKredytowy).toLocaleString("pl-PL")} PLN` : "-"} />
          <InfoRow label="Osoba kontaktowa" value={client.osobaKontaktowa || "-"} />
          <InfoRow label="Braki zamówień" value={String(client.brakiZamowien || 0)} alert={(client.brakiZamowien || 0) >= 2} />
        </div>
        {client.notatki && (
          <div>
            <p className="text-sm font-medium mb-1">Notatki</p>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-md max-h-40 overflow-y-auto">
              {client.notatki}
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

function AddClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    klient: "",
    opiekun: "Weryfikacja",
    segment: "Weryfikacja",
    grupaMvp: "",
    status: "Aktywny",
    telefon: "",
    telefonDodatkowy: "",
    email: "",
    emailDodatkowe: "",
    dniZamowien: "",
    rytmKontaktu: "",
    miasto: "",
    rabatProcent: "",
    warunkiPlatnosci: "",
    terminPlatnosciDni: "",
    limitKredytowy: "",
    osobaKontaktowa: "",
    notatki: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: async (res) => {
      const created = await res.json();
      toast({ title: `Dodano klienta ${created.klient}` });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Błąd tworzenia klienta", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setForm({
      klient: "", opiekun: "Weryfikacja", segment: "Weryfikacja", grupaMvp: "",
      status: "Aktywny", telefon: "", telefonDodatkowy: "", email: "", emailDodatkowe: "",
      dniZamowien: "", rytmKontaktu: "", miasto: "", rabatProcent: "",
      warunkiPlatnosci: "", terminPlatnosciDni: "", limitKredytowy: "",
      osobaKontaktowa: "", notatki: "",
    });
  };

  const handleSave = () => {
    if (!form.klient.trim()) {
      toast({ title: "Nazwa klienta jest wymagana", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      klient: form.klient.trim(),
      opiekun: form.opiekun,
      segment: form.segment,
      grupaMvp: form.grupaMvp || null,
      status: form.status,
      aktywny: form.status === "Aktywny",
      telefon: form.telefon || null,
      telefonDodatkowy: form.telefonDodatkowy || null,
      email: form.email || null,
      emailDodatkowe: form.emailDodatkowe || null,
      dniZamowien: form.dniZamowien || null,
      rytmKontaktu: form.rytmKontaktu || null,
      miasto: form.miasto || null,
      rabatProcent: form.rabatProcent ? Number(form.rabatProcent) : null,
      warunkiPlatnosci: form.warunkiPlatnosci || null,
      terminPlatnosciDni: form.terminPlatnosciDni ? Number(form.terminPlatnosciDni) : null,
      limitKredytowy: form.limitKredytowy ? Number(form.limitKredytowy) : null,
      osobaKontaktowa: form.osobaKontaktowa || null,
      notatki: form.notatki || null,
    });
  };

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj klienta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditField label="Nazwa klienta *" value={form.klient} onChange={(v) => setField("klient", v)} />
            <SelectField label="Opiekun *" value={form.opiekun} onChange={(v) => setField("opiekun", v)} options={OPIEKUN_OPTIONS} />
            <SelectField label="Segment *" value={form.segment} onChange={(v) => setField("segment", v)} options={SEGMENT_OPTIONS} />
            <SelectField label="Grupa MVP" value={form.grupaMvp} onChange={(v) => setField("grupaMvp", v)} options={GRUPA_OPTIONS} />
            <SelectField label="Status" value={form.status} onChange={(v) => setField("status", v)} options={STATUS_OPTIONS} />
            <EditField label="Telefon" value={form.telefon} onChange={(v) => setField("telefon", v)} />
            <EditField label="Telefon dodatkowy" value={form.telefonDodatkowy} onChange={(v) => setField("telefonDodatkowy", v)} />
            <EditField label="Email" value={form.email} onChange={(v) => setField("email", v)} />
            <EditField label="Email dodatkowe" value={form.emailDodatkowe} onChange={(v) => setField("emailDodatkowe", v)} />
            <EditField label="Dni zamówień" value={form.dniZamowien} onChange={(v) => setField("dniZamowien", v)} />
            <SelectField label="Rytm kontaktu" value={form.rytmKontaktu} onChange={(v) => setField("rytmKontaktu", v)} options={RYTM_OPTIONS} />
            <EditField label="Miasto" value={form.miasto} onChange={(v) => setField("miasto", v)} />
            <EditField label="Rabat %" value={form.rabatProcent} onChange={(v) => setField("rabatProcent", v)} type="number" />
            <EditField label="Warunki płatności" value={form.warunkiPlatnosci} onChange={(v) => setField("warunkiPlatnosci", v)} />
            <EditField label="Termin płatności (dni)" value={form.terminPlatnosciDni} onChange={(v) => setField("terminPlatnosciDni", v)} type="number" />
            <EditField label="Limit kredytowy" value={form.limitKredytowy} onChange={(v) => setField("limitKredytowy", v)} type="number" />
            <EditField label="Osoba kontaktowa" value={form.osobaKontaktowa} onChange={(v) => setField("osobaKontaktowa", v)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notatki</Label>
            <Textarea
              value={form.notatki}
              onChange={(e) => setField("notatki", e.target.value)}
              className="resize-none"
              rows={3}
              data-testid="textarea-add-notatki"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add">
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={createMutation.isPending} data-testid="button-save-add">
            <Plus className="w-4 h-4 mr-1" /> {createMutation.isPending ? "Dodaję..." : "Dodaj klienta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterOpiekun, setFilterOpiekun] = useState("all");
  const [filterSegment, setFilterSegment] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGrupa, setFilterGrupa] = useState("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: clientsData, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await authFetch("/api/clients");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const clients = clientsData || [];

  const filteredClients = clients.filter((c) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !c.klient.toLowerCase().includes(s) &&
        !(c.miasto || "").toLowerCase().includes(s) &&
        !(c.osobaKontaktowa || "").toLowerCase().includes(s) &&
        !(c.clientId || "").toLowerCase().includes(s)
      ) return false;
    }
    if (filterOpiekun !== "all" && c.opiekun !== filterOpiekun) return false;
    if (filterSegment !== "all" && c.segment !== filterSegment) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterGrupa !== "all" && c.grupaMvp !== filterGrupa) return false;

    if (activeTab === "gosia-premium" && !(c.opiekun === "Gosia" && c.segment === "Premium")) return false;
    if (activeTab === "magda-premium" && !(c.opiekun === "Magda" && c.segment === "Premium")) return false;
    if (activeTab === "magda-standard" && !(c.opiekun === "Magda" && c.segment === "Standard")) return false;
    if (activeTab === "weryfikacja" && !c.status.toLowerCase().includes("weryfikacj")) return false;
    if (activeTab === "alert" && (c.brakiZamowien || 0) < 2) return false;

    return true;
  });

  const handleExportCSV = () => {
    const headers = ["Klient", "ID", "Opiekun", "Segment", "Status", "Miasto", "Telefon", "Email"];
    const rows = filteredClients.map(c => [c.klient, c.clientId, c.opiekun, c.segment, c.status, c.miasto || "", c.telefon || "", c.email || ""]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klienci.csv";
    a.click();
  };

  const handleImportCSV = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/clients/import", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error("Import failed");
        const data = await res.json();
        toast({
          title: "Import zakończony",
          description: `Zaimportowano ${data.created} nowych klientów. Pominięto ${data.skipped} istniejących.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      } catch {
        toast({ title: "Błąd importu", variant: "destructive" });
      }
    };
    input.click();
  };

  const isAdmin = user?.rola === "admin";
  const [fixDone, setFixDone] = useState(false);

  const fixColumnsMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/clients/fix-columns", { method: "POST" });
      if (!res.ok) throw new Error("Blad naprawy");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Naprawiono dane", description: `Naprawiono: ${data.fixed}, OK: ${data.alreadyOk}, Nie udalo sie: ${data.couldNotFix}` });
      setFixDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: () => {
      toast({ title: "Blad naprawy danych", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Klienci</h1>
          <p className="text-sm text-muted-foreground">{filteredClients.length} z {clients.length} klientów</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          {isAdmin && (
            <>
              {!fixDone && (
                <Button variant="outline" size="sm" onClick={() => fixColumnsMutation.mutate()} disabled={fixColumnsMutation.isPending} data-testid="button-fix-columns">
                  <Wrench className="w-4 h-4 mr-1" /> {fixColumnsMutation.isPending ? "Naprawiam..." : "Napraw dane"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleImportCSV} data-testid="button-import-csv">
                <Upload className="w-4 h-4 mr-1" /> Importuj CSV
              </Button>
              <Button size="sm" onClick={() => setAddDialogOpen(true)} data-testid="button-add-client">
                <Plus className="w-4 h-4 mr-1" /> Dodaj klienta
              </Button>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="w-full">
            <TabsList className="w-auto">
              <TabsTrigger value="all" data-testid="tab-all">Wszyscy</TabsTrigger>
              <TabsTrigger value="gosia-premium" data-testid="tab-gosia-premium">Gosia Premium</TabsTrigger>
              <TabsTrigger value="magda-premium" data-testid="tab-magda-premium">Magda Premium</TabsTrigger>
              <TabsTrigger value="magda-standard" data-testid="tab-magda-standard">Magda Standard</TabsTrigger>
              <TabsTrigger value="weryfikacja" data-testid="tab-weryfikacja">Do weryfikacji</TabsTrigger>
              <TabsTrigger value="alert" data-testid="tab-alert">
                <AlertTriangle className="w-3 h-3 mr-1" /> Alerty
              </TabsTrigger>
            </TabsList>
          </ScrollArea>
        </Tabs>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj klienta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-clients"
          />
        </div>
        {isAdmin && (
          <>
            <Select value={filterOpiekun} onValueChange={setFilterOpiekun}>
              <SelectTrigger className="w-[140px]" data-testid="select-opiekun">
                <SelectValue placeholder="Opiekun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy</SelectItem>
                <SelectItem value="Gosia">Gosia</SelectItem>
                <SelectItem value="Magda">Magda</SelectItem>
                <SelectItem value="Weryfikacja">Weryfikacja</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSegment} onValueChange={setFilterSegment}>
              <SelectTrigger className="w-[140px]" data-testid="select-segment">
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Weryfikacja">Weryfikacja</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <Dialog open={!!selectedClient} onOpenChange={(o) => !o && setSelectedClient(null)}>
        {selectedClient && <ClientDetail client={selectedClient} onClose={() => setSelectedClient(null)} />}
      </Dialog>

      <AddClientDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onClick={() => setSelectedClient(client)}
          />
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Brak klientów</p>
          <p className="text-sm">Zmień filtry lub zaimportuj dane</p>
        </div>
      )}
    </div>
  );
}
