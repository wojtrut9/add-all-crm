import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Filter, Download, Upload, Plus, AlertTriangle, Phone, Mail,
  MapPin, User, X, ChevronRight,
} from "lucide-react";
import type { Client } from "@shared/schema";

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
          <Badge variant={client.segment === "Premium" ? "default" : "secondary"} className="text-xs">
            {client.segment}
          </Badge>
          <Badge variant={client.aktywny ? "outline" : "destructive"} className="text-xs">
            {client.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {client.klient}
          <Badge variant={client.segment === "Premium" ? "default" : "secondary"}>{client.segment}</Badge>
        </DialogTitle>
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
          <InfoRow label="Zamowienia gdzie" value={client.zamowieniaGdzie || "-"} />
          <InfoRow label="Dni zamowien" value={client.dniZamowien || "-"} />
          <InfoRow label="Rytm kontaktu" value={client.rytmKontaktu || "-"} />
          <InfoRow label="Rabat %" value={client.rabatProcent ? `${client.rabatProcent}%` : "-"} />
          <InfoRow label="Warunki platnosci" value={client.warunkiPlatnosci || "-"} />
          <InfoRow label="Termin platnosci" value={client.terminPlatnosciDni ? `${client.terminPlatnosciDni} dni` : "-"} />
          <InfoRow label="Limit kredytowy" value={client.limitKredytowy ? `${Number(client.limitKredytowy).toLocaleString("pl-PL")} PLN` : "-"} />
          <InfoRow label="Osoba kontaktowa" value={client.osobaKontaktowa || "-"} />
          <InfoRow label="Braki zamowien" value={String(client.brakiZamowien || 0)} alert={(client.brakiZamowien || 0) >= 2} />
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

function InfoRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${alert ? 'text-destructive' : ''}`}>{value}</p>
    </div>
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
        toast({ title: "Import zakonczony", description: `Zaimportowano ${data.count} klientow` });
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      } catch {
        toast({ title: "Blad importu", variant: "destructive" });
      }
    };
    input.click();
  };

  const isAdmin = user?.rola === "admin";

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
          <p className="text-sm text-muted-foreground">{filteredClients.length} z {clients.length} klientow</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleImportCSV} data-testid="button-import-csv">
              <Upload className="w-4 h-4 mr-1" /> Importuj CSV
            </Button>
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
          <p className="text-lg font-medium">Brak klientow</p>
          <p className="text-sm">Zmien filtry lub zaimportuj dane</p>
        </div>
      )}
    </div>
  );
}
