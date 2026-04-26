import Link from "next/link";
import { Target } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export function HistoryEmptyState() {
  return (
    <EmptyState
      icon={<Target size={48} strokeWidth={1.5} aria-hidden="true" />}
      title="No throws yet"
      description="Log your first throw and we'll start building your history. Every rep counts — even the ones that miss."
      action={
        <Link
          href="/athlete/throws/log"
          className="inline-flex items-center px-6 py-3 rounded-xl bg-primary-500 text-black font-heading font-bold tracking-wide hover:bg-primary-400 transition-colors"
        >
          LOG A THROW
        </Link>
      }
    />
  );
}
