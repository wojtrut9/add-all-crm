import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, XCircle, Clock, Wifi, WifiOff, Database } from "lucide-react";
import { useLocation } from "wouter";

function formatDate(val: string | null | undefined) {
  if (!val) return "-";
  const d = new Date(val);
  return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge className="bg-green-100 text-green-800 border-transparent gap-1"><CheckCircle2 className="w-3 h-3" /> Sukces</Badge>;
  if (status === "error") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Błąd</Badge>;
  return <Badge variant="outline" className="gap-1 animate-pulse"><Clock className="w-3 h-3" /> W trakcie</Badge>;
}

export default function IbizneSyncPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  if (user?.rola !== "admin") { setLocation("/"); return null; }

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/ibiznes/status"],
    queryFn: async () => {
      const res = await authFetch("/api/ibiznes/status");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["/api/ibiznes/logs"],
    queryFn: async () => {
      const res = await authFetch("/api/ibiznes/logs?limit=15");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/ibiznes/sync", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Błąd synchronizacji");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Synchronizacja zakończona",
        description: `Faktury: ${data.invoicesSynced}, Dopasowani: ${data.clientsMatched}, Niedopasowani: ${data.clientsUnmatched}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ibiznes/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Błąd synchronizacji", description: err.message, variant: "destructive" });
    },
  });

  const lastSync = status?.lastSync;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6" /> Synchronizacja iBiznes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automatyczny import faktur z systemu iBiznes do CRM. Sync działa codziennie o 05:00.
        </p>
      </div>

      {/* Connection status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status połączenia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            {statusLoading ? (
              <Badge variant="outline" className="animate-pulse">Sprawdzam...</Badge>
            ) : status?.connected ? (
              <Badge className="bg-green-100 text-green-800 border-transparent gap-1">
                <Wifi className="w-3 h-3" /> Połączony z iBiznes
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="w-3 h-3" /> Brak połączenia
              </Badge>
            )}
          </div>

          {!status?.connected && (
            <p className="text-sm text-muted-foreground">
              Ustaw zmienną <code className="bg-muted px-1 rounded text-xs">IBIZNES_DB_URL</code> w Railway (Environment Variables) z connection stringiem do MySQL iBiznes.
              Format: <code className="bg-muted px-1 rounded text-xs">mysql://user:pass@host:3306/dbname</code>
            </p>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ostatnia synchronizacja</p>
              {lastSync ? (
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={lastSync.status} />
                  <span className="text-xs text-muted-foreground">{formatDate(lastSync.finishedAt || lastSync.startedAt)}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Brak danych</p>
              )}
            </div>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !status?.connected}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Synchronizuję..." : "Uruchom sync"}
            </Button>
          </div>

          {lastSync?.status === "success" && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xl font-bold">{lastSync.invoicesSynced ?? 0}</p>
                <p className="text-xs text-muted-foreground">Faktur</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xl font-bold text-green-600">{lastSync.clientsMatched ?? 0}</p>
                <p className="text-xs text-muted-foreground">Dopasowanych</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xl font-bold text-amber-600">{lastSync.clientsUnmatched ?? 0}</p>
                <p className="text-xs text-muted-foreground">Niedopasowanych NIP</p>
              </div>
            </div>
          )}
          {lastSync?.status === "error" && lastSync.message && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded-md">
              {lastSync.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* How to match clients */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Jak dopasować klientów?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Sync dopasowuje faktury z iBiznes do klientów w CRM na podstawie <strong>numeru NIP</strong>.</p>
          <p>Żeby klient był dopasowany, wejdź w jego kartę → Edytuj → wpisz pole <strong>NIP (iBiznes sync)</strong> z tym samym NIP-em co w systemie iBiznes (bez kresek, np. <code className="bg-muted px-1 rounded">1234567890</code>).</p>
          <p>Po uzupełnieniu NIP-ów uruchom sync ponownie — faktury zostaną przypisane, a <strong>clientSales</strong> (realizacja) zaktualizuje się automatycznie.</p>
        </CardContent>
      </Card>

      {/* Sync history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historia synchronizacji</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak historii. Uruchom pierwszą synchronizację.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start justify-between gap-2 p-2 rounded-md border text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={log.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.startedAt)}
                    </span>
                    <Badge variant="outline" className="text-xs">{log.trigger}</Badge>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    {log.status === "success" ? (
                      <span>{log.invoicesSynced} faktur · {log.clientsMatched} dop.</span>
                    ) : log.message ? (
                      <span className="text-red-500 max-w-48 block truncate">{log.message}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
