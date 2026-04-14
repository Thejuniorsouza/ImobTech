import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    FileText,
    Download,
    Eye,
    Calendar,
    Plus,
    Building2,
    ChevronRight,
    ChevronLeft,
    MapPin,
    Info,
    Printer,
    X,
    Pencil,
    Save,
    Trash2,
    Check,
    AlertTriangle,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DatePicker } from "../../components/ui/DatePicker";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../hooks/useAuth";
import { contractService } from "../../services/contract.service";
import { propertyService } from "../../services/property.service";
import { supabase } from "../../services/supabase";
import { formatBRL } from "../../lib/currency";
import {
    ContractStatus,
    CONTRACT_STATUS_LABEL,
    PropertyStatus,
    PROPERTY_STATUS_LABEL,
    PROPERTY_TYPE_LABEL,
    InvoiceType,
    InvoiceStatus,
    INVOICE_STATUS_LABEL,
} from "../../lib/constants";
import { useNavigate, useLocation } from "react-router-dom";
import type { Contract, Invoice, Property } from "../../types/domain.types";

const statusVariant: Record<ContractStatus, "active" | "gray" | "overdue"> = {
    [ContractStatus.Active]: "active",
    [ContractStatus.Terminated]: "gray",
    [ContractStatus.Expired]: "overdue",
};

const blankForm = {
    property_id: "",
    template_id: "",
    tenant_name: "",
    tenant_cpf: "",
    tenant_rg: "",
    tenant_address: "",
    tenant_email: "",
    tenant_phone: "",
    tenant_nationality: "Brasileiro(a)",
    tenant_marital_status: "",
    tenant_profession: "",
    rent: "",
    deposit_multiplier: "3",
    due_day: "5",
    duration_months: "12",
    start_date: "",
    end_date: "",
    entry_date: "",
    iptu_responsibility: "tenant" as "tenant" | "owner",
    condo_responsibility: "tenant" as "tenant" | "owner",
};

type Step = 1 | 2 | 3;

function countInvoices(form: typeof blankForm, prop: Property | null): string {
    if (!prop || !form.start_date || !form.end_date) return "—";
    const start = new Date(form.start_date + "T12:00:00");
    const end = new Date(form.end_date + "T12:00:00");
    if (end <= start) return "—";
    let months = 0;
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endM = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endM) {
        months++;
        cur.setMonth(cur.getMonth() + 1);
    }
    const rentMonths = Math.max(0, months - 1);
    const deposit = Number(form.deposit_multiplier) > 0 ? 1 : 0;
    const ownerIptu =
        prop.iptu_monthly_cents > 0 && form.iptu_responsibility === "owner";
    const ownerCondo =
        prop.condo_monthly_cents > 0 && form.condo_responsibility === "owner";
    const feeTypes = (ownerIptu ? 1 : 0) + (ownerCondo ? 1 : 0);
    const total = deposit + rentMonths + months * feeTypes;
    const parts: string[] = [];
    if (deposit > 0) parts.push("1 caução");
    if (rentMonths > 0)
        parts.push(`${rentMonths} meses de aluguel (a partir do 2° mês)`);
    if (feeTypes > 0)
        parts.push(
            `${months} meses de encargos (${feeTypes} tipo${feeTypes > 1 ? "s" : ""}, 1° mês proporcional)`,
        );
    return `${total} faturas — ${parts.join(" + ")}`;
}

export function ContractsPage() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const qc = useQueryClient();

    const [modal, setModal] = useState(false);
    const [step, setStep] = useState<Step>(1);
    const [form, setForm] = useState(blankForm);

    // Auto-calc end_date from start_date + duration_months
    useEffect(() => {
        if (form.start_date && form.duration_months) {
            const months = parseInt(form.duration_months, 10);
            if (months > 0) {
                const d = new Date(form.start_date + "T12:00:00");
                d.setMonth(d.getMonth() + months);
                d.setDate(d.getDate() - 1);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                setForm((f) => ({ ...f, end_date: `${yyyy}-${mm}-${dd}` }));
            }
        }
    }, [form.start_date, form.duration_months]);
    const [formError, setFormError] = useState<string | null>(null);
    const [viewingContract, setViewingContract] = useState<Contract | null>(
        null,
    );
    const [editingTenant, setEditingTenant] = useState(false);
    const [tenantForm, setTenantForm] = useState({
        tenant_name: "",
        tenant_cpf: "",
        tenant_rg: "",
        tenant_nationality: "",
        tenant_marital_status: "",
        tenant_profession: "",
        tenant_email: "",
        tenant_phone: "",
        tenant_address: "",
    });
    const [tenantSaveError, setTenantSaveError] = useState<string | null>(null);

    const { data: contracts = [], isLoading } = useQuery({
        queryKey: ["owner-contracts", user?.id],
        queryFn: () => contractService.listByOwner(user!.id),
        enabled: !!user,
    });

    const { data: contractInvoices = [] } = useQuery<Invoice[]>({
        queryKey: ["contract-invoices", viewingContract?.id],
        queryFn: () =>
            contractService.listInvoicesByContract(viewingContract!.id),
        enabled: !!viewingContract?.id,
    });

    // Auto-open contract detail if navigated from Dashboard
    useEffect(() => {
        const openId = (location.state as any)?.openContractId;
        if (openId && contracts.length > 0) {
            const found = contracts.find((c) => c.id === openId);
            if (found) {
                setViewingContract(found);
                // Clear state so refresh doesn't reopen
                window.history.replaceState({}, "");
            }
        }
    }, [contracts, location.state]);

    const updateTenantMutation = useMutation({
        mutationFn: async (contractId: string) => {
            const { data, error } = await supabase
                .from("contracts")
                .update(tenantForm)
                .eq("id", contractId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["owner-contracts"] });
            setViewingContract(data as Contract);
            setEditingTenant(false);
            setTenantSaveError(null);
        },
        onError: (err: any) =>
            setTenantSaveError(err.message ?? "Erro ao salvar"),
    });

    // Invoice management state
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>("all");
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(
        null,
    );
    const [editInvoiceForm, setEditInvoiceForm] = useState<{
        amount: string;
        due_date: string;
        status: string;
        paid_at: string;
    }>({ amount: "", due_date: "", status: "", paid_at: "" });
    const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(
        null,
    );

    const updateInvoiceMutation = useMutation({
        mutationFn: async (invoiceId: string) => {
            const amountCents = Math.round(
                parseFloat(editInvoiceForm.amount.replace(",", ".")) * 100,
            );
            const patch: Record<string, unknown> = {
                amount_cents: amountCents,
                due_date: editInvoiceForm.due_date,
                status: editInvoiceForm.status,
                paid_at:
                    editInvoiceForm.status === "paid" && editInvoiceForm.paid_at
                        ? editInvoiceForm.paid_at
                        : editInvoiceForm.status !== "paid"
                          ? null
                          : undefined,
            };
            await contractService.updateInvoice(invoiceId, patch as any);
        },
        onSuccess: () => {
            qc.invalidateQueries({
                queryKey: ["contract-invoices", viewingContract?.id],
            });
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            setEditingInvoiceId(null);
        },
    });

    const deleteInvoiceMutation = useMutation({
        mutationFn: (invoiceId: string) =>
            contractService.deleteInvoice(invoiceId),
        onSuccess: () => {
            qc.invalidateQueries({
                queryKey: ["contract-invoices", viewingContract?.id],
            });
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            setDeletingInvoiceId(null);
        },
    });

    // Contract termination state
    const [terminatingContract, setTerminatingContract] =
        useState<Contract | null>(null);
    const [terminationConfirmed, setTerminationConfirmed] = useState(false);

    const terminateMutation = useMutation({
        mutationFn: (contractId: string) =>
            contractService.terminateContract(contractId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["owner-contracts"] });
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            qc.invalidateQueries({
                queryKey: ["contract-invoices", terminatingContract?.id],
            });
            qc.invalidateQueries({ queryKey: ["owner-properties"] });
            setTerminatingContract(null);
            setTerminationConfirmed(false);
            setViewingContract(null);
        },
    });

    const { data: properties = [] } = useQuery({
        queryKey: ["owner-properties", user?.id],
        queryFn: () => propertyService.list(user!.id),
        enabled: !!user && modal,
    });

    const { data: templates = [] } = useQuery({
        queryKey: ["templates", user?.id],
        queryFn: () => contractService.listTemplates(user!.id),
        enabled: !!user,
    });

    const vacantProperties = properties.filter(
        (p) => p.status === PropertyStatus.Vacant,
    );
    const selectedProperty =
        properties.find((p) => p.id === form.property_id) ?? null;
    const selectedTemplate =
        templates.find((t) => t.id === form.template_id) ?? null;

    const createMutation = useMutation({
        mutationFn: async () => {
            const prop = selectedProperty!;
            const rentCents = Math.round(Number(form.rent) * 100);
            const depositMultiplier = Number(form.deposit_multiplier) || 0;
            const depositCents = rentCents * depositMultiplier;
            const dueDay = Number(form.due_day);

            const contract = await contractService.createContract({
                owner_id: user!.id,
                tenant_id: user!.id, // placeholder — real invite via Edge Function
                property_id: form.property_id,
                template_id: form.template_id || null,
                tenant_name: form.tenant_name,
                tenant_cpf: form.tenant_cpf.replace(/\D/g, ""),
                tenant_rg: form.tenant_rg,
                tenant_address: form.tenant_address,
                tenant_email: form.tenant_email || undefined,
                tenant_phone: form.tenant_phone || undefined,
                tenant_nationality: form.tenant_nationality || undefined,
                tenant_marital_status: form.tenant_marital_status || undefined,
                tenant_profession: form.tenant_profession || undefined,
                rent_amount_cents: rentCents,
                deposit_amount_cents: depositCents,
                due_day: dueDay,
                start_date: form.start_date,
                end_date: form.end_date,
            });

            await contractService.generateAndInsertInvoices(contract.id, {
                rent_amount_cents: rentCents,
                deposit_amount_cents: depositCents,
                iptu_monthly_cents:
                    form.iptu_responsibility === "owner"
                        ? prop.iptu_monthly_cents
                        : 0,
                condo_monthly_cents:
                    form.condo_responsibility === "owner"
                        ? prop.condo_monthly_cents
                        : 0,
                due_day: dueDay,
                start_date: form.start_date,
                end_date: form.end_date,
                entry_date: form.entry_date || form.start_date,
            });

            await propertyService.update(form.property_id, {
                status: PropertyStatus.Rented,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["owner-contracts"] });
            qc.invalidateQueries({ queryKey: ["owner-properties"] });
            qc.invalidateQueries({ queryKey: ["owner-invoices"] });
            closeModal();
        },
        onError: (err: Error) => {
            setFormError(err.message || "Erro ao criar contrato");
        },
    });

    function openCreate() {
        setForm(blankForm);
        setStep(1);
        setFormError(null);
        setModal(true);
    }
    function closeModal() {
        setModal(false);
        setStep(1);
        setFormError(null);
    }

    function renderTemplate(body: string, c: Contract): string {
        const prop = c.property as any;
        const zip = prop?.address_zip
            ? prop.address_zip.replace(/(\d{5})(\d{3})/, "$1-$2")
            : "";
        const propertyAddr = prop
            ? `${prop.address_street}, ${prop.address_number}${prop.address_complement ? ` apto ${prop.address_complement}` : ""}, ${prop.address_neighborhood} – ${prop.address_city}/${prop.address_state}, CEP ${zip}`
            : "";
        const durationMonths = (() => {
            const s = new Date(c.start_date + "T12:00:00");
            const e = new Date(c.end_date + "T12:00:00");
            return (
                (e.getFullYear() - s.getFullYear()) * 12 +
                (e.getMonth() - s.getMonth())
            );
        })();
        const propTypeLabels: Record<string, string> = {
            house: "Casa",
            apartment: "Apartamento",
            commercial: "Imóvel Comercial",
        };
        return (
            body
                // Locatário (inquilino)
                .replace(/\{\{tenant_name\}\}/g, c.tenant_name)
                .replace(/\{\{tenant_cpf\}\}/g, c.tenant_cpf)
                .replace(/\{\{tenant_rg\}\}/g, c.tenant_rg || "")
                .replace(/\{\{tenant_address\}\}/g, c.tenant_address || "")
                .replace(/\{\{tenant_email\}\}/g, c.tenant_email || "")
                .replace(/\{\{tenant_phone\}\}/g, c.tenant_phone || "")
                .replace(
                    /\{\{tenant_nationality\}\}/g,
                    c.tenant_nationality || "",
                )
                .replace(
                    /\{\{tenant_marital_status\}\}/g,
                    c.tenant_marital_status || "",
                )
                .replace(
                    /\{\{tenant_profession\}\}/g,
                    c.tenant_profession || "",
                )
                // Locador (proprietário)
                .replace(/\{\{owner_name\}\}/g, profile?.full_name || "")
                .replace(/\{\{owner_cpf\}\}/g, profile?.cpf || "")
                .replace(/\{\{owner_rg\}\}/g, profile?.rg || "")
                .replace(/\{\{owner_email\}\}/g, profile?.email || "")
                .replace(/\{\{owner_phone\}\}/g, profile?.phone || "")
                .replace(/\{\{owner_address\}\}/g, profile?.address || "")
                .replace(
                    /\{\{owner_nationality\}\}/g,
                    profile?.nationality || "",
                )
                .replace(
                    /\{\{owner_marital_status\}\}/g,
                    profile?.marital_status || "",
                )
                .replace(/\{\{owner_profession\}\}/g, profile?.profession || "")
                // Imóvel
                .replace(/\{\{property_address\}\}/g, propertyAddr)
                .replace(
                    /\{\{property_type\}\}/g,
                    propTypeLabels[prop?.property_type] || "",
                )
                .replace(
                    /\{\{property_area\}\}/g,
                    prop?.area_sqm ? `${prop.area_sqm} m²` : "",
                )
                .replace(
                    /\{\{property_bedrooms\}\}/g,
                    String(prop?.bedrooms ?? ""),
                )
                .replace(
                    /\{\{property_bathrooms\}\}/g,
                    String(prop?.bathrooms ?? ""),
                )
                .replace(
                    /\{\{property_parking\}\}/g,
                    String(prop?.parking_spaces ?? ""),
                )
                .replace(
                    /\{\{property_neighborhood\}\}/g,
                    prop?.address_neighborhood || "",
                )
                .replace(/\{\{property_city\}\}/g, prop?.address_city || "")
                .replace(/\{\{property_state\}\}/g, prop?.address_state || "")
                .replace(/\{\{property_zip\}\}/g, zip)
                .replace(
                    /\{\{property_registration\}\}/g,
                    prop?.registration_number || "",
                )
                .replace(
                    /\{\{property_description\}\}/g,
                    prop?.description || "",
                )
                // Financeiro
                .replace(/\{\{rent_amount\}\}/g, formatBRL(c.rent_amount_cents))
                .replace(
                    /\{\{deposit_amount\}\}/g,
                    formatBRL(c.deposit_amount_cents),
                )
                .replace(
                    /\{\{iptu_amount\}\}/g,
                    formatBRL(prop?.iptu_monthly_cents ?? 0),
                )
                .replace(
                    /\{\{condo_amount\}\}/g,
                    formatBRL(prop?.condo_monthly_cents ?? 0),
                )
                .replace(/\{\{due_day\}\}/g, String(c.due_day))
                // Datas
                .replace(
                    /\{\{start_date\}\}/g,
                    new Date(c.start_date + "T12:00:00").toLocaleDateString(
                        "pt-BR",
                    ),
                )
                .replace(
                    /\{\{end_date\}\}/g,
                    new Date(c.end_date + "T12:00:00").toLocaleDateString(
                        "pt-BR",
                    ),
                )
                .replace(
                    /\{\{contract_duration_months\}\}/g,
                    String(durationMonths),
                )
                .replace(
                    /\{\{contract_date\}\}/g,
                    new Date(c.created_at).toLocaleDateString("pt-BR"),
                )
                .replace(/\{\{contract_city\}\}/g, prop?.address_city || "")
        );
    }

    function handlePrintContract(c: Contract) {
        const template = templates.find((t) => t.id === c.template_id);
        const rendered = template ? renderTemplate(template.body, c) : "";
        const prop = c.property as any;
        const propAddr = prop
            ? `${prop.address_street}, ${prop.address_number} – ${prop.address_city}`
            : "";
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Contrato – ${c.tenant_name}</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#111;line-height:1.8;}
  h1{font-size:22px;text-align:center;margin-bottom:4px;}
  .subtitle{text-align:center;color:#555;margin-bottom:28px;font-size:14px;}
  hr{border:none;border-top:1px solid #ccc;margin:24px 0;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:14px;}
  .label{color:#666;}
  .body{white-space:pre-wrap;font-size:14px;margin-top:32px;}
  @media print{body{margin:20px;}}
</style></head><body>
<h1>CONTRATO DE LOCAÇÃO</h1>
<p class="subtitle">${propAddr}</p>
<hr>
<div class="grid">
  <div><span class="label">Inquilino: </span>${c.tenant_name}</div>
  <div><span class="label">CPF: </span>${c.tenant_cpf}</div>
  <div><span class="label">RG: </span>${c.tenant_rg || "—"}</div>
  <div><span class="label">Endereço: </span>${c.tenant_address || "—"}</div>
  <div><span class="label">Aluguel: </span>${formatBRL(c.rent_amount_cents)}/mês</div>
  <div><span class="label">Caução: </span>${formatBRL(c.deposit_amount_cents)}</div>
  <div><span class="label">Vencimento: </span>Dia ${c.due_day}</div>
  <div><span class="label">Período: </span>${new Date(c.start_date + "T12:00:00").toLocaleDateString("pt-BR")} – ${new Date(c.end_date + "T12:00:00").toLocaleDateString("pt-BR")}</div>
</div>
${rendered ? `<hr><div class="body">${rendered}</div>` : ""}
</body></html>`;
        const w = window.open("", "_blank");
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
    }
    const set =
        (k: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm((f) => ({ ...f, [k]: e.target.value }));

    function nextStep() {
        setFormError(null);
        if (step === 1) {
            if (!form.property_id) {
                setFormError("Selecione um imóvel.");
                return;
            }
            if (!form.template_id) {
                setFormError("Selecione um template.");
                return;
            }
        }
        if (step === 2) {
            if (
                !form.tenant_name ||
                !form.tenant_cpf ||
                !form.tenant_rg ||
                !form.tenant_address
            ) {
                setFormError("Preencha todos os dados do inquilino.");
                return;
            }
        }
        setStep((s) => (s + 1) as Step);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Contratos
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {contracts.length} contrato(s) cadastrado(s)
                    </p>
                </div>
                <Button
                    icon={<Plus className="w-4 h-4" />}
                    onClick={openCreate}
                >
                    Novo Contrato
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <span className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : contracts.length === 0 ? (
                <Card className="text-center py-16">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Nenhum contrato criado
                    </p>
                    <p className="text-sm text-gray-400 mb-4">
                        Crie seu primeiro contrato para começar
                    </p>
                    <Button
                        icon={<Plus className="w-4 h-4" />}
                        onClick={openCreate}
                    >
                        Novo Contrato
                    </Button>
                </Card>
            ) : (
                <>
                    {/* Active contracts */}
                    {(() => {
                        const activeContracts = contracts.filter(
                            (c) => c.status === ContractStatus.Active,
                        );
                        if (activeContracts.length === 0) return null;
                        return (
                            <Card padding={false}>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                    Inquilino
                                                </th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                    Imóvel
                                                </th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                    Aluguel
                                                </th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                    Período
                                                </th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                    Status
                                                </th>
                                                <th className="px-5 py-3.5"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {activeContracts.map((c) => (
                                                <tr
                                                    key={c.id}
                                                    className="hover:bg-gray-50 transition-colors"
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs shrink-0">
                                                                {c.tenant_name
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900">
                                                                    {
                                                                        c.tenant_name
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-gray-400">
                                                                    {
                                                                        c.tenant_cpf
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-gray-600 max-w-[160px]">
                                                        <p className="truncate">
                                                            {
                                                                (
                                                                    c.property as any
                                                                )
                                                                    ?.address_street
                                                            }
                                                            ,{" "}
                                                            {
                                                                (
                                                                    c.property as any
                                                                )
                                                                    ?.address_number
                                                            }
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {
                                                                (
                                                                    c.property as any
                                                                )?.address_city
                                                            }
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-4 font-semibold text-gray-900">
                                                        {formatBRL(
                                                            c.rent_amount_cents,
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(
                                                                c.start_date,
                                                            ).toLocaleDateString(
                                                                "pt-BR",
                                                            )}
                                                            {" – "}
                                                            {new Date(
                                                                c.end_date,
                                                            ).toLocaleDateString(
                                                                "pt-BR",
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <Badge
                                                            variant={
                                                                statusVariant[
                                                                    c.status
                                                                ]
                                                            }
                                                        >
                                                            {
                                                                CONTRACT_STATUS_LABEL[
                                                                    c.status
                                                                ]
                                                            }
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex gap-1.5">
                                                            <button
                                                                onClick={() =>
                                                                    setViewingContract(
                                                                        c,
                                                                    )
                                                                }
                                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                            {c.pdf_storage_path && (
                                                                <a
                                                                    href={
                                                                        c.pdf_storage_path
                                                                    }
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                                                >
                                                                    <Download className="w-3.5 h-3.5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        );
                    })()}

                    {/* Inactive contracts (terminated / expired) */}
                    {(() => {
                        const inactiveContracts = contracts.filter(
                            (c) =>
                                c.status === ContractStatus.Terminated ||
                                c.status === ContractStatus.Expired,
                        );
                        if (inactiveContracts.length === 0) return null;
                        return (
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                    Contratos inativos (
                                    {inactiveContracts.length})
                                </p>
                                <Card padding={false}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm opacity-75">
                                            <thead>
                                                <tr className="border-b border-gray-100">
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                                        Inquilino
                                                    </th>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                                        Imóvel
                                                    </th>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                                        Aluguel
                                                    </th>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                                        Período
                                                    </th>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                                        Status
                                                    </th>
                                                    <th className="px-5 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {inactiveContracts.map((c) => (
                                                    <tr
                                                        key={c.id}
                                                        className="hover:bg-gray-50 transition-colors text-gray-500"
                                                    >
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-semibold text-xs shrink-0">
                                                                    {c.tenant_name
                                                                        .charAt(
                                                                            0,
                                                                        )
                                                                        .toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-gray-600">
                                                                        {
                                                                            c.tenant_name
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-gray-400">
                                                                        {
                                                                            c.tenant_cpf
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3.5 max-w-[160px]">
                                                            <p className="truncate text-gray-500">
                                                                {
                                                                    (
                                                                        c.property as any
                                                                    )
                                                                        ?.address_street
                                                                }
                                                                ,{" "}
                                                                {
                                                                    (
                                                                        c.property as any
                                                                    )
                                                                        ?.address_number
                                                                }
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                {
                                                                    (
                                                                        c.property as any
                                                                    )
                                                                        ?.address_city
                                                                }
                                                            </p>
                                                        </td>
                                                        <td className="px-5 py-3.5 font-semibold text-gray-500">
                                                            {formatBRL(
                                                                c.rent_amount_cents,
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(
                                                                    c.start_date,
                                                                ).toLocaleDateString(
                                                                    "pt-BR",
                                                                )}{" "}
                                                                –{" "}
                                                                {new Date(
                                                                    c.end_date,
                                                                ).toLocaleDateString(
                                                                    "pt-BR",
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <Badge variant="gray">
                                                                {
                                                                    CONTRACT_STATUS_LABEL[
                                                                        c.status as ContractStatus
                                                                    ]
                                                                }
                                                            </Badge>
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <button
                                                                onClick={() =>
                                                                    setViewingContract(
                                                                        c,
                                                                    )
                                                                }
                                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>
                        );
                    })()}
                </>
            )}

            {/* ── Creation Modal ── */}
            <Modal
                open={modal}
                onClose={closeModal}
                title="Novo Contrato"
                className="max-w-2xl mx-4"
            >
                {/* Stepper */}
                <div className="flex items-center gap-2 mb-6">
                    {([1, 2, 3] as Step[]).map((s) => (
                        <div key={s} className="flex items-center gap-2 flex-1">
                            <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                                    step === s
                                        ? "bg-primary-700 text-white"
                                        : step > s
                                          ? "bg-primary-200 text-primary-700"
                                          : "bg-gray-100 text-gray-400"
                                }`}
                            >
                                {s}
                            </div>
                            <span
                                className={`text-xs font-medium truncate ${step === s ? "text-gray-900" : "text-gray-400"}`}
                            >
                                {s === 1
                                    ? "Imóvel & Template"
                                    : s === 2
                                      ? "Inquilino"
                                      : "Condições"}
                            </span>
                            {s < 3 && (
                                <div
                                    className={`h-px flex-1 ${step > s ? "bg-primary-300" : "bg-gray-200"}`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Step 1: Property + Template ── */}
                {step === 1 && (
                    <div className="space-y-5">
                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                                Imóvel{" "}
                                <span className="text-primary-600">*</span>
                            </p>
                            {vacantProperties.length === 0 ? (
                                <div className="border border-dashed border-gray-200 rounded-xl py-8 text-center">
                                    <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">
                                        Nenhum imóvel vago disponível
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Cadastre um imóvel antes de criar um
                                        contrato
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                                    {vacantProperties.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() =>
                                                setForm((f) => ({
                                                    ...f,
                                                    property_id: p.id,
                                                }))
                                            }
                                            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                                form.property_id === p.id
                                                    ? "border-primary-500 bg-primary-50"
                                                    : "border-gray-200 hover:border-gray-300 bg-white"
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 overflow-hidden">
                                                {p.photo_urls?.[0] ? (
                                                    <img
                                                        src={p.photo_urls[0]}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <Building2 className="w-5 h-5 text-primary-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-gray-900 truncate">
                                                    {p.address_street},{" "}
                                                    {p.address_number}
                                                </p>
                                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                    <MapPin className="w-3 h-3" />
                                                    {p.address_city} —{" "}
                                                    {
                                                        PROPERTY_TYPE_LABEL[
                                                            p.property_type
                                                        ]
                                                    }
                                                </p>
                                                {p.iptu_monthly_cents > 0 && (
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        IPTU{" "}
                                                        {formatBRL(
                                                            p.iptu_monthly_cents,
                                                        )}
                                                        /mês
                                                        {p.condo_monthly_cents >
                                                            0 &&
                                                            ` · Cond. ${formatBRL(p.condo_monthly_cents)}/mês`}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                                Template de Contrato{" "}
                                <span className="text-primary-600">*</span>
                            </p>
                            {templates.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">
                                    Carregando templates...
                                </p>
                            ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {templates.map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() =>
                                                setForm((f) => ({
                                                    ...f,
                                                    template_id: t.id,
                                                }))
                                            }
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                                                form.template_id === t.id
                                                    ? "border-primary-500 bg-primary-50"
                                                    : "border-gray-200 hover:border-gray-300 bg-white"
                                            }`}
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {t.name}
                                                </p>
                                                {t.is_system && (
                                                    <p className="text-xs text-primary-600">
                                                        Template padrão do
                                                        sistema
                                                    </p>
                                                )}
                                            </div>
                                            {form.template_id === t.id && (
                                                <div className="w-4 h-4 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
                                                    <div className="w-2 h-2 rounded-full bg-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Step 2: Tenant data ── */}
                {step === 2 && (
                    <div className="space-y-4">
                        <Input
                            label="Nome completo do inquilino *"
                            id="tenant_name"
                            value={form.tenant_name}
                            onChange={set("tenant_name")}
                            placeholder="Ex: Maria da Silva"
                            required
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="CPF *"
                                id="tenant_cpf"
                                value={form.tenant_cpf}
                                onChange={set("tenant_cpf")}
                                placeholder="000.000.000-00"
                                required
                            />
                            <Input
                                label="RG *"
                                id="tenant_rg"
                                value={form.tenant_rg}
                                onChange={set("tenant_rg")}
                                placeholder="00.000.000-0"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Nacionalidade"
                                id="tenant_nationality"
                                value={form.tenant_nationality}
                                onChange={set("tenant_nationality")}
                                placeholder="Brasileiro(a)"
                            />
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="tenant_marital_status"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Estado civil
                                </label>
                                <select
                                    id="tenant_marital_status"
                                    value={form.tenant_marital_status}
                                    onChange={set("tenant_marital_status")}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="">Selecionar</option>
                                    <option>Solteiro(a)</option>
                                    <option>Casado(a)</option>
                                    <option>Divorciado(a)</option>
                                    <option>Viúvo(a)</option>
                                    <option>União Estável</option>
                                </select>
                            </div>
                        </div>
                        <Input
                            label="Profissão"
                            id="tenant_profession"
                            value={form.tenant_profession}
                            onChange={set("tenant_profession")}
                            placeholder="Ex: Engenheiro"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="E-mail"
                                id="tenant_email"
                                type="email"
                                value={form.tenant_email}
                                onChange={set("tenant_email")}
                                placeholder="email@exemplo.com"
                            />
                            <Input
                                label="Telefone"
                                id="tenant_phone"
                                value={form.tenant_phone}
                                onChange={set("tenant_phone")}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                        <Input
                            label="Endereço do inquilino *"
                            id="tenant_address"
                            value={form.tenant_address}
                            onChange={set("tenant_address")}
                            placeholder="Rua, Número, Bairro, Cidade – UF"
                            required
                        />
                    </div>
                )}

                {/* ── Step 3: Contract terms ── */}
                {step === 3 && (
                    <div className="space-y-4">
                        {/* Property summary banner */}
                        {selectedProperty && (
                            <div className="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
                                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                    {selectedProperty.photo_urls?.[0] ? (
                                        <img
                                            src={selectedProperty.photo_urls[0]}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-primary-200 flex items-center justify-center">
                                            <Building2 className="w-4 h-4 text-primary-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-primary-900 truncate">
                                        {selectedProperty.address_street},{" "}
                                        {selectedProperty.address_number} —{" "}
                                        {selectedProperty.address_city}
                                    </p>
                                    <p className="text-xs text-primary-600">
                                        {
                                            PROPERTY_STATUS_LABEL[
                                                selectedProperty.status
                                            ]
                                        }{" "}
                                        ·{" "}
                                        {selectedTemplate?.name ??
                                            "Template selecionado"}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Valor do aluguel (R$) *"
                                id="rent"
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.rent}
                                onChange={set("rent")}
                                placeholder="0,00"
                                required
                            />
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="deposit_multiplier"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Caução (× aluguel)
                                </label>
                                <select
                                    id="deposit_multiplier"
                                    value={form.deposit_multiplier}
                                    onChange={set("deposit_multiplier")}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="0">Sem caução</option>
                                    <option value="1">1× aluguel</option>
                                    <option value="2">2× aluguel</option>
                                    <option value="3">3× aluguel</option>
                                    <option value="4">4× aluguel</option>
                                    <option value="5">5× aluguel</option>
                                    <option value="6">6× aluguel</option>
                                </select>
                                {Number(form.deposit_multiplier) > 0 && (
                                    <p className="text-xs text-emerald-700 font-medium">
                                        ={" "}
                                        {form.rent
                                            ? formatBRL(
                                                  Math.round(
                                                      Number(form.rent) * 100,
                                                  ) *
                                                      Number(
                                                          form.deposit_multiplier,
                                                      ),
                                              )
                                            : "preencha o aluguel"}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <Input
                                label="Dia de vencimento *"
                                id="due_day"
                                type="number"
                                min="1"
                                max="28"
                                value={form.due_day}
                                onChange={set("due_day")}
                                required
                            />
                            <DatePicker
                                label="Início do contrato *"
                                id="start_date"
                                value={form.start_date}
                                onChange={(v) =>
                                    setForm((f) => ({ ...f, start_date: v }))
                                }
                                required
                            />
                            <Input
                                label="Duração (meses) *"
                                id="duration_months"
                                type="number"
                                min="1"
                                max="120"
                                value={form.duration_months}
                                onChange={set("duration_months")}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker
                                label="Data de entrada do inquilino"
                                id="entry_date"
                                value={form.entry_date}
                                onChange={(v) =>
                                    setForm((f) => ({ ...f, entry_date: v }))
                                }
                            />
                            <DatePicker
                                label="Término do contrato *"
                                id="end_date"
                                value={form.end_date}
                                onChange={(v) =>
                                    setForm((f) => ({ ...f, end_date: v }))
                                }
                                minDate={
                                    form.start_date
                                        ? new Date(
                                              form.start_date + "T12:00:00",
                                          )
                                        : undefined
                                }
                                required
                            />
                        </div>
                        {form.entry_date &&
                            form.entry_date !== form.start_date && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                    <strong>Data de entrada</strong> diferente
                                    do início oficial. As cobranças de aluguel e
                                    encargos usarão a data de entrada como
                                    referência.
                                </p>
                            )}

                        {/* Fee responsibility */}
                        {selectedProperty &&
                            (selectedProperty.iptu_monthly_cents > 0 ||
                                selectedProperty.condo_monthly_cents > 0) && (
                                <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Responsabilidade pelos encargos
                                    </p>
                                    {selectedProperty.iptu_monthly_cents >
                                        0 && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 mb-1.5">
                                                IPTU ·{" "}
                                                {formatBRL(
                                                    selectedProperty.iptu_monthly_cents,
                                                )}
                                                /mês
                                            </p>
                                            <div className="flex gap-2">
                                                {(
                                                    ["tenant", "owner"] as const
                                                ).map((r) => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() =>
                                                            setForm((f) => ({
                                                                ...f,
                                                                iptu_responsibility:
                                                                    r,
                                                            }))
                                                        }
                                                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                                                            form.iptu_responsibility ===
                                                            r
                                                                ? "bg-primary-600 border-primary-600 text-white"
                                                                : "bg-white border-gray-200 text-gray-600 hover:border-primary-300"
                                                        }`}
                                                    >
                                                        {r === "tenant"
                                                            ? "Inquilino paga direto"
                                                            : "Proprietário cobra e repassa"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedProperty.condo_monthly_cents >
                                        0 && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 mb-1.5">
                                                Condomínio ·{" "}
                                                {formatBRL(
                                                    selectedProperty.condo_monthly_cents,
                                                )}
                                                /mês
                                            </p>
                                            <div className="flex gap-2">
                                                {(
                                                    ["tenant", "owner"] as const
                                                ).map((r) => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() =>
                                                            setForm((f) => ({
                                                                ...f,
                                                                condo_responsibility:
                                                                    r,
                                                            }))
                                                        }
                                                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                                                            form.condo_responsibility ===
                                                            r
                                                                ? "bg-primary-600 border-primary-600 text-white"
                                                                : "bg-white border-gray-200 text-gray-600 hover:border-primary-300"
                                                        }`}
                                                    >
                                                        {r === "tenant"
                                                            ? "Inquilino paga direto"
                                                            : "Proprietário cobra e repassa"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        {/* Invoice preview */}
                        {form.start_date &&
                            form.end_date &&
                            selectedProperty && (
                                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                                    <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                    <div className="text-xs text-emerald-800">
                                        <p className="font-semibold mb-0.5">
                                            Faturas a gerar automaticamente
                                        </p>
                                        <p>
                                            {countInvoices(
                                                form,
                                                selectedProperty,
                                            )}
                                        </p>
                                        {(() => {
                                            const entryStr =
                                                form.entry_date ||
                                                form.start_date;
                                            if (!entryStr) return null;
                                            const entry = new Date(
                                                entryStr + "T12:00:00",
                                            );
                                            const daysInMonth = new Date(
                                                entry.getFullYear(),
                                                entry.getMonth() + 1,
                                                0,
                                            ).getDate();
                                            const daysUsed =
                                                daysInMonth -
                                                entry.getDate() +
                                                1;
                                            const isProrated =
                                                daysUsed < daysInMonth;
                                            const hasOwnerFee =
                                                (selectedProperty.iptu_monthly_cents >
                                                    0 &&
                                                    form.iptu_responsibility ===
                                                        "owner") ||
                                                (selectedProperty.condo_monthly_cents >
                                                    0 &&
                                                    form.condo_responsibility ===
                                                        "owner");
                                            return (
                                                <>
                                                    {selectedProperty.iptu_monthly_cents >
                                                        0 && (
                                                        <p className="text-emerald-600 mt-0.5">
                                                            IPTU{" "}
                                                            {formatBRL(
                                                                selectedProperty.iptu_monthly_cents,
                                                            )}
                                                            /mês —{" "}
                                                            {form.iptu_responsibility ===
                                                            "owner" ? (
                                                                <>
                                                                    incluído nas
                                                                    faturas
                                                                    {isProrated && (
                                                                        <span className="ml-1 font-medium text-amber-700">
                                                                            · 1º
                                                                            mês
                                                                            proporcional:{" "}
                                                                            {
                                                                                daysUsed
                                                                            }{" "}
                                                                            de{" "}
                                                                            {
                                                                                daysInMonth
                                                                            }{" "}
                                                                            dias
                                                                            (
                                                                            {formatBRL(
                                                                                Math.round(
                                                                                    (selectedProperty.iptu_monthly_cents *
                                                                                        daysUsed) /
                                                                                        daysInMonth,
                                                                                ),
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                "pago direto pelo inquilino"
                                                            )}
                                                        </p>
                                                    )}
                                                    {selectedProperty.condo_monthly_cents >
                                                        0 && (
                                                        <p className="text-emerald-600">
                                                            Condomínio{" "}
                                                            {formatBRL(
                                                                selectedProperty.condo_monthly_cents,
                                                            )}
                                                            /mês —{" "}
                                                            {form.condo_responsibility ===
                                                            "owner" ? (
                                                                <>
                                                                    incluído nas
                                                                    faturas
                                                                    {isProrated && (
                                                                        <span className="ml-1 font-medium text-amber-700">
                                                                            · 1º
                                                                            mês
                                                                            proporcional:{" "}
                                                                            {
                                                                                daysUsed
                                                                            }{" "}
                                                                            de{" "}
                                                                            {
                                                                                daysInMonth
                                                                            }{" "}
                                                                            dias
                                                                            (
                                                                            {formatBRL(
                                                                                Math.round(
                                                                                    (selectedProperty.condo_monthly_cents *
                                                                                        daysUsed) /
                                                                                        daysInMonth,
                                                                                ),
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                "pago direto pelo inquilino"
                                                            )}
                                                        </p>
                                                    )}
                                                    {isProrated &&
                                                        hasOwnerFee && (
                                                            <p className="mt-1 text-amber-700 font-medium">
                                                                Encargo
                                                                proporcional
                                                                calculado para{" "}
                                                                {daysUsed} de{" "}
                                                                {daysInMonth}{" "}
                                                                dias de{" "}
                                                                {entry.toLocaleDateString(
                                                                    "pt-BR",
                                                                    {
                                                                        month: "long",
                                                                    },
                                                                )}
                                                                .
                                                            </p>
                                                        )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                    </div>
                )}

                {/* Error */}
                {formError && (
                    <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {formError}
                    </p>
                )}
                {createMutation.isError && !formError && (
                    <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {(createMutation.error as Error)?.message ||
                            "Erro ao criar contrato"}
                    </p>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                    <Button
                        type="button"
                        variant="secondary"
                        icon={<ChevronLeft className="w-4 h-4" />}
                        onClick={
                            step === 1
                                ? closeModal
                                : () => {
                                      setFormError(null);
                                      setStep((s) => (s - 1) as Step);
                                  }
                        }
                    >
                        {step === 1 ? "Cancelar" : "Voltar"}
                    </Button>
                    {step < 3 ? (
                        <Button
                            type="button"
                            onClick={nextStep}
                            icon={<ChevronRight className="w-4 h-4" />}
                            className="flex-row-reverse"
                        >
                            Próximo
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            loading={createMutation.isPending}
                            onClick={() => {
                                setFormError(null);
                                if (
                                    !form.rent ||
                                    !form.due_day ||
                                    !form.start_date ||
                                    !form.end_date
                                ) {
                                    setFormError(
                                        "Preencha todos os campos obrigatórios.",
                                    );
                                    return;
                                }
                                if (
                                    new Date(form.end_date) <=
                                    new Date(form.start_date)
                                ) {
                                    setFormError(
                                        "A data de término deve ser posterior à data de início.",
                                    );
                                    return;
                                }
                                createMutation.mutate();
                            }}
                        >
                            Criar Contrato
                        </Button>
                    )}
                </div>
            </Modal>

            {/* ── Contract Detail Modal ── */}
            {viewingContract && (
                <Modal
                    open={!!viewingContract}
                    onClose={() => {
                        setViewingContract(null);
                        setEditingTenant(false);
                    }}
                    title="Detalhes do Contrato"
                    className="max-w-2xl mx-4"
                >
                    <div className="space-y-5">
                        {/* Header: tenant + status */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                                    {viewingContract.tenant_name
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">
                                        {viewingContract.tenant_name}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        CPF: {viewingContract.tenant_cpf} · RG:{" "}
                                        {viewingContract.tenant_rg || "—"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    title="Editar dados do inquilino"
                                    onClick={() => {
                                        setTenantForm({
                                            tenant_name:
                                                viewingContract.tenant_name ??
                                                "",
                                            tenant_cpf:
                                                viewingContract.tenant_cpf ??
                                                "",
                                            tenant_rg:
                                                viewingContract.tenant_rg ?? "",
                                            tenant_nationality:
                                                viewingContract.tenant_nationality ??
                                                "",
                                            tenant_marital_status:
                                                viewingContract.tenant_marital_status ??
                                                "",
                                            tenant_profession:
                                                viewingContract.tenant_profession ??
                                                "",
                                            tenant_email:
                                                viewingContract.tenant_email ??
                                                "",
                                            tenant_phone:
                                                viewingContract.tenant_phone ??
                                                "",
                                            tenant_address:
                                                viewingContract.tenant_address ??
                                                "",
                                        });
                                        setTenantSaveError(null);
                                        setEditingTenant((v) => !v);
                                    }}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${editingTenant ? "bg-primary-100 text-primary-700" : "hover:bg-gray-100 text-gray-400"}`}
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <Badge
                                    variant={
                                        statusVariant[
                                            viewingContract.status as ContractStatus
                                        ]
                                    }
                                >
                                    {
                                        CONTRACT_STATUS_LABEL[
                                            viewingContract.status as ContractStatus
                                        ]
                                    }
                                </Badge>
                            </div>
                        </div>

                        {/* Inline edit tenant form */}
                        {editingTenant && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                                    Editar dados do inquilino
                                </p>
                                <Input
                                    label="Nome completo *"
                                    id="et_name"
                                    value={tenantForm.tenant_name}
                                    onChange={(e) =>
                                        setTenantForm((f) => ({
                                            ...f,
                                            tenant_name: e.target.value,
                                        }))
                                    }
                                    required
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        label="CPF *"
                                        id="et_cpf"
                                        value={tenantForm.tenant_cpf}
                                        onChange={(e) =>
                                            setTenantForm((f) => ({
                                                ...f,
                                                tenant_cpf: e.target.value,
                                            }))
                                        }
                                    />
                                    <Input
                                        label="RG"
                                        id="et_rg"
                                        value={tenantForm.tenant_rg}
                                        onChange={(e) =>
                                            setTenantForm((f) => ({
                                                ...f,
                                                tenant_rg: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        label="Nacionalidade"
                                        id="et_nat"
                                        value={tenantForm.tenant_nationality}
                                        onChange={(e) =>
                                            setTenantForm((f) => ({
                                                ...f,
                                                tenant_nationality:
                                                    e.target.value,
                                            }))
                                        }
                                        placeholder="Brasileiro(a)"
                                    />
                                    <div className="flex flex-col gap-1.5">
                                        <label
                                            htmlFor="et_ms"
                                            className="text-sm font-medium text-gray-700"
                                        >
                                            Estado civil
                                        </label>
                                        <select
                                            id="et_ms"
                                            value={
                                                tenantForm.tenant_marital_status
                                            }
                                            onChange={(e) =>
                                                setTenantForm((f) => ({
                                                    ...f,
                                                    tenant_marital_status:
                                                        e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="">Selecionar</option>
                                            {[
                                                "Solteiro(a)",
                                                "Casado(a)",
                                                "Divorciado(a)",
                                                "Viúvo(a)",
                                                "União Estável",
                                            ].map((o) => (
                                                <option key={o}>{o}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <Input
                                    label="Profissão"
                                    id="et_prof"
                                    value={tenantForm.tenant_profession}
                                    onChange={(e) =>
                                        setTenantForm((f) => ({
                                            ...f,
                                            tenant_profession: e.target.value,
                                        }))
                                    }
                                    placeholder="Ex: Engenheiro"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        label="E-mail"
                                        id="et_email"
                                        type="email"
                                        value={tenantForm.tenant_email}
                                        onChange={(e) =>
                                            setTenantForm((f) => ({
                                                ...f,
                                                tenant_email: e.target.value,
                                            }))
                                        }
                                    />
                                    <Input
                                        label="Telefone"
                                        id="et_phone"
                                        value={tenantForm.tenant_phone}
                                        onChange={(e) =>
                                            setTenantForm((f) => ({
                                                ...f,
                                                tenant_phone: e.target.value,
                                            }))
                                        }
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                                <Input
                                    label="Endereço"
                                    id="et_addr"
                                    value={tenantForm.tenant_address}
                                    onChange={(e) =>
                                        setTenantForm((f) => ({
                                            ...f,
                                            tenant_address: e.target.value,
                                        }))
                                    }
                                    placeholder="Rua, Número, Bairro, Cidade – UF"
                                />
                                {tenantSaveError && (
                                    <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                                        {tenantSaveError}
                                    </p>
                                )}
                                <div className="flex justify-end gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setEditingTenant(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="button"
                                        loading={updateTenantMutation.isPending}
                                        icon={<Save className="w-4 h-4" />}
                                        onClick={() =>
                                            updateTenantMutation.mutate(
                                                viewingContract.id,
                                            )
                                        }
                                    >
                                        Salvar
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Property info */}
                        {viewingContract.property && (
                            <div className="bg-gray-50 rounded-xl px-4 py-3">
                                <p className="text-xs text-gray-400 mb-1">
                                    Imóvel
                                </p>
                                <p className="text-sm font-medium text-gray-900">
                                    {
                                        (viewingContract.property as any)
                                            .address_street
                                    }
                                    ,{" "}
                                    {
                                        (viewingContract.property as any)
                                            .address_number
                                    }{" "}
                                    –{" "}
                                    {
                                        (viewingContract.property as any)
                                            .address_city
                                    }
                                </p>
                            </div>
                        )}

                        {/* Financial details grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                {
                                    label: "Aluguel",
                                    value:
                                        formatBRL(
                                            viewingContract.rent_amount_cents,
                                        ) + "/mês",
                                },
                                {
                                    label: "Caução",
                                    value: formatBRL(
                                        viewingContract.deposit_amount_cents,
                                    ),
                                },
                                {
                                    label: "Vencimento",
                                    value: `Dia ${viewingContract.due_day}`,
                                },
                                {
                                    label: "Endereço inquilino",
                                    value:
                                        viewingContract.tenant_address || "—",
                                },
                            ].map(({ label, value }) => (
                                <div
                                    key={label}
                                    className="bg-gray-50 rounded-xl px-3 py-2.5"
                                >
                                    <p className="text-xs text-gray-400">
                                        {label}
                                    </p>
                                    <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Period */}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-primary-500" />
                            <span>
                                {new Date(
                                    viewingContract.start_date + "T12:00:00",
                                ).toLocaleDateString("pt-BR")}{" "}
                                &rarr;{" "}
                                {new Date(
                                    viewingContract.end_date + "T12:00:00",
                                ).toLocaleDateString("pt-BR")}
                            </span>
                        </div>

                        {/* Invoice list */}
                        {/* Invoice list */}
                        {(() => {
                            const INVOICE_TYPE_LABEL: Record<string, string> = {
                                all: "Todos",
                                rent: "Aluguel",
                                deposit: "Caução",
                                iptu: "IPTU",
                                condo: "Condomínio",
                            };
                            const invoiceStatusVariant: Record<
                                InvoiceStatus,
                                string
                            > = {
                                [InvoiceStatus.Paid]:
                                    "bg-green-100 text-green-700",
                                [InvoiceStatus.Pending]:
                                    "bg-yellow-100 text-yellow-700",
                                [InvoiceStatus.Overdue]:
                                    "bg-red-100 text-red-700",
                                [InvoiceStatus.Cancelled]:
                                    "bg-gray-100 text-gray-500",
                            };
                            const presentTypes = Array.from(
                                new Set(
                                    contractInvoices.map((i) => i.invoice_type),
                                ),
                            );
                            const filtered = [...contractInvoices]
                                .filter(
                                    (i) =>
                                        invoiceTypeFilter === "all" ||
                                        i.invoice_type === invoiceTypeFilter,
                                )
                                .sort((a, b) =>
                                    a.due_date.localeCompare(b.due_date),
                                );

                            // Compute proration labels using property full monthly amounts
                            const prop = viewingContract.property as any;
                            const proratedLabel = new Map<string, string>();
                            for (const feeType of ["iptu", "condo"] as const) {
                                const fullCents: number =
                                    feeType === "iptu"
                                        ? (prop?.iptu_monthly_cents ?? 0)
                                        : (prop?.condo_monthly_cents ?? 0);
                                if (fullCents <= 0) continue;
                                const feeInvoices = [...contractInvoices]
                                    .filter((i) => i.invoice_type === feeType)
                                    .sort((a, b) =>
                                        a.competencia_month.localeCompare(
                                            b.competencia_month,
                                        ),
                                    );
                                if (feeInvoices.length === 0) continue;
                                const first = feeInvoices[0];
                                if (first.amount_cents !== fullCents) {
                                    const d = new Date(
                                        first.competencia_month + "T12:00:00",
                                    );
                                    const daysInMonth = new Date(
                                        d.getFullYear(),
                                        d.getMonth() + 1,
                                        0,
                                    ).getDate();
                                    const daysUsed = Math.round(
                                        (first.amount_cents * daysInMonth) /
                                            fullCents,
                                    );
                                    proratedLabel.set(
                                        first.id,
                                        `proporcional: ${daysUsed} de ${daysInMonth} dias`,
                                    );
                                }
                            }
                            return (
                                <div>
                                    {/* Header + filters */}
                                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            Faturas ({contractInvoices.length})
                                        </p>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {["all", ...presentTypes].map(
                                                (t) => (
                                                    <button
                                                        key={t}
                                                        onClick={() =>
                                                            setInvoiceTypeFilter(
                                                                t,
                                                            )
                                                        }
                                                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
                                                            invoiceTypeFilter ===
                                                            t
                                                                ? "bg-primary-600 text-white border-primary-600"
                                                                : "bg-white text-gray-500 border-gray-200 hover:border-primary-400 hover:text-primary-600"
                                                        }`}
                                                    >
                                                        {INVOICE_TYPE_LABEL[
                                                            t
                                                        ] ?? t}
                                                    </button>
                                                ),
                                            )}
                                        </div>
                                    </div>

                                    {filtered.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">
                                            Nenhuma fatura encontrada.
                                        </p>
                                    ) : (
                                        <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                                            {filtered.map((inv) => {
                                                const isEditing =
                                                    editingInvoiceId === inv.id;
                                                const isDeleting =
                                                    deletingInvoiceId ===
                                                    inv.id;
                                                if (isEditing) {
                                                    return (
                                                        <div
                                                            key={inv.id}
                                                            className="px-3 py-3 bg-blue-50 space-y-2"
                                                        >
                                                            <p className="text-xs font-semibold text-blue-700">
                                                                Editar fatura —{" "}
                                                                {INVOICE_TYPE_LABEL[
                                                                    inv
                                                                        .invoice_type
                                                                ] ??
                                                                    inv.invoice_type}
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <label className="text-xs text-gray-500">
                                                                        Valor
                                                                        (R$)
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={
                                                                            editInvoiceForm.amount
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            setEditInvoiceForm(
                                                                                (
                                                                                    f,
                                                                                ) => ({
                                                                                    ...f,
                                                                                    amount: e
                                                                                        .target
                                                                                        .value,
                                                                                }),
                                                                            )
                                                                        }
                                                                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <label className="text-xs text-gray-500">
                                                                        Vencimento
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        value={
                                                                            editInvoiceForm.due_date
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            setEditInvoiceForm(
                                                                                (
                                                                                    f,
                                                                                ) => ({
                                                                                    ...f,
                                                                                    due_date:
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                }),
                                                                            )
                                                                        }
                                                                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <label className="text-xs text-gray-500">
                                                                        Status
                                                                    </label>
                                                                    <select
                                                                        value={
                                                                            editInvoiceForm.status
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            setEditInvoiceForm(
                                                                                (
                                                                                    f,
                                                                                ) => ({
                                                                                    ...f,
                                                                                    status: e
                                                                                        .target
                                                                                        .value,
                                                                                }),
                                                                            )
                                                                        }
                                                                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                                    >
                                                                        <option value="pending">
                                                                            Pendente
                                                                        </option>
                                                                        <option value="paid">
                                                                            Pago
                                                                        </option>
                                                                        <option value="overdue">
                                                                            Atrasado
                                                                        </option>
                                                                        <option value="cancelled">
                                                                            Cancelado
                                                                        </option>
                                                                    </select>
                                                                </div>
                                                                {editInvoiceForm.status ===
                                                                    "paid" && (
                                                                    <div className="flex flex-col gap-1">
                                                                        <label className="text-xs text-gray-500">
                                                                            Data
                                                                            pag.
                                                                        </label>
                                                                        <input
                                                                            type="date"
                                                                            value={
                                                                                editInvoiceForm.paid_at
                                                                            }
                                                                            max={
                                                                                new Date()
                                                                                    .toISOString()
                                                                                    .split(
                                                                                        "T",
                                                                                    )[0]
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                setEditInvoiceForm(
                                                                                    (
                                                                                        f,
                                                                                    ) => ({
                                                                                        ...f,
                                                                                        paid_at:
                                                                                            e
                                                                                                .target
                                                                                                .value,
                                                                                    }),
                                                                                )
                                                                            }
                                                                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-end gap-1.5 pt-1">
                                                                <button
                                                                    onClick={() =>
                                                                        setEditingInvoiceId(
                                                                            null,
                                                                        )
                                                                    }
                                                                    className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:bg-gray-50"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        updateInvoiceMutation.mutate(
                                                                            inv.id,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        updateInvoiceMutation.isPending
                                                                    }
                                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                    Salvar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                if (isDeleting) {
                                                    return (
                                                        <div
                                                            key={inv.id}
                                                            className="px-3 py-3 bg-red-50 flex items-center justify-between gap-2"
                                                        >
                                                            <p className="text-sm text-red-700">
                                                                Excluir fatura
                                                                de{" "}
                                                                <strong>
                                                                    {formatBRL(
                                                                        inv.amount_cents,
                                                                    )}
                                                                </strong>
                                                                ?
                                                            </p>
                                                            <div className="flex gap-1.5 shrink-0">
                                                                <button
                                                                    onClick={() =>
                                                                        setDeletingInvoiceId(
                                                                            null,
                                                                        )
                                                                    }
                                                                    className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:bg-white"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        deleteInvoiceMutation.mutate(
                                                                            inv.id,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        deleteInvoiceMutation.isPending
                                                                    }
                                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                    Confirmar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div
                                                        key={inv.id}
                                                        className={`flex items-center justify-between px-3 py-2.5 text-sm group transition-colors ${
                                                            inv.status ===
                                                            InvoiceStatus.Cancelled
                                                                ? "bg-gray-50 opacity-60 hover:opacity-75"
                                                                : "hover:bg-gray-50"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-gray-400 text-xs w-20 shrink-0">
                                                                {new Date(
                                                                    inv.due_date +
                                                                        "T12:00:00",
                                                                ).toLocaleDateString(
                                                                    "pt-BR",
                                                                )}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <span className="text-gray-600 truncate block">
                                                                    {INVOICE_TYPE_LABEL[
                                                                        inv
                                                                            .invoice_type
                                                                    ] ??
                                                                        inv.invoice_type}
                                                                </span>
                                                                {proratedLabel.has(
                                                                    inv.id,
                                                                ) && (
                                                                    <span className="text-amber-600 text-xs block">
                                                                        {proratedLabel.get(
                                                                            inv.id,
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                                            <span className="text-gray-900 font-medium">
                                                                {formatBRL(
                                                                    inv.amount_cents,
                                                                )}
                                                            </span>
                                                            <span
                                                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${invoiceStatusVariant[inv.status as InvoiceStatus] ?? "bg-gray-100 text-gray-500"}`}
                                                            >
                                                                {INVOICE_STATUS_LABEL[
                                                                    inv.status as InvoiceStatus
                                                                ] ?? inv.status}
                                                            </span>
                                                            <button
                                                                title="Editar"
                                                                onClick={() => {
                                                                    setEditingInvoiceId(
                                                                        inv.id,
                                                                    );
                                                                    setEditInvoiceForm(
                                                                        {
                                                                            amount: (
                                                                                inv.amount_cents /
                                                                                100
                                                                            ).toFixed(
                                                                                2,
                                                                            ),
                                                                            due_date:
                                                                                inv.due_date,
                                                                            status: inv.status,
                                                                            paid_at:
                                                                                inv.paid_at?.split(
                                                                                    "T",
                                                                                )[0] ??
                                                                                "",
                                                                        },
                                                                    );
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-primary-600 transition-opacity"
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                title="Excluir"
                                                                onClick={() =>
                                                                    setDeletingInvoiceId(
                                                                        inv.id,
                                                                    )
                                                                }
                                                                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 transition-opacity"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Template body preview */}
                        {(() => {
                            const tmpl = templates.find(
                                (t) => t.id === viewingContract.template_id,
                            );
                            if (!tmpl) return null;
                            const rendered = renderTemplate(
                                tmpl.body,
                                viewingContract,
                            );
                            return (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                        Modelo: {tmpl.name}
                                    </p>
                                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 max-h-52 overflow-y-auto">
                                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                                            {rendered}
                                        </pre>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            {/* Termination button — only for active contracts */}
                            {viewingContract.status ===
                            ContractStatus.Active ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setTerminatingContract(viewingContract)
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Rescindir
                                </button>
                            ) : (
                                <span />
                            )}
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    icon={<X className="w-4 h-4" />}
                                    onClick={() => setViewingContract(null)}
                                >
                                    Fechar
                                </Button>
                                <Button
                                    type="button"
                                    icon={<Printer className="w-4 h-4" />}
                                    onClick={() =>
                                        handlePrintContract(viewingContract)
                                    }
                                >
                                    Imprimir / PDF
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Termination confirmation modal ── */}
            {terminatingContract && (
                <Modal
                    open={!!terminatingContract}
                    onClose={() => {
                        setTerminatingContract(null);
                        setTerminationConfirmed(false);
                    }}
                    title="Rescindir Contrato"
                    className="max-w-md mx-4"
                >
                    {(() => {
                        const preview = contractService.calcTerminationFine(
                            terminatingContract.rent_amount_cents,
                            terminatingContract.start_date,
                            terminatingContract.end_date,
                        );
                        return (
                            <div className="space-y-4">
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1.5">
                                    <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4" />
                                        Esta ação não pode ser desfeita
                                    </p>
                                    <p className="text-sm text-red-600">
                                        O contrato de{" "}
                                        <strong>
                                            {terminatingContract.tenant_name}
                                        </strong>{" "}
                                        será rescindido e o imóvel voltará a
                                        ficar vago.
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2 text-sm">
                                    <p className="font-semibold text-gray-700">
                                        Cálculo da multa rescisória
                                    </p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                                        <span>Aluguel mensal</span>
                                        <span className="font-medium text-right">
                                            {formatBRL(
                                                terminatingContract.rent_amount_cents,
                                            )}
                                        </span>
                                        <span>Meses restantes</span>
                                        <span className="font-medium text-right">
                                            {preview.remaining_months} de{" "}
                                            {preview.total_months} meses
                                        </span>
                                        <span className="text-gray-400 text-xs col-span-2">
                                            3 × aluguel × (meses restantes /
                                            total de meses)
                                        </span>
                                    </div>
                                    <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                        <span className="font-semibold text-gray-700">
                                            Multa a cobrar
                                        </span>
                                        <span className="font-bold text-lg text-red-600">
                                            {formatBRL(preview.fine_cents)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3 text-sm text-gray-600">
                                    <p className="font-medium">
                                        O que acontece ao rescindir:
                                    </p>
                                    <ul className="space-y-1.5 text-xs">
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-400 mt-0.5">
                                                ✕
                                            </span>{" "}
                                            Faturas futuras pendentes serão
                                            marcadas como canceladas
                                            (continuarão visíveis no contrato)
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-green-500 mt-0.5">
                                                ✓
                                            </span>{" "}
                                            Fatura de multa (
                                            {formatBRL(preview.fine_cents)})
                                            será gerada e adicionada às
                                            cobranças
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-green-500 mt-0.5">
                                                ✓
                                            </span>{" "}
                                            Imóvel voltará ao status "Vago"
                                        </li>
                                    </ul>
                                </div>

                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={terminationConfirmed}
                                        onChange={(e) =>
                                            setTerminationConfirmed(
                                                e.target.checked,
                                            )
                                        }
                                        className="mt-0.5 accent-red-600"
                                    />
                                    <span className="text-sm text-gray-700">
                                        Confirmo que desejo rescindir este
                                        contrato
                                    </span>
                                </label>

                                {terminateMutation.isError && (
                                    <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                                        {(terminateMutation.error as Error)
                                            ?.message ??
                                            "Erro ao rescindir contrato"}
                                    </p>
                                )}

                                <div className="flex justify-end gap-3 pt-1">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            setTerminatingContract(null);
                                            setTerminationConfirmed(false);
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                    <button
                                        disabled={
                                            !terminationConfirmed ||
                                            terminateMutation.isPending
                                        }
                                        onClick={() =>
                                            terminateMutation.mutate(
                                                terminatingContract.id,
                                            )
                                        }
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {terminateMutation.isPending ? (
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4" />
                                        )}
                                        Confirmar Rescisão
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </Modal>
            )}
        </div>
    );
}
