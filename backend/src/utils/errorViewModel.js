function toStatus(rawStatus) {
  const status = Number(rawStatus);
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return 500;
  }
  return status;
}

function sanitizeMessage(rawMessage) {
  if (typeof rawMessage !== 'string') return '';
  const trimmed = rawMessage.trim();
  if (!trimmed) return '';
  if (trimmed.length > 140) return '';
  if (/\n|\r/.test(trimmed)) return '';
  if (/\b(TypeError|ReferenceError|SyntaxError|ENOENT|ECONN|EACCES)\b/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

function defaultActions(status) {
  if (status === 404) {
    return [
      { type: 'back', kind: 'secondary', label: 'Kembali' },
      { type: 'link', kind: 'primary', label: 'Ke Beranda', href: '/' },
    ];
  }

  return [
    { type: 'reload', kind: 'primary', label: 'Muat Ulang' },
    { type: 'link', kind: 'secondary', label: 'Ke Beranda', href: '/' },
  ];
}

function resolvePreset(status) {
  if (status === 404) {
    return {
      accent: 'info',
      statusLabel: 'Not Found',
      headline: 'Halaman tidak ditemukan',
      description: 'Halaman yang Anda tuju tidak tersedia.',
      icon: '?',
    };
  }

  if (status === 503) {
    return {
      accent: 'warning',
      statusLabel: 'Service Unavailable',
      headline: 'Layanan tidak tersedia sementara',
      description: 'Sistem sedang maintenance atau sinkronisasi. Silakan coba lagi nanti.',
      icon: '~',
    };
  }

  if (status >= 500) {
    return {
      accent: 'danger',
      statusLabel: 'Internal Server Error',
      headline: 'Terjadi gangguan pada sistem',
      description: 'Permintaan belum dapat diproses. Silakan coba lagi.',
      icon: '!',
    };
  }

  return {
    accent: 'default',
    statusLabel: 'Error',
    headline: 'Terjadi kendala',
    description: 'Silakan coba lagi.',
    icon: '!',
  };
}

function buildErrorViewModel({ status, message }) {
  const normalizedStatus = toStatus(status);
  const preset = resolvePreset(normalizedStatus);
  const safeMessage = sanitizeMessage(message);

  return {
    title: `${normalizedStatus} - ${preset.headline}`,
    status: normalizedStatus,
    statusLabel: preset.statusLabel,
    headline: preset.headline,
    description: safeMessage || preset.description,
    accent: preset.accent,
    icon: preset.icon,
    actions: defaultActions(normalizedStatus),
  };
}

module.exports = {
  buildErrorViewModel,
};
