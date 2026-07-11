import { User } from "@shared/schema";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PlayCircle, Rocket, Sparkles } from "lucide-react";
import { useAppTourContext } from "@/hooks/use-app-tour";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { motion } from "framer-motion";

interface WelcomeSectionProps {
  user: Omit<User, 'password'> | null;
}

// Clean UI, removed MagneticButton wrapper for a more stable, professional feel

export default function WelcomeSection({ user }: WelcomeSectionProps) {
  const [, setLocation] = useLocation();
  const { startTour } = useAppTourContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<HTMLDivElement[]>([]);

  const addToRefs = (el: HTMLDivElement | null) => {
    if (el && !elementsRef.current.includes(el)) {
      elementsRef.current.push(el);
    }
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Create a staggered entrance animation
      gsap.fromTo(
        elementsRef.current,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.15,
          ease: "power3.out",
          delay: 0.5 // wait for preloader to finish
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const goToCreateProject = () => {
    setLocation("/projects");
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div
      className="relative overflow-hidden py-12"
      data-tour="dashboard-welcome"
      ref={containerRef}
    >
      {/* Deep Space Radial Gradient Background (Cleaned) */}
      <div className="absolute inset-0 bg-background/50"></div>

      <div className="relative z-10 max-w-5xl">
        <div className="space-y-6">
          <div ref={addToRefs}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl text-foreground font-semibold tracking-tight leading-tight">
              <span className="block text-xl md:text-2xl font-normal text-muted-foreground mb-2">
                {getGreeting()},
              </span>
              <span>
                {user ? user.fullName.split(' ')[0] : 'Equipo'}
              </span>
            </h1>
          </div>

          <div ref={addToRefs}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Aquí está el pulso de tu{' '}
              <span className="text-foreground font-medium">operación de marketing</span>.
              <br className="hidden md:block" />
              Gestiona proyectos, campañas y cronogramas.
            </p>
          </div>

          <div ref={addToRefs} className="flex flex-wrap gap-4 pt-4">
            <Button
              className="h-12 px-6"
              onClick={() => startTour('dashboard')}
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              Iniciar Recorrido
            </Button>

            <Button
              variant="outline"
              className="h-12 px-6"
              onClick={goToCreateProject}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Nuevo Proyecto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}