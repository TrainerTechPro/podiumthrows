import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { HistoryClient } from "./_history-client";

export const metadata = {
  title: "Throws History",
};

export default function ThrowsHistoryPage() {
  return (
    <div className="max-w-3xl mx-auto pb-12">
      <ScrollProgressBar />
      <HistoryClient />
    </div>
  );
}
