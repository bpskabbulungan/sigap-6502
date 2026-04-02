import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { ToneSurface } from "./ui/ToneSurface";
import {
  isValidWhatsappNumber,
  normalizeWhatsappNumber,
  formatStatusLabel,
} from "../lib/contactFormatters";

function normalizeStatusOptions(options) {
  if (!Array.isArray(options)) {
    return ["masuk"];
  }

  const normalized = options
    .map((status) => String(status || "").trim().toLowerCase())
    .filter(Boolean);

  return normalized.length ? [...new Set(normalized)] : ["masuk"];
}

function resolveInitialValues(initialValues, fallbackStatus) {
  return {
    name: String(initialValues?.name || "").trim(),
    number: String(initialValues?.number || "").replace(/\D/g, ""),
    status: String(initialValues?.status || fallbackStatus).trim().toLowerCase(),
  };
}

function validateContact(values, allowedStatuses) {
  const errors = {};
  const trimmedName = String(values.name || "").trim();
  const normalizedNumber = normalizeWhatsappNumber(values.number);
  const normalizedStatus = String(values.status || "").trim().toLowerCase();

  if (!trimmedName) {
    errors.name = "Nama wajib diisi.";
  } else if (trimmedName.length < 2) {
    errors.name = "Nama minimal 2 karakter.";
  }

  if (!values.number) {
    errors.number = "Nomor WhatsApp wajib diisi.";
  } else if (!isValidWhatsappNumber(normalizedNumber)) {
    errors.number = "Nomor tidak valid. Gunakan format 62XXXXXXXXXXX.";
  }

  if (!allowedStatuses.includes(normalizedStatus)) {
    errors.status = "Status tidak valid.";
  }

  return errors;
}

export function ContactForm({
  allowedStatuses = ["masuk"],
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Simpan",
  title = "Kontak",
  description,
  errorMessage,
  formId = "contact-form",
  hideActions = false,
  onDirtyChange,
  onValidityChange,
}) {
  const normalizedStatuses = useMemo(
    () => normalizeStatusOptions(allowedStatuses),
    [allowedStatuses]
  );
  const defaultStatus = normalizedStatuses[0] ?? "masuk";
  const initialSnapshot = useMemo(
    () => resolveInitialValues(initialValues, defaultStatus),
    [initialValues, defaultStatus]
  );

  const [values, setValues] = useState(initialSnapshot);
  const [touched, setTouched] = useState({
    name: false,
    number: false,
    status: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setValues(initialSnapshot);
    setTouched({ name: false, number: false, status: false });
    setSubmitAttempted(false);
  }, [initialSnapshot]);

  const handleChange = (field) => (event) => {
    const rawValue = event.target.value;
    const value = field === "number" ? rawValue.replace(/\D/g, "") : rawValue;
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const errors = useMemo(
    () => validateContact(values, normalizedStatuses),
    [values, normalizedStatuses]
  );

  const normalizedNumber = useMemo(
    () => normalizeWhatsappNumber(values.number),
    [values.number]
  );

  const isDirty = useMemo(
    () =>
      values.name.trim() !== initialSnapshot.name ||
      values.number !== initialSnapshot.number ||
      values.status !== initialSnapshot.status,
    [values, initialSnapshot]
  );

  const canSubmit = Object.keys(errors).length === 0 && !isSubmitting;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onValidityChange?.(canSubmit);
  }, [canSubmit, onValidityChange]);

  const showNameError = Boolean((touched.name || submitAttempted) && errors.name);
  const showNumberError = Boolean((touched.number || submitAttempted) && errors.number);
  const showStatusError = Boolean((touched.status || submitAttempted) && errors.status);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setTouched({ name: true, number: true, status: true });

    if (Object.keys(errors).length > 0) return;

    onSubmit?.({
      name: values.name.trim(),
      number: normalizeWhatsappNumber(values.number),
      status: values.status,
    });
  };

  const submitActionVariant =
    String(submitLabel).trim().toLowerCase() === "tambah"
      ? "success"
      : "primary";

  const content = (
    <>
      {title || description ? (
        <div
          className={clsx(
            "space-y-1",
            hideActions && "rounded-xl border border-border/70 bg-muted/25 px-4 py-3"
          )}
        >
          {title ? <h2 className="text-lg font-semibold text-foreground">{title}</h2> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}

      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="contact-name"
            required
            variant={showNameError ? "error" : "default"}
          >
            Nama Lengkap
          </Label>
          <Input
            id="contact-name"
            value={values.name}
            onChange={handleChange("name")}
            onBlur={handleBlur("name")}
            required
            placeholder="Nama pegawai"
            variant={showNameError ? "error" : "default"}
            aria-invalid={showNameError}
            aria-describedby={showNameError ? "contact-name-error" : undefined}
            autoComplete="name"
          />
          {showNameError ? (
            <p id="contact-name-error" className="text-sm text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="contact-number"
            required
            variant={showNumberError ? "error" : "default"}
          >
            Nomor WhatsApp
          </Label>
          <Input
            id="contact-number"
            type="tel"
            value={values.number}
            onChange={handleChange("number")}
            onBlur={handleBlur("number")}
            required
            placeholder="0812xxxxxxx atau 62812xxxxxxx"
            aria-invalid={showNumberError}
            aria-describedby={
              showNumberError ? "wa-help wa-error" : "wa-help"
            }
            variant={showNumberError ? "error" : "default"}
            inputMode="numeric"
            autoComplete="tel"
          />
          {values.number && !showNumberError ? (
            <p className="text-xs text-info">Format tersimpan: +{normalizedNumber}</p>
          ) : null}
          {showNumberError ? (
            <p id="wa-error" className="text-sm text-destructive">
              {errors.number}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="contact-status"
            required
            variant={showStatusError ? "error" : "default"}
          >
            Status
          </Label>
          <select
            id="contact-status"
            className="
              w-full rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-sm
              font-medium text-foreground shadow-inner shadow-black/10
              focus:border-primary focus:outline-none focus:ring focus:ring-primary/20
              [&>option]:bg-white [&>option]:text-slate-900
              dark:border-border/70
            "
            value={values.status}
            onChange={handleChange("status")}
            onBlur={handleBlur("status")}
            aria-invalid={showStatusError}
            aria-describedby={showStatusError ? "contact-status-error" : undefined}
          >
            {normalizedStatuses.map((status) => (
              <option
                key={status}
                value={status}
                className="bg-white text-slate-900"
              >
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
          {showStatusError ? (
            <p id="contact-status-error" className="text-sm text-destructive">
              {errors.status}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <ToneSurface tone="danger" size="sm">
            <p className="text-sm">{errorMessage}</p>
          </ToneSurface>
        ) : null}

        {!hideActions && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant={submitActionVariant}
              loading={isSubmitting}
              loadingText="Menyimpan..."
              disabled={!canSubmit}
            >
              {isSubmitting ? "Menyimpan..." : submitLabel}
            </Button>
            {onCancel ? (
              <Button
                type="button"
                variant="secondary"
                outline
                onClick={() => onCancel?.()}
                disabled={isSubmitting}
              >
                Batal
              </Button>
            ) : null}
          </div>
        )}
      </form>
    </>
  );

  if (hideActions) {
    return <div className="space-y-5">{content}</div>;
  }

  return (
    <Card className="space-y-5 border-border/70 bg-card p-6">
      {content}
    </Card>
  );
}
