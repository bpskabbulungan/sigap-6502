import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../queries/auth";
import { useTemplatesCatalog, useUpsertTemplate } from "../queries/templates";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Label } from "../components/ui/Label";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { QueryErrorNotice } from "../components/error/QueryErrorNotice";
import { ToneSurface } from "../components/ui/ToneSurface";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useConfirm } from "../components/ui/ConfirmProvider.jsx";
import {
  Save,
  RotateCcw,
  Eye,
  Pencil,
  LockOpen,
  Lock,
  Clipboard,
  Check,
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

const NAME_PLACEHOLDER = "{name}";
const QUOTE_PLACEHOLDER = "{quote}";

const STARTER_TEMPLATE = `Halo ${NAME_PLACEHOLDER},\n${QUOTE_PLACEHOLDER}\nSemoga harimu menyenangkan!`;

const PLACEHOLDERS = [
  {
    token: NAME_PLACEHOLDER,
    label: "Nama penerima",
    toneClasses:
      "border-info/35 bg-info/10 text-info hover:border-info/50 hover:bg-info/15",
  },
  {
    token: QUOTE_PLACEHOLDER,
    label: "Kutipan harian",
    toneClasses:
      "border-warning/35 bg-warning/10 text-warning hover:border-warning/50 hover:bg-warning/15",
  },
];

function PlaceholderButton({ token, label, toneClasses, onInsert, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onInsert(token)}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${toneClasses} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-45`}
      title={`Sisipkan ${token}`}
    >
      <code className="font-semibold">{token}</code>
      <span className="opacity-80">{label}</span>
    </button>
  );
}

function PreviewContent({ content }) {
  const parts = String(content || "").split(/(\{[^}]+\})/g);

  return (
    <div className="min-h-[280px] whitespace-pre-wrap rounded-2xl border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.22)_100%)] p-4 text-sm leading-7 text-foreground sm:p-5 sm:text-base">
      {parts.map((segment, index) =>
        /^\{[^}]+\}$/.test(segment) ? (
          <mark
            key={`${segment}-${index}`}
            className="rounded bg-warning/25 px-1.5 py-0.5 font-semibold text-warning"
          >
            {segment}
          </mark>
        ) : (
          <span key={`${segment}-${index}`}>{segment}</span>
        )
      )}
    </div>
  );
}

export default function AdminTemplatesPage() {
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data, isLoading, isError, error, isFetching, refetch } =
    useTemplatesCatalog();
  const upsertMutation = useUpsertTemplate();

  useDocumentTitle("Templat Pesan");

  const [activeTab, setActiveTab] = useState("edit");
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);
  const [previewName, setPreviewName] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const syncedTemplateRef = useRef({ id: "", updatedAt: "" });
  const textareaRef = useRef(null);

  const templateRecord = useMemo(() => {
    if (Array.isArray(data?.templates) && data.templates.length > 0) {
      return data.templates[0];
    }

    if (typeof data?.template === "string") {
      return {
        id: "default-reminder",
        content: data.template,
        updatedAt: "",
      };
    }

    return null;
  }, [data]);

  const isDirty = useMemo(() => {
    if (!templateRecord) return false;
    return templateContent !== (templateRecord.content || "");
  }, [templateContent, templateRecord]);

  useEffect(() => {
    if (!templateRecord) return;

    const nextUpdatedAt = templateRecord.updatedAt || "";
    const previousSync = syncedTemplateRef.current;
    const switchedTemplate = previousSync.id !== templateRecord.id;
    const refreshedServer =
      previousSync.id === templateRecord.id &&
      previousSync.updatedAt !== nextUpdatedAt;

    if (switchedTemplate || (!isDirty && refreshedServer)) {
      setTemplateContent(templateRecord.content || "");
      syncedTemplateRef.current = {
        id: templateRecord.id || "default-reminder",
        updatedAt: nextUpdatedAt,
      };
    }
  }, [templateRecord, isDirty]);

  const isTemplateEmpty = templateContent.trim().length === 0;
  const lineCount = templateContent ? templateContent.split(/\n/).length : 0;
  const characterCount = templateContent.length;

  const preview = useMemo(
    () =>
      (templateContent || "")
        .replaceAll(NAME_PLACEHOLDER, previewName || "Nama Penerima")
        .replaceAll(QUOTE_PLACEHOLDER, "Kutipan hari ini"),
    [templateContent, previewName]
  );

  const handleSave = useCallback(
    (event) => {
      event?.preventDefault?.();

      if (!templateRecord) {
        addToast("Data templat belum tersedia.", { type: "warning" });
        return;
      }

      if (!isEditUnlocked) {
        addToast("Aktifkan edit terlebih dahulu.", { type: "warning" });
        return;
      }

      if (!templateContent.trim()) {
        addToast("Isi templat tidak boleh kosong.", { type: "warning" });
        return;
      }

      upsertMutation.mutate(
        {
          templateId: templateRecord.id,
          content: templateContent,
        },
        {
          onSuccess: (response) => {
            setLastSavedAt(new Date());
            addToast(response?.message || "Templat berhasil disimpan.", {
              type: "success",
            });
          },
          onError: (err) => {
            addToast(err?.message || "Gagal menyimpan templat.", {
              type: "error",
            });
          },
        }
      );
    },
    [addToast, isEditUnlocked, templateRecord, templateContent, upsertMutation]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!upsertMutation.isLoading && isDirty && isEditUnlocked) {
          handleSave();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, isDirty, isEditUnlocked, upsertMutation.isLoading]);

  const insertAtCursor = useCallback((token) => {
    if (!isEditUnlocked) return;

    const element = textareaRef.current;
    if (!element) {
      setTemplateContent((prev) => `${prev || ""}${token}`);
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const nextValue = `${element.value.slice(0, start)}${token}${element.value.slice(
      end
    )}`;

    setTemplateContent(nextValue);

    requestAnimationFrame(() => {
      element.focus();
      const cursor = start + token.length;
      element.setSelectionRange(cursor, cursor);
    });
  }, [isEditUnlocked]);

  const handleReset = useCallback(async () => {
    if (!templateRecord || !isEditUnlocked) return;

    const ok = await confirm({
      title: "Reset draf templat?",
      message: "Perubahan yang belum disimpan akan dibatalkan.",
      confirmText: "Ya, reset",
      variant: "warning",
    });

    if (!ok) return;

    setTemplateContent(templateRecord.content || "");
    addToast("Perubahan templat direset.", { type: "info" });
  }, [addToast, confirm, isEditUnlocked, templateRecord]);

  const applyStarterTemplate = useCallback(() => {
    if (!isEditUnlocked) return;
    setTemplateContent(STARTER_TEMPLATE);
    addToast("Contoh awal dimasukkan ke editor.", { type: "info" });
  }, [addToast, isEditUnlocked]);

  const handleCopyPreview = useCallback(async () => {
    if (!preview.trim()) {
      addToast("Pratinjau masih kosong.", { type: "warning" });
      return;
    }

    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      addToast("Gagal menyalin pratinjau.", { type: "error" });
    }
  }, [addToast, preview]);

  const handleActivateEdit = useCallback(() => {
    setIsEditUnlocked(true);
  }, []);

  const handleDeactivateEdit = useCallback(async () => {
    if (isDirty) {
      const ok = await confirm({
        title: "Nonaktifkan mode edit?",
        message:
          "Perubahan yang belum disimpan tetap tersimpan sebagai draf lokal di halaman ini.",
        confirmText: "Nonaktifkan",
        variant: "warning",
      });

      if (!ok) return;
    }

    setIsEditUnlocked(false);
    setActiveTab("preview");
  }, [confirm, isDirty]);

  const savedAtLabel = useMemo(() => {
    if (!lastSavedAt) return "";
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(lastSavedAt);
  }, [lastSavedAt]);

  const showInitialLoading = isLoading && !data;
  const showInitialError = isError && !data;

  return (
    <AdminLayout username={session?.user?.username} loading={sessionLoading}>
      <div className="ds-page-stack">
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(155deg,hsl(var(--card))_0%,hsl(var(--card))_55%,hsl(var(--primary)/0.06)_100%)] p-0">
          <div className="border-b border-border/70 bg-background/40 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Manajemen Templat Pesan
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Halaman kelola templat pesan yang akan dikirimkan oleh bot.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {isEditUnlocked ? (
                  <span className="inline-flex items-center rounded-full border border-info/35 bg-info/10 px-3 py-1 text-xs font-semibold text-info">
                    Mode edit aktif
                  </span>
                ) : null}
                {!isEditUnlocked ? (
                  <Button
                    type="button"
                    variant="success"
                    onClick={handleActivateEdit}
                    disabled={showInitialLoading || showInitialError || !templateRecord}
                    className="!border-emerald-700 !bg-emerald-600 !text-white shadow-sm shadow-emerald-600/30 hover:!bg-emerald-700"
                  >
                    <LockOpen className="h-4 w-4" />
                    Aktifkan edit
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleDeactivateEdit()}
                    disabled={showInitialLoading || showInitialError || !templateRecord}
                  >
                    <Lock className="h-4 w-4" />
                    Nonaktifkan edit
                  </Button>
                )}
              </div>
            </div>

            {isFetching && !showInitialLoading ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-info/35 bg-info/10 px-3 py-1 text-xs font-medium text-info">
                <Spinner size="sm" />
                Menyinkronkan data templat...
              </div>
            ) : null}
          </div>

          <div className="p-4 sm:p-6">
            {showInitialError ? (
              <div className="space-y-3">
                <QueryErrorNotice
                  error={error}
                  fallbackMessage="Data templat belum dapat dimuat dari server."
                  onRetry={() => refetch()}
                  retryLabel="Muat ulang data"
                />
              </div>
            ) : showInitialLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-72 w-full rounded-2xl" />
              </div>
            ) : !templateRecord ? (
              <EmptyState
                variant="warning"
                title="Templat belum tersedia"
                description="Silakan muat ulang halaman untuk mengambil data templat."
              />
            ) : (
              <section className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4">
                  <div className="mb-4">
                    <div className="grid grid-cols-1 gap-2 rounded-2xl border border-border/70 bg-background/70 p-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("edit")}
                        aria-pressed={activeTab === "edit"}
                        aria-current={activeTab === "edit" ? "page" : undefined}
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${
                          activeTab === "edit"
                            ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/35 shadow-lg shadow-primary/30"
                            : "border-border/70 bg-background/55 text-muted-foreground hover:border-primary/30 hover:bg-muted/70 hover:text-foreground"
                        }`}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("preview")}
                        aria-pressed={activeTab === "preview"}
                        aria-current={activeTab === "preview" ? "page" : undefined}
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${
                          activeTab === "preview"
                            ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/35 shadow-lg shadow-primary/30"
                            : "border-border/70 bg-background/55 text-muted-foreground hover:border-primary/30 hover:bg-muted/70 hover:text-foreground"
                        }`}
                      >
                        <Eye className="h-4 w-4" />
                        Pratinjau
                      </button>
                    </div>
                  </div>

                  {activeTab === "preview" ? (
                    <div id="templat-preview" className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="preview-name">Nama untuk pratinjau</Label>
                          <Input
                            id="preview-name"
                            value={previewName}
                            onChange={(event) => setPreviewName(event.target.value)}
                            placeholder="Contoh: Budi"
                            className="w-full rounded-xl border-border/70 bg-background sm:w-60"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleCopyPreview}
                          disabled={isTemplateEmpty}
                        >
                          {copied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Clipboard className="h-4 w-4" />
                          )}
                          {copied ? "Tersalin" : "Salin"}
                        </Button>
                      </div>

                      {isTemplateEmpty ? (
                        <EmptyState
                          variant="warning"
                          title="Templat masih kosong"
                          description="Buka tab Edit lalu isi konten pesan."
                        />
                      ) : (
                        <PreviewContent content={preview} />
                      )}

                      {!isEditUnlocked ? (
                        <ToneSurface tone="info" size="sm" className="text-xs leading-5">
                          Edit belum aktif. Klik tombol "Aktifkan edit" jika ingin mengubah isi templat.
                        </ToneSurface>
                      ) : null}
                    </div>
                  ) : (
                    <div id="templat-editor" className="space-y-4">
                      {!isEditUnlocked ? (
                        <ToneSurface tone="warning" className="text-sm">
                          Mode edit masih terkunci. Aktifkan edit terlebih dahulu.
                        </ToneSurface>
                      ) : null}

                      <div className="rounded-xl border border-border/70 bg-muted/15 p-3 sm:p-4">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="template-editor">Isi Templat Pesan</Label>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Sisipkan placeholder agar isi pesan tetap dinamis.
                            </p>
                          </div>

                          {isTemplateEmpty ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={applyStarterTemplate}
                              disabled={!isEditUnlocked}
                            >
                              Gunakan contoh awal
                            </Button>
                          ) : null}
                        </div>

                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Sisipkan cepat:
                          </span>
                          {PLACEHOLDERS.map((item) => (
                            <PlaceholderButton
                              key={item.token}
                              token={item.token}
                              label={item.label}
                              toneClasses={item.toneClasses}
                              onInsert={insertAtCursor}
                              disabled={!isEditUnlocked}
                            />
                          ))}
                        </div>

                        <textarea
                          id="template-editor"
                          ref={textareaRef}
                          value={templateContent}
                          onChange={(event) => setTemplateContent(event.target.value)}
                          placeholder={STARTER_TEMPLATE}
                          disabled={!isEditUnlocked}
                          className="min-h-[280px] w-full resize-y rounded-xl border border-border/70 bg-background px-4 py-3 text-sm leading-7 text-foreground shadow-inner shadow-black/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-muted/35 disabled:text-muted-foreground sm:min-h-[320px]"
                        />

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            {characterCount} karakter | {lineCount} baris
                          </span>
                          <span className="opacity-80">Ctrl/Cmd + S untuk simpan</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
                        <Button
                          type="button"
                          variant="secondary"
                          outline
                          disabled={!isDirty || !isEditUnlocked || upsertMutation.isLoading}
                          onClick={handleReset}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Batal
                        </Button>
                        <Button
                          type="button"
                          variant="info"
                          loading={upsertMutation.isLoading}
                          loadingText="Menyimpan..."
                          disabled={!isDirty || !isEditUnlocked || upsertMutation.isLoading}
                          onClick={handleSave}
                          className="!border-sky-700 !bg-sky-600 !text-white shadow-sm shadow-sky-600/20 hover:!bg-sky-700"
                        >
                          {upsertMutation.isLoading ? null : (
                            <>
                              <Save className="h-4 w-4" />
                              Simpan
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {upsertMutation.error ? (
                    <ToneSurface tone="danger" className="mt-4 text-sm">
                      {upsertMutation.error.message || "Gagal menyimpan templat."}
                    </ToneSurface>
                  ) : null}

                  {lastSavedAt && !isDirty ? (
                    <ToneSurface tone="success" className="mt-4 text-sm">
                      Templat berhasil disimpan pada pukul {savedAtLabel}.
                    </ToneSurface>
                  ) : null}
                </div>
              </section>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
