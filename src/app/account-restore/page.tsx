import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { RestoreClient } from "./_restore-client";

export const metadata = {
  title: "Restore your account · Podium Throws",
};

export default async function AccountRestorePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { deletedAt: true, deleteScheduledFor: true },
  });
  if (!user) redirect("/login");

  // If they're not actually pending deletion, send them home — nothing to do here.
  if (!user.deletedAt || !user.deleteScheduledFor) {
    redirect(session.role === "COACH" ? "/coach/dashboard" : "/athlete/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 px-4 py-12">
      <main className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-display-md text-primary-500 font-heading">Podium Throws</h1>
        </div>
        <div className="card p-8 space-y-6">
          <header className="space-y-2">
            <h2 className="text-xl font-heading text-[var(--foreground)]">
              Your account is scheduled for deletion
            </h2>
            <p className="text-sm text-muted">
              You requested deletion on{" "}
              <span className="font-mono text-[var(--foreground)]">
                {user.deletedAt.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              . All your data will be permanently removed on{" "}
              <span className="font-mono text-[var(--foreground)]">
                {user.deleteScheduledFor.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              .
            </p>
          </header>
          <RestoreClient role={session.role} />
        </div>
      </main>
    </div>
  );
}
