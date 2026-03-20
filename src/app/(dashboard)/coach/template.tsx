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
        ease: [0.22, 1, 0.36, 1], // ease-out-quint — smooth deceleration, no overshoot
      }}
    >
      {children}
    </motion.div>
  );
}
