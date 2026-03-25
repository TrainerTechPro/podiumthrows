import { ReactNode } from "react";

export default function AthleteTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-fade-slide-in">{children}</div>;
}
