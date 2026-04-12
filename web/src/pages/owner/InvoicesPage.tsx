import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Receipt,
    CheckCircle2,
    Clock,
    AlertCircle,
    Pencil,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
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

    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editForm, setEditForm] = useState({
        amount: "",
        due_date: "",
        invoice_type: "",
        status: "",
    });

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ["owner-invoices", user?.id],
        queryFn: () => contractService.listInvoicesByOwner(user!.id),
        enabled: !!user,
    });

    const payMutation = useMutation({
        mutationFn: (id: string) => contractService.markInvoicePaid(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-invoices"] }),
    });

    const editMutation = useMutation({
        mutationFn: () =>
            contractService.updateInvoice(editingInvoice!.id, {
                amount_cents: Math.round(Number(editForm.amount) * 100),
                due_date: editForm.due_date,
                invoice_type: editForm.invoice_type,
                status: editForm.status,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            setEditingInvoice(null);
        },
    });

    function openEdit(inv: Invoice) {
        setEditingInvoice(inv);
        setEditForm({
            amount: String(inv.amount_cents / 100),
            due_date: inv.due_date,
            invoice_type: inv.invoice_type,
            status: inv.status,
        });
    }
    const setE =
        (k: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setEditForm((f) => ({ ...f, [k]: e.target.value }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Faturas</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    {invoices.length} fatura(s) no total
                </p>
            </div>

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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Inquilino
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Tipo
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Valor
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Vencimento
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Status
                                    </th>
                                    <th className="px-5 py-3.5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {invoices.map((inv) => (
                                    <tr
                                        key={inv.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-5 py-4 font-medium text-gray-900">
                                            {(inv.contract as any)
                                                ?.tenant_name ?? "—"}
                                        </td>
                                        <td className="px-5 py-4 text-gray-600">
                                            {
                                                INVOICE_TYPE_LABEL[
                                                    inv.invoice_type
                                                ]
                                            }
                                        </td>
                                        <td className="px-5 py-4 font-semibold text-gray-900">
                                            {formatBRL(inv.amount_cents)}
                                        </td>
                                        <td className="px-5 py-4 text-gray-500">
                                            {new Date(
                                                inv.due_date,
                                            ).toLocaleDateString("pt-BR")}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-1.5">
                                                {statusIcon[inv.status]}
                                                <Badge
                                                    variant={
                                                        statusVariant[
                                                            inv.status
                                                        ]
                                                    }
                                                >
                                                    {
                                                        INVOICE_STATUS_LABEL[
                                                            inv.status
                                                        ]
                                                    }
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex gap-1.5">
                                                {inv.status ===
                                                    InvoiceStatus.Pending ||
                                                inv.status ===
                                                    InvoiceStatus.Overdue ? (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        loading={
                                                            payMutation.isPending
                                                        }
                                                        onClick={() =>
                                                            payMutation.mutate(
                                                                inv.id,
                                                            )
                                                        }
                                                    >
                                                        Marcar pago
                                                    </Button>
                                                ) : null}
                                                {inv.status !==
                                                    InvoiceStatus.Paid && (
                                                    <button
                                                        onClick={() =>
                                                            openEdit(inv)
                                                        }
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                                        title="Editar fatura"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* ── Edit Invoice Modal ── */}
            <Modal
                open={!!editingInvoice}
                onClose={() => setEditingInvoice(null)}
                title="Editar Fatura"
                className="max-w-md mx-4"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        editMutation.mutate();
                    }}
                    className="space-y-4"
                >
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
                    <Input
                        label="Vencimento"
                        id="edit_due"
                        type="date"
                        value={editForm.due_date}
                        onChange={setE("due_date")}
                        required
                    />
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
                            onChange={setE("status")}
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary-400"
                        >
                            <option value={InvoiceStatus.Pending}>
                                {INVOICE_STATUS_LABEL[InvoiceStatus.Pending]}
                            </option>
                            <option value={InvoiceStatus.Overdue}>
                                {INVOICE_STATUS_LABEL[InvoiceStatus.Overdue]}
                            </option>
                            <option value={InvoiceStatus.Cancelled}>
                                {INVOICE_STATUS_LABEL[InvoiceStatus.Cancelled]}
                            </option>
                        </select>
                        <p className="text-xs text-gray-400">
                            Para marcar como pago, use o botão "Marcar pago" na
                            listagem.
                        </p>
                    </div>
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
        </div>
    );
}
