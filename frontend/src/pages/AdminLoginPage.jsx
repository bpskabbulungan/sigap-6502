import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, User, Lock, ArrowLeft, ShieldCheck, AlertCircle } from "lucide-react";

import { useLogin } from "../queries/auth";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { ThemeToggle } from "../components/ThemeToggle";
import { AppFooter } from "../components/layout/AppFooter";
import {
  ADMIN_LOGIN_FALLBACK_REDIRECT,
  resolveSafeAdminRedirect,
} from "../lib/authRedirect";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 64;
const PASSWORD_MAX_LENGTH = 256;

function validateLoginForm(values) {
  const errors = {};
  const username = values.username.trim();
  const password = values.password;

  if (!username) {
    errors.username = "Username wajib diisi.";
  } else if (username.length < USERNAME_MIN_LENGTH) {
    errors.username = `Username minimal ${USERNAME_MIN_LENGTH} karakter.`;
  } else if (username.length > USERNAME_MAX_LENGTH) {
    errors.username = `Username maksimal ${USERNAME_MAX_LENGTH} karakter.`;
  }

  if (!password || password.trim().length === 0) {
    errors.password = "Password wajib diisi.";
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`;
  }

  return errors;
}

function extractServerFieldErrors(error) {
  const rawErrors = error?.payload?.errors;
  if (!rawErrors || typeof rawErrors !== "object" || Array.isArray(rawErrors)) {
    return {};
  }

  const result = {};
  if (typeof rawErrors.username === "string" && rawErrors.username.trim()) {
    result.username = rawErrors.username.trim();
  }
  if (typeof rawErrors.password === "string" && rawErrors.password.trim()) {
    result.password = rawErrors.password.trim();
  }
  return result;
}

function resolveLoginErrorMessage(error) {
  if (!error) return "";

  const status = Number(error.status);
  if (status === 401) return "Username atau password salah.";
  if (status === 429) {
    return "Terlalu banyak percobaan login. Tunggu beberapa menit lalu coba lagi.";
  }
  if (status === 503) return "Layanan login sedang tidak tersedia sementara. Coba lagi.";
  if (status >= 500) return "Server sedang mengalami kendala. Silakan coba lagi.";
  if (error.code === "NETWORK_ERROR") {
    return "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
  }

  return "Login gagal. Periksa data lalu coba lagi.";
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const userRef = useRef(null);
  const passRef = useRef(null);

  const redirectTarget = useMemo(() => {
    const rawTarget = new URLSearchParams(location.search).get("redirect");
    return resolveSafeAdminRedirect(rawTarget, ADMIN_LOGIN_FALLBACK_REDIRECT);
  }, [location.search]);

  const [form, setForm] = useState({
    username: "",
    password: "",
    remember: false,
  });
  const [touched, setTouched] = useState({ username: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState({});

  const clientErrors = useMemo(() => validateLoginForm(form), [form]);
  const fieldErrors = useMemo(
    () => ({ ...clientErrors, ...serverFieldErrors }),
    [clientErrors, serverFieldErrors]
  );

  const isSubmitting = loginMutation.isLoading;
  const loginErrorMessage = resolveLoginErrorMessage(loginMutation.error);
  const hasServerFieldErrors = Object.keys(serverFieldErrors).length > 0;
  const hasClientErrors = Object.keys(clientErrors).length > 0;

  useDocumentTitle("Login");

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!submitted) return;
    const [firstErrorField] = Object.keys(fieldErrors);
    if (firstErrorField === "username") userRef.current?.focus();
    if (firstErrorField === "password") passRef.current?.focus();
  }, [fieldErrors, submitted]);

  function showFieldError(fieldName) {
    return Boolean((submitted || touched[fieldName]) && fieldErrors[fieldName]);
  }

  function resetMutationErrorIfNeeded() {
    if (loginMutation.isError) {
      loginMutation.reset();
    }
  }

  function updateField(fieldName, value) {
    setForm((prev) => ({ ...prev, [fieldName]: value }));

    if (serverFieldErrors[fieldName]) {
      setServerFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }

    resetMutationErrorIfNeeded();
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    setSubmitted(true);
    setTouched({ username: true, password: true });
    setServerFieldErrors({});

    if (hasClientErrors) {
      const [firstErrorField] = Object.keys(clientErrors);
      if (firstErrorField === "username") userRef.current?.focus();
      if (firstErrorField === "password") passRef.current?.focus();
      return;
    }

    loginMutation.mutate(
      {
        username: form.username.trim(),
        password: form.password,
        remember: form.remember,
      },
      {
        onSuccess: () => {
          setServerFieldErrors({});
          navigate(redirectTarget, { replace: true });
        },
        onError: (error) => {
          const fieldLevelErrors = extractServerFieldErrors(error);
          const keys = Object.keys(fieldLevelErrors);

          if (!keys.length) {
            passRef.current?.focus();
            return;
          }

          setServerFieldErrors(fieldLevelErrors);
          if (keys[0] === "username") userRef.current?.focus();
          if (keys[0] === "password") passRef.current?.focus();
        },
      }
    );
  }

  const usernameErrorVisible = showFieldError("username");
  const passwordErrorVisible = showFieldError("password");
  const submitDisabled = isSubmitting || hasClientErrors;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(70%_60%_at_20%_0%,hsl(var(--primary)/0.16),transparent_74%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-[-18%] top-8 hidden w-[46vw] rounded-full bg-primary/8 blur-3xl md:block" />

      <header className="relative z-10 border-b border-border/65 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground no-underline transition hover:bg-muted/50 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <ThemeToggle className="h-10" />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-[500px]">
          <section className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-lg backdrop-blur sm:p-7">
            <div className="mb-6 space-y-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-3">
                  <img src="/logo.png" alt="SIGAP" className="h-9 w-9 rounded-md" />
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    Masuk ke Dashboard
                  </h1>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Akses terbatas untuk admin. Gunakan akun internal untuk
                  melanjutkan.
                </p>
              </div>
            </div>

            <form
              className="space-y-4 sm:space-y-5"
              onSubmit={handleSubmit}
              noValidate
              aria-busy={isSubmitting}
            >
              <div className="space-y-2">
                <Label htmlFor="username" className="text-muted-foreground">
                  Username
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <User className="h-4 w-4" />
                  </span>
                  <Input
                    id="username"
                    ref={userRef}
                    autoComplete="username"
                    value={form.username}
                    onChange={(event) => updateField("username", event.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
                    required
                    maxLength={USERNAME_MAX_LENGTH}
                    aria-invalid={usernameErrorVisible}
                    aria-describedby={
                      usernameErrorVisible ? "username-error" : "username-helper"
                    }
                    variant={
                      usernameErrorVisible
                        ? "error"
                        : touched.username && !fieldErrors.username
                        ? "success"
                        : "default"
                    }
                    className="pl-10"
                  />
                </div>
                {usernameErrorVisible ? (
                  <p
                    id="username-error"
                    role="alert"
                    className="flex items-center gap-1.5 text-xs text-destructive"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    {fieldErrors.username}
                  </p>
                ) : (
                  <p id="username-helper" className="text-xs text-muted-foreground">
                    Minimal {USERNAME_MIN_LENGTH} karakter.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-muted-foreground">
                    Password
                  </Label>
                  {capsLockOn ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-md border border-warning/35 bg-warning/12 px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
                      aria-live="polite"
                    >
                      Caps Lock aktif
                    </span>
                  ) : null}
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <Input
                    id="password"
                    ref={passRef}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, password: true }));
                      setCapsLockOn(false);
                    }}
                    onKeyDown={(event) =>
                      setCapsLockOn(Boolean(event.getModifierState?.("CapsLock")))
                    }
                    onKeyUp={(event) =>
                      setCapsLockOn(Boolean(event.getModifierState?.("CapsLock")))
                    }
                    required
                    maxLength={PASSWORD_MAX_LENGTH}
                    aria-invalid={passwordErrorVisible}
                    aria-describedby={passwordErrorVisible ? "password-error" : undefined}
                    variant={
                      passwordErrorVisible
                        ? "error"
                        : touched.password && !fieldErrors.password
                        ? "success"
                        : "default"
                    }
                    className="pl-10 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={isSubmitting}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-2 my-1.5 inline-flex items-center rounded-md px-2 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {passwordErrorVisible ? (
                  <p
                    id="password-error"
                    role="alert"
                    className="flex items-center gap-1.5 text-xs text-destructive"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label
                  htmlFor="remember"
                  className="inline-flex select-none items-center gap-2 text-sm text-muted-foreground"
                >
                  <input
                    id="remember"
                    type="checkbox"
                    checked={form.remember}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, remember: event.target.checked }));
                      resetMutationErrorIfNeeded();
                    }}
                    className="h-4 w-4 rounded-[4px] border border-border/70 bg-muted/25 accent-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  Ingat saya
                </label>
                <p className="text-xs text-muted-foreground">Lupa password? Hubungi IPDS 6502</p>
              </div>

              {loginMutation.isError && loginErrorMessage && !hasServerFieldErrors ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{loginErrorMessage}</span>
                </div>
              ) : null}

              <div className="space-y-2 pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isSubmitting}
                  loadingText="Memverifikasi..."
                  disabled={submitDisabled}
                  className="w-full"
                >
                  Masuk
                </Button>
                {isSubmitting ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Memproses login dengan aman...
                  </p>
                ) : null}
              </div>
            </form>
          </section>
        </div>
      </main>

      <AppFooter className="relative z-10 bg-transparent" />
    </div>
  );
}
