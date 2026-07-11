import { Link, useLocation } from "wouter";
import { Menu, Bell, Search, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  // Generate title based on current path
  const getTitle = () => {
    if (location === "/") return "Dashboard";
    if (location === "/projects") return "Proyectos";
    if (location.startsWith("/projects/")) return "Detalles del Proyecto";
    return "Chantia";
  };

  return (
    <header className="border-b bg-card/90 backdrop-blur-sm px-4 py-3 md:px-6 sticky top-0 z-50 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 md:hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuClick}
            className="rounded-md p-2 hover:bg-accent interactive-element"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-lg font-heading font-bold tracking-tight">Chantia</span>
        </div>
        <div className="hidden md:block">
          <h1 className="text-xl font-heading font-bold tracking-tight">
            <span className="text-primary mr-1.5">•</span> 
            {getTitle()}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-md p-2 hover:bg-accent interactive-element"
              title="Notificaciones"
            >
              <Bell className="h-5 w-5" />
              <Badge 
                variant="destructive" 
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-xs font-semibold shadow-sm"
              >
                2
              </Badge>
            </Button>
          </div>
          <div className="flex items-center rounded-md border bg-background/70 px-3 py-1.5 transition-all duration-200 hover:bg-background focus-within:bg-background focus-within:shadow-sm">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Buscar proyectos..." 
              className="w-32 border-0 bg-transparent text-sm outline-none shadow-none p-0 h-auto sm:w-64" 
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="p-1 h-auto hover:bg-accent rounded-full" 
                size="icon"
                data-tour="user-menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={typeof user?.profileImage === 'string' ? user.profileImage : undefined} />
                  <AvatarFallback className="text-xs">
                    {user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || user?.username?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/profile">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Perfil</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
