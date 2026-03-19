import React from "react";
import { CalendarIcon } from "lucide-react";

interface DateInputProps {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DateInput({ value, onChange, placeholder = "Seleccionar fecha" }: DateInputProps) {
  // Esta función garantiza que la fecha seleccionada se preserve tal cual
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      // Directamente usamos el valor del input, que ya viene en formato YYYY-MM-DD
      // Evitamos crear un objeto Date para prevenir ajustes por zona horaria
      onChange(e.target.value);
    }
  };

  // Para mostrar la fecha en formato español, necesitamos convertirla pero sólo para visualización
  const getFormattedDate = () => {
    if (!value) return placeholder;

    try {
      // Separamos los componentes de la fecha directamente del string
      const [year, month, day] = value.split('-').map(Number);

      // Creamos la fecha asegurando que se usa la fecha exacta
      // Usamos mes-1 porque en JS los meses son base 0 (enero=0)
      return new Date(year, month - 1, day).toLocaleDateString('es-ES');
    } catch (e) {
      return placeholder;
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
        <CalendarIcon className="h-5 w-5 text-primary" />
      </div>

      <div className="relative w-full h-11">
        <input
          type="date"
          className="absolute inset-0 w-full h-11 cursor-pointer opacity-0 z-20"
          value={value || ''}
          onChange={handleChange}
        />
        <div className="h-11 w-full flex items-center border rounded-md px-3 pl-10 relative z-0 bg-muted/50 border-border text-foreground placeholder:text-gray-600 hover:border-primary/30 focus-within:border-primary/50 transition-all duration-200">
          {getFormattedDate()}
        </div>
      </div>
    </div>
  );
}