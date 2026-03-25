import { ReactNode } from "react";

export default function CoachTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-fade-slide-in">{children}</div>;
}
