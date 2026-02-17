import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, StickyNote, Calendar, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function NotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterKategoria, setFilterKategoria] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [newNote, setNewNote] = useState({ tytul: "", tresc: "", kategoria: "Inna", tagi: "", clientId: "", dataSpotkania: "", godzinaSpotkania: "" });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["/api/notes"],
    queryFn: async () => {
      const res = await authFetch("/api/notes");
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

  const addMutation = useMutation({
    mutationFn: async () => {
      const body: any = { ...newNote, autor: user?.imie || "System" };
      if (body.clientId) body.clientId = parseInt(body.clientId);
      else body.clientId = null;
      const res = await authFetch("/api/notes", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Notatka dodana" });
      setAddDialogOpen(false);
      setNewNote({ tytul: "", tresc: "", kategoria: "Inna", tagi: "", clientId: "", dataSpotkania: "", godzinaSpotkania: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingNote) return;
      const body: any = { ...editingNote };
      delete body.id;
      delete body.createdAt;
      delete body.autor;
      if (body.clientId) body.clientId = parseInt(body.clientId);
      else body.clientId = null;
      const res = await authFetch(`/api/notes/${editingNote.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Notatka zaktualizowana" });
      setEditDialogOpen(false);
      setEditingNote(null);
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Notatka usunięta" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

  const getClientName = (clientId: number | null) => {
    if (!clientId) return null;
    const client = clients.find((c: any) => c.id === clientId);
    return client?.klient || null;
  };

  const filteredNotes = notes.filter((n: any) => {
    if (search) {
      const s = search.toLowerCase();
      if (!n.tytul.toLowerCase().includes(s) && !(n.tresc || "").toLowerCase().includes(s)) return false;
    }
    if (filterKategoria !== "all" && n.kategoria !== filterKategoria) return false;
    if (filterClient !== "all" && String(n.clientId) !== filterClient) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const kategoriaColors: Record<string, string> = {
    Klient: "default",
    Produkt: "secondary",
    Spotkanie: "outline",
    Proces: "secondary",
    Finanse: "destructive",
    Inna: "outline",
  };

  const openEdit = (note: any) => {
    setEditingNote({
      id: note.id,
      tytul: note.tytul,
      tresc: note.tresc || "",
      kategoria: note.kategoria,
      tagi: note.tagi || "",
      clientId: note.clientId ? String(note.clientId) : "",
    });
    setEditDialogOpen(true);
  };

  const clientsWithNotes = clients.filter((c: any) => notes.some((n: any) => n.clientId === c.id));

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Notatki</h1>
        <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-note">
          <Plus className="w-4 h-4 mr-1" /> Dodaj notatke
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Szukaj notatki..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-notes" />
        </div>
        <Select value={filterKategoria} onValueChange={setFilterKategoria}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Kategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="Klient">Klient</SelectItem>
            <SelectItem value="Produkt">Produkt</SelectItem>
            <SelectItem value="Spotkanie">Spotkanie</SelectItem>
            <SelectItem value="Proces">Proces</SelectItem>
            <SelectItem value="Finanse">Finanse</SelectItem>
            <SelectItem value="Inna">Inna</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Klient" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy klienci</SelectItem>
            {clientsWithNotes.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.klient}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredNotes.map((note: any) => (
          <Card key={note.id} className="hover-elevate" data-testid={`card-note-${note.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-sm">{note.tytul}</h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge variant={kategoriaColors[note.kategoria] as any || "outline"} className="text-xs">{note.kategoria}</Badge>
                </div>
              </div>
              {note.clientId && (
                <Badge variant="outline" className="text-xs mb-2">{getClientName(note.clientId) || "Klient"}</Badge>
              )}
              {note.tresc && (
                <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{note.tresc}</p>
              )}
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{note.autor}</span>
                <div className="flex items-center gap-1">
                  {note.createdAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(note.createdAt), "d MMM yyyy", { locale: pl })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 justify-end">
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(note); }} data-testid={`button-edit-note-${note.id}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-delete-note-${note.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Czy na pewno chcesz usunąć tę notatkę?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Notatka "{note.tytul}" zostanie trwale usunięta.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anuluj</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(note.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Usuń
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredNotes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Brak notatek</p>
          <p className="text-sm">Dodaj pierwsza notatke</p>
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowa notatka</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tytul</Label>
              <Input value={newNote.tytul} onChange={(e) => setNewNote({ ...newNote, tytul: e.target.value })} data-testid="input-note-title" />
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select value={newNote.kategoria} onValueChange={(v) => setNewNote({ ...newNote, kategoria: v })}>
                <SelectTrigger data-testid="select-note-kategoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Klient">Klient</SelectItem>
                  <SelectItem value="Produkt">Produkt</SelectItem>
                  <SelectItem value="Spotkanie">Spotkanie</SelectItem>
                  <SelectItem value="Proces">Proces</SelectItem>
                  <SelectItem value="Finanse">Finanse</SelectItem>
                  <SelectItem value="Inna">Inna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Klient (opcjonalnie)</Label>
              <Select value={newNote.clientId || "none"} onValueChange={(v) => setNewNote({ ...newNote, clientId: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-note-client">
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
            {newNote.kategoria === "Spotkanie" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data spotkania</Label>
                  <Input type="date" value={newNote.dataSpotkania} onChange={(e) => setNewNote({ ...newNote, dataSpotkania: e.target.value })} data-testid="input-note-meeting-date" />
                </div>
                <div>
                  <Label>Godzina</Label>
                  <Input type="time" value={newNote.godzinaSpotkania} onChange={(e) => setNewNote({ ...newNote, godzinaSpotkania: e.target.value })} data-testid="input-note-meeting-time" />
                </div>
              </div>
            )}
            <div>
              <Label>Tagi (oddzielone przecinkami)</Label>
              <Input value={newNote.tagi} onChange={(e) => setNewNote({ ...newNote, tagi: e.target.value })} />
            </div>
            <div>
              <Label>Tresc</Label>
              <Textarea value={newNote.tresc} onChange={(e) => setNewNote({ ...newNote, tresc: e.target.value })} rows={5} data-testid="input-note-content" />
            </div>
            <Button onClick={() => addMutation.mutate()} disabled={!newNote.tytul || addMutation.isPending} className="w-full" data-testid="button-save-note">
              Zapisz notatke
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj notatkę</DialogTitle>
          </DialogHeader>
          {editingNote && (
            <div className="space-y-4">
              <div>
                <Label>Tytul</Label>
                <Input value={editingNote.tytul} onChange={(e) => setEditingNote({ ...editingNote, tytul: e.target.value })} data-testid="input-edit-note-title" />
              </div>
              <div>
                <Label>Kategoria</Label>
                <Select value={editingNote.kategoria} onValueChange={(v) => setEditingNote({ ...editingNote, kategoria: v })}>
                  <SelectTrigger data-testid="select-edit-note-kategoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Klient">Klient</SelectItem>
                    <SelectItem value="Produkt">Produkt</SelectItem>
                    <SelectItem value="Spotkanie">Spotkanie</SelectItem>
                    <SelectItem value="Proces">Proces</SelectItem>
                    <SelectItem value="Finanse">Finanse</SelectItem>
                    <SelectItem value="Inna">Inna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Klient (opcjonalnie)</Label>
                <Select value={editingNote.clientId || "none"} onValueChange={(v) => setEditingNote({ ...editingNote, clientId: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-edit-note-client">
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
              <div>
                <Label>Tagi</Label>
                <Input value={editingNote.tagi} onChange={(e) => setEditingNote({ ...editingNote, tagi: e.target.value })} />
              </div>
              <div>
                <Label>Tresc</Label>
                <Textarea value={editingNote.tresc} onChange={(e) => setEditingNote({ ...editingNote, tresc: e.target.value })} rows={5} data-testid="input-edit-note-content" />
              </div>
              <Button onClick={() => editMutation.mutate()} disabled={!editingNote.tytul || editMutation.isPending} className="w-full" data-testid="button-update-note">
                Zapisz zmiany
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
