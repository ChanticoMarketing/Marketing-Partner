import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useLocation } from "wouter";

export function Preloader() {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);
    const loadingBarRef = useRef<HTMLDivElement>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [location] = useLocation();
    const [hasRun, setHasRun] = useState(false);

    useEffect(() => {
        // Only run the preloader once per session or on root load
        if (hasRun || location !== '/') {
            setIsComplete(true);
            return;
        }

        // Lock scroll
        document.body.style.overflow = "hidden";

        // Ensure scroll is locked on root HTML as well
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

        // Check if it already ran in this session
        if (sessionStorage.getItem("preloaderCompleted") === "true") {
            tl.progress(1);
            return;
        }

        // Initial state
        gsap.set(containerRef.current, { yPercent: 0 });
        gsap.set([logoRef.current, textRef.current], { opacity: 0, y: 30 });
        gsap.set(loadingBarRef.current, { scaleX: 0, transformOrigin: 'left center' });

        // Choreography
        tl.to(logoRef.current, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
        })
            .to(textRef.current, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: "power2.out",
            }, "-=0.4")
            .to(loadingBarRef.current, {
                scaleX: 1,
                duration: 1.2,
                ease: "power2.inOut",
            }, "-=0.2")
            .to([logoRef.current, textRef.current, loadingBarRef.current], {
                opacity: 0,
                y: -20,
                duration: 0.5,
                ease: "power2.in",
                delay: 0.3
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
            <div className="relative flex flex-col items-center gap-6">
                <div ref={logoRef} className="flex h-24 w-24 items-center justify-center rounded-2xl glass-premium glow-amber">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-12 w-12 text-primary drop-shadow-[0_0_8px_rgba(255,174,0,0.8)]"
                    >
                        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                    </svg>
                </div>

                <div ref={textRef} className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-widest text-foreground uppercase title-premium">ROCKETFLOW</h1>
                    <p className="text-sm text-primary tracking-[0.3em] font-medium uppercase font-mono">Initializing Systems</p>
                </div>

                <div className="w-48 h-1 overflow-hidden rounded-full bg-white/5 mt-4">
                    <div ref={loadingBarRef} className="h-full bg-primary" />
                </div>
            </div>
        </div>
    );
}
