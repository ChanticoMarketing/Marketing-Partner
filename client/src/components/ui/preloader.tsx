import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useLocation } from "wouter";

export function Preloader() {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);
    const spark1Ref = useRef<HTMLDivElement>(null);
    const spark2Ref = useRef<HTMLDivElement>(null);
    const spark3Ref = useRef<HTMLDivElement>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [location] = useLocation();
    const [hasRun, setHasRun] = useState(false);

    useEffect(() => {
        if (hasRun || location !== '/') {
            setIsComplete(true);
            return;
        }

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        const tl = gsap.timeline({
            onComplete: () => {
                document.body.style.overflow = "auto";
                document.documentElement.style.overflow = "auto";
                setIsComplete(true);
                setHasRun(true);
                sessionStorage.setItem("preloaderCompleted", "true");
            },
        });

        if (sessionStorage.getItem("preloaderCompleted") === "true") {
            tl.progress(1);
            return;
        }

        // Initial state
        gsap.set(containerRef.current, { yPercent: 0 });
        gsap.set(logoRef.current, { scale: 0, opacity: 0 });
        gsap.set(textRef.current, { opacity: 0, y: 20 });
        
        // Setup sparks positions
        gsap.set(spark1Ref.current, { x: -60, y: -40, opacity: 0, scale: 0.5 });
        gsap.set(spark2Ref.current, { x: 60, y: -40, opacity: 0, scale: 0.5 });
        gsap.set(spark3Ref.current, { x: 0, y: 60, opacity: 0, scale: 0.5 });

        // Choreography: Convergence
        tl.to([spark1Ref.current, spark2Ref.current, spark3Ref.current], {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            stagger: 0.1,
            ease: "power2.out",
        })
        .to([spark1Ref.current, spark2Ref.current, spark3Ref.current], {
            x: 0,
            y: 0,
            duration: 0.6,
            ease: "back.in(1.2)",
        })
        .to([spark1Ref.current, spark2Ref.current, spark3Ref.current], {
            opacity: 0,
            duration: 0.1,
        })
        // The Fusion
        .to(logoRef.current, {
            opacity: 1,
            scale: 1,
            duration: 0.8,
            ease: "elastic.out(1, 0.5)",
        }, "-=0.1")
        // Wordmark appears
        .to(textRef.current, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
        }, "-=0.4")
        // Hold for a moment, then exit
        .to([logoRef.current, textRef.current], {
            opacity: 0,
            y: -20,
            duration: 0.5,
            ease: "power2.in",
            delay: 0.8
        })
        .to(containerRef.current, {
            yPercent: -100,
            duration: 1.2,
            ease: "expo.inOut",
        });

        return () => {
            tl.kill();
            document.body.style.overflow = "auto";
            document.documentElement.style.overflow = "auto";
        };
    }, [hasRun, location]);

    if (isComplete) return null;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background pointer-events-none"
        >
            <div className="relative flex flex-col items-center gap-8">
                
                {/* Convergence Stage */}
                <div className="relative h-24 w-24 flex items-center justify-center">
                    {/* Sparks */}
                    <div ref={spark1Ref} className="absolute w-3 h-3 rounded-full bg-[#E85D22] shadow-[0_0_15px_#E85D22]" />
                    <div ref={spark2Ref} className="absolute w-3 h-3 rounded-full bg-[#D4AF37] shadow-[0_0_15px_#D4AF37]" />
                    <div ref={spark3Ref} className="absolute w-3 h-3 rounded-full bg-[#151312] dark:bg-[#F7F2E9] shadow-[0_0_15px_#151312] dark:shadow-[0_0_15px_#F7F2E9]" />
                    
                    {/* Final Logo */}
                    <div ref={logoRef} className="absolute flex h-24 w-24 items-center justify-center rounded-2xl glass-premium glow-amber overflow-hidden p-2">
                        <img src="/chantia-isotype-light.png" alt="Chantia" className="h-full w-full object-cover dark:hidden scale-[1.2]" />
                        <img src="/chantia-isotype-dark.png" alt="Chantia" className="h-full w-full object-cover hidden dark:block scale-[1.2]" />
                    </div>
                </div>

                {/* Wordmark */}
                <div ref={textRef} className="text-center space-y-2">
                    <h1 className="text-3xl font-heading font-bold tracking-widest text-foreground uppercase title-premium">CHANTIA</h1>
                    <p className="text-sm text-primary tracking-[0.3em] font-medium uppercase font-mono">ACTIVANDO NÚCLEO</p>
                </div>

            </div>
        </div>
    );
}
