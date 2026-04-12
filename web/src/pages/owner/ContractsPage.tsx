import { useState } from "react";
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
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../hooks/useAuth";
import { contractService } from "../../services/contract.service";
import { propertyService } from "../../services/property.service";
import { formatBRL } from "../../lib/currency";
import {
    ContractStatus,
    CONTRACT_STATUS_LABEL,
    PropertyStatus,
    PROPERTY_STATUS_LABEL,
    PROPERTY_TYPE_LABEL,
    InvoiceType,
} from "../../lib/constants";
import { useNavigate } from "react-router-dom";
import type { Contract, Property } from "../../types/domain.types";

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
    deposit: "",
    due_day: "5",
    start_date: "",
    end_date: "",
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
    const deposit = Number(form.deposit) > 0 ? 1 : 0;
    const perMonth =
        1 +
        (prop.iptu_monthly_cents > 0 ? 1 : 0) +
        (prop.condo_monthly_cents > 0 ? 1 : 0);
    return `${deposit + months * perMonth} faturas (${deposit > 0 ? "1 caução + " : ""}${months} meses × ${perMonth} tipo${perMonth > 1 ? "s" : ""})`;
}

export function ContractsPage() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const qc = useQueryClient();

    const [modal, setModal] = useState(false);
    const [step, setStep] = useState<Step>(1);
    const [form, setForm] = useState(blankForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [viewingContract, setViewingContract] = useState<Contract | null>(
        null,
    );

    const { data: contracts = [], isLoading } = useQuery({
        queryKey: ["owner-contracts", user?.id],
        queryFn: () => contractService.listByOwner(user!.id),
        enabled: !!user,
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
            const depositCents = Math.round(Number(form.deposit) * 100);
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
                iptu_monthly_cents: prop.iptu_monthly_cents,
                condo_monthly_cents: prop.condo_monthly_cents,
                due_day: dueDay,
                start_date: form.start_date,
                end_date: form.end_date,
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
                                {contracts.map((c) => (
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
                                                        {c.tenant_name}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {c.tenant_cpf}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-gray-600 max-w-[160px]">
                                            <p className="truncate">
                                                {
                                                    (c.property as any)
                                                        ?.address_street
                                                }
                                                ,{" "}
                                                {
                                                    (c.property as any)
                                                        ?.address_number
                                                }
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {
                                                    (c.property as any)
                                                        ?.address_city
                                                }
                                            </p>
                                        </td>
                                        <td className="px-5 py-4 font-semibold text-gray-900">
                                            {formatBRL(c.rent_amount_cents)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(
                                                    c.start_date,
                                                ).toLocaleDateString("pt-BR")}
                                                {" – "}
                                                {new Date(
                                                    c.end_date,
                                                ).toLocaleDateString("pt-BR")}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <Badge
                                                variant={
                                                    statusVariant[c.status]
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
                                                        setViewingContract(c)
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
                            <Input
                                label="Valor da caução (R$)"
                                id="deposit"
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.deposit}
                                onChange={set("deposit")}
                                placeholder="0,00"
                            />
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
                            <Input
                                label="Início do contrato *"
                                id="start_date"
                                type="date"
                                value={form.start_date}
                                onChange={set("start_date")}
                                required
                            />
                            <Input
                                label="Término do contrato *"
                                id="end_date"
                                type="date"
                                value={form.end_date}
                                onChange={set("end_date")}
                                required
                            />
                        </div>

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
                                        {selectedProperty.iptu_monthly_cents >
                                            0 && (
                                            <p className="text-emerald-600 mt-0.5">
                                                Inclui IPTU{" "}
                                                {formatBRL(
                                                    selectedProperty.iptu_monthly_cents,
                                                )}
                                                /mês
                                            </p>
                                        )}
                                        {selectedProperty.condo_monthly_cents >
                                            0 && (
                                            <p className="text-emerald-600">
                                                Inclui condomínio{" "}
                                                {formatBRL(
                                                    selectedProperty.condo_monthly_cents,
                                                )}
                                                /mês
                                            </p>
                                        )}
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
                    onClose={() => setViewingContract(null)}
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
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
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
                </Modal>
            )}
        </div>
    );
}
