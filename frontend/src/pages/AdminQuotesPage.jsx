import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../queries/auth";
import {
  useQuotes,
  useCreateQuote,
  useUpdateQuote,
  useDeleteQuote,
} from "../queries/quotes";
import { AdminLayout } from "../components/layout/AdminLayout";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Modal } from "../components/ui/Modal";
import { QueryErrorNotice } from "../components/error/QueryErrorNotice";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { ToneSurface } from "../components/ui/ToneSurface";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useConfirm } from "../components/ui/ConfirmProvider.jsx";
import {
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Save,
  MessageSquareText,
  SearchX,
  RefreshCcw,
  Filter,
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setV(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return v;
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function QuotesLoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={`quotes-stat-${index}`} className="h-20" effect="shimmer" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={`quotes-card-${index}`} className="h-52" effect="shimmer" />
        ))}
      </div>
    </div>
  );
}

const MAX_QUOTE_LENGTH = 280;
const PAGE_SIZE = 9;
const PRIMARY_ACTION_CLASS =
  "!border-sky-700 !bg-sky-600 !text-white hover:!bg-sky-700";

export default function AdminQuotesPage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data, isLoading, isError, error, isFetching, refetch } = useQuotes();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const deleteMutation = useDeleteQuote();
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();

  useDocumentTitle("Kutipan Harian");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [content, setContent] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [contentTouched, setContentTouched] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 250);
  const searchRef = useRef(null);
  const textareaRef = useRef(null);
  const formRef = useRef(null);

  const isCreatePending = createMutation.isPending ?? createMutation.isLoading;
  const isUpdatePending = updateMutation.isPending ?? updateMutation.isLoading;
  const isDeletePending = deleteMutation.isPending ?? deleteMutation.isLoading;
  const isMutating = isCreatePending || isUpdatePending;
  const deletingId = deleteMutation.variables;

  const trimmedContent = content.trim();
  const remainingCharacters = MAX_QUOTE_LENGTH - content.length;
  const showContentError = contentTouched && trimmedContent.length === 0;
  const hasDraftChanges = trimmedContent !== initialContent.trim();

  const quotes = useMemo(() => data?.quotes || [], [data]);
  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return quotes;
    return quotes.filter((item) =>
      String(item?.content || "").toLowerCase().includes(query)
    );
  }, [quotes, debouncedSearch]);

  const totalQuotes = quotes.length;
  const totalFiltered = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const formError = updateMutation.error?.message || createMutation.error?.message || "";

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (
        modalOpen &&
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !isMutating
      ) {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, isMutating]);

  const closeModalWithoutConfirm = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setContent("");
    setInitialContent("");
    setContentTouched(false);
    createMutation.reset();
    updateMutation.reset();
  }, [createMutation, updateMutation]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setContent("");
    setInitialContent("");
    setContentTouched(false);
    createMutation.reset();
    updateMutation.reset();
    setModalOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [createMutation, updateMutation]);

  const openEdit = useCallback(
    (quote) => {
      const nextContent = String(quote?.content || "");
      setEditing(quote);
      setContent(nextContent);
      setInitialContent(nextContent);
      setContentTouched(false);
      createMutation.reset();
      updateMutation.reset();
      setModalOpen(true);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [createMutation, updateMutation]
  );

  const closeModal = useCallback(async () => {
    if (isMutating) return;

    if (hasDraftChanges) {
      const ok = await confirm({
        title: "Tutup formulir?",
        message: "Perubahan kutipan yang belum disimpan akan hilang.",
        confirmText: "Tutup",
        variant: "warning",
      });
      if (!ok) return;
    }

    closeModalWithoutConfirm();
  }, [confirm, hasDraftChanges, isMutating, closeModalWithoutConfirm]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      setContentTouched(true);

      const payload = trimmedContent;
      if (!payload) {
        textareaRef.current?.focus();
        return;
      }

      if (editing?.id) {
        updateMutation.mutate(
          { id: editing.id, content: payload },
          {
            onSuccess: () => {
              addToast("Kutipan diperbarui.", { type: "success" });
              closeModalWithoutConfirm();
            },
            onError: (err) =>
              addToast(err?.message || "Gagal memperbarui kutipan.", {
                type: "error",
              }),
          }
        );
        return;
      }

      createMutation.mutate(
        { content: payload },
        {
          onSuccess: () => {
            addToast("Kutipan ditambahkan.", { type: "success" });
            closeModalWithoutConfirm();
          },
          onError: (err) =>
            addToast(err?.message || "Gagal menambah kutipan.", {
              type: "error",
            }),
        }
      );
    },
    [
      addToast,
      closeModalWithoutConfirm,
      createMutation,
      editing,
      trimmedContent,
      updateMutation,
    ]
  );

  const handleDelete = useCallback(
    async (quote) => {
      if (!quote?.id) return;

      const ok = await confirm({
        title: "Hapus kutipan?",
        message: "Kutipan yang dihapus tidak dapat dikembalikan.",
        confirmText: "Hapus",
        variant: "danger",
      });
      if (!ok) return;

      deleteMutation.mutate(quote.id, {
        onSuccess: () => addToast("Kutipan dihapus.", { type: "success" }),
        onError: (err) =>
          addToast(err?.message || "Gagal menghapus kutipan.", {
            type: "error",
          }),
      });
    },
    [addToast, confirm, deleteMutation]
  );

  const clearSearch = () => setSearch("");

  return (
    <AdminLayout username={session?.user?.username} loading={sessionLoading}>
      <div className="ds-page-stack">
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(168deg,hsl(var(--card))_0%,hsl(var(--muted)/0.2)_56%,hsl(var(--primary)/0.08)_100%)] p-0">
          <section className="space-y-5 border-b border-border/70 bg-background/25 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <h1 className="ds-page-title">Manajemen Kutipan</h1>
                <p className="ds-body max-w-2xl">
                  Halaman kelola kutipan yang dipakai pada template pesan dan log.
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  onClick={openAdd}
                  variant="primary"
                  className={`w-full sm:w-auto ${PRIMARY_ACTION_CLASS}`}
                >
                  <Plus className="h-4 w-4" />
                  Tambah
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-primary/30 bg-[linear-gradient(160deg,hsl(var(--primary)/0.16)_0%,hsl(var(--card))_68%)] px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total kutipan</span>
                  <MessageSquareText className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">{totalQuotes}</p>
              </div>

              <div className="rounded-2xl border border-info/35 bg-[linear-gradient(160deg,hsl(var(--info)/0.18)_0%,hsl(var(--card))_70%)] px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Hasil filter</span>
                  <Filter className="h-4 w-4 text-info" />
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">{totalFiltered}</p>
              </div>

              <div className="rounded-2xl border border-success/35 bg-[linear-gradient(160deg,hsl(var(--success)/0.2)_0%,hsl(var(--card))_72%)] px-4 py-3 shadow-sm sm:col-span-2 xl:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Batas per kutipan</span>
                  <span className="rounded-full border border-success/45 bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
                    Maksimal
                  </span>
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {MAX_QUOTE_LENGTH} karakter
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="w-full lg:max-w-lg">
                <Input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari isi kutipan... (tekan /)"
                  prefix={<Search className="h-4 w-4" />}
                  suffix={
                    search ? (
                      <button
                        type="button"
                        onClick={clearSearch}
                        aria-label="Bersihkan pencarian kutipan"
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/65 hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null
                  }
                  className="bg-background/85"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 p-4 sm:p-6">
            {isFetching && !isLoading ? (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-info/35 bg-info/10 px-3 py-1 text-xs text-info">
                <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                Menyinkronkan daftar kutipan...
              </div>
            ) : null}

            {isLoading ? (
              <QuotesLoadingState />
            ) : isError ? (
              <QueryErrorNotice
                error={error}
                fallbackMessage="Daftar kutipan belum dapat dimuat dari server."
                onRetry={() => refetch()}
                retryLabel="Muat ulang data"
              />
            ) : totalQuotes === 0 ? (
              <EmptyState
                icon={<MessageSquareText className="h-10 w-10" />}
                title="Belum ada kutipan"
                description="Tambahkan kutipan pertama agar template pesan dapat menampilkan konten kutipan."
                actionLabel="Tambah kutipan pertama"
                onAction={openAdd}
                actionVariant="primary"
                className="border-primary/30 bg-[linear-gradient(160deg,hsl(var(--primary)/0.08)_0%,hsl(var(--card))_70%)]"
              />
            ) : totalFiltered === 0 ? (
              <EmptyState
                icon={<SearchX className="h-10 w-10" />}
                title="Kutipan tidak ditemukan"
                description="Coba ubah kata kunci pencarian atau reset filter."
                actionLabel="Reset pencarian"
                onAction={clearSearch}
                variant="info"
                actionVariant="secondary"
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((quote) => {
                    const isDeletingThis = isDeletePending && deletingId === quote.id;
                    const isEditingThis = editing?.id === quote.id;

                    return (
                      <article
                        key={quote.id}
                        className={`group flex min-h-[220px] flex-col rounded-2xl border p-4 shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-200 ${
                          isEditingThis
                            ? "border-info/55 bg-[linear-gradient(165deg,hsl(var(--info)/0.12)_0%,hsl(var(--card))_72%)] ring-2 ring-info/25"
                            : "border-border/70 bg-[linear-gradient(168deg,hsl(var(--card))_0%,hsl(var(--muted)/0.24)_100%)] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant={isEditingThis ? "info" : "default"}
                            className="rounded-full px-2.5 py-1 text-[10px] normal-case tracking-normal"
                          >
                            Kutipan #{quote.id}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {String(quote?.content || "").length} karakter
                          </span>
                        </div>

                        <p className="mt-3 flex-1 whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                          {quote.content}
                        </p>

                        <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-border/55 pt-3">
                          <Button
                            variant="info"
                            size="sm"
                            iconOnly
                            onClick={() => openEdit(quote)}
                            aria-label="Edit kutipan"
                            title="Edit kutipan"
                            disabled={isDeletePending}
                            className="focus-visible:ring-info/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit kutipan</span>
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            iconOnly
                            onClick={() => handleDelete(quote)}
                            aria-label="Hapus kutipan"
                            title="Hapus kutipan"
                            loading={isDeletingThis}
                            loadingText="Menghapus..."
                            disabled={isDeletePending && !isDeletingThis}
                            className="focus-visible:ring-destructive/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {!isDeletingThis ? <Trash2 className="h-4 w-4" /> : <span className="sr-only">Menghapus kutipan</span>}
                            {!isDeletingThis ? <span className="sr-only">Hapus kutipan</span> : null}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {pageCount > 1 ? (
                  <div className="mt-2 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground">
                      Menampilkan {visible.length ? start + 1 : 0}
                      {visible.length ? `-${start + visible.length}` : ""} dari{" "}
                      {totalFiltered} kutipan
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage(1)}
                        disabled={currentPage <= 1}
                        className="hidden sm:inline-flex"
                      >
                        Awal
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage <= 1}
                      >
                        Sebelumnya
                      </Button>
                      <span className="rounded-md border border-border/70 bg-muted/35 px-2.5 py-1 text-xs text-muted-foreground">
                        Hal {currentPage} / {pageCount}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                        disabled={currentPage >= pageCount}
                      >
                        Berikutnya
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage(pageCount)}
                        disabled={currentPage >= pageCount}
                        className="hidden sm:inline-flex"
                      >
                        Akhir
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </Card>

        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={editing ? "Edit Kutipan" : "Tambah Kutipan"}
          maxWidth="max-w-2xl"
          footer={
            <>
              <Button
                variant="secondary"
                outline
                onClick={closeModal}
                disabled={isMutating}
              >
                Batal
              </Button>
              <Button
                type="submit"
                form="quote-form"
                variant="primary"
                className={PRIMARY_ACTION_CLASS}
                loading={isMutating}
                loadingText={editing ? "Menyimpan..." : "Menambahkan..."}
                disabled={isMutating || trimmedContent.length === 0}
              >
                {!isMutating ? (
                  editing ? (
                    <>
                      <Save className="h-4 w-4" />
                      Simpan
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Tambah
                    </>
                  )
                ) : null}
              </Button>
            </>
          }
        >
          <form
            id="quote-form"
            ref={formRef}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-primary/25 bg-[linear-gradient(160deg,hsl(var(--primary)/0.12)_0%,hsl(var(--card))_74%)] px-4 py-3">
              <p className="text-xs leading-6 text-muted-foreground">
                Gunakan kalimat yang ringkas dan jelas agar kutipan mudah dibaca saat
                dikirim pada template pesan.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="quote-content" className="text-foreground">
                  Isi Kutipan
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <span
                  className={`text-xs ${
                    remainingCharacters <= 20
                      ? "font-semibold text-warning"
                      : "text-muted-foreground"
                  }`}
                >
                  {content.length}/{MAX_QUOTE_LENGTH} karakter
                </span>
              </div>

              <textarea
                id="quote-content"
                ref={textareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onBlur={() => setContentTouched(true)}
                maxLength={MAX_QUOTE_LENGTH}
                placeholder="Tulis isi kutipan yang akan digunakan di template pesan..."
                className={`min-h-[190px] w-full rounded-2xl border bg-background/85 px-4 py-3.5 text-sm leading-7 text-foreground shadow-inner shadow-black/10 transition focus:outline-none focus:ring-2 ${
                  showContentError
                    ? "border-destructive/60 focus:border-destructive focus:ring-destructive/30"
                    : "border-border/70 focus:border-primary focus:ring-primary/20"
                } placeholder:text-muted-foreground`}
                aria-invalid={showContentError}
                aria-describedby={`quote-content-helper${
                  showContentError ? " quote-content-error" : ""
                }`}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span id="quote-content-helper">
                  Gunakan Ctrl/Cmd + Enter untuk simpan cepat.
                </span>
                <span>Tersisa {Math.max(0, remainingCharacters)} karakter.</span>
              </div>

              {showContentError ? (
                <p id="quote-content-error" className="text-sm text-destructive">
                  Isi kutipan wajib diisi.
                </p>
              ) : null}
            </div>

            {trimmedContent ? (
              <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Pratinjau kutipan
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                  {trimmedContent}
                </p>
              </div>
            ) : null}

            {formError ? (
              <ToneSurface tone="danger" size="sm" className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{formError}</span>
              </ToneSurface>
            ) : null}
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
