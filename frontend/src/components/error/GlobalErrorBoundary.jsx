import { Component } from "react";
import { Home, RefreshCcw } from "lucide-react";

import { AppErrorPage } from "./AppErrorPage";

export class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[GlobalErrorBoundary]", error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const status = Number(error?.status) === 503 ? 503 : 500;

    return (
      <AppErrorPage
        status={status}
        title={
          status === 503
            ? "Layanan sedang tidak tersedia sementara"
            : undefined
        }
        description={
          status === 503
            ? "Sistem sedang sinkronisasi atau maintenance. Silakan coba lagi nanti."
            : "Terjadi gangguan pada sistem. Silakan muat ulang halaman."
        }
        actions={[
          {
            label: "Muat ulang",
            variant: "primary",
            icon: RefreshCcw,
            onClick: this.handleReload,
          },
          {
            label: "Ke beranda",
            variant: "secondary",
            icon: Home,
            onClick: this.handleGoHome,
          },
        ]}
      />
    );
  }
}
