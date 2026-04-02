import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/layout/AdminLayout";
import { ContactForm } from "../components/ContactForm";
import { ContactTable } from "../components/ContactTable";
import { Card } from "../components/ui/Card";
import { DataPlaceholder } from "../components/ui/DataPlaceholder";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { QueryErrorNotice } from "../components/error/QueryErrorNotice";
import { ToneSurface } from "../components/ui/ToneSurface";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useSession, useLogout } from "../queries/auth";
import { useConfirm } from "../components/ui/ConfirmProvider.jsx";
import {
  useAdminContacts,
  useCreateContact,
  useUpdateContact,
  useUpdateContactStatus,
  useBulkUpdateContactStatus,
  useDeleteContact,
  useBulkDeleteContacts,
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
  SearchX,
  Filter,
  RefreshCcw,
  CheckSquare,
  Trash2,
} from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle.js";
import { formatStatusLabel } from "../lib/contactFormatters";

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function ContactLoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`contacts-kpi-${index}`} className="h-20" effect="shimmer" />
        ))}
      </div>
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`contacts-row-${index}`} className="h-10 w-full" effect="shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}

function getSortComparator(sortBy) {
  switch (sortBy) {
    case "name-desc":
      return (a, b) => String(b?.name || "").localeCompare(String(a?.name || ""), "id", { sensitivity: "base" });
    case "name-asc":
    default:
      return (a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "id", { sensitivity: "base" });
  }
}

export default function AdminContactsPage() {
  const navigate = useNavigate();
  const { add: addToast } = useToast();
  const { confirm } = useConfirm();

  const { data: session, isLoading: sessionLoading } = useSession();
  const logoutMutation = useLogout();
  const { data, isLoading, isFetching, isError, error, refetch } = useAdminContacts();

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const updateStatusMutation = useUpdateContactStatus();
  const bulkStatusMutation = useBulkUpdateContactStatus();
  const deleteMutation = useDeleteContact();
  const bulkDeleteMutation = useBulkDeleteContacts();

  const isCreatePending = createMutation.isPending ?? createMutation.isLoading;
  const isUpdatePending = updateMutation.isPending ?? updateMutation.isLoading;
  const isStatusPending = updateStatusMutation.isPending ?? updateStatusMutation.isLoading;
  const isBulkStatusPending = bulkStatusMutation.isPending ?? bulkStatusMutation.isLoading;
  const isDeletePending = deleteMutation.isPending ?? deleteMutation.isLoading;
  const isBulkDeletePending = bulkDeleteMutation.isPending ?? bulkDeleteMutation.isLoading;
  const isLogoutPending = logoutMutation.isPending ?? logoutMutation.isLoading;

  useDocumentTitle("Kontak Admin");

  const [editingContact, setEditingContact] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [canSubmitForm, setCanSubmitForm] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatusValue, setBulkStatusValue] = useState("masuk");
  const debouncedSearch = useDebouncedValue(search, 250);
  const searchRef = useRef(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const contacts = useMemo(() => data?.contacts ?? [], [data]);
  const allowedStatuses = useMemo(() => data?.allowedStatuses ?? ["masuk"], [data]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const isFormSubmitting = isCreatePending || isUpdatePending;
  const isBulkPending = isBulkStatusPending || isBulkDeletePending;

  useEffect(() => {
    if (allowedStatuses.includes(bulkStatusValue)) return;
    setBulkStatusValue(allowedStatuses[0] ?? "masuk");
  }, [allowedStatuses, bulkStatusValue]);

  useEffect(() => {
    const validIds = new Set(contacts.map((contact) => contact.id));
    setSelectedIds((previous) => previous.filter((id) => validIds.has(id)));
  }, [contacts]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingContact(null);
    setIsFormDirty(false);
    setCanSubmitForm(false);
    createMutation.reset();
    updateMutation.reset();
  }, [createMutation, updateMutation]);

  const openCreateForm = useCallback(() => {
    setEditingContact(null);
    setFormOpen(true);
    setIsFormDirty(false);
    setCanSubmitForm(false);
    createMutation.reset();
    updateMutation.reset();
  }, [createMutation, updateMutation]);

  const openEditForm = useCallback(
    (contact) => {
      setEditingContact(contact);
      setFormOpen(true);
      setIsFormDirty(false);
      setCanSubmitForm(false);
      createMutation.reset();
      updateMutation.reset();
    },
    [createMutation, updateMutation]
  );

  useEffect(() => {
    if (!createMutation.isSuccess) return;
    closeForm();
    addToast("Kontak berhasil ditambahkan.", { type: "success" });
  }, [createMutation.isSuccess, closeForm, addToast]);

  useEffect(() => {
    if (!updateMutation.isSuccess) return;
    closeForm();
    addToast("Kontak berhasil diperbarui.", { type: "success" });
  }, [updateMutation.isSuccess, closeForm, addToast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const tagName = target?.tagName;
      const isTypingTarget = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable;
      if (isTypingTarget) return;
      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (statusFilter === "all") return;
    if (allowedStatuses.includes(statusFilter)) return;
    setStatusFilter("all");
  }, [statusFilter, allowedStatuses]);

  const statusCounts = useMemo(() => {
    const base = Object.fromEntries(allowedStatuses.map((status) => [status, 0]));
    for (const contact of contacts) {
      if (!contact?.status) continue;
      if (base[contact.status] !== undefined) base[contact.status] += 1;
    }
    return base;
  }, [contacts, allowedStatuses]);

  const filteredContacts = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      const name = String(contact.name || "").toLowerCase();
      const number = String(contact.number || "").toLowerCase();
      const status = String(contact.status || "").toLowerCase();
      return name.includes(query) || number.includes(query) || status.includes(query);
    });
  }, [contacts, debouncedSearch, statusFilter]);

  useEffect(() => {
    const filteredIdSet = new Set(filteredContacts.map((contact) => contact.id));
    setSelectedIds((previous) => previous.filter((id) => filteredIdSet.has(id)));
  }, [filteredContacts]);

  const sortedContacts = useMemo(() => {
    const comparator = getSortComparator(sortBy);
    return [...filteredContacts].sort(comparator);
  }, [filteredContacts, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sortBy]);

  const totalFiltered = sortedContacts.length;
  const hasFilters = Boolean(debouncedSearch.trim()) || statusFilter !== "all";
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visibleContacts = sortedContacts.slice(start, start + pageSize);

  const visibleIds = useMemo(() => visibleContacts.map((contact) => contact.id), [visibleContacts]);
  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    for (const id of visibleIds) {
      if (selectedIdSet.has(id)) count += 1;
    }
    return count;
  }, [visibleIds, selectedIdSet]);

  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const selectedCount = selectedIds.length;

  const otherStatusCount = Object.entries(statusCounts)
    .filter(([status]) => status !== "masuk")
    .reduce((sum, [, count]) => sum + count, 0);

  const statusUpdatingId = updateStatusMutation.variables?.id;
  const deletingId = deleteMutation.variables;

  const formError = updateMutation.error?.message || createMutation.error?.message || "";
  const tableError =
    bulkDeleteMutation.error?.message ||
    bulkStatusMutation.error?.message ||
    updateStatusMutation.error?.message ||
    deleteMutation.error?.message ||
    "";

  const formTitle = editingContact ? "Edit Kontak Pegawai" : "Tambah Kontak Pegawai";
  const submitLabel = editingContact ? "Simpan" : "Tambah";
  const addButtonBlueClass = "!border-sky-700 !bg-sky-600 !text-white hover:!bg-sky-700";
  const defaultAllowedStatus = allowedStatuses[0] ?? "masuk";
  const editingContactId = editingContact?.id ?? null;
  const editingContactName = editingContact?.name ?? "";
  const editingContactNumber = editingContact?.number ?? "";
  const editingContactStatus = editingContact?.status ?? "";

  const formInitialValues = useMemo(() => {
    if (editingContactId) {
      return {
        name: editingContactName,
        number: editingContactNumber,
        status: editingContactStatus,
      };
    }

    return { status: defaultAllowedStatus };
  }, [
    defaultAllowedStatus,
    editingContactId,
    editingContactName,
    editingContactNumber,
    editingContactStatus,
  ]);

  const handleSubmit = (values) => {
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, ...values });
      return;
    }
    createMutation.mutate(values);
  };

  const handleCloseForm = async () => {
    if (isFormSubmitting) return;

    const confirmed = await confirm({
      title: "Tutup formulir?",
      message: isFormDirty
        ? "Perubahan pada form belum disimpan dan akan hilang."
        : "Formulir kontak akan ditutup.",
      confirmText: "Ya, tutup",
      variant: "warning",
    });
    if (!confirmed) return;
    closeForm();
  };

  const toggleSelect = useCallback((id, checked) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return [...next];
    });
  }, []);

  const toggleSelectAllVisible = useCallback(
    (checked) => {
      setSelectedIds((previous) => {
        const next = new Set(previous);
        if (checked) visibleIds.forEach((id) => next.add(id));
        else visibleIds.forEach((id) => next.delete(id));
        return [...next];
      });
    },
    [visibleIds]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleDelete = async (contact) => {
    if (isBulkPending || !contact?.id) return;
    const confirmed = await confirm({
      title: "Hapus kontak?",
      message: `Kontak ${contact.name || "-"} akan dihapus permanen.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    deleteMutation.mutate(contact.id, {
      onSuccess: () => {
        if (editingContact?.id === contact.id) closeForm();
        setSelectedIds((previous) => previous.filter((id) => id !== contact.id));
        addToast("Kontak berhasil dihapus.", { type: "success" });
      },
      onError: (err) => addToast(err?.message || "Gagal menghapus kontak.", { type: "error" }),
    });
  };

  const handleStatusChange = (contact, status) => {
    if (isBulkPending) return;
    updateStatusMutation.mutate(
      { id: contact.id, status },
      {
        onSuccess: () =>
          addToast(`Status ${contact.name || "kontak"} diperbarui ke ${formatStatusLabel(status)}.`, {
            type: "success",
          }),
        onError: (err) =>
          addToast(err?.message || "Gagal memperbarui status kontak.", { type: "error" }),
      }
    );
  };

  const handleBulkStatusApply = async () => {
    if (!selectedCount || isBulkPending) return;
    const targetStatusLabel = formatStatusLabel(bulkStatusValue);
    const confirmed = await confirm({
      title: `Ubah status ${selectedCount} kontak?`,
      message: `Status semua kontak terpilih akan diubah menjadi ${targetStatusLabel}.`,
      confirmText: "Terapkan",
      variant: "warning",
    });
    if (!confirmed) return;

    bulkStatusMutation.reset();
    bulkStatusMutation.mutate(
      { ids: selectedIds, status: bulkStatusValue },
      {
        onSuccess: (result) => {
          clearSelection();
          const updatedCount = Array.isArray(result?.contacts) ? result.contacts.length : selectedCount;
          addToast(`${updatedCount} kontak diperbarui ke status ${targetStatusLabel}.`, { type: "success" });
        },
        onError: (err) => addToast(err?.message || "Gagal memperbarui status massal.", { type: "error" }),
      }
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedCount || isBulkPending) return;
    const idsToDelete = [...selectedIds];
    const confirmed = await confirm({
      title: `Hapus ${idsToDelete.length} kontak?`,
      message: "Kontak yang dipilih akan dihapus permanen.",
      confirmText: "Hapus semua",
      variant: "danger",
    });
    if (!confirmed) return;

    bulkDeleteMutation.reset();
    bulkDeleteMutation.mutate(idsToDelete, {
      onSuccess: (result) => {
        if (editingContact?.id && idsToDelete.includes(editingContact.id)) closeForm();
        clearSelection();
        const deletedCount = typeof result?.deletedCount === "number" ? result.deletedCount : idsToDelete.length;
        addToast(`${deletedCount} kontak berhasil dihapus.`, { type: "success" });
      },
      onError: (err) => addToast(err?.message || "Gagal menghapus kontak terpilih.", { type: "error" }),
    });
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <AdminLayout
      username={session?.user?.username}
      loading={sessionLoading}
      onLogout={() =>
        logoutMutation.mutate(undefined, {
          onSuccess: () => navigate("/admin/login", { replace: true }),
        })
      }
      isLoggingOut={isLogoutPending}
    >
      <div className="ds-page-stack">
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(170deg,hsl(var(--card))_0%,hsl(var(--muted)/0.22)_100%)] p-0">
          <section className="space-y-5 border-b border-border/70 bg-background/25 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h1 className="ds-page-title">Manajemen Kontak Pegawai</h1>
                <p className="ds-body max-w-2xl">
                  Halaman untuk kelola daftar penerima pengingat WhatsApp dan perbarui
                  data kontak.
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  onClick={openCreateForm}
                  variant="primary"
                  className={`w-full sm:w-auto ${addButtonBlueClass}`}
                  disabled={isBulkPending}
                >
                  <Plus className="h-4 w-4" />
                  Tambah
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-primary/30 bg-[linear-gradient(160deg,hsl(var(--primary)/0.14)_0%,hsl(var(--card))_62%,hsl(var(--muted)/0.45)_100%)] px-4 py-3 shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total kontak</span>
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">{contacts.length}</p>
              </div>

              <div className="rounded-2xl border border-success/35 bg-[linear-gradient(160deg,hsl(var(--success)/0.2)_0%,hsl(var(--card))_68%)] px-4 py-3 shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status masuk</span>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">{statusCounts.masuk ?? 0}</p>
              </div>

              <div className="rounded-2xl border border-warning/35 bg-[linear-gradient(160deg,hsl(var(--warning)/0.2)_0%,hsl(var(--card))_68%)] px-4 py-3 shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status non-masuk</span>
                  <Clock3 className="h-4 w-4 text-warning" />
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">{otherStatusCount}</p>
              </div>

              <div className="rounded-2xl border border-info/35 bg-[linear-gradient(160deg,hsl(var(--info)/0.18)_0%,hsl(var(--card))_68%)] px-4 py-3 shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Hasil filter</span>
                  <Filter className="h-4 w-4 text-info" />
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">{totalFiltered}</p>
              </div>
            </div>

            <div className="w-full">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama, nomor, atau status"
                  className="w-full rounded-xl border border-border/70 bg-background/80 py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-4 p-4 sm:p-6">
            {isFetching && !isLoading ? (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-info/35 bg-info/10 px-3 py-1 text-xs text-info">
                <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                Menyinkronkan data kontak...
              </div>
            ) : null}

            {isLoading ? (
              <ContactLoadingState />
            ) : isError ? (
              <QueryErrorNotice
                error={error}
                fallbackMessage="Data kontak belum dapat dimuat dari server."
                onRetry={() => refetch()}
                retryLabel="Muat ulang data"
              />
            ) : contacts.length === 0 ? (
              <DataPlaceholder
                icon={<Users className="h-10 w-10" />}
                title="Belum ada kontak"
                description="Tambahkan kontak pertama agar fitur pengingat WhatsApp bisa digunakan."
                action={
                  <Button
                    onClick={openCreateForm}
                    variant="primary"
                    className={addButtonBlueClass}
                  >
                    <Plus className="h-4 w-4" />
                    Tambah kontak pertama
                  </Button>
                }
              />
            ) : totalFiltered === 0 ? (
              <DataPlaceholder
                icon={<SearchX className="h-10 w-10" />}
                title="Tidak ada kontak yang cocok"
                description={
                  hasFilters
                    ? "Coba ubah kata kunci pencarian atau reset filter status."
                    : "Belum ada data yang dapat ditampilkan."
                }
                variant="info"
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Reset filter
                  </Button>
                }
              />
            ) : (
              <>
                {selectedCount > 0 ? (
                  <ToneSurface
                    tone="info"
                    size="md"
                    className="space-y-3 border-info/45 bg-[linear-gradient(160deg,hsl(var(--info)/0.16)_0%,hsl(var(--card))_72%)] !text-foreground shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-2">
                        <CheckSquare className="mt-0.5 h-4 w-4 flex-none" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{selectedCount} kontak terpilih</p>
                          <p className="text-xs text-muted-foreground">Pilih aksi massal untuk update status atau hapus kontak.</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={bulkStatusValue}
                          onChange={(event) => setBulkStatusValue(event.target.value)}
                          className="min-w-[180px] rounded-lg border border-info/35 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          disabled={isBulkPending}
                        >
                          {allowedStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={handleBulkStatusApply}
                          loading={isBulkStatusPending}
                          loadingText="Menerapkan..."
                          disabled={isBulkPending || selectedCount === 0}
                        >
                          Terapkan status
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkDelete}
                          loading={isBulkDeletePending}
                          loadingText="Menghapus..."
                          disabled={isBulkPending || selectedCount === 0}
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus terpilih
                        </Button>
                        <Button variant="secondary" outline size="sm" onClick={clearSelection} disabled={isBulkPending}>
                          Batal pilih
                        </Button>
                      </div>
                    </div>
                  </ToneSurface>
                ) : null}

                {tableError ? (
                  <ToneSurface tone="warning" size="md" className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                    <span className="text-sm">{tableError}</span>
                  </ToneSurface>
                ) : null}

                <ContactTable
                  contacts={visibleContacts}
                  allowedStatuses={allowedStatuses}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  selectedIds={selectedIds}
                  allVisibleSelected={allVisibleSelected}
                  someVisibleSelected={someVisibleSelected}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAllVisible}
                  onEdit={openEditForm}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  statusUpdatingId={statusUpdatingId}
                  isStatusUpdating={isStatusPending}
                  deletingId={deletingId}
                  isDeleting={isDeletePending}
                  isBulkBusy={isBulkPending}
                />

                {pageCount > 1 ? (
                  <div className="mt-2 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground">
                      Menampilkan {visibleContacts.length ? start + 1 : 0}
                      {visibleContacts.length ? `-${start + visibleContacts.length}` : ""} dari {totalFiltered} kontak
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setPage(1)} disabled={currentPage <= 1} className="hidden sm:inline-flex">
                        Awal
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1}>
                        Sebelumnya
                      </Button>
                      <span className="rounded-md border border-border/70 bg-muted/35 px-2.5 py-1 text-xs text-muted-foreground">
                        Hal {currentPage} / {pageCount}
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))} disabled={currentPage >= pageCount}>
                        Berikutnya
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setPage(pageCount)} disabled={currentPage >= pageCount} className="hidden sm:inline-flex">
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
          open={formOpen}
          onClose={handleCloseForm}
          title={formTitle}
          maxWidth="max-w-2xl"
          footer={
            <>
              <Button variant="secondary" outline onClick={handleCloseForm} disabled={isFormSubmitting}>
                Batal
              </Button>
              <Button
                type="submit"
                form="contact-form"
                variant="primary"
                className={addButtonBlueClass}
                loading={isFormSubmitting}
                loadingText="Menyimpan..."
                disabled={isFormSubmitting || !canSubmitForm}
              >
                {isFormSubmitting ? null : (
                  <>
                    {editingContact ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
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
            onCancel={handleCloseForm}
            isSubmitting={isFormSubmitting}
            submitLabel={submitLabel}
            title=""
            errorMessage={formError}
            onDirtyChange={setIsFormDirty}
            onValidityChange={setCanSubmitForm}
          />
        </Modal>
      </div>
    </AdminLayout>
  );
}
