import { Home, RefreshCcw } from "lucide-react";

import { AppErrorPage } from "../components/error/AppErrorPage";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

export default function ServerErrorPage() {
  useDocumentTitle("500 - Gangguan Sistem");

  return (
    <AppErrorPage
      status={500}
      title="Terjadi gangguan pada sistem"
      description="Permintaan belum bisa diproses. Silakan coba lagi beberapa saat."
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
