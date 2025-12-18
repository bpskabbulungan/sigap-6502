import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Spinner } from "../components/ui/Spinner";
import { Modal } from "../components/ui/Modal";
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
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

/** Debounce kecil untuk pencarian */
function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const MAX_QUOTE_LENGTH = 280;

export default function AdminQuotesPage() {
  const navigate = useNavigate();
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data, isLoading, isError, error } = useQuotes();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const deleteMutation = useDeleteQuote();
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();

  useDocumentTitle("Quotes Harian");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [content, setContent] = useState("");
  const [contentTouched, setContentTouched] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const searchRef = useRef(null);
  const textareaRef = useRef(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const trimmedContent = content.trim();
  const remainingCharacters = MAX_QUOTE_LENGTH - content.length;
  const showContentError = contentTouched && trimmedContent.length === 0;

  useEffect(() => {
    if (!sessionLoading && !session?.authenticated) {
      navigate("/admin/login", { replace: true });
    }
  }, [session, sessionLoading, navigate]);

  /** Hotkey: "/" fokus ke search, Ctrl/Cmd+Enter submit modal */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (modalOpen && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!createMutation.isLoading && !updateMutation.isLoading) {
          handleSubmit(new Event("submit"));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    modalOpen,
    createMutation.isLoading,
    updateMutation.isLoading,
    handleSubmit,
  ]);

  const quotes = useMemo(() => data?.quotes || [], [data]);
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((x) => (x.content || "").toLowerCase().includes(q));
  }, [quotes, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const openAdd = () => {
    setEditing(null);
    setContent("");
    setContentTouched(false);
    setModalOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };
  const openEdit = (q) => {
    setEditing(q);
    setContent(q.content || "");
    setContentTouched(false);
    setModalOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };
  const closeModal = async () => {
    const ok = await confirm({
      title: "Tutup formulir?",
      message: "Perubahan yang belum disimpan akan hilang.",
      confirmText: "Tutup",
      variant: "warning",
    });
    if (ok) {
      setModalOpen(false);
      setContentTouched(false);
    }
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setContentTouched(true);
      const body = content.trim();
      if (!body) {
        textareaRef.current?.focus();
        return;
      }
      if (editing) {
        updateMutation.mutate(
          { id: editing.id, content: body },
          {
            onSuccess: () => {
              setModalOpen(false);
              setContentTouched(false);
              addToast("Quote diperbarui.", { type: "success" });
            },
            onError: (err) =>
              addToast(err?.message || "Gagal menyimpan.", { type: "error" }),
          }
        );
      } else {
        createMutation.mutate(
          { content: body },
          {
            onSuccess: () => {
              setModalOpen(false);
              setContentTouched(false);
              addToast("Quote ditambahkan.", { type: "success" });
            },
            onError: (err) =>
              addToast(err?.message || "Gagal menambah.", { type: "error" }),
          }
        );
      }
    },
    [addToast, content, createMutation, editing, updateMutation]
  );

  const handleDelete = async (q) => {
    const ok = await confirm({
      title: "Hapus quote?",
      message: "Tindakan ini tidak dapat dibatalkan.",
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    deleteMutation.mutate(q.id, {
      onSuccess: () => addToast("Quote dihapus.", { type: "success" }),
      onError: (err) =>
        addToast(err?.message || "Gagal menghapus.", { type: "error" }),
    });
  };

  const isMutating = createMutation.isLoading || updateMutation.isLoading;

  return (
    <AdminLayout username={session?.user?.username} loading={sessionLoading}>
      <div className="space-y-8">
        <Card
          className="space-y-6 border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-800/70 p-6 backdrop-blur-xl"
          header={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-white">
                  Manajemen Quotes
                </h1>
                <p className="text-sm text-slate-400">
                  Tambah, edit, dan hapus kutipan yang digunakan dalam pesan.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Search with icon + clear */}
                <div className="relative w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Cari isi quote…  (tekan /)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 pl-9 pr-9 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring focus:ring-primary-500/20"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Bersihkan pencarian"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-300 hover:bg-white/5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Add button: selalu biru di light/dark */}
                <Button
                  onClick={openAdd}
                  className="
                    inline-flex items-center gap-2 rounded-lg px-3 py-2
                    bg-sky-600 text-on-accent hover:bg-sky-500
                    border border-sky-400/30 shadow-lg shadow-sky-600/20
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60
                    focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface,#0b1220)]
                  "
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Tambah</span>
                  <span className="sm:hidden">Tambah</span>
                </Button>
              </div>
            </div>
          }
        >
          {isLoading ? (
            <div className="flex items-center gap-3 text-slate-300">
              <Spinner size="sm" /> Memuat quotes...
            </div>
          ) : isError ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{error?.message || "Gagal memuat data."}</span>
            </div>
          ) : (
            <>
              {visible.length === 0 ? (
                <div className="rounded-xl border border-slate-200/70 [.theme-dark_&]:border-white/10 bg-white/50 [.theme-dark_&]:bg-white/5 p-8 text-center text-sm text-slate-500 [.theme-dark_&]:text-slate-300">
                  Tidak ada data.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200/70 [.theme-dark_&]:border-white/10">
                  <div className="max-h-[520px] overflow-auto">
                    <table className="min-w-full text-sm divide-y divide-slate-200/70 [.theme-dark_&]:divide-white/10">
                      <thead className="bg-slate-100 text-slate-600 [.theme-dark_&]:bg-slate-900/80 [.theme-dark_&]:text-slate-400 text-xs uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-3 text-left">Quote</th>
                          <th className="px-4 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200/70 [.theme-dark_&]:divide-white/10">
                        {visible.map((q) => (
                          <tr
                            key={q.id}
                            className="
                group transition
                bg-white text-slate-700 hover:bg-slate-50
                [.theme-dark_&]:bg-slate-900/50 [.theme-dark_&]:text-slate-200 [.theme-dark_&]:hover:bg-slate-900/70
              "
                          >
                            <td className="px-4 py-3 leading-relaxed">
                              {q.content}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                {/* Edit */}
                                <Button
                                  variant="secondary"
                                  outline
                                  iconOnly
                                  onClick={() => openEdit(q)}
                                  aria-label="Edit quote"
                                  title="Edit"
                                  className="
                      hover:bg-slate-900/5 [.theme-dark_&]:hover:bg-white/10
                      focus-visible:ring-sky-300/60
                      focus-visible:ring-offset-2 focus-visible:ring-offset-white
                      [.theme-dark_&]:focus-visible:ring-offset-slate-900
                    "
                                >
                                  <Pencil className="h-5 w-5" />
                                  <span className="sr-only">Edit</span>
                                </Button>

                                {/* Hapus */}
                                <Button
                                  variant="danger"
                                  outline
                                  iconOnly
                                  onClick={() => handleDelete(q)}
                                  aria-label="Hapus quote"
                                  title="Hapus"
                                  className="
                      hover:bg-rose-500/10
                      focus-visible:ring-rose-300/60
                      focus-visible:ring-offset-2 focus-visible:ring-offset-white
                      [.theme-dark_&]:focus-visible:ring-offset-slate-900
                    "
                                >
                                  <Trash2 className="h-5 w-5" />
                                  <span className="sr-only">Hapus</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Menampilkan {visible.length ? start + 1 : 0}
                  {visible.length ? `–${start + visible.length}` : ""} dari{" "}
                  {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={current <= 1}
                  >
                    Sebelumnya
                  </Button>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                    Hal {current} / {pageCount}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={current >= pageCount}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Modal Add/Edit */}
        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={editing ? "Edit Quote" : "Tambah Quote"}
          footer={
            <>
              <Button variant="danger" outline onClick={closeModal}>
                Batal
              </Button>

              <Button
                type="submit"
                form="quote-form"
                disabled={isMutating || trimmedContent.length === 0}
                className="
          inline-flex items-center gap-2 rounded-lg px-4 py-2
          bg-sky-600 text-on-accent hover:bg-sky-500
          border border-sky-400/30 shadow-lg shadow-sky-600/20
          disabled:opacity-60
        "
              >
                {editing ? (
                  <>
                    <Save className="h-4 w-4" /> Simpan
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Tambah
                  </>
                )}
              </Button>
            </>
          }
        >
          <form id="quote-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quote-content" className="text-slate-200">
                Isi Quote
                <span className="ml-1 text-rose-300">*</span>
              </Label>
              <textarea
                id="quote-content"
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => setContentTouched(true)}
                maxLength={MAX_QUOTE_LENGTH}
                placeholder="Tulis isi quote yang akan dikirimkan..."
                className={`min-h-[160px] w-full resize-vertical rounded-xl border bg-slate-950/70 p-4 text-sm text-slate-100 shadow-inner shadow-black/20 transition focus:outline-none focus:ring-2 ${
                  showContentError
                    ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/30"
                    : "border-white/10 focus:border-primary-500 focus:ring-primary-500/20"
                } placeholder:text-slate-500`}
                aria-invalid={showContentError}
                aria-describedby={`quote-content-helper${showContentError ? " quote-content-error" : ""}`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span
                  id="quote-content-helper"
                  className={remainingCharacters <= 20 ? "text-amber-300" : undefined}
                >
                  {content.length} / {MAX_QUOTE_LENGTH} karakter
                  {" "}
                  <span className="opacity-70">
                    (tersisa {Math.max(0, remainingCharacters)})
                  </span>
                </span>
                <span className="opacity-80">
                  Ctrl/Cmd + Enter untuk simpan
                </span>
              </div>
              {showContentError ? (
                <p id="quote-content-error" className="text-sm text-rose-300">
                  Isi quote wajib diisi.
                </p>
              ) : null}
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
