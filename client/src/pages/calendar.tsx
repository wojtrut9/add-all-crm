import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon, Plus, RefreshCw, ChevronLeft, ChevronRight,
  Phone, CheckCircle2, XCircle, Clock, Loader2, Users, Trash2, Pencil,
  MessageSquare, Mail, UserRound,
} from "lucide-react";
import { format, startOfWeek, addDays, isToday } from "date-fns";
import { pl } from "date-fns/locale";

const statusColors: Record<string, string> = {
  "Do zrobienia": "bg-muted text-muted-foreground",
  "W trakcie": "bg-chart-2/20 text-foreground",
  "Zamowil": "bg-chart-4/20 text-foreground",
  "Nie zamowil": "bg-destructive/20 text-foreground",
  "Zrobione": "bg-chart-5/20 text-foreground",
};

const statusDotColors: Record<string, string> = {
  "Do zrobienia": "bg-muted-foreground",
  "W trakcie": "bg-chart-2",
  "Zamowil": "bg-chart-4",
  "Nie zamowil": "bg-destructive",
  "Zrobione": "bg-chart-5",
};

function ContactFormBadge({ forma }: { forma: string | null | undefined }) {
  if (!forma) return null;
  const lower = forma.toLowerCase();
  let icon = null;
  let label = forma;
  if (lower === "telefon") {
    icon = <Phone className="w-3 h-3" />;
    label = "Telefon";
  } else if (lower === "sms") {
    icon = <MessageSquare className="w-3 h-3" />;
    label = "SMS";
  } else if (lower === "email" || lower.includes("@")) {
    icon = <Mail className="w-3 h-3" />;
    label = lower.includes("@") ? "Email" : "Email";
  } else if (lower === "wizyta") {
    icon = <UserRound className="w-3 h-3" />;
    label = "Wizyta";
  } else if (lower === "whatsapp") {
    icon = <MessageSquare className="w-3 h-3" />;
    label = "WhatsApp";
  } else {
    return null;
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 mt-1" data-testid="badge-contact-form">
      {icon}
      {label}
    </Badge>
  );
}

const meetingTypeBadge: Record<string, string> = {
  "Spotkanie": "default",
  "Alert": "destructive",
  "Z notatki": "secondary",
};

function ContactCard({ contact, onStatusChange }: { contact: any; onStatusChange: (id: number, status: string) => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(contact.status);

  const handleSave = () => {
    onStatusChange(contact.id, newStatus);
    setDialogOpen(false);
  };

  return (
    <>
      <div
        className={`p-3 rounded-md border cursor-pointer hover-elevate ${(contact.brakiZamowien || 0) >= 2 ? 'border-destructive/40' : ''}`}
        onClick={() => setDialogOpen(true)}
        data-testid={`card-contact-${contact.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{contact.clientName || "Klient"}</p>
            <p className="text-xs text-muted-foreground">{contact.typ}</p>
          </div>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${statusDotColors[contact.status] || 'bg-muted-foreground'}`} />
        </div>
        <ContactFormBadge forma={contact.preferowanaFormaKontaktu} />
        {contact.priorytet !== "Normalny" && (
          <Badge variant="destructive" className="text-xs mt-1">{contact.priorytet}</Badge>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{contact.clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-contact-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Do zrobienia">Do zrobienia</SelectItem>
                  <SelectItem value="W trakcie">W trakcie</SelectItem>
                  <SelectItem value="Zamowil">Zamowil</SelectItem>
                  <SelectItem value="Nie zamowil">Nie zamowil</SelectItem>
                  <SelectItem value="Zrobione">Zrobione</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <p className="text-sm">{contact.data}</p>
            </div>
            <div>
              <Label>Typ</Label>
              <p className="text-sm">{contact.typ} | Priorytet: {contact.priorytet}</p>
            </div>
            {contact.preferowanaFormaKontaktu && (
              <div>
                <Label>Preferowana forma kontaktu</Label>
                <div className="mt-1">
                  <ContactFormBadge forma={contact.preferowanaFormaKontaktu} />
                </div>
              </div>
            )}
            {contact.notatka && (
              <div>
                <Label>Notatka</Label>
                <p className="text-sm text-muted-foreground">{contact.notatka}</p>
              </div>
            )}
            <Button onClick={handleSave} className="w-full" data-testid="button-save-contact">
              Zapisz zmiany
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MeetingCard({ meeting, clients, onEdit }: { meeting: any; clients: any[]; onEdit: (m: any) => void }) {
  const clientName = meeting.clientId ? clients.find((c: any) => c.id === meeting.clientId)?.klient : null;
  return (
    <div
      className="p-3 rounded-md border cursor-pointer hover-elevate"
      onClick={() => onEdit(meeting)}
      data-testid={`card-meeting-${meeting.id}`}
    >
      {meeting.godzina && (
        <p className="text-xs text-muted-foreground mb-1">
          <Clock className="w-3 h-3 inline mr-1" />
          {meeting.godzina}{meeting.godzinaKoniec ? ` - ${meeting.godzinaKoniec}` : ""}
        </p>
      )}
      <p className="text-sm font-medium truncate">{meeting.tytul}</p>
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <Badge variant={meetingTypeBadge[meeting.typ] as any || "outline"} className="text-xs">{meeting.typ}</Badge>
        <Badge variant="outline" className="text-xs">{meeting.status}</Badge>
      </div>
      {clientName && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Users className="w-3 h-3" />{clientName}
        </p>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [mainTab, setMainTab] = useState("kontakty");
  const [activeView, setActiveView] = useState("week");

  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<any>(null);
  const [meetingForm, setMeetingForm] = useState({
    tytul: "", opis: "", data: "", godzina: "", godzinaKoniec: "", clientId: "", typ: "Spotkanie", status: "Zaplanowane",
  });

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/contacts", weekOffset],
    queryFn: async () => {
      const from = format(weekDays[0], "yyyy-MM-dd");
      const to = format(weekDays[4], "yyyy-MM-dd");
      const res = await authFetch(`/api/contacts?from=${from}&to=${to}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: meetingsData = [] } = useQuery({
    queryKey: ["/api/meetings", weekOffset],
    queryFn: async () => {
      const from = format(weekDays[0], "yyyy-MM-dd");
      const to = format(weekDays[4], "yyyy-MM-dd");
      const res = await authFetch(`/api/meetings?from=${from}&to=${to}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await authFetch("/api/clients");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/contacts/generate-week", {
        method: "POST",
        body: JSON.stringify({ weekStart: format(weekStart, "yyyy-MM-dd") }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Plan wygenerowany", description: `Utworzono ${data.count} kontaktow` });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
    },
    onError: () => {
      toast({ title: "Blad generowania", variant: "destructive" });
    },
  });

  const updateContactStatus = async (id: number, status: string) => {
    try {
      await authFetch(`/api/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast({ title: "Zaktualizowano" });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] });
    } catch {
      toast({ title: "Blad aktualizacji", variant: "destructive" });
    }
  };

  const saveMeetingMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        ...meetingForm,
        autor: user?.imie || "System",
        clientId: meetingForm.clientId ? parseInt(meetingForm.clientId) : null,
      };
      if (!body.godzina) body.godzina = null;
      if (!body.godzinaKoniec) body.godzinaKoniec = null;
      if (!body.opis) body.opis = null;

      if (editingMeeting) {
        const res = await authFetch(`/api/meetings/${editingMeeting.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed");
        return res.json();
      } else {
        const res = await authFetch("/api/meetings", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed");
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: editingMeeting ? "Spotkanie zaktualizowane" : "Spotkanie dodane" });
      setMeetingDialogOpen(false);
      setEditingMeeting(null);
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
    },
    onError: () => {
      toast({ title: "Blad zapisu", variant: "destructive" });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/api/meetings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Spotkanie usunięte" });
      setMeetingDialogOpen(false);
      setEditingMeeting(null);
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
    },
  });

  const openAddMeeting = () => {
    setEditingMeeting(null);
    setMeetingForm({ tytul: "", opis: "", data: format(weekDays[0], "yyyy-MM-dd"), godzina: "", godzinaKoniec: "", clientId: "", typ: "Spotkanie", status: "Zaplanowane" });
    setMeetingDialogOpen(true);
  };

  const openEditMeeting = (m: any) => {
    setEditingMeeting(m);
    setMeetingForm({
      tytul: m.tytul,
      opis: m.opis || "",
      data: m.data,
      godzina: m.godzina || "",
      godzinaKoniec: m.godzinaKoniec || "",
      clientId: m.clientId ? String(m.clientId) : "",
      typ: m.typ,
      status: m.status,
    });
    setMeetingDialogOpen(true);
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayContacts = contacts.filter((c: any) => c.data === todayStr);
  const dayNames = ["Poniedzialek", "Wtorek", "Sroda", "Czwartek", "Piatek"];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  const weekNav = (
    <div className="flex items-center justify-between mb-4">
      <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)} data-testid="button-prev-week">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="text-center">
        <p className="font-medium">
          {format(weekDays[0], "d MMM", { locale: pl })} - {format(weekDays[4], "d MMM yyyy", { locale: pl })}
        </p>
      </div>
      <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)} data-testid="button-next-week">
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Kalendarz</h1>
        <div className="flex items-center gap-2">
          {mainTab === "kontakty" && (
            <Button
              onClick={() => setConfirmGenerate(true)}
              disabled={generateMutation.isPending}
              data-testid="button-generate-week"
            >
              {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Generuj plan na tydzien
            </Button>
          )}
          {mainTab === "spotkania" && (
            <Button onClick={openAddMeeting} data-testid="button-add-meeting">
              <Plus className="w-4 h-4 mr-1" /> Dodaj spotkanie
            </Button>
          )}
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="kontakty" data-testid="tab-kontakty">Kontakty</TabsTrigger>
          <TabsTrigger value="spotkania" data-testid="tab-spotkania">Spotkania</TabsTrigger>
        </TabsList>

        <TabsContent value="kontakty" className="mt-4">
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList>
              <TabsTrigger value="week" data-testid="tab-week">Tydzien</TabsTrigger>
              <TabsTrigger value="today" data-testid="tab-today">Moj dzien</TabsTrigger>
            </TabsList>

            <TabsContent value="week" className="mt-4">
              {weekNav}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {weekDays.map((day, i) => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const dayContacts = contacts.filter((c: any) => c.data === dayStr);
                  const isCurrentDay = isToday(day);
                  return (
                    <Card key={dayStr} className={isCurrentDay ? 'ring-2 ring-primary' : ''}>
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-center justify-between gap-1">
                          <CardTitle className="text-sm">{dayNames[i]}</CardTitle>
                          <Badge variant="secondary" className="text-xs">{dayContacts.length}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{format(day, "d.MM")}</p>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        {dayContacts.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">Brak kontaktow</p>
                        )}
                        {dayContacts.map((c: any) => (
                          <ContactCard key={c.id} contact={c} onStatusChange={updateContactStatus} />
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="today" className="mt-4">
              <h2 className="text-lg font-semibold mb-4">Kontakty na dzisiaj ({todayContacts.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {["Do zrobienia", "W trakcie", "Zamowil", "Nie zamowil", "Zrobione"].map((status) => {
                  const statusContacts = todayContacts.filter((c: any) => c.status === status);
                  return (
                    <div key={status}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusDotColors[status]}`} />
                        <p className="text-sm font-medium">{status}</p>
                        <Badge variant="secondary" className="text-xs">{statusContacts.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {statusContacts.map((c: any) => (
                          <ContactCard key={c.id} contact={c} onStatusChange={updateContactStatus} />
                        ))}
                        {statusContacts.length === 0 && (
                          <div className="border-2 border-dashed rounded-md p-4 text-center">
                            <p className="text-xs text-muted-foreground">Pusty</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="spotkania" className="mt-4">
          {weekNav}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {weekDays.map((day, i) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const dayMeetings = meetingsData.filter((m: any) => m.data === dayStr);
              const isCurrentDay = isToday(day);
              return (
                <Card key={dayStr} className={isCurrentDay ? 'ring-2 ring-primary' : ''}>
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-sm">{dayNames[i]}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{dayMeetings.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(day, "d.MM")}</p>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    {dayMeetings.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Brak spotkan</p>
                    )}
                    {dayMeetings.map((m: any) => (
                      <MeetingCard key={m.id} meeting={m} clients={clients} onEdit={openEditMeeting} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Legenda statusow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusDotColors).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-sm">{status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMeeting ? "Edytuj spotkanie" : "Nowe spotkanie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tytuł</Label>
              <Input value={meetingForm.tytul} onChange={(e) => setMeetingForm({ ...meetingForm, tytul: e.target.value })} data-testid="input-meeting-title" />
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea value={meetingForm.opis} onChange={(e) => setMeetingForm({ ...meetingForm, opis: e.target.value })} rows={3} data-testid="input-meeting-opis" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={meetingForm.data} onChange={(e) => setMeetingForm({ ...meetingForm, data: e.target.value })} data-testid="input-meeting-date" />
              </div>
              <div>
                <Label>Godzina od</Label>
                <Input type="time" value={meetingForm.godzina} onChange={(e) => setMeetingForm({ ...meetingForm, godzina: e.target.value })} data-testid="input-meeting-time" />
              </div>
              <div>
                <Label>Godzina do</Label>
                <Input type="time" value={meetingForm.godzinaKoniec} onChange={(e) => setMeetingForm({ ...meetingForm, godzinaKoniec: e.target.value })} data-testid="input-meeting-time-end" />
              </div>
            </div>
            <div>
              <Label>Klient (opcjonalnie)</Label>
              <Select value={meetingForm.clientId || "none"} onValueChange={(v) => setMeetingForm({ ...meetingForm, clientId: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-meeting-client">
                  <SelectValue placeholder="Wybierz klienta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.klient}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={meetingForm.typ} onValueChange={(v) => setMeetingForm({ ...meetingForm, typ: v })}>
                  <SelectTrigger data-testid="select-meeting-typ">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spotkanie">Spotkanie</SelectItem>
                    <SelectItem value="Alert">Alert</SelectItem>
                    <SelectItem value="Z notatki">Z notatki</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingMeeting && (
                <div>
                  <Label>Status</Label>
                  <Select value={meetingForm.status} onValueChange={(v) => setMeetingForm({ ...meetingForm, status: v })}>
                    <SelectTrigger data-testid="select-meeting-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Zaplanowane">Zaplanowane</SelectItem>
                      <SelectItem value="Odbyte">Odbyte</SelectItem>
                      <SelectItem value="Anulowane">Anulowane</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingMeeting && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-meeting">
                    <Trash2 className="w-4 h-4 mr-1" /> Usuń
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Usunąć spotkanie?</AlertDialogTitle>
                    <AlertDialogDescription>Spotkanie "{editingMeeting.tytul}" zostanie trwale usunięte.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMeetingMutation.mutate(editingMeeting.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Usuń
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={() => saveMeetingMutation.mutate()} disabled={!meetingForm.tytul || !meetingForm.data || saveMeetingMutation.isPending} data-testid="button-save-meeting">
              {saveMeetingMutation.isPending ? "Zapisuję..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generowanie planu na tydzien</AlertDialogTitle>
            <AlertDialogDescription>
              Generowanie nowego planu usunie TYLKO niezrealizowane kontakty (status &quot;Do zrobienia&quot;) za wybrany tydzien i utworzy nowe. Kontakty ze statusami &quot;Zamowil&quot;, &quot;Nie zamowil&quot; itp. pozostana bez zmian. Kontynuowac?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-generate">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmGenerate(false);
                generateMutation.mutate();
              }}
              data-testid="button-confirm-generate"
            >
              Generuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
