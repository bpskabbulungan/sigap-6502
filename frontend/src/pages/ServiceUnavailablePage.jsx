import { Home, RefreshCcw } from "lucide-react";

import { AppErrorPage } from "../components/error/AppErrorPage";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

export default function ServiceUnavailablePage() {
  useDocumentTitle("503 - Layanan Tidak Tersedia");

  return (
    <AppErrorPage
      status={503}
      title="Layanan tidak tersedia sementara"
      description="Sistem sedang maintenance atau sinkronisasi. Silakan coba lagi nanti."
      actions={[
        {
          label: "Muat ulang",
          variant: "primary",
          icon: RefreshCcw,
          onClick: () => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          },
        },
        {
          label: "Ke beranda",
          variant: "secondary",
          icon: Home,
          onClick: () => {
            if (typeof window !== "undefined") {
              window.location.assign("/");
            }
          },
        },
      ]}
    />
  );
}
