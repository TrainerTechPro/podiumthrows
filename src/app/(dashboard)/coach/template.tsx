"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function CoachTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.34, 1.56, 0.64, 1], // spring easing from tailwind config
      }}
    >
      {children}
    </motion.div>
  );
}
