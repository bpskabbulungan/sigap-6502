import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppErrorPage } from "../components/error/AppErrorPage";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

export default function NotFoundPage() {
  useDocumentTitle("404 - Halaman Tidak Ditemukan");

  const navigate = useNavigate();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  };

  return (
    <AppErrorPage
      status={404}
      title="Halaman tidak ditemukan"
      description="Halaman yang Anda tuju tidak tersedia atau alamatnya tidak tepat."
      actions={[
        {
          label: "Kembali",
          variant: "secondary",
          icon: ArrowLeft,
          onClick: goBack,
        },
        {
          label: "Ke beranda",
          variant: "primary",
          icon: Home,
          onClick: () => navigate("/"),
        },
      ]}
    />
  );
}
