import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Rocket,
  LayoutDashboard,
  Grid2X2,
  LineChart,
  Users,
  Settings,
  LogOut,
  X,
  ListChecks,
  Calendar,
  CalendarPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isPrimary = user?.isPrimary;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card md:static md:z-0 transform transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        data-tour="main-navigation"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 mb-2 border-b">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Rocket className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold tracking-tight">Cohete Workflow</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Command Center</p>
            </div>
            {/* Close button - mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto md:hidden text-gray-400 hover:text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <div className="space-y-1 flex-1 min-h-0 px-3 py-4">
            <NavItem
              href="/"
              icon={<LayoutDashboard className="mr-3 h-5 w-5" />}
              label="Dashboard"
              isActive={location === "/"}
              onClick={onClose}
            />
            <NavItem
              href="/projects"
              icon={<Grid2X2 className="mr-3 h-5 w-5" />}
              label="Proyectos"
              isActive={location === "/projects" || (location.startsWith("/projects/") && !location.includes("/tasks"))}
              onClick={onClose}
            />

            <NavItem
              href="/calendars"
              icon={<CalendarPlus className="mr-3 h-5 w-5" />}
              label="Calendarios"
              isActive={location === "/calendars" || location === "/calendar-creator" || location === "/quick-calendar"}
              onClick={onClose}
            />



            {/* Admin section for Primary users only */}
            {isPrimary && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <h2 className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                  Sistemas
                </h2>
                <NavItem
                  href="/users-management"
                  icon={<Users className="mr-3 h-4 w-4" />}
                  label="Usuarios"
                  isActive={location === "/users-management"}
                  onClick={onClose}
                />
                <NavItem
                  href="/settings"
                  icon={<Settings className="mr-3 h-4 w-4" />}
                  label="Configuración"
                  isActive={location === "/settings"}
                  onClick={onClose}
                />
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="border-t p-4 mt-auto">
            <Link href="/profile">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <span className="text-xs font-medium">
                    {user?.fullName?.charAt(0) || user?.username?.charAt(0) || "U"}
                  </span>
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card"></div>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">
                    {user?.fullName?.split(' ')[0] || user?.username}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {user?.isPrimary ? "Admin" : "User"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLogout();
                  }}
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon, label, isActive, onClick }: NavItemProps) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors mb-1",
          isActive
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        )}
        onClick={onClick}
      >
        <div className="flex items-center w-full">
          <div className={cn("mr-3", isActive ? "text-foreground" : "")}>
            {icon}
          </div>
          <span className={cn(isActive ? "font-semibold" : "")}>
            {label}
          </span>
        </div>
      </div>
    </Link>
  );
}
