import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Car, Users } from "lucide-react";
import { useState } from "react";

export default function DriversPage() {
  const { toast } = useToast();
  const [addDriverOpen, setAddDriverOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newVehicleName, setNewVehicleName] = useState("");

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["/api/drivers"],
    queryFn: async () => {
      const res = await authFetch("/api/drivers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const res = await authFetch("/api/vehicles");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addDriver = async () => {
    if (!newDriverName) return;
    try {
      await authFetch("/api/drivers", { method: "POST", body: JSON.stringify({ imie: newDriverName }) });
      toast({ title: "Kierowca dodany" });
      setNewDriverName("");
      setAddDriverOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
    } catch { toast({ title: "Blad", variant: "destructive" }); }
  };

  const addVehicle = async () => {
    if (!newVehicleName) return;
    try {
      await authFetch("/api/vehicles", { method: "POST", body: JSON.stringify({ nazwa: newVehicleName }) });
      toast({ title: "Auto dodane" });
      setNewVehicleName("");
      setAddVehicleOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    } catch { toast({ title: "Blad", variant: "destructive" }); }
  };

  if (driversLoading || vehiclesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Kierowcy i auta</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Kierowcy
            </CardTitle>
            <Button size="sm" onClick={() => setAddDriverOpen(true)} data-testid="button-add-driver">
              <Plus className="w-4 h-4 mr-1" /> Dodaj
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Imie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.id}</TableCell>
                    <TableCell className="font-medium">{d.imie}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="w-4 h-4" /> Auta
            </CardTitle>
            <Button size="sm" onClick={() => setAddVehicleOpen(true)} data-testid="button-add-vehicle">
              <Plus className="w-4 h-4 mr-1" /> Dodaj
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nazwa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.id}</TableCell>
                    <TableCell className="font-medium">{v.nazwa}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addDriverOpen} onOpenChange={setAddDriverOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj kierowce</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Imie</Label>
              <Input value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} data-testid="input-driver-name" />
            </div>
            <Button onClick={addDriver} className="w-full" data-testid="button-save-driver">Zapisz</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj auto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa</Label>
              <Input value={newVehicleName} onChange={(e) => setNewVehicleName(e.target.value)} data-testid="input-vehicle-name" />
            </div>
            <Button onClick={addVehicle} className="w-full" data-testid="button-save-vehicle">Zapisz</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
