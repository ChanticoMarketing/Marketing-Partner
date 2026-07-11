import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
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
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-white/5 bg-[#151312] md:static md:z-0 transform transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        data-tour="main-navigation"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 mb-2 border-b border-white/5">
            <div className="relative flex h-10 w-10 items-center justify-center shrink-0 overflow-hidden">
              <img src="/chantia-isotype-dark.png" alt="Chantia Logo" className="h-full w-full object-cover scale-[1.3]" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-base font-heading font-bold tracking-tight text-[#F7F2E9] truncate">Chantia</h1>
              <p className="text-[10px] text-[#A3A09A] uppercase tracking-wider truncate">Chispa Contenida</p>
            </div>
            {/* Close button - mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto md:hidden text-[#A3A09A] hover:text-[#F7F2E9] hover:bg-white/5"
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
              <div className="mt-6 pt-6 border-t border-white/5">
                <h2 className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#A3A09A]">
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
          <div className="border-t border-white/5 p-4 mt-auto">
            <Link href="/profile">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[#F7F2E9]">
                  <span className="text-xs font-medium">
                    {user?.fullName?.charAt(0) || user?.username?.charAt(0) || "U"}
                  </span>
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-[#151312]"></div>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#F7F2E9] truncate">
                    {user?.fullName?.split(' ')[0] || user?.username}
                  </span>
                  <span className="text-[10px] text-[#A3A09A]">
                    {user?.isPrimary ? "Admin" : "User"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md text-[#A3A09A] hover:text-[#E85D22] hover:bg-[#E85D22]/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
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
          "flex w-full items-center rounded-md px-3 py-2 text-sm font-sans font-medium transition-colors mb-1 cursor-pointer",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-[#D5D3CF] hover:bg-white/5 hover:text-[#F7F2E9]"
        )}
        onClick={onClick}
      >
        <div className="flex items-center w-full">
          <div className={cn("mr-3", isActive ? "text-primary" : "")}>
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
