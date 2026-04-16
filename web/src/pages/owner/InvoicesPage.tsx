import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
    Receipt,
    CheckCircle2,
    Clock,
    AlertCircle,
    Pencil,
    Search,
    X,
    TrendingUp,
    Banknote,
    Trash2,
    Plus,
    FileText,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DatePicker } from "../../components/ui/DatePicker";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../hooks/useAuth";
import { contractService } from "../../services/contract.service";
import { formatBRL } from "../../lib/currency";
import {
    InvoiceStatus,
    InvoiceType,
    INVOICE_STATUS_LABEL,
    INVOICE_TYPE_LABEL,
} from "../../lib/constants";
import type { Invoice } from "../../types/domain.types";

const statusVariant: Record<
    InvoiceStatus,
    "paid" | "pending" | "overdue" | "gray"
> = {
    [InvoiceStatus.Paid]: "paid",
    [InvoiceStatus.Pending]: "pending",
    [InvoiceStatus.Overdue]: "overdue",
    [InvoiceStatus.Cancelled]: "gray",
};

const statusIcon: Record<InvoiceStatus, React.ReactNode> = {
    [InvoiceStatus.Paid]: (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
    ),
    [InvoiceStatus.Pending]: <Clock className="w-3.5 h-3.5 text-yellow-500" />,
    [InvoiceStatus.Overdue]: (
        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
    ),
    [InvoiceStatus.Cancelled]: (
        <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
    ),
};

export function InvoicesPage() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // ── Filters ──────────────────────────────────────────────────────────────
    type QuickFilter = "all" | "month" | "overdue" | "paid";
    const [quickFilter, setQuickFilter] = useState<QuickFilter>("month");
    const [dateFrom, setDateFrom] = useState(""); // "YYYY-MM-DD"
    const [dateTo, setDateTo] = useState(""); // "YYYY-MM-DD"
    const [tenantSearch, setTenantSearch] = useState("");
    // When set, filters by paid_at month (used when navigating from chart)
    const [paidMonthFilter, setPaidMonthFilter] = useState<string | null>(null); // "YYYY-MM"

    // Pagination
    const PAGE_SIZE = 20;
    const [currentPage, setCurrentPage] = useState(1);

    // Initialise filters from URL query params (e.g. from dashboard click)
    useEffect(() => {
        const paidMonth = searchParams.get("paidMonth"); // "YYYY-MM"
        const month = searchParams.get("month"); // "YYYY-MM"
        const filter = searchParams.get("filter") as QuickFilter | null;
        if (paidMonth) {
            setPaidMonthFilter(paidMonth);
            setQuickFilter("paid");
        } else if (month) {
            const [y, m] = month.split("-");
            const first = `${y}-${m}-01`;
            const last = new Date(Number(y), Number(m), 0);
            const lastStr = `${y}-${m}-${String(last.getDate()).padStart(2, "0")}`;
            setDateFrom(first);
            setDateTo(lastStr);
            if (filter) setQuickFilter(filter);
        } else if (filter) {
            setQuickFilter(filter);
        }
        if (paidMonth || month || filter)
            setSearchParams({}, { replace: true });
        setCurrentPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editTab, setEditTab] = useState<"details" | "notes">("details");
    const [editForm, setEditForm] = useState({
        amount: "",
        due_date: "",
        invoice_type: "",
        status: "",
        paid_at: "",
        description: "",
    });
    const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
    const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(
        null,
    );
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        contract_id: "",
        amount: "",
        due_date: "",
        invoice_type: InvoiceType.Other,
        description: "",
    });
    const todayStr = new Date().toISOString().split("T")[0];
    const clampToToday = (date: string) => (date > todayStr ? todayStr : date);
    const [payDate, setPayDate] = useState("");

    const { data: rawInvoices = [], isLoading } = useQuery({
        queryKey: ["owner-invoices", user?.id],
        queryFn: () => contractService.listInvoicesByOwner(user!.id),
        enabled: !!user,
    });

    const { data: contracts = [] } = useQuery({
        queryKey: ["owner-contracts", user?.id],
        queryFn: () => contractService.listByOwner(user!.id),
        enabled: !!user,
    });
    const activeContracts = contracts.filter((c) => c.status === "active");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoices = [...rawInvoices].sort(
        (a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );

    function isPastDue(inv: Invoice): boolean {
        if (
            inv.status === InvoiceStatus.Paid ||
            inv.status === InvoiceStatus.Cancelled
        )
            return false;
        return new Date(inv.due_date) < today;
    }

    const filteredInvoices = useMemo(() => {
        let list = invoices;

        // If coming from chart: filter by paid_at month
        if (paidMonthFilter) {
            const [py, pm] = paidMonthFilter.split("-").map(Number);
            list = list.filter((i) => {
                if (!i.paid_at) return false;
                const pd = new Date(i.paid_at);
                return pd.getFullYear() === py && pd.getMonth() + 1 === pm;
            });
            if (tenantSearch.trim()) {
                const q = tenantSearch.toLowerCase();
                list = list.filter((i) =>
                    ((i.contract as any)?.tenant_name ?? "")
                        .toLowerCase()
                        .includes(q),
                );
            }
            return list;
        }

        // Quick filter chip
        if (quickFilter === "month") {
            list = list.filter((i) => {
                const d = new Date(i.due_date);
                return (
                    d.getFullYear() === today.getFullYear() &&
                    d.getMonth() === today.getMonth()
                );
            });
        } else if (quickFilter === "overdue") {
            list = list.filter((i) => isPastDue(i));
        } else if (quickFilter === "paid") {
            list = list.filter((i) => i.status === InvoiceStatus.Paid);
        }

        // Date range filter
        if (dateFrom) {
            const from = new Date(dateFrom + "T00:00:00");
            list = list.filter(
                (i) => new Date(i.due_date + "T00:00:00") >= from,
            );
        }
        if (dateTo) {
            const to = new Date(dateTo + "T23:59:59");
            list = list.filter((i) => new Date(i.due_date + "T00:00:00") <= to);
        }

        // Tenant search
        if (tenantSearch.trim()) {
            const q = tenantSearch.toLowerCase();
            list = list.filter((i) =>
                ((i.contract as any)?.tenant_name ?? "")
                    .toLowerCase()
                    .includes(q),
            );
        }

        return list;
    }, [
        invoices,
        quickFilter,
        dateFrom,
        dateTo,
        tenantSearch,
        today,
        paidMonthFilter,
    ]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredInvoices.length / PAGE_SIZE),
    );
    const paginatedInvoices = filteredInvoices.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
    );

    const payMutation = useMutation({
        mutationFn: ({ id, paidAt }: { id: string; paidAt: string }) =>
            contractService.markInvoicePaid(id, paidAt),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            setPayingInvoice(null);
            setPayDate("");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => contractService.deleteInvoice(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            setDeletingInvoice(null);
        },
    });

    const createMutation = useMutation({
        mutationFn: () =>
            contractService.createStandaloneInvoice({
                contract_id: createForm.contract_id,
                amount_cents: Math.round(Number(createForm.amount) * 100),
                due_date: createForm.due_date,
                invoice_type: createForm.invoice_type,
                description: createForm.description || undefined,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            setCreateOpen(false);
            setCreateForm({
                contract_id: "",
                amount: "",
                due_date: "",
                invoice_type: InvoiceType.Other,
                description: "",
            });
        },
    });

    const editMutation = useMutation({
        mutationFn: () =>
            contractService.updateInvoice(editingInvoice!.id, {
                amount_cents: Math.round(Number(editForm.amount) * 100),
                due_date: editForm.due_date,
                invoice_type: editForm.invoice_type,
                status: editForm.status,
                description: editForm.description || null,
                paid_at:
                    editForm.status === InvoiceStatus.Paid
                        ? editForm.paid_at
                            ? new Date(
                                  editForm.paid_at + "T12:00:00",
                              ).toISOString()
                            : new Date().toISOString()
                        : null,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            setEditingInvoice(null);
        },
    });

    function openEdit(inv: Invoice) {
        setEditingInvoice(inv);
        setEditTab("details");
        setEditForm({
            amount: String(inv.amount_cents / 100),
            due_date: inv.due_date,
            invoice_type: inv.invoice_type,
            status: inv.status,
            paid_at: inv.paid_at
                ? new Date(inv.paid_at).toISOString().split("T")[0]
                : "",
            description: inv.description ?? "",
        });
    }
    const setE =
        (k: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setEditForm((f) => ({ ...f, [k]: e.target.value }));

    return (
        <div className="space-y-6">
            {/* ── Page header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Faturas
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Gerencie cobranças e acompanhe pagamentos dos seus
                        contratos
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setCreateForm({
                            contract_id: activeContracts[0]?.id ?? "",
                            amount: "",
                            due_date: "",
                            invoice_type: InvoiceType.Other,
                            description: "",
                        });
                        setCreateOpen(true);
                    }}
                    className="flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nova Fatura
                </Button>
            </div>

            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total */}
                <Card className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-5 h-5 text-primary-700" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 font-medium">
                            Total
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                            {invoices.length}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                            faturas
                        </p>
                    </div>
                </Card>
                {/* Receita */}
                <Card className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Banknote className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 font-medium">
                            Receita total
                        </p>
                        <p className="text-xl font-bold text-gray-900 truncate">
                            {formatBRL(
                                invoices
                                    .filter(
                                        (i) => i.status === InvoiceStatus.Paid,
                                    )
                                    .reduce((s, i) => s + i.amount_cents, 0),
                            )}
                        </p>
                        <p className="text-xs text-gray-400">pagas</p>
                    </div>
                </Card>
                {/* Pendentes */}
                <Card className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 font-medium">
                            Pendentes
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                            {
                                invoices.filter(
                                    (i) => i.status === InvoiceStatus.Pending,
                                ).length
                            }
                        </p>
                        <p className="text-xs text-gray-400">aguardando</p>
                    </div>
                </Card>
                {/* Em atraso */}
                <Card className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 font-medium">
                            Em atraso
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                            {invoices.filter(isPastDue).length}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                            {formatBRL(
                                invoices
                                    .filter(isPastDue)
                                    .reduce((s, i) => s + i.amount_cents, 0),
                            )}
                        </p>
                    </div>
                </Card>
            </div>

            {/* ── Main table card ── */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <span className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : invoices.length === 0 ? (
                <Card className="text-center py-16">
                    <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Nenhuma fatura encontrada
                    </p>
                </Card>
            ) : (
                <Card padding={false}>
                    {/* ── Toolbar ── */}
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3">
                        {/* Row 1: chips + count */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex flex-wrap gap-2">
                                {(
                                    [
                                        { key: "all", label: "Todas" },
                                        { key: "month", label: "Mês atual" },
                                        {
                                            key: "overdue",
                                            label: "Inadimplentes",
                                        },
                                        { key: "paid", label: "Pagas" },
                                    ] as const
                                ).map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setQuickFilter(key);
                                            setDateFrom("");
                                            setDateTo("");
                                            setCurrentPage(1);
                                        }}
                                        className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                                            quickFilter === key &&
                                            !dateFrom &&
                                            !dateTo
                                                ? key === "overdue"
                                                    ? "bg-red-600 border-red-600 text-white"
                                                    : "bg-primary-600 border-primary-600 text-white"
                                                : "bg-white border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-700"
                                        }`}
                                    >
                                        {key === "overdue" && (
                                            <AlertCircle className="inline w-3 h-3 mr-1 -mt-0.5" />
                                        )}
                                        {label}
                                        {key === "overdue" &&
                                            invoices.filter(isPastDue).length >
                                                0 && (
                                                <span
                                                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                        quickFilter ===
                                                            "overdue" &&
                                                        !dateFrom &&
                                                        !dateTo
                                                            ? "bg-red-500 text-white"
                                                            : "bg-red-100 text-red-600"
                                                    }`}
                                                >
                                                    {
                                                        invoices.filter(
                                                            isPastDue,
                                                        ).length
                                                    }
                                                </span>
                                            )}
                                    </button>
                                ))}
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                {filteredInvoices.length} de {invoices.length}
                            </span>
                        </div>

                        {/* Row 2: date range + search */}
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                            {/* Date range */}
                            <div className="flex items-end gap-2 flex-wrap">
                                <div className="flex-1 min-w-[130px]">
                                    <DatePicker
                                        label="De"
                                        id="filter_from"
                                        value={dateFrom}
                                        onChange={(v) => {
                                            setDateFrom(v);
                                            setQuickFilter("all");
                                            setCurrentPage(1);
                                        }}
                                        placeholder="Data inicial"
                                        maxDate={
                                            dateTo
                                                ? new Date(dateTo + "T00:00:00")
                                                : undefined
                                        }
                                    />
                                </div>
                                <span className="text-gray-400 text-sm pb-2.5 hidden sm:inline">
                                    até
                                </span>
                                <div className="flex-1 min-w-[130px]">
                                    <DatePicker
                                        label="Até"
                                        id="filter_to"
                                        value={dateTo}
                                        onChange={(v) => {
                                            setDateTo(v);
                                            setQuickFilter("all");
                                            setCurrentPage(1);
                                        }}
                                        placeholder="Data final"
                                        minDate={
                                            dateFrom
                                                ? new Date(
                                                      dateFrom + "T00:00:00",
                                                  )
                                                : undefined
                                        }
                                    />
                                </div>
                                {(dateFrom || dateTo) && (
                                    <button
                                        onClick={() => {
                                            setDateFrom("");
                                            setDateTo("");
                                        }}
                                        className="pb-2.5 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Limpar período"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="relative sm:ml-auto w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar inquilino..."
                                    value={tenantSearch}
                                    onChange={(e) => {
                                        setTenantSearch(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-primary-400 bg-white text-gray-700 w-full sm:w-52"
                                />
                                {tenantSearch && (
                                    <button
                                        onClick={() => setTenantSearch("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Mobile card list (xs screens) ── */}
                    <div className="sm:hidden divide-y divide-gray-100">
                        {filteredInvoices.length === 0 ? (
                            <p className="text-center text-sm text-gray-400 py-12">
                                Nenhuma fatura para os filtros selecionados
                            </p>
                        ) : (
                            paginatedInvoices.map((inv) => (
                                <div
                                    key={inv.id}
                                    className={`px-4 py-4 flex items-start gap-3 ${isPastDue(inv) ? "bg-red-50/40" : ""}`}
                                >
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-xs font-semibold text-primary-700">
                                            {((inv.contract as any)
                                                ?.tenant_name ??
                                                "?")[0].toUpperCase()}
                                        </span>
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-medium text-sm text-gray-900 truncate">
                                                {(inv.contract as any)
                                                    ?.tenant_name ?? "—"}
                                            </p>
                                            <span className="font-semibold text-sm text-gray-900 whitespace-nowrap">
                                                {formatBRL(inv.amount_cents)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
                                                    inv.status ===
                                                    InvoiceStatus.Paid
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : inv.status ===
                                                            InvoiceStatus.Pending
                                                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                                          : "bg-red-50 text-red-700 border-red-200"
                                                }`}
                                            >
                                                {statusIcon[inv.status]}
                                                {
                                                    INVOICE_STATUS_LABEL[
                                                        inv.status
                                                    ]
                                                }
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(
                                                    inv.due_date + "T12:00:00",
                                                ).toLocaleDateString("pt-BR", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </span>
                                            {isPastDue(inv) && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Em atraso
                                                </span>
                                            )}
                                            {inv.paid_at && (
                                                <span className="text-[11px] text-emerald-600 font-medium">
                                                    Pago em{" "}
                                                    {new Date(
                                                        inv.paid_at,
                                                    ).toLocaleDateString(
                                                        "pt-BR",
                                                        {
                                                            day: "2-digit",
                                                            month: "short",
                                                        },
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {(inv.status ===
                                            InvoiceStatus.Pending ||
                                            inv.status ===
                                                InvoiceStatus.Overdue) && (
                                            <button
                                                onClick={() => {
                                                    setPayingInvoice(inv);
                                                    setPayDate(
                                                        clampToToday(
                                                            inv.due_date,
                                                        ),
                                                    );
                                                }}
                                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors whitespace-nowrap"
                                            >
                                                Pago
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openEdit(inv)}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() =>
                                                setDeletingInvoice(inv)
                                            }
                                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Excluir fatura"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ── Table (sm+) ── */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70">
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Inquilino
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                                        Tipo
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Valor
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Vencimento
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Status
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                                        Pagamento
                                    </th>
                                    <th className="px-5 py-3 w-36"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-5 py-12 text-center text-sm text-gray-400"
                                        >
                                            Nenhuma fatura para os filtros
                                            selecionados
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedInvoices.map((inv) => (
                                        <tr
                                            key={inv.id}
                                            className={`transition-colors ${
                                                isPastDue(inv)
                                                    ? "hover:bg-red-50/40"
                                                    : "hover:bg-gray-50"
                                            }`}
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xs font-semibold text-primary-700">
                                                            {((
                                                                inv.contract as any
                                                            )?.tenant_name ??
                                                                "?")[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium text-gray-900">
                                                        {(inv.contract as any)
                                                            ?.tenant_name ??
                                                            "—"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-gray-500 text-xs hidden md:table-cell">
                                                {
                                                    INVOICE_TYPE_LABEL[
                                                        inv.invoice_type
                                                    ]
                                                }
                                            </td>
                                            <td className="px-5 py-4 font-semibold text-gray-900">
                                                {formatBRL(inv.amount_cents)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-gray-700">
                                                        {new Date(
                                                            inv.due_date +
                                                                "T12:00:00",
                                                        ).toLocaleDateString(
                                                            "pt-BR",
                                                            {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                            },
                                                        )}
                                                    </span>
                                                    {isPastDue(inv) && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
                                                            <AlertCircle className="w-3 h-3" />
                                                            Em atraso
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                                        inv.status ===
                                                        InvoiceStatus.Paid
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                            : inv.status ===
                                                                InvoiceStatus.Pending
                                                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                                              : inv.status ===
                                                                      InvoiceStatus.Overdue ||
                                                                  isPastDue(inv)
                                                                ? "bg-red-50 text-red-700 border-red-200"
                                                                : "bg-gray-50 text-gray-600 border-gray-200"
                                                    }`}
                                                >
                                                    {statusIcon[inv.status]}
                                                    {
                                                        INVOICE_STATUS_LABEL[
                                                            inv.status
                                                        ]
                                                    }
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 hidden lg:table-cell">
                                                {inv.paid_at ? (
                                                    <span className="text-sm text-emerald-700 font-medium">
                                                        {new Date(
                                                            inv.paid_at,
                                                        ).toLocaleDateString(
                                                            "pt-BR",
                                                            {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                            },
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {(inv.status ===
                                                        InvoiceStatus.Pending ||
                                                        inv.status ===
                                                            InvoiceStatus.Overdue) && (
                                                        <button
                                                            onClick={() => {
                                                                setPayingInvoice(
                                                                    inv,
                                                                );
                                                                setPayDate(
                                                                    clampToToday(
                                                                        inv.due_date,
                                                                    ),
                                                                );
                                                            }}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                                                        >
                                                            Marcar pago
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() =>
                                                            openEdit(inv)
                                                        }
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                                        title="Editar fatura"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setDeletingInvoice(
                                                                inv,
                                                            )
                                                        }
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Excluir fatura"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Pagination ── */}
                    {totalPages > 1 && (
                        <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-xs text-gray-400">
                                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–
                                {Math.min(
                                    currentPage * PAGE_SIZE,
                                    filteredInvoices.length,
                                )}{" "}
                                de {filteredInvoices.length} faturas
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((p) => p - 1)}
                                    disabled={currentPage === 1}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from(
                                    { length: totalPages },
                                    (_, i) => i + 1,
                                )
                                    .filter(
                                        (p) =>
                                            p === 1 ||
                                            p === totalPages ||
                                            Math.abs(p - currentPage) <= 1,
                                    )
                                    .reduce<(number | "...")[]>(
                                        (acc, p, idx, arr) => {
                                            if (
                                                idx > 0 &&
                                                p - (arr[idx - 1] as number) > 1
                                            )
                                                acc.push("...");
                                            acc.push(p);
                                            return acc;
                                        },
                                        [],
                                    )
                                    .map((p, i) =>
                                        p === "..." ? (
                                            <span
                                                key={`ellipsis-${i}`}
                                                className="px-1 text-xs text-gray-400"
                                            >
                                                …
                                            </span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() =>
                                                    setCurrentPage(p as number)
                                                }
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                                                    p === currentPage
                                                        ? "bg-primary-600 text-white border border-primary-600"
                                                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ),
                                    )}
                                <button
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                    disabled={currentPage === totalPages}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* ── Edit Invoice Modal ── */}
            <Modal
                open={!!editingInvoice}
                onClose={() => setEditingInvoice(null)}
                title="Editar Fatura"
                className="max-w-md mx-4"
            >
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4 -mt-1">
                    <button
                        onClick={() => setEditTab("details")}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            editTab === "details"
                                ? "border-primary-600 text-primary-700"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        Detalhes
                    </button>
                    <button
                        onClick={() => setEditTab("notes")}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            editTab === "notes"
                                ? "border-primary-600 text-primary-700"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Anotações
                    </button>
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        editMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    {editTab === "details" ? (
                        <>
                            <Input
                                label="Valor (R$)"
                                id="edit_amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={editForm.amount}
                                onChange={setE("amount")}
                                required
                            />
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="edit_due"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Vencimento
                                </label>
                                <input
                                    id="edit_due"
                                    type="date"
                                    value={editForm.due_date}
                                    onChange={(e) =>
                                        setEditForm((f) => ({
                                            ...f,
                                            due_date: e.target.value,
                                        }))
                                    }
                                    required
                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 bg-white"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700">
                                    Tipo
                                </label>
                                <select
                                    value={editForm.invoice_type}
                                    onChange={setE("invoice_type")}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary-400"
                                >
                                    {Object.values(InvoiceType).map((t) => (
                                        <option key={t} value={t}>
                                            {INVOICE_TYPE_LABEL[t]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700">
                                    Status
                                </label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) => {
                                        const s = e.target.value;
                                        setEditForm((f) => ({
                                            ...f,
                                            status: s,
                                            paid_at:
                                                s === InvoiceStatus.Paid
                                                    ? f.paid_at ||
                                                      new Date()
                                                          .toISOString()
                                                          .split("T")[0]
                                                    : "",
                                        }));
                                    }}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary-400"
                                >
                                    <option value={InvoiceStatus.Pending}>
                                        {
                                            INVOICE_STATUS_LABEL[
                                                InvoiceStatus.Pending
                                            ]
                                        }
                                    </option>
                                    <option value={InvoiceStatus.Paid}>
                                        {
                                            INVOICE_STATUS_LABEL[
                                                InvoiceStatus.Paid
                                            ]
                                        }
                                    </option>
                                    <option value={InvoiceStatus.Overdue}>
                                        {
                                            INVOICE_STATUS_LABEL[
                                                InvoiceStatus.Overdue
                                            ]
                                        }
                                    </option>
                                    <option value={InvoiceStatus.Cancelled}>
                                        {
                                            INVOICE_STATUS_LABEL[
                                                InvoiceStatus.Cancelled
                                            ]
                                        }
                                    </option>
                                </select>
                            </div>
                            {editForm.status === InvoiceStatus.Paid && (
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="edit_paid_at"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Data do pagamento
                                    </label>
                                    <input
                                        id="edit_paid_at"
                                        type="date"
                                        value={editForm.paid_at}
                                        onChange={(e) =>
                                            setEditForm((f) => ({
                                                ...f,
                                                paid_at: e.target.value,
                                            }))
                                        }
                                        required
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 bg-white"
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Anotações
                            </label>
                            <textarea
                                rows={8}
                                placeholder="Adicione observações sobre esta fatura..."
                                value={editForm.description}
                                onChange={(e) =>
                                    setEditForm((f) => ({
                                        ...f,
                                        description: e.target.value,
                                    }))
                                }
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 bg-white resize-none"
                            />
                        </div>
                    )}
                    {editMutation.isError && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                            {(editMutation.error as Error)?.message ||
                                "Erro ao salvar"}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingInvoice(null)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" loading={editMutation.isPending}>
                            Salvar alterações
                        </Button>
                    </div>
                </form>
            </Modal>
            {/* ── Delete Confirmation Modal ── */}
            <Modal
                open={!!deletingInvoice}
                onClose={() => setDeletingInvoice(null)}
                title="Excluir Fatura"
                className="max-w-sm mx-4"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Tem certeza que deseja excluir esta fatura? Esta ação
                        não pode ser desfeita.
                    </p>
                    {deletingInvoice && (
                        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
                            <p className="text-gray-500">
                                Valor:{" "}
                                <span className="font-semibold text-gray-900">
                                    {formatBRL(deletingInvoice.amount_cents)}
                                </span>
                            </p>
                            <p className="text-gray-500">
                                Iniquilino:{" "}
                                <span className="font-medium text-gray-700">
                                    {(deletingInvoice.contract as any)
                                        ?.tenant_name ?? "—"}
                                </span>
                            </p>
                            <p className="text-gray-500">
                                Tipo:{" "}
                                <span className="font-medium text-gray-700">
                                    {
                                        INVOICE_TYPE_LABEL[
                                            deletingInvoice.invoice_type
                                        ]
                                    }
                                </span>
                            </p>
                        </div>
                    )}
                    {deleteMutation.isError && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                            {(deleteMutation.error as Error)?.message ||
                                "Erro ao excluir"}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setDeletingInvoice(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            loading={deleteMutation.isPending}
                            onClick={() =>
                                deletingInvoice &&
                                deleteMutation.mutate(deletingInvoice.id)
                            }
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Create Standalone Invoice Modal ── */}
            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Nova Fatura Avulsa"
                className="max-w-md mx-4"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        createMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Contrato / Inquilino
                        </label>
                        <select
                            value={createForm.contract_id}
                            onChange={(e) =>
                                setCreateForm((f) => ({
                                    ...f,
                                    contract_id: e.target.value,
                                }))
                            }
                            required
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary-400"
                        >
                            <option value="">Selecione um contrato…</option>
                            {contracts.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.tenant_name}
                                    {c.status !== "active"
                                        ? " (encerrado)"
                                        : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Categoria
                        </label>
                        <select
                            value={createForm.invoice_type}
                            onChange={(e) =>
                                setCreateForm((f) => ({
                                    ...f,
                                    invoice_type: e.target.value as InvoiceType,
                                }))
                            }
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary-400"
                        >
                            {Object.values(InvoiceType).map((t) => (
                                <option key={t} value={t}>
                                    {INVOICE_TYPE_LABEL[t]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Input
                        label="Valor (R$)"
                        id="create_amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={createForm.amount}
                        onChange={(e) =>
                            setCreateForm((f) => ({
                                ...f,
                                amount: e.target.value,
                            }))
                        }
                        required
                    />
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="create_due"
                            className="text-sm font-medium text-gray-700"
                        >
                            Vencimento
                        </label>
                        <input
                            id="create_due"
                            type="date"
                            value={createForm.due_date}
                            onChange={(e) =>
                                setCreateForm((f) => ({
                                    ...f,
                                    due_date: e.target.value,
                                }))
                            }
                            required
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 bg-white"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Anotações{" "}
                            <span className="text-gray-400 font-normal">
                                (opcional)
                            </span>
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Descreva o motivo ou detalhes desta cobrança…"
                            value={createForm.description}
                            onChange={(e) =>
                                setCreateForm((f) => ({
                                    ...f,
                                    description: e.target.value,
                                }))
                            }
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 bg-white resize-none"
                        />
                    </div>
                    {createMutation.isError && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                            {(createMutation.error as Error)?.message ||
                                "Erro ao criar fatura"}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setCreateOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            loading={createMutation.isPending}
                        >
                            Criar Fatura
                        </Button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={!!payingInvoice}
                onClose={() => setPayingInvoice(null)}
                title="Confirmar Pagamento"
                className="max-w-sm mx-4"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Informe a data em que o pagamento foi recebido.
                    </p>
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="pay_date"
                            className="text-sm font-medium text-gray-700"
                        >
                            Data do pagamento
                        </label>
                        <input
                            id="pay_date"
                            type="date"
                            value={payDate}
                            onChange={(e) => setPayDate(e.target.value)}
                            max={new Date().toISOString().split("T")[0]}
                            required
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 bg-white"
                        />
                    </div>
                    {payingInvoice && (
                        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
                            <p className="text-gray-500">
                                Valor:{" "}
                                <span className="font-semibold text-gray-900">
                                    {formatBRL(payingInvoice.amount_cents)}
                                </span>
                            </p>
                            <p className="text-gray-500">
                                Vencimento:{" "}
                                <span className="font-medium text-gray-700">
                                    {new Date(
                                        payingInvoice.due_date + "T12:00:00",
                                    ).toLocaleDateString("pt-BR")}
                                </span>
                            </p>
                        </div>
                    )}
                    {payMutation.isError && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                            {(payMutation.error as Error)?.message ||
                                "Erro ao salvar"}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setPayingInvoice(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            loading={payMutation.isPending}
                            disabled={!payDate}
                            onClick={() =>
                                payingInvoice &&
                                payMutation.mutate({
                                    id: payingInvoice.id,
                                    paidAt: new Date(
                                        payDate + "T12:00:00",
                                    ).toISOString(),
                                })
                            }
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
