export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-light-primary dark:bg-dark-primary">
      {children}
    </div>
  );
}
