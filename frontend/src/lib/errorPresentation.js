function toNumericStatus(rawStatus) {
  const numeric = Number(rawStatus);
  if (!Number.isInteger(numeric) || numeric < 100 || numeric > 599) {
    return null;
  }
  return numeric;
}

function cleanMessage(message) {
  if (typeof message !== "string") return "";
  const trimmed = message.trim();
  if (!trimmed) return "";
  if (/^request failed with status\s+\d+/i.test(trimmed)) return "";
  return trimmed;
}

const PAGE_PRESETS = {
  404: {
    tone: "info",
    badge: "404 Not Found",
    title: "Halaman tidak ditemukan",
    description:
      "Halaman yang Anda tuju tidak tersedia.",
    tips: [],
  },
  500: {
    tone: "danger",
    badge: "500 Internal Server Error",
    title: "Terjadi gangguan pada sistem",
    description:
      "Permintaan belum dapat diproses. Silakan coba lagi.",
    tips: [],
  },
  503: {
    tone: "warning",
    badge: "503 Service Unavailable",
    title: "Layanan sedang tidak tersedia sementara",
    description:
      "Sistem sedang maintenance atau sinkronisasi. Silakan coba lagi nanti.",
    tips: [],
  },
  default: {
    tone: "default",
    badge: "Terjadi Kendala",
    title: "Halaman sedang mengalami kendala",
    description: "Terjadi kendala pada halaman ini.",
    tips: [],
  },
};

const INLINE_PRESETS = {
  network: {
    tone: "warning",
    title: "Tidak dapat terhubung ke server",
    description: "Periksa koneksi lalu coba lagi.",
  },
  404: {
    tone: "info",
    title: "Data tidak ditemukan",
    description: "Data yang diminta tidak tersedia.",
  },
  500: {
    tone: "danger",
    title: "Terjadi gangguan pada sistem",
    description: "Server mengalami kendala internal.",
  },
  503: {
    tone: "warning",
    title: "Layanan tidak tersedia sementara",
    description: "Server sedang maintenance atau sinkronisasi.",
  },
  400: {
    tone: "warning",
    title: "Permintaan tidak dapat diproses",
    description: "Periksa data lalu coba kembali.",
  },
  default: {
    tone: "danger",
    title: "Terjadi kendala saat memuat data",
    description: "Silakan coba lagi.",
  },
};

function clonePreset(preset) {
  return {
    ...preset,
    tips: Array.isArray(preset.tips) ? [...preset.tips] : undefined,
  };
}

export function getErrorStatus(errorOrStatus) {
  if (typeof errorOrStatus === "number") {
    return toNumericStatus(errorOrStatus);
  }

  if (errorOrStatus && typeof errorOrStatus === "object") {
    return toNumericStatus(errorOrStatus.status);
  }

  return null;
}

export function resolveErrorMeta(errorOrStatus, options = {}) {
  const context = options.context === "page" ? "page" : "inline";
  const rawMessage =
    cleanMessage(options.fallbackMessage) ||
    cleanMessage(errorOrStatus?.message) ||
    "";

  if (context === "inline" && errorOrStatus?.code === "NETWORK_ERROR") {
    return {
      ...clonePreset(INLINE_PRESETS.network),
      status: null,
      message: rawMessage,
    };
  }

  const status = getErrorStatus(errorOrStatus);

  if (context === "page") {
    if (status === 404) {
      return { ...clonePreset(PAGE_PRESETS[404]), status };
    }

    if (status === 503) {
      return { ...clonePreset(PAGE_PRESETS[503]), status };
    }

    if (status && status >= 500) {
      return { ...clonePreset(PAGE_PRESETS[500]), status };
    }

    if (status && status >= 400) {
      return {
        ...clonePreset(PAGE_PRESETS.default),
        status,
      };
    }

    return {
      ...clonePreset(PAGE_PRESETS.default),
      status,
    };
  }

  if (status === 404) {
    return {
      ...clonePreset(INLINE_PRESETS[404]),
      status,
      description: rawMessage || INLINE_PRESETS[404].description,
    };
  }

  if (status === 503) {
    return {
      ...clonePreset(INLINE_PRESETS[503]),
      status,
      description: rawMessage || INLINE_PRESETS[503].description,
    };
  }

  if (status && status >= 500) {
    return {
      ...clonePreset(INLINE_PRESETS[500]),
      status,
      description: rawMessage || INLINE_PRESETS[500].description,
    };
  }

  if (status && status >= 400) {
    return {
      ...clonePreset(INLINE_PRESETS[400]),
      status,
      description: rawMessage || INLINE_PRESETS[400].description,
    };
  }

  return {
    ...clonePreset(INLINE_PRESETS.default),
    status,
    description: rawMessage || INLINE_PRESETS.default.description,
  };
}
