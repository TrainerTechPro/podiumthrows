"use client";

import { motion, useReducedMotion } from "framer-motion";

interface TextRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function TextReveal({ children, delay = 0, className }: TextRevealProps) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <span className={`block ${className ?? ""}`}>{children}</span>;
  }

  return (
    <span className={`block overflow-hidden ${className ?? ""}`}>
      <motion.span
        className="inline-block"
        initial={{ y: "115%", opacity: 0, filter: "blur(8px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{
          duration: 0.9,
          delay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}
