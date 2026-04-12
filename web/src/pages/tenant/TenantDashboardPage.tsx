import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Receipt } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../hooks/useAuth";
import { contractService } from "../../services/contract.service";
import { formatBRL } from "../../lib/currency";
import {
    ContractStatus,
    InvoiceStatus,
    INVOICE_TYPE_LABEL,
    INVOICE_STATUS_LABEL,
} from "../../lib/constants";

export function TenantDashboardPage() {
    const { user, profile } = useAuth();

    const { data: contracts = [] } = useQuery({
        queryKey: ["tenant-contracts", user?.id],
        queryFn: () => contractService.listByTenant(user!.id),
        enabled: !!user,
    });

    const activeContract = contracts.find(
        (c) => c.status === ContractStatus.Active,
    );

    const { data: invoices = [] } = useQuery({
        queryKey: ["tenant-invoices", activeContract?.id],
        queryFn: () =>
            contractService.listInvoicesByContract(activeContract!.id),
        enabled: !!activeContract,
    });

    const pendingInvoices = invoices.filter(
        (i) => i.status === InvoiceStatus.Pending,
    );
    const paidInvoices = invoices.filter(
        (i) => i.status === InvoiceStatus.Paid,
    );
    const overdueInvoices = invoices.filter(
        (i) => i.status === InvoiceStatus.Overdue,
    );

    const totalThisMonth = pendingInvoices
        .filter((i) => {
            const d = new Date(i.due_date);
            const n = new Date();
            return (
                d.getMonth() === n.getMonth() &&
                d.getFullYear() === n.getFullYear()
            );
        })
        .reduce((s, i) => s + i.amount_cents, 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Minha Área</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Olá, {profile?.full_name?.split(" ")[0]}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-primary-800 text-white p-5">
                    <p className="text-xs text-primary-200 mb-2">
                        Contratos Ativos
                    </p>
                    <p className="text-3xl font-bold">
                        {
                            contracts.filter(
                                (c) => c.status === ContractStatus.Active,
                            ).length
                        }
                    </p>
                </div>
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                    <p className="text-xs text-gray-500 mb-2">A Pagar no Mês</p>
                    <p className="text-3xl font-bold text-gray-900">
                        {formatBRL(totalThisMonth)}
                    </p>
                </div>
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                    <p className="text-xs text-gray-500 mb-2">
                        Faturas Atrasadas
                    </p>
                    <p
                        className={`text-3xl font-bold ${overdueInvoices.length > 0 ? "text-red-600" : "text-gray-900"}`}
                    >
                        {overdueInvoices.length}
                    </p>
                </div>
            </div>

            {/* Active contract */}
            {activeContract ? (
                <Card>
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">
                                Contrato Ativo
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {
                                    (activeContract.property as any)
                                        ?.address_street
                                }
                                ,{" "}
                                {
                                    (activeContract.property as any)
                                        ?.address_number
                                }{" "}
                                —{" "}
                                {(activeContract.property as any)?.address_city}
                            </p>
                        </div>
                        {activeContract.pdf_storage_path && (
                            <a
                                href={activeContract.pdf_storage_path}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:underline"
                            >
                                <Download className="w-3.5 h-3.5" /> Baixar PDF
                            </a>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">
                                Aluguel
                            </p>
                            <p className="font-semibold text-gray-900">
                                {formatBRL(activeContract.rent_amount_cents)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">
                                Caução
                            </p>
                            <p className="font-semibold text-gray-900">
                                {formatBRL(activeContract.deposit_amount_cents)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">
                                Início
                            </p>
                            <p className="font-semibold text-gray-900">
                                {new Date(
                                    activeContract.start_date,
                                ).toLocaleDateString("pt-BR")}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">
                                Término
                            </p>
                            <p className="font-semibold text-gray-900">
                                {new Date(
                                    activeContract.end_date,
                                ).toLocaleDateString("pt-BR")}
                            </p>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card className="text-center py-10">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhum contrato ativo</p>
                </Card>
            )}

            {/* Invoices */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900">
                        Minhas Faturas
                    </h2>
                    <div className="flex gap-2">
                        <Badge variant="pending">
                            {pendingInvoices.length} pendentes
                        </Badge>
                        <Badge variant="paid">
                            {paidInvoices.length} pagas
                        </Badge>
                    </div>
                </div>
                {invoices.length === 0 ? (
                    <div className="text-center py-8">
                        <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">
                            Nenhuma fatura encontrada
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Tipo
                                    </th>
                                    <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Valor
                                    </th>
                                    <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Vencimento
                                    </th>
                                    <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {invoices.slice(0, 12).map((inv) => (
                                    <tr
                                        key={inv.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="py-3 text-gray-700">
                                            {
                                                INVOICE_TYPE_LABEL[
                                                    inv.invoice_type
                                                ]
                                            }
                                        </td>
                                        <td className="py-3 font-semibold text-gray-900">
                                            {formatBRL(inv.amount_cents)}
                                        </td>
                                        <td className="py-3 text-gray-500">
                                            {new Date(
                                                inv.due_date,
                                            ).toLocaleDateString("pt-BR")}
                                        </td>
                                        <td className="py-3">
                                            <Badge
                                                variant={
                                                    inv.status ===
                                                    InvoiceStatus.Paid
                                                        ? "paid"
                                                        : inv.status ===
                                                            InvoiceStatus.Overdue
                                                          ? "overdue"
                                                          : "pending"
                                                }
                                            >
                                                {
                                                    INVOICE_STATUS_LABEL[
                                                        inv.status
                                                    ]
                                                }
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
