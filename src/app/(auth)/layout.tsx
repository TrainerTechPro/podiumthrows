export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-display-md text-primary-500 font-heading">
            Podium Throws
          </h1>
          <p className="text-sm text-muted mt-1">
            Elite throws coaching platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
