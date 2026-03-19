import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Settings, Palette, Globe } from "lucide-react";

export default function SettingsPage() {
  console.log("SettingsPage rendering...");

  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("preferences");

  console.log("Settings user:", user);

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 shadow-md">
          <Settings className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-primary">/</span> CONFIGURACIÓN
          </h1>
          <p className="text-muted-foreground tracking-wide">
            Parámetros del sistema y preferencias de usuario
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-muted/30 border border-border p-1 rounded-xl">
          <TabsTrigger
            value="preferences"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold uppercase tracking-wider transition-all duration-300"
          >
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Preferencias
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold uppercase tracking-wider transition-all duration-300"
          >
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Apariencia
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="space-y-6">
          <div className="bg-card border-border border-border p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Preferencias Generales</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-muted-foreground uppercase text-xs tracking-wider font-bold">Idioma del Sistema</Label>
                <Select value={user.preferredLanguage || "es"}>
                  <SelectTrigger className="bg-muted/30 border-border text-foreground focus:border-primary/50">
                    <SelectValue placeholder="Selecciona un idioma" />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-border text-foreground">
                    <SelectItem value="es">Español (ES)</SelectItem>
                    <SelectItem value="en">English (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-muted-foreground uppercase text-xs tracking-wider font-bold">Teléfono de Contacto</Label>
                <Input
                  id="phone"
                  value={user.phoneNumber || ""}
                  placeholder="+1 234 567 8900"
                  className="bg-muted/30 border-border text-foreground focus:border-primary/50"
                />
              </div>

              <div className="pt-4">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider uppercase shadow-md">
                  Guardar Preferencias
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <div className="bg-card border-border border-border p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
              <Palette className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Tema y Visualización</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-muted-foreground uppercase text-xs tracking-wider font-bold">Modo de Interfaz</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setTheme("light")}
                    className={`h-24 flex-col gap-3 border-border hover:bg-muted hover:border-primary/50 transition-all duration-300 ${theme === 'light' ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-muted/30'}`}
                  >
                    <div className="h-8 w-8 rounded bg-white border border-gray-300 shadow-sm" />
                    <span className={`uppercase text-xs font-bold tracking-wider ${theme === 'light' ? 'text-primary' : 'text-muted-foreground'}`}>Claro</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setTheme("dark")}
                    className={`h-24 flex-col gap-3 border-border hover:bg-muted hover:border-primary/50 transition-all duration-300 ${theme === 'dark' ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-muted/30'}`}
                  >
                    <div className="h-8 w-8 rounded bg-gray-900 border border-gray-700 shadow-sm" />
                    <span className={`uppercase text-xs font-bold tracking-wider ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`}>Oscuro</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setTheme("system")}
                    className={`h-24 flex-col gap-3 border-border hover:bg-muted hover:border-primary/50 transition-all duration-300 ${theme === 'system' ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-muted/30'}`}
                  >
                    <div className="h-8 w-8 rounded bg-gradient-to-r from-white to-gray-900 border border-gray-500 shadow-sm" />
                    <span className={`uppercase text-xs font-bold tracking-wider ${theme === 'system' ? 'text-primary' : 'text-muted-foreground'}`}>Sistema</span>
                  </Button>
                </div>
              </div>

              <div className="pt-4">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider uppercase shadow-md">
                  Aplicar Cambios
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}