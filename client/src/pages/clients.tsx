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
import { Switch } from "@/components/ui/switch";
import {
  Search, Download, Upload, Plus, AlertTriangle, Phone,
  MapPin, Users, Pencil, Save, X, Trash2, Wrench, StickyNote,
  Building2, CreditCard, UserPlus, Star, Mail, Package, PackagePlus,
} from "lucide-react";
import type { Client, ClientContact, ClientProduct } from "@shared/schema";

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
          <Badge variant="secondary" className={`text-xs border-transparent ${client.segment === "Premium" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : client.segment === "Standard" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "bg-[#e6e6e6] text-[#0f0f0f] dark:bg-neutral-700 dark:text-neutral-200"}`}>
            {client.segment}
          </Badge>
          <Badge variant={client.aktywny ? "outline" : "secondary"} className={`text-xs ${!client.aktywny ? "bg-[#e6e6e6] text-[#0f0f0f] border-transparent" : ""}`}>
            {client.status}
          </Badge>
          {(client as any).przekazany && (
            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-transparent">
              Przekazany
            </Badge>
          )}
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

function EditField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function ContactPersonCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: ClientContact;
  onEdit: (c: ClientContact) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{contact.imie}</p>
          {contact.isPrimary && (
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-transparent">
              <Star className="w-2.5 h-2.5 mr-1" /> Główny
            </Badge>
          )}
          {contact.rola && <Badge variant="outline" className="text-xs">{contact.rola}</Badge>}
        </div>
        <div className="flex flex-col gap-0.5 mt-1">
          {contact.telefon && (
            <a href={`tel:${contact.telefon}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
              <Phone className="w-3 h-3" /> {contact.telefon}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
              <Mail className="w-3 h-3" /> {contact.email}
            </a>
          )}
          {contact.notatka && <p className="text-xs text-muted-foreground mt-1 italic">{contact.notatka}</p>}
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(contact)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(contact.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ContactPersonForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<ClientContact>;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState({
    imie: initial?.imie || "",
    rola: initial?.rola || "",
    telefon: initial?.telefon || "",
    email: initial?.email || "",
    notatka: initial?.notatka || "",
    isPrimary: initial?.isPrimary || false,
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3 p-3 rounded-md border bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Imię i nazwisko *</Label>
          <Input value={form.imie} onChange={e => set("imie", e.target.value)} placeholder="Jan Kowalski" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rola</Label>
          <Input value={form.rola} onChange={e => set("rola", e.target.value)} placeholder="np. Manager, Księgowość" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefon</Label>
          <Input value={form.telefon} onChange={e => set("telefon", e.target.value)} placeholder="+48 600 000 000" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="jan@firma.pl" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notatka</Label>
        <Input value={form.notatka} onChange={e => set("notatka", e.target.value)} placeholder="Dodatkowe informacje..." />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.isPrimary} onCheckedChange={v => set("isPrimary", v)} id="is-primary" />
        <Label htmlFor="is-primary" className="text-xs cursor-pointer">Główna osoba kontaktowa</Label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" /> Anuluj</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.imie.trim() || saving}>
          <Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Zapisuję..." : "Zapisz"}
        </Button>
      </div>
    </div>
  );
}

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);

  const { data: clientNotes = [] } = useQuery({
    queryKey: ["/api/notes", "client", client.id],
    queryFn: async () => {
      const res = await authFetch("/api/notes");
      if (!res.ok) return [];
      const allNotes = await res.json();
      return allNotes.filter((n: any) => n.clientId === client.id);
    },
  });

  const { data: contactPersons = [], refetch: refetchContacts } = useQuery<ClientContact[]>({
    queryKey: ["/api/clients", client.id, "contacts"],
    queryFn: async () => {
      const res = await authFetch(`/api/clients/${client.id}/contacts`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: productList = [], refetch: refetchProducts } = useQuery<ClientProduct[]>({
    queryKey: ["/api/clients", client.id, "products"],
    queryFn: async () => {
      const res = await authFetch(`/api/clients/${client.id}/products`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [newProductName, setNewProductName] = useState("");
  const [newProductNote, setNewProductNote] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const addProductMutation = useMutation({
    mutationFn: async (data: { nazwa: string; notatka?: string }) => {
      const res = await authFetch(`/api/clients/${client.id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Błąd");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dodano produkt" });
      refetchProducts();
      setNewProductName("");
      setNewProductNote("");
      setAddingProduct(false);
    },
    onError: () => toast({ title: "Błąd zapisu", variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/api/clients/${client.id}/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Błąd");
    },
    onSuccess: () => { toast({ title: "Usunięto produkt" }); refetchProducts(); },
    onError: () => toast({ title: "Błąd usuwania", variant: "destructive" }),
  });

  const przekazanyMutation = useMutation({
    mutationFn: async (val: boolean) => {
      return apiRequest("PATCH", `/api/clients/${client.id}`, { przekazany: val });
    },
    onSuccess: (_res: any, val: boolean) => {
      toast({ title: val ? "Klient oznaczony jako przekazany" : "Oznaczenie przekazany usunięte" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: () => toast({ title: "Błąd zapisu", variant: "destructive" }),
  });

  const [form, setForm] = useState({
    klient: client.klient,
    pelnaFirmaNazwa: (client as any).pelnaFirmaNazwa || "",
    opiekun: client.opiekun,
    segment: client.segment,
    grupaMvp: client.grupaMvp || "",
    status: client.status,
    nip: (client as any).nip || "",
    adres: (client as any).adres || "",
    kodPocztowy: (client as any).kodPocztowy || "",
    miasto: client.miasto || "",
    kraj: client.kraj || "",
    telefon: client.telefon || "",
    telefonDodatkowy: client.telefonDodatkowy || "",
    email: client.email || "",
    emailDodatkowe: client.emailDodatkowe || "",
    preferowanaFormaKontaktu: client.preferowanaFormaKontaktu || "",
    zamowieniaGdzie: client.zamowieniaGdzie || "",
    dniZamowien: client.dniZamowien || "",
    rytmKontaktu: client.rytmKontaktu || "",
    rabatProcent: client.rabatProcent ? String(client.rabatProcent) : "",
    warunkiPlatnosci: client.warunkiPlatnosci || "",
    terminPlatnosciDni: client.terminPlatnosciDni ? String(client.terminPlatnosciDni) : "",
    limitKredytowy: client.limitKredytowy ? String(client.limitKredytowy) : "",
    ubezpieczenieStatus: client.ubezpieczenieStatus || "",
    osobaKontaktowa: client.osobaKontaktowa || "",
    notatki: client.notatki || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/clients/${client.id}`, data),
    onSuccess: (_res: any, variables: any) => {
      toast({ title: "Zapisano zmiany" });
      if (variables.dniZamowien !== undefined && variables.dniZamowien !== (client.dniZamowien || null)) {
        toast({ title: "Dni zamówień zmienione", description: "Wygeneruj plan na tydzień, aby zobaczyć zmiany w kalendarzu." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditing(false);
    },
    onError: () => toast({ title: "Błąd zapisu", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/clients/${client.id}`),
    onSuccess: () => {
      toast({ title: `Usunięto klienta ${client.klient}` });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onClose();
    },
    onError: () => toast({ title: "Błąd usuwania klienta", variant: "destructive" }),
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await authFetch(`/api/clients/${client.id}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Błąd");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Dodano osobę kontaktową" }); refetchContacts(); setAddingContact(false); },
    onError: () => toast({ title: "Błąd zapisu", variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await authFetch(`/api/clients/${client.id}/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Błąd");
    },
    onSuccess: () => { toast({ title: "Zaktualizowano kontakt" }); refetchContacts(); setEditingContact(null); },
    onError: () => toast({ title: "Błąd zapisu", variant: "destructive" }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/api/clients/${client.id}/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Błąd");
    },
    onSuccess: () => { toast({ title: "Usunięto kontakt" }); refetchContacts(); },
    onError: () => toast({ title: "Błąd usuwania", variant: "destructive" }),
  });

  const handleSave = () => {
    updateMutation.mutate({
      klient: form.klient,
      pelnaFirmaNazwa: form.pelnaFirmaNazwa || null,
      opiekun: form.opiekun,
      segment: form.segment,
      grupaMvp: form.grupaMvp || null,
      status: form.status,
      nip: form.nip || null,
      adres: form.adres || null,
      kodPocztowy: form.kodPocztowy || null,
      telefon: form.telefon || null,
      telefonDodatkowy: form.telefonDodatkowy || null,
      email: form.email || null,
      emailDodatkowe: form.emailDodatkowe || null,
      preferowanaFormaKontaktu: form.preferowanaFormaKontaktu || null,
      zamowieniaGdzie: form.zamowieniaGdzie || null,
      dniZamowien: form.dniZamowien || null,
      rytmKontaktu: form.rytmKontaktu || null,
      miasto: form.miasto || null,
      kraj: form.kraj || null,
      rabatProcent: form.rabatProcent ? Number(form.rabatProcent) : null,
      warunkiPlatnosci: form.warunkiPlatnosci || null,
      terminPlatnosciDni: form.terminPlatnosciDni ? Number(form.terminPlatnosciDni) : null,
      limitKredytowy: form.limitKredytowy ? Number(form.limitKredytowy) : null,
      ubezpieczenieStatus: form.ubezpieczenieStatus || null,
      osobaKontaktowa: form.osobaKontaktowa || null,
      notatki: form.notatki || null,
    });
  };

  const setField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const isAdmin = user?.rola === "admin";

  if (editing) {
    return (
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edytuj klienta — {client.klient}</DialogTitle></DialogHeader>
        <Tabs defaultValue="firma">
          <TabsList className="w-full">
            <TabsTrigger value="firma" className="flex-1"><Building2 className="w-3.5 h-3.5 mr-1" />Firma</TabsTrigger>
            <TabsTrigger value="handlowe" className="flex-1"><CreditCard className="w-3.5 h-3.5 mr-1" />Handlowe</TabsTrigger>
            <TabsTrigger value="notatki" className="flex-1"><StickyNote className="w-3.5 h-3.5 mr-1" />Notatki</TabsTrigger>
          </TabsList>
          <TabsContent value="firma" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditField label="Nazwa skrócona *" value={form.klient} onChange={(v) => setField("klient", v)} />
              <EditField label="Pełna nazwa firmy" value={form.pelnaFirmaNazwa} onChange={(v) => setField("pelnaFirmaNazwa", v)} placeholder="np. FIRMA SP. Z O.O." />
              <EditField label="NIP" value={form.nip} onChange={(v) => setField("nip", v)} placeholder="np. 1234567890" />
              <EditField label="Adres (ulica)" value={form.adres} onChange={(v) => setField("adres", v)} placeholder="ul. Przykładowa 1" />
              <EditField label="Kod pocztowy" value={form.kodPocztowy} onChange={(v) => setField("kodPocztowy", v)} placeholder="00-000" />
              <EditField label="Miasto" value={form.miasto} onChange={(v) => setField("miasto", v)} />
              <EditField label="Kraj" value={form.kraj} onChange={(v) => setField("kraj", v)} />
              <EditField label="Ubezpieczenie" value={form.ubezpieczenieStatus} onChange={(v) => setField("ubezpieczenieStatus", v)} />
            </div>
          </TabsContent>
          <TabsContent value="handlowe" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField label="Opiekun" value={form.opiekun} onChange={(v) => setField("opiekun", v)} options={OPIEKUN_OPTIONS} />
              <SelectField label="Segment" value={form.segment} onChange={(v) => setField("segment", v)} options={SEGMENT_OPTIONS} />
              <SelectField label="Grupa MVP" value={form.grupaMvp} onChange={(v) => setField("grupaMvp", v)} options={GRUPA_OPTIONS} />
              <SelectField label="Status" value={form.status} onChange={(v) => setField("status", v)} options={STATUS_OPTIONS} />
              <EditField label="Dni zamówień" value={form.dniZamowien} onChange={(v) => setField("dniZamowien", v)} />
              <SelectField label="Rytm kontaktu" value={form.rytmKontaktu} onChange={(v) => setField("rytmKontaktu", v)} options={RYTM_OPTIONS} />
              <EditField label="Preferowana forma kontaktu" value={form.preferowanaFormaKontaktu} onChange={(v) => setField("preferowanaFormaKontaktu", v)} />
              <EditField label="Zamówienia gdzie" value={form.zamowieniaGdzie} onChange={(v) => setField("zamowieniaGdzie", v)} />
              <EditField label="Telefon" value={form.telefon} onChange={(v) => setField("telefon", v)} />
              <EditField label="Telefon dodatkowy" value={form.telefonDodatkowy} onChange={(v) => setField("telefonDodatkowy", v)} />
              <EditField label="Email" value={form.email} onChange={(v) => setField("email", v)} />
              <EditField label="Email dodatkowe" value={form.emailDodatkowe} onChange={(v) => setField("emailDodatkowe", v)} />
              <EditField label="Rabat %" value={form.rabatProcent} onChange={(v) => setField("rabatProcent", v)} type="number" />
              <EditField label="Warunki płatności" value={form.warunkiPlatnosci} onChange={(v) => setField("warunkiPlatnosci", v)} />
              <EditField label="Termin płatności (dni)" value={form.terminPlatnosciDni} onChange={(v) => setField("terminPlatnosciDni", v)} type="number" />
              <EditField label="Limit kredytowy" value={form.limitKredytowy} onChange={(v) => setField("limitKredytowy", v)} type="number" />
            </div>
          </TabsContent>
          <TabsContent value="notatki" className="pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Notatki</Label>
              <Textarea value={form.notatki} onChange={(e) => setField("notatki", e.target.value)} className="resize-none" rows={8} />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" /> Anuluj</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="w-4 h-4 mr-1" /> {updateMutation.isPending ? "Zapisuję..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <DialogTitle className="flex items-center gap-2">
              {client.klient}
              <Badge variant={client.segment === "Premium" ? "default" : "secondary"}>{client.segment}</Badge>
            </DialogTitle>
            {(client as any).pelnaFirmaNazwa && (
              <p className="text-xs text-muted-foreground mt-0.5">{(client as any).pelnaFirmaNazwa}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Edytuj
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-1" /> Usuń</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Usunąć klienta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Klient <strong>{client.klient}</strong> zostanie trwale usunięty.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleteMutation.isPending ? "Usuwam..." : "Usuń klienta"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </DialogHeader>

      <Tabs defaultValue="firma">
        <TabsList className="w-full">
          <TabsTrigger value="firma" className="flex-1"><Building2 className="w-3.5 h-3.5 mr-1" />Firma</TabsTrigger>
          <TabsTrigger value="kontakty" className="flex-1">
            <Users className="w-3.5 h-3.5 mr-1" />Kontakty
            {contactPersons.length > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5">{contactPersons.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="produkty" className="flex-1">
            <Package className="w-3.5 h-3.5 mr-1" />Produkty
            {productList.length > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5">{productList.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="handlowe" className="flex-1"><CreditCard className="w-3.5 h-3.5 mr-1" />Handlowe</TabsTrigger>
          <TabsTrigger value="notatki" className="flex-1"><StickyNote className="w-3.5 h-3.5 mr-1" />Notatki</TabsTrigger>
        </TabsList>

        {/* DANE FIRMY */}
        <TabsContent value="firma" className="space-y-4 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow label="ID klienta" value={client.clientId} />
            <InfoRow label="NIP" value={(client as any).nip || "-"} />
            {(client as any).adres && <InfoRow label="Adres" value={(client as any).adres} />}
            {(client as any).kodPocztowy && <InfoRow label="Kod pocztowy" value={(client as any).kodPocztowy} />}
            {client.miasto && <InfoRow label="Miasto" value={client.miasto} />}
            {client.kraj && <InfoRow label="Kraj" value={client.kraj} />}
            {client.ubezpieczenieStatus && <InfoRow label="Ubezpieczenie" value={client.ubezpieczenieStatus} />}
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border">
            <div>
              <p className="text-sm font-medium">Klient przekazany</p>
              <p className="text-xs text-muted-foreground">Oznacz klienta jako przekazanego</p>
            </div>
            <Switch checked={(client as any).przekazany || false} onCheckedChange={(val) => przekazanyMutation.mutate(val)} />
          </div>
        </TabsContent>

        {/* KONTAKTY */}
        <TabsContent value="kontakty" className="space-y-3 pt-3">
          {contactPersons.length === 0 && !addingContact && (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Brak osób kontaktowych</p>
            </div>
          )}
          <div className="space-y-2">
            {contactPersons.map(cp => (
              editingContact?.id === cp.id
                ? <ContactPersonForm key={cp.id} initial={cp} saving={updateContactMutation.isPending}
                    onSave={(data) => updateContactMutation.mutate({ id: cp.id, data })}
                    onCancel={() => setEditingContact(null)} />
                : <ContactPersonCard key={cp.id} contact={cp}
                    onEdit={(c) => setEditingContact(c)}
                    onDelete={(id) => deleteContactMutation.mutate(id)} />
            ))}
          </div>
          {addingContact
            ? <ContactPersonForm saving={addContactMutation.isPending} onSave={(data) => addContactMutation.mutate(data)} onCancel={() => setAddingContact(false)} />
            : (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingContact(true)}>
                <UserPlus className="w-4 h-4 mr-1" /> Dodaj osobę kontaktową
              </Button>
            )
          }
        </TabsContent>

        {/* PRODUKTY INDYWIDUALNE */}
        <TabsContent value="produkty" className="space-y-3 pt-3">
          {productList.length === 0 && !addingProduct && (
            <div className="text-center py-6 text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Brak produktów indywidualnych</p>
            </div>
          )}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {productList.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md border bg-card text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.nazwa}</p>
                  {p.notatka && <p className="text-xs text-muted-foreground mt-0.5">{p.notatka}</p>}
                </div>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                  onClick={() => deleteProductMutation.mutate(p.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          {addingProduct ? (
            <div className="space-y-2 p-3 rounded-md border bg-muted/30">
              <div className="space-y-1">
                <Label className="text-xs">Nazwa produktu *</Label>
                <Input
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  placeholder="np. Pojemnik prostokątny hot 900ml"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notatka (opcjonalnie)</Label>
                <Input
                  value={newProductNote}
                  onChange={e => setNewProductNote(e.target.value)}
                  placeholder="np. zamawia co tydzień"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setAddingProduct(false); setNewProductName(""); setNewProductNote(""); }}>
                  <X className="w-3.5 h-3.5 mr-1" /> Anuluj
                </Button>
                <Button size="sm"
                  disabled={!newProductName.trim() || addProductMutation.isPending}
                  onClick={() => addProductMutation.mutate({ nazwa: newProductName.trim(), notatka: newProductNote.trim() || undefined })}
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> {addProductMutation.isPending ? "Zapisuję..." : "Dodaj"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingProduct(true)}>
              <PackagePlus className="w-4 h-4 mr-1" /> Dodaj produkt
            </Button>
          )}
        </TabsContent>

        {/* HANDLOWE */}
        <TabsContent value="handlowe" className="space-y-3 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow label="Opiekun" value={client.opiekun} />
            <InfoRow label="Grupa MVP" value={client.grupaMvp || "-"} />
            <InfoRow label="Status" value={client.status} />
            <InfoRow label="Rytm kontaktu" value={client.rytmKontaktu || "-"} />
            <InfoRow label="Dni zamówień" value={client.dniZamowien || "-"} />
            <InfoRow label="Zamówienia gdzie" value={client.zamowieniaGdzie || "-"} />
            <InfoRow label="Forma kontaktu" value={client.preferowanaFormaKontaktu || "-"} />
            <InfoRow label="Telefon" value={client.telefon || "-"} />
            <InfoRow label="Email" value={client.email || "-"} />
            <InfoRow label="Rabat %" value={client.rabatProcent ? `${client.rabatProcent}%` : "-"} />
            <InfoRow label="Warunki płatności" value={client.warunkiPlatnosci || "-"} />
            <InfoRow label="Termin płatności" value={client.terminPlatnosciDni ? `${client.terminPlatnosciDni} dni` : "-"} />
            <InfoRow label="Limit kredytowy" value={client.limitKredytowy ? `${Number(client.limitKredytowy).toLocaleString("pl-PL")} PLN` : "-"} />
            <InfoRow label="Braki zamówień" value={String(client.brakiZamowien || 0)} alert={(client.brakiZamowien || 0) >= 2} />
          </div>
        </TabsContent>

        {/* NOTATKI */}
        <TabsContent value="notatki" className="space-y-3 pt-3">
          {client.notatki ? (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-md max-h-48 overflow-y-auto">
              {client.notatki}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Brak notatek</p>
          )}
          {clientNotes.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <StickyNote className="w-4 h-4" /> Notatki powiązane ({clientNotes.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {clientNotes.map((note: any) => (
                  <div key={note.id} className="p-2 rounded-md bg-muted/50 border">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{note.tytul}</p>
                      <Badge variant="outline" className="text-xs">{note.kategoria}</Badge>
                    </div>
                    {note.tresc && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{note.tresc}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
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
    nip: "",
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
      osobaKontaktowa: "", notatki: "", nip: "",
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
            <EditField label="NIP (iBiznes sync)" value={form.nip} onChange={(v) => setField("nip", v)} placeholder="np. 1234567890" />
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
  const [filterPrzekazany, setFilterPrzekazany] = useState("all");
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

  const isHandlowiec = user?.rola === "handlowiec";
  const availableGrupy = Array.from(
    new Set(
      clients
        .filter(c => isHandlowiec ? c.opiekun === user?.imie : true)
        .map(c => c.grupaMvp)
        .filter(Boolean) as string[]
    )
  ).sort();

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
    if (filterPrzekazany === "tak" && !(c as any).przekazany) return false;
    if (filterPrzekazany === "nie" && (c as any).przekazany) return false;

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
        const parts = [];
        if (data.created) parts.push(`Nowi: ${data.created}`);
        if (data.updated) parts.push(`Zaktualizowano: ${data.updated}`);
        if (data.skipped) parts.push(`Bez zmian: ${data.skipped}`);
        toast({
          title: "Import zakończony",
          description: parts.join(" · "),
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
            </>
          )}
          <Button size="sm" onClick={() => setAddDialogOpen(true)} data-testid="button-add-client">
            <Plus className="w-4 h-4 mr-1" /> Dodaj klienta
          </Button>
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
        <Select value={filterGrupa} onValueChange={setFilterGrupa}>
          <SelectTrigger className="w-[180px]" data-testid="select-grupa">
            <SelectValue placeholder="Grupa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie grupy</SelectItem>
            {availableGrupy.map(g => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPrzekazany} onValueChange={setFilterPrzekazany}>
          <SelectTrigger className="w-[160px]" data-testid="select-przekazany">
            <SelectValue placeholder="Przekazany" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy</SelectItem>
            <SelectItem value="tak">Tylko przekazani</SelectItem>
            <SelectItem value="nie">Tylko nieprzekazani</SelectItem>
          </SelectContent>
        </Select>
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
