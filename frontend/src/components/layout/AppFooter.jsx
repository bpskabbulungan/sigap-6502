export function AppFooter({ className = "", innerClassName = "" }) {
  const footerClassName = [
    "border-t border-border/80 bg-card py-6 text-sm text-muted-foreground text-center",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const contentClassName = ["mx-auto flex w-full max-w-7xl justify-center px-4", innerClassName]
    .filter(Boolean)
    .join(" ");
  const currentYear = new Date().getFullYear();

  return (
    <footer className={footerClassName}>
      <div className={contentClassName}>
        <p className="text-center">&copy; {currentYear} Badan Pusat Statistik Kabupaten Bulungan</p>
      </div>
    </footer>
  );
}
