import { useQuery } from "@tanstack/react-query";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import {
    ArrowUpRight,
    TrendingUp,
    Building2,
    FileText,
    AlertCircle,
    Plus,
    ExternalLink,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../hooks/useAuth";
import { contractService } from "../../services/contract.service";
import { propertyService } from "../../services/property.service";
import { formatBRL } from "../../lib/currency";
import {
    ContractStatus,
    InvoiceStatus,
    PropertyStatus,
} from "../../lib/constants";
import { useNavigate } from "react-router-dom";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];
const GREEN_DARK = "#1c6147";
const GREEN_MED = "#339970";
const GREEN_LIGHT = "#8dd0b2";

export function DashboardPage() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();

    const { data: contracts = [] } = useQuery({
        queryKey: ["owner-contracts", user?.id],
        queryFn: () => contractService.listByOwner(user!.id),
        enabled: !!user,
    });

    const { data: properties = [] } = useQuery({
        queryKey: ["owner-properties", user?.id],
        queryFn: () => propertyService.list(user!.id),
        enabled: !!user,
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ["owner-invoices", user?.id],
        queryFn: () => contractService.listInvoicesByOwner(user!.id),
        enabled: !!user,
    });

    const activeContracts = contracts.filter(
        (c) => c.status === ContractStatus.Active,
    );
    const vacantProperties = properties.filter(
        (p) => p.status === PropertyStatus.Vacant,
    );
    const overdueInvoices = invoices.filter(
        (i) => i.status === InvoiceStatus.Overdue,
    );
    const pendingInvoices = invoices.filter(
        (i) => i.status === InvoiceStatus.Pending,
    );

    const totalReceivable = pendingInvoices.reduce(
        (s, i) => s + i.amount_cents,
        0,
    );
    const totalOverdue = overdueInvoices.reduce(
        (s, i) => s + i.amount_cents,
        0,
    );

    // Build chart data — last 7 months
    const today = new Date();
    const chartData = MONTH_LABELS.map((month, idx) => {
        const d = new Date(
            today.getFullYear(),
            today.getMonth() - (6 - idx),
            1,
        );
        const paid = invoices
            .filter((i) => {
                if (!i.paid_at) return false;
                const pd = new Date(i.paid_at);
                return (
                    pd.getMonth() === d.getMonth() &&
                    pd.getFullYear() === d.getFullYear()
                );
            })
            .reduce((s, i) => s + i.amount_cents, 0);
        return { month, value: paid / 100 };
    });

    // Upcoming invoices (within 7 days)
    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() + 7);
    const upcoming = pendingInvoices
        .filter((i) => new Date(i.due_date) <= sevenDays)
        .slice(0, 4);

    const recentContracts = [...activeContracts].slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Page title */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Dashboard
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Olá, {profile?.full_name?.split(" ")[0]} — visão geral
                        dos seus imóveis.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        icon={<Plus className="w-4 h-4" />}
                        onClick={() => navigate("/owner/contracts")}
                    >
                        Novo Contrato
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => navigate("/owner/properties")}
                    >
                        Importar
                    </Button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total de Contratos"
                    value={contracts.length}
                    sub="todos os contratos"
                    dark
                />
                <StatCard
                    label="Contratos Ativos"
                    value={activeContracts.length}
                    sub="em andamento"
                    icon={<FileText className="w-4 h-4" />}
                />
                <StatCard
                    label="A Receber"
                    value={formatBRL(totalReceivable)}
                    sub="faturas pendentes"
                    icon={<TrendingUp className="w-4 h-4" />}
                />
                <StatCard
                    label="Imóveis Vagos"
                    value={vacantProperties.length}
                    sub={
                        vacantProperties.length === 1
                            ? "disponível"
                            : "disponíveis"
                    }
                    icon={<Building2 className="w-4 h-4" />}
                />
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Receita Mensal</CardTitle>
                        <span className="text-xs text-gray-400">
                            Últimos 7 meses
                        </span>
                    </CardHeader>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} barSize={28}>
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: "#9ca3af" }}
                            />
                            <YAxis hide />
                            <Tooltip
                                formatter={(v: number) => [
                                    `R$ ${v.toFixed(2)}`,
                                    "Recebido",
                                ]}
                                contentStyle={{
                                    borderRadius: 12,
                                    border: "none",
                                    boxShadow: "0 4px 20px rgba(0,0,0,.08)",
                                    fontSize: 12,
                                }}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {chartData.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={
                                            i === chartData.length - 1
                                                ? GREEN_DARK
                                                : i % 2 === 0
                                                  ? GREEN_MED
                                                  : GREEN_LIGHT
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* Upcoming due dates */}
                <Card>
                    <CardHeader>
                        <CardTitle>Vencimentos Próximos</CardTitle>
                        {overdueInvoices.length > 0 && (
                            <Badge variant="overdue">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {overdueInvoices.length} atrasadas
                            </Badge>
                        )}
                    </CardHeader>
                    {upcoming.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">
                            Nenhum vencimento nos próximos 7 dias
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {upcoming.map((inv) => (
                                <li
                                    key={inv.id}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <div>
                                        <p className="font-medium text-gray-800 text-xs">
                                            {(inv.contract as any)
                                                ?.tenant_name ?? "—"}
                                        </p>
                                        <p className="text-gray-400 text-[11px]">
                                            Vence{" "}
                                            {new Date(
                                                inv.due_date,
                                            ).toLocaleDateString("pt-BR")}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-gray-900 text-xs">
                                            {formatBRL(inv.amount_cents)}
                                        </p>
                                        <Badge variant="pending">
                                            Pendente
                                        </Badge>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {totalOverdue > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => navigate("/owner/invoices")}
                                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl py-2 transition-colors"
                            >
                                Ver faturas atrasadas ({formatBRL(totalOverdue)}
                                )
                                <ExternalLink className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </Card>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Tenant list */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Inquilinos Ativos</CardTitle>
                        <button
                            onClick={() => navigate("/owner/contracts")}
                            className="text-xs text-primary-700 font-medium hover:underline"
                        >
                            Ver todos
                        </button>
                    </CardHeader>
                    {activeContracts.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">
                            Nenhum contrato ativo
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-50">
                            {activeContracts.slice(0, 5).map((c) => {
                                const due = invoices.find(
                                    (i) =>
                                        i.contract_id === c.id &&
                                        i.status === InvoiceStatus.Pending,
                                );
                                return (
                                    <li
                                        key={c.id}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs shrink-0">
                                            {c.tenant_name
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {c.tenant_name}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">
                                                {(c.property as any)
                                                    ?.address_street ?? "—"}
                                            </p>
                                        </div>
                                        {due ? (
                                            <Badge variant="pending">
                                                Pendente
                                            </Badge>
                                        ) : (
                                            <Badge variant="paid">Em dia</Badge>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>

                {/* Contracts list */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contratos</CardTitle>
                        <button
                            onClick={() => navigate("/owner/contracts")}
                            className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                        >
                            <Plus className="w-3 h-3 text-gray-500" />
                        </button>
                    </CardHeader>
                    {recentContracts.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">
                            Nenhum contrato
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {recentContracts.map((c) => (
                                <li
                                    key={c.id}
                                    onClick={() =>
                                        navigate(`/owner/contracts/${c.id}`)
                                    }
                                    className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                        {c.tenant_name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">
                                            {c.tenant_name}
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            Vence:{" "}
                                            {new Date(
                                                c.end_date,
                                            ).toLocaleDateString("pt-BR")}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    sub: string;
    dark?: boolean;
    icon?: React.ReactNode;
}

function StatCard({ label, value, sub, dark, icon }: StatCardProps) {
    return (
        <div
            className={`rounded-2xl p-5 flex flex-col gap-3 border ${
                dark
                    ? "bg-primary-800 border-primary-700 text-white"
                    : "bg-white border-gray-100 shadow-sm text-gray-900"
            }`}
        >
            <div className="flex items-center justify-between">
                <span
                    className={`text-xs font-medium ${dark ? "text-primary-200" : "text-gray-500"}`}
                >
                    {label}
                </span>
                <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        dark
                            ? "bg-primary-700 text-white"
                            : "bg-gray-100 text-gray-500"
                    }`}
                >
                    {dark ? <ArrowUpRight className="w-3.5 h-3.5" /> : icon}
                </div>
            </div>
            <div>
                <p
                    className={`text-3xl font-bold ${dark ? "text-white" : "text-gray-900"}`}
                >
                    {value}
                </p>
                <p
                    className={`text-[11px] mt-1 flex items-center gap-1 ${dark ? "text-primary-300" : "text-gray-400"}`}
                >
                    <TrendingUp className="w-3 h-3" />
                    {sub}
                </p>
            </div>
        </div>
    );
}
