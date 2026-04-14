import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    BookTemplate,
    Trash2,
    Star,
    ChevronDown,
    ChevronUp,
    Pencil,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";
import { contractService } from "../../services/contract.service";

const TEMPLATE_VARIABLES = [
    // Locatário (Inquilino)
    { variable: "{{tenant_name}}", label: "Nome inquilino" },
    { variable: "{{tenant_cpf}}", label: "CPF inquilino" },
    { variable: "{{tenant_rg}}", label: "RG inquilino" },
    { variable: "{{tenant_nationality}}", label: "Nacionalidade inquilino" },
    { variable: "{{tenant_marital_status}}", label: "Estado civil inquilino" },
    { variable: "{{tenant_profession}}", label: "Profissão inquilino" },
    { variable: "{{tenant_email}}", label: "E-mail inquilino" },
    { variable: "{{tenant_phone}}", label: "Telefone inquilino" },
    { variable: "{{tenant_address}}", label: "Endereço inquilino" },
    // Locador (Proprietário)
    { variable: "{{owner_name}}", label: "Nome proprietário" },
    { variable: "{{owner_cpf}}", label: "CPF proprietário" },
    { variable: "{{owner_rg}}", label: "RG proprietário" },
    { variable: "{{owner_nationality}}", label: "Nacionalidade proprietário" },
    {
        variable: "{{owner_marital_status}}",
        label: "Estado civil proprietário",
    },
    { variable: "{{owner_profession}}", label: "Profissão proprietário" },
    { variable: "{{owner_email}}", label: "E-mail proprietário" },
    { variable: "{{owner_phone}}", label: "Telefone proprietário" },
    { variable: "{{owner_address}}", label: "Endereço proprietário" },
    // Imóvel
    { variable: "{{property_address}}", label: "Endereço imóvel" },
    { variable: "{{property_type}}", label: "Tipo imóvel" },
    { variable: "{{property_area}}", label: "Área m²" },
    { variable: "{{property_bedrooms}}", label: "Nº quartos" },
    { variable: "{{property_bathrooms}}", label: "Nº banheiros" },
    { variable: "{{property_parking}}", label: "Vagas garagem" },
    { variable: "{{property_neighborhood}}", label: "Bairro imóvel" },
    { variable: "{{property_city}}", label: "Cidade imóvel" },
    { variable: "{{property_state}}", label: "UF imóvel" },
    { variable: "{{property_zip}}", label: "CEP imóvel" },
    { variable: "{{property_registration}}", label: "Matrícula imóvel" },
    { variable: "{{property_description}}", label: "Descrição imóvel" },
    // Valores
    { variable: "{{rent_amount}}", label: "Valor aluguel" },
    { variable: "{{deposit_amount}}", label: "Valor caução" },
    { variable: "{{iptu_amount}}", label: "IPTU mensal" },
    { variable: "{{condo_amount}}", label: "Condomínio mensal" },
    { variable: "{{due_day}}", label: "Dia vencimento" },
    // Datas e vigência
    { variable: "{{start_date}}", label: "Data início" },
    { variable: "{{end_date}}", label: "Data término" },
    { variable: "{{contract_duration_months}}", label: "Duração (meses)" },
    { variable: "{{contract_date}}", label: "Data assinatura" },
    { variable: "{{contract_city}}", label: "Cidade celebração" },
] as const;

const VARIABLE_GROUPS: Array<{ title: string; slice: [number, number] }> = [
    { title: "Inquilino", slice: [0, 9] },
    { title: "Proprietário", slice: [9, 18] },
    { title: "Imóvel", slice: [18, 30] },
    { title: "Valores", slice: [30, 35] },
    { title: "Datas", slice: [35, 40] },
];

/** Converte `{{owner_name}}` → `[Nome proprietário]` para exibir no editor */
function variableToDisplay(text: string): string {
    let result = text;
    for (const { variable, label } of TEMPLATE_VARIABLES) {
        result = result.split(variable).join(`[${label}]`);
    }
    return result;
}

/** Converte `[Nome proprietário]` → `{{owner_name}}` para salvar no banco */
function displayToVariable(text: string): string {
    let result = text;
    for (const { variable, label } of TEMPLATE_VARIABLES) {
        result = result.split(`[${label}]`).join(variable);
    }
    return result;
}

/** Converte texto com tokens [Label] em HTML com chips estilizados */
function bodyToHtml(text: string): string {
    if (!text) return "";
    let result = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    for (const { label } of TEMPLATE_VARIABLES) {
        const chip = `<span class="var-chip" contenteditable="false" data-label="${label}">${label}</span>`;
        result = result.split(`[${label}]`).join(chip);
    }
    return result.replace(/\n/g, "<br>");
}

/** Extrai texto da div contenteditable, convertendo chips de volta para [Label] */
function getBodyFromEditor(el: HTMLDivElement | null): string {
    if (!el) return "";
    function walk(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const e = node as Element;
        if (e.tagName === "BR") return "\n";
        const lbl = e.getAttribute("data-label");
        if (lbl) return `[${lbl}]`;
        const inner = Array.from(node.childNodes).map(walk).join("");
        if (e.tagName === "DIV" || e.tagName === "P") return "\n" + inner;
        return inner;
    }
    return Array.from(el.childNodes).map(walk).join("").replace(/^\n+/, "");
}

export function TemplatesPage() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [modal, setModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [body, setBody] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    const [copiedVar, setCopiedVar] = useState<string | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInitHtmlRef = useRef<string>("");

    const usedLabels = useMemo(() => {
        const s = new Set<string>();
        for (const { label } of TEMPLATE_VARIABLES) {
            if (body.includes(`[${label}]`)) s.add(label);
        }
        return s;
    }, [body]);

    useEffect(() => {
        if (modal && editorRef.current) {
            editorRef.current.innerHTML = editorInitHtmlRef.current;
        }
    }, [modal]);

    function insertVar(variable: string, label: string) {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        const chip = document.createElement("span");
        chip.className = "var-chip";
        chip.setAttribute("contenteditable", "false");
        chip.setAttribute("data-label", label);
        chip.textContent = label;
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(chip);
            const after = document.createRange();
            after.setStartAfter(chip);
            after.collapse(true);
            sel.removeAllRanges();
            sel.addRange(after);
        } else {
            el.appendChild(chip);
        }
        setBody(getBodyFromEditor(el));
        setCopiedVar(variable);
        setTimeout(() => setCopiedVar(null), 1200);
    }

    function openCreate() {
        setEditingId(null);
        setName("");
        setBody("");
        editorInitHtmlRef.current = "";
        setFormError(null);
        setModal(true);
    }

    function openEdit(id: string, tplName: string, tplBody: string) {
        setEditingId(id);
        setName(tplName);
        const display = variableToDisplay(tplBody);
        setBody(display);
        editorInitHtmlRef.current = bodyToHtml(display);
        setFormError(null);
        setModal(true);
    }

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ["templates", user?.id],
        queryFn: () => contractService.listTemplates(user!.id),
        enabled: !!user,
    });

    const createMutation = useMutation({
        mutationFn: () => {
            const raw = displayToVariable(
                getBodyFromEditor(editorRef.current).trim(),
            );
            return contractService.createTemplate(user!.id, name.trim(), raw);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["templates"] });
            setModal(false);
            setName("");
            setBody("");
        },
        onError: (err: any) =>
            setFormError(err.message ?? "Erro ao criar modelo"),
    });

    const editMutation = useMutation({
        mutationFn: () => {
            const raw = displayToVariable(
                getBodyFromEditor(editorRef.current).trim(),
            );
            return contractService.updateTemplate(editingId!, name.trim(), raw);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["templates"] });
            setModal(false);
        },
        onError: (err: any) =>
            setFormError(err.message ?? "Erro ao salvar modelo"),
    });

    const isPending = createMutation.isPending || editMutation.isPending;

    const deleteMutation = useMutation({
        mutationFn: (id: string) => contractService.deleteTemplate(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Modelos de Contrato
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Gerencie os templates para geração de contratos
                    </p>
                </div>
                <Button
                    icon={<Plus className="w-4 h-4" />}
                    onClick={openCreate}
                >
                    Novo Modelo
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <span className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-3">
                    {templates.map((t) => (
                        <Card key={t.id}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                            t.is_system
                                                ? "bg-purple-100 text-purple-600"
                                                : "bg-primary-100 text-primary-600"
                                        }`}
                                    >
                                        {t.is_system ? (
                                            <Star className="w-4 h-4" />
                                        ) : (
                                            <BookTemplate className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-900 text-sm">
                                                {t.name}
                                            </p>
                                            {t.is_system && (
                                                <Badge variant="system">
                                                    Sistema
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Criado em{" "}
                                            {new Date(
                                                t.created_at,
                                            ).toLocaleDateString("pt-BR")}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() =>
                                            setExpanded(
                                                expanded === t.id ? null : t.id,
                                            )
                                        }
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                    >
                                        {expanded === t.id ? (
                                            <ChevronUp className="w-4 h-4" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4" />
                                        )}
                                    </button>
                                    {!t.is_system && (
                                        <>
                                            <button
                                                onClick={() =>
                                                    openEdit(
                                                        t.id,
                                                        t.name,
                                                        t.body,
                                                    )
                                                }
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
                                                title="Editar template"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            `Excluir "${t.name}"?`,
                                                        )
                                                    )
                                                        deleteMutation.mutate(
                                                            t.id,
                                                        );
                                                }}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                title="Excluir template"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {expanded === t.id && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans bg-gray-50 rounded-xl p-4 max-h-60 overflow-y-auto">
                                        {t.body}
                                    </pre>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={modal}
                onClose={() => {
                    setModal(false);
                    setFormError(null);
                }}
                title={editingId ? "Editar Modelo" : "Novo Modelo"}
                className="max-w-4xl mx-4 w-full"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        setFormError(null);
                        const currentBody = getBodyFromEditor(
                            editorRef.current,
                        );
                        if (!currentBody.trim()) {
                            setFormError(
                                "O corpo do contrato não pode estar vazio",
                            );
                            return;
                        }
                        if (editingId) editMutation.mutate();
                        else createMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <Input
                        label="Nome do modelo"
                        id="tpl-name"
                        placeholder="ex: Contrato Residencial Padrão"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Corpo do contrato
                        </label>
                        <div
                            ref={editorRef}
                            id="tpl-body"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={() =>
                                setBody(getBodyFromEditor(editorRef.current))
                            }
                            onPaste={(e) => {
                                e.preventDefault();
                                const text =
                                    e.clipboardData.getData("text/plain");
                                const sel = window.getSelection();
                                if (!sel?.rangeCount) return;
                                sel.deleteFromDocument();
                                sel.getRangeAt(0).insertNode(
                                    document.createTextNode(text),
                                );
                                sel.collapseToEnd();
                                setBody(getBodyFromEditor(editorRef.current));
                            }}
                            className="w-full min-h-[220px] max-h-[400px] overflow-y-auto px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 leading-relaxed"
                            style={{
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                fontFamily: "inherit",
                            }}
                        />
                    </div>

                    {/* Variable inserter */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            Clique no local do texto e depois em uma variável
                            para inseri-la
                        </p>
                        <div className="space-y-3">
                            {VARIABLE_GROUPS.map((group) => (
                                <div key={group.title}>
                                    <p className="text-xs font-semibold text-gray-400 mb-1.5">
                                        {group.title}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TEMPLATE_VARIABLES.slice(
                                            group.slice[0],
                                            group.slice[1],
                                        ).map(({ variable, label }) => (
                                            <button
                                                key={variable}
                                                type="button"
                                                title={variable}
                                                onClick={() =>
                                                    insertVar(variable, label)
                                                }
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                                                    copiedVar === variable
                                                        ? "bg-primary-600 border-primary-600 text-white"
                                                        : usedLabels.has(label)
                                                          ? "bg-green-100 border-green-400 text-green-700 hover:bg-green-200 hover:border-green-500"
                                                          : "bg-white border-gray-300 text-gray-700 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50"
                                                }`}
                                            >
                                                {usedLabels.has(label)
                                                    ? "✓"
                                                    : "+"}{" "}
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2.5 italic">
                            Passe o mouse sobre o botão para ver o código da
                            variável.
                        </p>
                    </div>
                    {formError && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                            {formError}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setModal(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" loading={isPending}>
                            {editingId ? "Salvar alterações" : "Salvar Modelo"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
