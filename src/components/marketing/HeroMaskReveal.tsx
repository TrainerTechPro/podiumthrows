"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  useReducedMotion,
} from "framer-motion";

interface HeroMaskRevealProps {
  baseImage: string;
  revealImage: string;
  baseAlt: string;
  revealAlt: string;
  minRadius?: number;
  maxRadius?: number;
  children: React.ReactNode;
}

const CURSOR_SPRING = { stiffness: 150, damping: 15, mass: 0.5 };
const RADIUS_SPRING = { stiffness: 100, damping: 20, mass: 0.8 };
const PARALLAX_SPRING = { stiffness: 50, damping: 30 };
const MAX_VELOCITY = 1500;

export default function HeroMaskReveal({
  baseImage,
  revealImage,
  baseAlt,
  revealAlt,
  minRadius = 100,
  maxRadius = 350,
  children,
}: HeroMaskRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const rawX = useMotionValue(-200);
  const rawY = useMotionValue(-200);

  const springX = useSpring(rawX, CURSOR_SPRING);
  const springY = useSpring(rawY, CURSOR_SPRING);

  const velocityX = useVelocity(springX);
  const velocityY = useVelocity(springY);

  const targetRadius = useMotionValue(minRadius);
  const springRadius = useSpring(targetRadius, RADIUS_SPRING);

  const maskOpacity = useMotionValue(0);
  const springMaskOpacity = useSpring(maskOpacity, { stiffness: 200, damping: 30 });

  const parallaxBaseX = useSpring(useMotionValue(0), PARALLAX_SPRING);
  const parallaxBaseY = useSpring(useMotionValue(0), PARALLAX_SPRING);
  const parallaxRevealX = useSpring(useMotionValue(0), PARALLAX_SPRING);
  const parallaxRevealY = useSpring(useMotionValue(0), PARALLAX_SPRING);

  const [inputMode, setInputMode] = useState<"mouse" | "touch" | "gyro" | "auto">("mouse");
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const touchActiveRef = useRef(false);

  useEffect(() => {
    if (shouldReduceMotion) return;

    let rafId: number;
    const update = () => {
      const vx = velocityX.get();
      const vy = velocityY.get();
      const speed = Math.sqrt(vx * vx + vy * vy);
      const t = Math.min(speed / MAX_VELOCITY, 1);
      targetRadius.set(minRadius + t * (maxRadius - minRadius));
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [shouldReduceMotion, velocityX, velocityY, targetRadius, minRadius, maxRadius]);

  const maskImage = useTransform(
    [springX, springY, springRadius, springMaskOpacity],
    ([x, y, r, opacity]: number[]) => {
      if (opacity < 0.01) return "none";
      return `radial-gradient(circle ${r}px at ${x}px ${y}px, rgba(0,0,0,${opacity}) 0%, rgba(0,0,0,${opacity * 0.6}) 50%, rgba(0,0,0,${opacity * 0.1}) 80%, transparent 100%)`;
    }
  );

  const baseTransform = useTransform(
    [parallaxBaseX, parallaxBaseY],
    ([px, py]: number[]) => `translate(${px}px, ${py}px)`
  );
  const revealTransform = useTransform(
    [parallaxRevealX, parallaxRevealY],
    ([px, py]: number[]) => `translate(${px}px, ${py}px)`
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      rawX.set(x);
      rawY.set(y);

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const px = ((x - cx) / cx) * 10;
      const py = ((y - cy) / cy) * 10;
      parallaxBaseX.set(px);
      parallaxBaseY.set(py);
      parallaxRevealX.set(-px * 2);
      parallaxRevealY.set(-py * 2);
    },
    [shouldReduceMotion, rawX, rawY, parallaxBaseX, parallaxBaseY, parallaxRevealX, parallaxRevealY]
  );

  const handleMouseEnter = useCallback(() => {
    if (shouldReduceMotion) return;
    maskOpacity.set(1);
  }, [shouldReduceMotion, maskOpacity]);

  const handleMouseLeave = useCallback(() => {
    if (shouldReduceMotion) return;
    maskOpacity.set(0);
    parallaxBaseX.set(0);
    parallaxBaseY.set(0);
    parallaxRevealX.set(0);
    parallaxRevealY.set(0);
  }, [shouldReduceMotion, maskOpacity, parallaxBaseX, parallaxBaseY, parallaxRevealX, parallaxRevealY]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      const touch = e.touches[0];
      if (!touch) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      touchActiveRef.current = true;
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      rawX.set(x);
      rawY.set(y);
      maskOpacity.set(1);

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const px = ((x - cx) / cx) * 10;
      const py = ((y - cy) / cy) * 10;
      parallaxBaseX.set(px);
      parallaxBaseY.set(py);
      parallaxRevealX.set(-px * 2);
      parallaxRevealY.set(-py * 2);
    },
    [shouldReduceMotion, rawX, rawY, maskOpacity, parallaxBaseX, parallaxBaseY, parallaxRevealX, parallaxRevealY]
  );

  const handleTouchEnd = useCallback(() => {
    touchActiveRef.current = false;
  }, []);

  // Gyroscope setup for mobile devices
  useEffect(() => {
    if (shouldReduceMotion) return;
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;

    setInputMode("auto");

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (touchActiveRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;

      const clampedBeta = Math.max(-15, Math.min(15, beta - 45));
      const clampedGamma = Math.max(-15, Math.min(15, gamma));

      const x = ((clampedGamma + 15) / 30) * rect.width;
      const y = ((clampedBeta + 15) / 30) * rect.height;

      rawX.set(x);
      rawY.set(y);
      maskOpacity.set(1);

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const px = ((x - cx) / cx) * 10;
      const py = ((y - cy) / cy) * 10;
      parallaxBaseX.set(px);
      parallaxBaseY.set(py);
      parallaxRevealX.set(-px * 2);
      parallaxRevealY.set(-py * 2);
    };

    const requestGyro = async () => {
      try {
        if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission !== "granted") {
            setGyroAvailable(false);
            return;
          }
        }
        setGyroAvailable(true);
        setInputMode("gyro");
        window.addEventListener("deviceorientation", handleOrientation);
      } catch {
        setGyroAvailable(false);
      }
    };

    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      const tapHandler = () => {
        requestGyro();
        document.removeEventListener("touchstart", tapHandler);
      };
      document.addEventListener("touchstart", tapHandler, { once: true });
      return () => {
        document.removeEventListener("touchstart", tapHandler);
        window.removeEventListener("deviceorientation", handleOrientation);
      };
    } else {
      requestGyro();
      return () => {
        window.removeEventListener("deviceorientation", handleOrientation);
      };
    }
  }, [shouldReduceMotion, rawX, rawY, maskOpacity, parallaxBaseX, parallaxBaseY, parallaxRevealX, parallaxRevealY]);

  // Auto-animation fallback (Lissajous figure-8) for mobile
  useEffect(() => {
    if (shouldReduceMotion) return;
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;

    let rafId: number;
    const startTime = performance.now();

    const animate = () => {
      if (touchActiveRef.current || (gyroAvailable && inputMode === "gyro")) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const t = (performance.now() - startTime) / 1000;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ax = rect.width * 0.25;
      const ay = rect.height * 0.2;

      const x = cx + ax * Math.sin(t * 0.3);
      const y = cy + ay * Math.sin(t * 0.5);

      rawX.set(x);
      rawY.set(y);
      maskOpacity.set(0.7);

      const midRadius = (minRadius + maxRadius) / 2;
      targetRadius.set(minRadius + (midRadius - minRadius) * (0.5 + 0.5 * Math.sin(t * 0.4)));

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [shouldReduceMotion, gyroAvailable, inputMode, rawX, rawY, maskOpacity, targetRadius, minRadius, maxRadius]);

  if (shouldReduceMotion) {
    return (
      <section
        className="relative w-full overflow-hidden"
        style={{ height: "100svh" }}
        aria-label="Hero"
      >
        <div className="absolute inset-0">
          <Image src={revealImage} alt={revealAlt} fill priority sizes="100vw" className="object-cover" />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `
              linear-gradient(to right, rgba(8,8,10,0.85) 0%, rgba(8,8,10,0.6) 40%, rgba(8,8,10,0.1) 70%, transparent 100%),
              linear-gradient(to top, rgba(8,8,10,0.9) 0%, transparent 40%)
            `,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none lg:hidden"
          aria-hidden="true"
          style={{
            background: "linear-gradient(to top, rgba(8,8,10,0.95) 0%, rgba(8,8,10,0.7) 50%, rgba(8,8,10,0.4) 100%)",
          }}
        />
        <div className="relative z-10 h-full flex items-end lg:items-center">
          <div className="max-w-[1200px] mx-auto px-6 sm:px-10 w-full pb-12 lg:pb-0">{children}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="relative w-full overflow-hidden cursor-none"
      style={{ height: "100svh" }}
      aria-label="Hero"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <motion.div
        className="absolute inset-[-20px]"
        style={{ transform: baseTransform }}
        aria-hidden="true"
      >
        <Image src={baseImage} alt={baseAlt} fill priority sizes="100vw" className="object-cover" />
      </motion.div>

      <motion.div
        className="absolute inset-[-20px]"
        style={{
          transform: revealTransform,
          WebkitMaskImage: maskImage,
          maskImage: maskImage,
          willChange: "mask-image",
        }}
      >
        <Image src={revealImage} alt={revealAlt} fill priority sizes="100vw" className="object-cover" />
      </motion.div>

      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            linear-gradient(to right, rgba(8,8,10,0.85) 0%, rgba(8,8,10,0.6) 40%, rgba(8,8,10,0.1) 70%, transparent 100%),
            linear-gradient(to top, rgba(8,8,10,0.9) 0%, transparent 40%)
          `,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none lg:hidden"
        aria-hidden="true"
        style={{
          background: "linear-gradient(to top, rgba(8,8,10,0.95) 0%, rgba(8,8,10,0.7) 50%, rgba(8,8,10,0.4) 100%)",
        }}
      />

      <div className="relative z-10 h-full flex items-end lg:items-center">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 w-full pb-12 lg:pb-0">{children}</div>
      </div>
    </section>
  );
}
