import { SkipLink } from "@/components/ui/SkipLink";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 px-4 py-12">
      <SkipLink />
      <main id="main-content" className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-display-md text-primary-500 font-heading">Podium Throws</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
