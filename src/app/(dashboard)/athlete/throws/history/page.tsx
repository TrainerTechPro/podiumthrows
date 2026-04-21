import { HistoryClient } from "./_history-client";
import { ThrowsChipNav } from "../_chip-nav";

export const metadata = {
  title: "Throws History",
};

export default function ThrowsHistoryPage() {
  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <ThrowsChipNav />
      <HistoryClient />
    </div>
  );
}
