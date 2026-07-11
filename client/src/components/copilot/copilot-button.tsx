import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
// Importación relativa del componente Drawer
import CopilotDrawer from "@/components/copilot/copilot-drawer";

export default function CopilotButton() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <Button
        onClick={toggleDrawer}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-40"
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </Button>

      <CopilotDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}