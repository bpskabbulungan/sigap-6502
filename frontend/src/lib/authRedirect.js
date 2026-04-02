const DEFAULT_ADMIN_REDIRECT = "/admin/dashboard";

export function resolveSafeAdminRedirect(rawTarget, fallback = DEFAULT_ADMIN_REDIRECT) {
  if (typeof rawTarget !== "string") return fallback;

  const candidate = rawTarget.trim();
  if (!candidate) return fallback;

  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("://")) return fallback;
  if (/[\r\n]/.test(candidate)) return fallback;

  if (!candidate.startsWith("/admin/")) return fallback;
  if (candidate.startsWith("/admin/login")) return fallback;

  return candidate;
}

export const ADMIN_LOGIN_FALLBACK_REDIRECT = DEFAULT_ADMIN_REDIRECT;
