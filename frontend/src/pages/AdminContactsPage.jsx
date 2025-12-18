import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/layout/AdminLayout";
import { ContactForm } from "../components/ContactForm";
import { ContactTable } from "../components/ContactTable";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { DataPlaceholder } from "../components/ui/DataPlaceholder";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useSession, useLogout } from "../queries/auth";
import { useConfirm } from "../components/ui/ConfirmProvider.jsx";
import {
  useAdminContacts,
  useCreateContact,
  useUpdateContact,
  useUpdateContactStatus,
  useDeleteContact,
} from "../queries/contacts";
import {
  Plus,
  Search,
  X,
  Users,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Save,
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";

/** Debounce kecil untuk pencarian */
function useDebouncedValue(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function AdminContactsPage() {
  const navigate = useNavigate();
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();
  const { data: session, isLoading: sessionLoading } = useSession();
  const logoutMutation = useLogout();

  const { data, isLoading, isError, error } = useAdminContacts();
  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const updateStatusMutation = useUpdateContactStatus();
  const deleteMutation = useDeleteContact();

  useDocumentTitle("Kontak Admin");

  const [editingContact, setEditingContact] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const searchRef = useRef(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const contacts = useMemo(() => data?.contacts ?? [], [data]);
  const allowedStatuses = useMemo(
    () => data?.allowedStatuses ?? ["masuk"],
    [data]
  );

  useEffect(() => {
    if (!sessionLoading && !session?.authenticated) {
      navigate("/admin/login", { replace: true });
    }
  }, [session, sessionLoading, navigate]);

  useEffect(() => {
    if (updateMutation.isSuccess) {
      setEditingContact(null);
      setFormOpen(false);
      addToast("Kontak berhasil diperbarui.", { type: "success" });
    }
  }, [updateMutation.isSuccess, addToast]);

  useEffect(() => {
    if (createMutation.isSuccess) {
      setEditingContact(null);
      setFormOpen(false);
      addToast("Kontak berhasil ditambahkan.", { type: "success" });
    }
  }, [createMutation.isSuccess, addToast]);

  /** hotkey: tekan "/" untuk fokus ke search */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusUpdatingId = updateStatusMutation.variables?.id;

  const formError =
    updateMutation.error?.message || createMutation.error?.message || "";

  const tableError =
    deleteMutation.error?.message || updateStatusMutation.error?.message || "";

  const handleSubmit = (values) => {
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: "Batalkan?",
      message: "Perubahan yang belum disimpan akan hilang.",
      confirmText: "Ya, batal",
      variant: "warning",
    });
    if (!ok) return;
    setEditingContact(null);
    setFormOpen(false);
  };

  const handleDelete = async (contact) => {
    if (!contact?.id) return;
    const confirmed = await confirm({
      title: "Hapus kontak?",
      message: `Kontak ${contact.name || "-"} akan dihapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    deleteMutation.mutate(contact.id, {
      onSuccess: () => {
        if (editingContact?.id === contact.id) {
          setEditingContact(null);
        }
        addToast("Kontak dihapus.", { type: "success" });
      },
      onError: (err) =>
        addToast(err?.message || "Gagal menghapus kontak.", { type: "error" }),
    });
  };

  const handleStatusChange = (id, status) => {
    updateStatusMutation.mutate({ id, status });
  };

  const isFormSubmitting = createMutation.isLoading || updateMutation.isLoading;

  const formInitialValues = editingContact
    ? {
        name: editingContact.name,
        number: editingContact.number,
        status: editingContact.status,
      }
    : {
        status: allowedStatuses[0] ?? "masuk",
      };

  const formTitle = editingContact
    ? "Edit Kontak Pegawai"
    : "Tambah Kontak Baru";
  const formDescription = editingContact
    ? "Perbarui informasi kontak pegawai dan status kehadiran."
    : "Simpan nomor WhatsApp pegawai untuk daftar penerima pengingat otomatis.";
  const submitLabel = editingContact ? "Simpan" : "Tambah";

  /** ---- Filtering, pagination, dan statistik ---- */
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const nm = (c.name || "").toLowerCase();
      const no = (c.number || "").toLowerCase();
      const st = (c.status || "").toLowerCase();
      return nm.includes(q) || no.includes(q) || st.includes(q);
    });
  }, [contacts, debouncedSearch]);

  useEffect(() => {
    // reset ke halaman 1 kalau query berubah
    setPage(1);
  }, [debouncedSearch]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const statusCounts = useMemo(() => {
    const base = Object.fromEntries(allowedStatuses.map((s) => [s, 0]));
    for (const c of contacts) {
      if (c?.status && base[c.status] !== undefined) base[c.status] += 1;
    }
    return base;
  }, [contacts, allowedStatuses]);

  return (
    <AdminLayout
      username={session?.user?.username}
      loading={sessionLoading}
      onLogout={() =>
        logoutMutation.mutate(undefined, {
          onSuccess: () => navigate("/admin/login", { replace: true }),
        })
      }
      isLoggingOut={logoutMutation.isLoading}
    >
      <div className="space-y-8">
        <Card
          className="space-y-6 border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-800/70 p-6 backdrop-blur-xl"
          header={
            <div className="flex flex-col gap-4">
              {/* Title row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-white">
                    Manajemen Kontak Pegawai
                  </h1>
                  <p className="text-sm text-slate-400">
                    Atur daftar penerima pengingat WhatsApp dan tandai status
                    kehadiran.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setEditingContact(null);
                      setFormOpen(true);
                    }}
                    className="
                      inline-flex items-center gap-2 rounded-lg px-3 py-2
                      bg-sky-600 text-on-accent
                      hover:bg-sky-500
                      border border-sky-400/30
                      shadow-lg shadow-sky-600/20
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

              {/* Stats row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total</span>
                    <Users className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {contacts.length}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Aktif / Masuk
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {statusCounts["masuk"] ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Status lain</span>
                    <Clock3 className="h-4 w-4 text-sky-400" />
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {Object.entries(statusCounts)
                      .filter(([k]) => k !== "masuk")
                      .reduce((n, [, v]) => n + v, 0)}
                  </div>
                </div>
              </div>

              {/* Toolbar row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Cari nama / nomor / status…   (tekan /)"
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

                {/* Legend status (dinamis dari allowedStatuses) */}
                <div className="flex flex-wrap items-center gap-2">
                  {allowedStatuses.map((st) => (
                    <span
                      key={st}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-200"
                    >
                      <span className="inline-block h-2 w-2 rounded-full bg-primary-400/80" />
                      {st} · {statusCounts[st] ?? 0}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          }
        >
          {isLoading ? (
            <div className="flex items-center gap-3 text-slate-300">
              <Spinner size="sm" /> Memuat kontak...
            </div>
          ) : isError ? (
            <DataPlaceholder
              icon="⚠️"
              title="Gagal memuat kontak"
              description={error?.message || "Terjadi kesalahan pada server."}
            />
          ) : contacts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <DataPlaceholder
                icon="🗂️"
                title="Belum ada kontak"
                description="Mulai tambahkan kontak pegawai untuk pengingat otomatis WhatsApp."
              />
              <div className="mt-4">
                <Button
                  onClick={() => {
                    setEditingContact(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Kontak Pertama
                </Button>
              </div>
            </div>
          ) : (
            <>
              {tableError ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{tableError}</span>
                </div>
              ) : null}

              <ContactTable
                contacts={visible}
                allowedStatuses={allowedStatuses}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                statusUpdatingId={statusUpdatingId}
                isStatusUpdating={updateStatusMutation.isLoading}
              />

              {/* Pagination */}
              <div className="mt-5 flex flex-col items-center justify-between gap-3 text-xs text-slate-400 sm:flex-row">
                <span>
                  Menampilkan {visible.length ? start + 1 : 0}
                  {visible.length ? `–${start + visible.length}` : ""} dari{" "}
                  {total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={current <= 1}
                    className="rounded-lg"
                  >
                    « Awal
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={current <= 1}
                    className="rounded-lg"
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
                    className="rounded-lg"
                  >
                    Berikutnya
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(pageCount)}
                    disabled={current >= pageCount}
                    className="rounded-lg"
                  >
                    Akhir »
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        <Modal
          open={formOpen}
          onClose={handleCancel}
          title={formTitle}
          footer={
            <>
              <Button variant="danger" outline onClick={handleCancel}>
                Batal
              </Button>
              <Button
                type="submit"
                form="contact-form"
                disabled={isFormSubmitting}
                className="
          inline-flex items-center gap-2 rounded-lg px-4 py-2
          bg-sky-600 text-on-accent hover:bg-sky-500
          border border-sky-400/30 shadow-lg shadow-sky-600/20
          disabled:opacity-60
        "
              >
                {isFormSubmitting ? (
                  "Menyimpan…"
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {submitLabel}
                  </>
                )}
              </Button>
            </>
          }
        >
          <ContactForm
            formId="contact-form"
            hideActions
            allowedStatuses={allowedStatuses}
            initialValues={formInitialValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isFormSubmitting}
            submitLabel={submitLabel}
            title={formTitle}
            description={formDescription}
            errorMessage={formError}
          />
        </Modal>
      </div>
    </AdminLayout>
  );
}
