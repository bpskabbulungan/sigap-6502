import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import { ArrowDownAZ, ArrowUpAZ, Loader2, Pencil, Trash2, Users } from "lucide-react";
import { ContactStatusBadge } from "./ContactStatusBadge";
import { Button } from "./ui/Button";
import { DataPlaceholder } from "./ui/DataPlaceholder";
import {
  formatStatusLabel,
  formatWhatsappDisplay,
} from "../lib/contactFormatters";

function normalizeStatusOptions(allowedStatuses, contacts) {
  const fromAllowed = Array.isArray(allowedStatuses)
    ? allowedStatuses
        .map((status) => String(status || "").trim().toLowerCase())
        .filter(Boolean)
    : [];

  if (fromAllowed.length > 0) {
    return [...new Set(fromAllowed)];
  }

  const fromContacts = contacts
    .map((contact) => String(contact?.status || "").trim().toLowerCase())
    .filter(Boolean);
  return fromContacts.length > 0 ? [...new Set(fromContacts)] : ["masuk"];
}

export function ContactTable({
  contacts = [],
  allowedStatuses = [],
  sortBy = "name-asc",
  onSortByChange,
  statusFilter = "all",
  onStatusFilterChange,
  selectedIds = [],
  allVisibleSelected = false,
  someVisibleSelected = false,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onStatusChange,
  statusUpdatingId,
  isStatusUpdating = false,
  deletingId,
  isDeleting = false,
  isBulkBusy = false,
}) {
  const headerCheckboxRef = useRef(null);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

  if (!contacts.length) {
    return (
      <DataPlaceholder
        icon={<Users className="h-10 w-10" />}
        title="Belum ada kontak"
        description="Tambahkan kontak pegawai untuk mengatur daftar penerima pesan."
      />
    );
  }

  const statusOptions = normalizeStatusOptions(allowedStatuses, contacts);
  const isNameDesc = sortBy === "name-desc";
  const currentStatusFilter = statusFilter === "all" || statusOptions.includes(statusFilter) ? statusFilter : "all";
  const baseSelectClassName =
    "w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground shadow-inner shadow-black/5 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

  const toggleNameSort = () => {
    if (!onSortByChange) return;
    onSortByChange(isNameDesc ? "name-asc" : "name-desc");
  };

  const renderStatusSelect = (contact, size = "default") => {
    const isStatusUpdatingRow = isStatusUpdating && statusUpdatingId === contact.id;
    const isDeletingRow = isDeleting && deletingId === contact.id;
    const disabled = isStatusUpdatingRow || isDeletingRow || isBulkBusy;
    const selectId = `contact-status-${contact.id}`;

    return (
      <div className="relative">
        <label htmlFor={selectId} className="sr-only">
          Status {contact.name || "kontak"}
        </label>
        <select
          id={selectId}
          className={clsx(
            baseSelectClassName,
            size === "compact" && "py-1.5 text-xs",
            isStatusUpdatingRow && "pr-8"
          )}
          value={contact.status}
          disabled={disabled}
          onChange={(event) => {
            const nextStatus = event.target.value;
            if (nextStatus !== contact.status) {
              onStatusChange?.(contact, nextStatus);
            }
          }}
          aria-label={`Ubah status ${contact.name || "kontak"}`}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {formatStatusLabel(status)}
            </option>
          ))}
        </select>
        {isStatusUpdatingRow ? (
          <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:hidden sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={toggleNameSort}
          disabled={!onSortByChange}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/75 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-55"
          aria-label={`Urutkan nama ${isNameDesc ? "A-Z" : "Z-A"}`}
        >
          {isNameDesc ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
          Nama {isNameDesc ? "Z-A" : "A-Z"}
        </button>

        <div className="relative w-full sm:w-auto sm:min-w-[190px]">
          <select
            value={currentStatusFilter}
            onChange={(event) => onStatusFilterChange?.(event.target.value)}
            className="w-full rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Filter status kontak"
          >
            <option value="all">Semua status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {contacts.map((contact) => {
          const isStatusUpdatingRow = isStatusUpdating && statusUpdatingId === contact.id;
          const isDeletingRow = isDeleting && deletingId === contact.id;
          const isRowBusy = isStatusUpdatingRow || isDeletingRow || isBulkBusy;
          const isChecked = selectedIdSet.has(contact.id);

          return (
            <article
              key={contact.id}
              className={clsx(
                "rounded-2xl border border-border/70 bg-[linear-gradient(160deg,hsl(var(--card))_0%,hsl(var(--muted)/0.28)_100%)] p-4 transition-colors",
                isChecked && "border-primary/40 bg-[linear-gradient(160deg,hsl(var(--primary)/0.10)_0%,hsl(var(--card))_100%)]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{contact.name}</h3>
                  <p className="text-xs font-medium text-muted-foreground">
                    {formatWhatsappDisplay(contact.number)}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-2 py-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={isChecked}
                    disabled={isRowBusy}
                    onChange={(event) =>
                      onToggleSelect?.(contact.id, event.target.checked)
                    }
                    aria-label={`Pilih ${contact.name || "kontak"}`}
                  />
                  Pilih
                </label>
              </div>

              <div className="mt-3">
                <ContactStatusBadge status={contact.status} />
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ubah status
                </p>
                {renderStatusSelect(contact)}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="info"
                  size="sm"
                  iconOnly
                  onClick={() => onEdit?.(contact)}
                  disabled={isRowBusy}
                  aria-label={`Edit ${contact.name || "kontak"}`}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  iconOnly
                  onClick={() => onDelete?.(contact)}
                  loading={isDeletingRow}
                  loadingText="Menghapus..."
                  disabled={isStatusUpdatingRow || isBulkBusy}
                  aria-label={`Hapus ${contact.name || "kontak"}`}
                  title="Hapus"
                >
                  {isDeletingRow ? null : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
        <div className="overflow-auto">
          <table className="w-full min-w-[860px] divide-y divide-border/70 text-sm">
            <thead className="bg-muted/35 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-3 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={allVisibleSelected}
                    onChange={(event) => onToggleSelectAll?.(event.target.checked)}
                    aria-label="Pilih semua kontak pada halaman ini"
                    disabled={isBulkBusy}
                  />
                </th>
                <th className="px-4 py-3 text-center font-semibold" aria-sort={isNameDesc ? "descending" : "ascending"}>
                  <button
                    type="button"
                    onClick={toggleNameSort}
                    disabled={!onSortByChange}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md px-1 py-0.5 text-center font-semibold normal-case text-foreground/90 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Urutkan nama ${isNameDesc ? "A-Z" : "Z-A"}`}
                    title={`Urutkan nama ${isNameDesc ? "A-Z" : "Z-A"}`}
                  >
                    <span>NAMA</span>
                    {isNameDesc ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-semibold">Nomor WhatsApp</th>
                <th className="px-4 py-3 text-center font-semibold">
                  <div className="mx-auto flex max-w-[240px] items-center justify-center gap-2 normal-case">
                    <span>STATUS</span>
                    <select
                      value={currentStatusFilter}
                      onChange={(event) => onStatusFilterChange?.(event.target.value)}
                      className="rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      aria-label="Filter status pada tabel kontak"
                    >
                      <option value="all">Semua</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/70">
              {contacts.map((contact) => {
                const isStatusUpdatingRow = isStatusUpdating && statusUpdatingId === contact.id;
                const isDeletingRow = isDeleting && deletingId === contact.id;
                const isRowBusy = isStatusUpdatingRow || isDeletingRow || isBulkBusy;
                const isChecked = selectedIdSet.has(contact.id);

                return (
                  <tr
                    key={contact.id}
                    className={clsx(
                      "bg-card text-foreground transition hover:bg-muted/25",
                      isChecked && "bg-primary/5"
                    )}
                  >
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={isChecked}
                        disabled={isRowBusy}
                        onChange={(event) =>
                          onToggleSelect?.(contact.id, event.target.checked)
                        }
                        aria-label={`Pilih ${contact.name || "kontak"}`}
                      />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <p className="font-semibold text-foreground">{contact.name}</p>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex rounded-md border border-border/70 bg-muted/25 px-2.5 py-1 font-mono text-xs text-foreground">
                        {formatWhatsappDisplay(contact.number)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="mx-auto flex min-w-[250px] max-w-[360px] items-center justify-center gap-3">
                        <ContactStatusBadge status={contact.status} />
                        <div className="w-full max-w-[160px]">
                          {renderStatusSelect(contact, "compact")}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="info"
                          size="sm"
                          iconOnly
                          onClick={() => onEdit?.(contact)}
                          disabled={isRowBusy}
                          aria-label={`Edit ${contact.name || "kontak"}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          iconOnly
                          onClick={() => onDelete?.(contact)}
                          loading={isDeletingRow}
                          loadingText="Menghapus..."
                          disabled={isStatusUpdatingRow || isBulkBusy}
                          aria-label={`Hapus ${contact.name || "kontak"}`}
                          title="Hapus"
                        >
                          {isDeletingRow ? null : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
