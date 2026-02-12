import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Truck,
  BarChart3,
  DollarSign,
  StickyNote,
  Building2,
  LogOut,
  Car,
  TrendingUp,
  Target,
  Calculator,
} from "lucide-react";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location === path;

  const handlowiecItems = [
    { title: "M\u00f3j dzie\u0144", url: "/", icon: LayoutDashboard },
    { title: "Klienci", url: "/klienci", icon: Users },
    { title: "Kalendarz", url: "/kalendarz", icon: Calendar },
    { title: "Dostawy", url: "/dostawy", icon: Truck },
    { title: "Moja sprzeda\u017c", url: "/moja-sprzedaz", icon: TrendingUp },
    { title: "Notatki", url: "/notatki", icon: StickyNote },
  ];

  const logistykaItems = [
    { title: "Panel g\u0142\u00f3wny", url: "/", icon: LayoutDashboard },
    { title: "Dostawy", url: "/dostawy", icon: Truck },
    { title: "Kierowcy i auta", url: "/kierowcy", icon: Car },
  ];

  const adminItems = [
    { title: "Panel g\u0142\u00f3wny", url: "/", icon: LayoutDashboard },
    { title: "Klienci", url: "/klienci", icon: Users },
    { title: "Kalendarz", url: "/kalendarz", icon: Calendar },
    { title: "Dostawy", url: "/dostawy", icon: Truck },
    { title: "Kierowcy i auta", url: "/kierowcy", icon: Car },
    { title: "Analiza sprzeda\u017cy", url: "/analiza", icon: BarChart3 },
    { title: "Plan miesi\u0119czny", url: "/plan", icon: Target },
    { title: "Panel sprzeda\u017cowy", url: "/sprzedaz", icon: TrendingUp },
    { title: "Analiza dzienna", url: "/analiza-dzienna", icon: Calculator },
    { title: "Panel finansowy", url: "/finanse", icon: DollarSign },
    { title: "Notatki", url: "/notatki", icon: StickyNote },
  ];

  let menuItems = handlowiecItems;
  if (user.rola === "admin") menuItems = adminItems;
  else if (user.rola === "logistyka") menuItems = logistykaItems;

  const roleLabel =
    user.rola === "admin" ? "Administrator" :
    user.rola === "handlowiec" ? "Handlowiec" : "Logistyka";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-none">Add All CRM</h2>
              <p className="text-xs text-muted-foreground mt-0.5">HoReCa</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs bg-primary/10">
              {user.imie.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.imie}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
