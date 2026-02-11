import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import CalendarPage from "@/pages/calendar";
import DeliveriesPage from "@/pages/deliveries";
import DriversPage from "@/pages/drivers";
import SalesAnalysisPage from "@/pages/sales-analysis";
import SalesDashboard from "@/pages/sales-dashboard";
import FinancePage from "@/pages/finance";
import NotesPage from "@/pages/notes";
import MySalesPage from "@/pages/my-sales";
import PlanPage from "@/pages/plan";
import DailyAnalysisPage from "@/pages/daily-analysis";

function AppRoutes() {
  const { user } = useAuth();
  const isAdmin = user?.rola === "admin";
  const isHandlowiec = user?.rola === "handlowiec";
  const isLogistyka = user?.rola === "logistyka";

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      {(isAdmin || isHandlowiec) && <Route path="/klienci" component={ClientsPage} />}
      {(isAdmin || isHandlowiec) && <Route path="/kalendarz" component={CalendarPage} />}
      {(isAdmin || isLogistyka) && <Route path="/dostawy" component={DeliveriesPage} />}
      {(isAdmin || isLogistyka) && <Route path="/kierowcy" component={DriversPage} />}
      {isAdmin && <Route path="/analiza" component={SalesAnalysisPage} />}
      {isAdmin && <Route path="/plan" component={PlanPage} />}
      {isAdmin && <Route path="/sprzedaz" component={SalesDashboard} />}
      {isAdmin && <Route path="/analiza-dzienna" component={DailyAnalysisPage} />}
      {isAdmin && <Route path="/finanse" component={FinancePage} />}
      {(isAdmin || isHandlowiec) && <Route path="/notatki" component={NotesPage} />}
      {isHandlowiec && <Route path="/moja-sprzedaz" component={MySalesPage} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 bg-background z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">
            <AppRoutes />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Ladowanie...</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
