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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon, Plus, RefreshCw, ChevronLeft, ChevronRight,
  Phone, CheckCircle2, XCircle, Clock, Loader2,
} from "lucide-react";
import { format, startOfWeek, addDays, isToday, parseISO } from "date-fns";
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

function ContactCard({ contact, onStatusChange }: { contact: any; onStatusChange: (id: number, status: string, kwota?: string) => void }) {
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

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeView, setActiveView] = useState("week");

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
    },
    onError: () => {
      toast({ title: "Blad generowania", variant: "destructive" });
    },
  });

  const updateContactStatus = async (id: number, status: string, kwota?: string) => {
    try {
      await authFetch(`/api/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, kwota }),
      });
      if (status === "Zamowil" && (!kwota || Number(kwota) === 0)) {
        toast({ title: "Uwaga", description: "Zamowienie bez kwoty \u2014 dostawa zostanie utworzona z kwota 0 PLN. Mozesz ja zaktualizowac pozniej." });
      } else {
        toast({ title: "Zaktualizowano" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] });
    } catch {
      toast({ title: "Blad aktualizacji", variant: "destructive" });
    }
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

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Kalendarz kontaktow</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-week"
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Generuj plan na tydzien
          </Button>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="week" data-testid="tab-week">Tydzien</TabsTrigger>
          <TabsTrigger value="today" data-testid="tab-today">Moj dzien</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-4">
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
    </div>
  );
}
