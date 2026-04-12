import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Building2,
    MapPin,
    Edit2,
    Trash2,
    Camera,
    X as XIcon,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";
import { propertyService } from "../../services/property.service";
import { formatBRL } from "../../lib/currency";
import {
    PropertyType,
    PropertyStatus,
    PROPERTY_TYPE_LABEL,
    PROPERTY_STATUS_LABEL,
} from "../../lib/constants";
import type { Property } from "../../types/domain.types";

const blankForm = {
    address_street: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    property_type: PropertyType.Apartment,
    area_sqm: "",
    bedrooms: "",
    bathrooms: "",
    iptu_monthly_cents: "",
    condo_monthly_cents: "",
    photo_urls: [] as string[],
};

export function PropertiesPage() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<Property | null>(null);
    const [form, setForm] = useState(blankForm);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: properties = [], isLoading } = useQuery({
        queryKey: ["owner-properties", user?.id],
        queryFn: () => propertyService.list(user!.id),
        enabled: !!user,
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                owner_id: user!.id,
                ...form,
                area_sqm: Number(form.area_sqm),
                bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
                bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
                iptu_monthly_cents: Math.round(
                    Number(form.iptu_monthly_cents) * 100,
                ),
                condo_monthly_cents: Math.round(
                    Number(form.condo_monthly_cents) * 100,
                ),
                status: editing?.status ?? PropertyStatus.Vacant,
                photo_urls: form.photo_urls,
            };
            if (editing) return propertyService.update(editing.id, payload);
            return propertyService.create(payload as any);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["owner-properties"] });
            closeModal();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => propertyService.delete(id),
        onSuccess: () =>
            qc.invalidateQueries({ queryKey: ["owner-properties"] }),
    });

    function openCreate() {
        setEditing(null);
        setForm(blankForm);
        setModal(true);
    }
    function openEdit(p: Property) {
        setEditing(p);
        setForm({
            address_street: p.address_street,
            address_number: p.address_number,
            address_complement: p.address_complement ?? "",
            address_neighborhood: p.address_neighborhood,
            address_city: p.address_city,
            address_state: p.address_state,
            address_zip: p.address_zip,
            property_type: p.property_type,
            area_sqm: String(p.area_sqm),
            bedrooms: String(p.bedrooms ?? ""),
            bathrooms: String(p.bathrooms ?? ""),
            iptu_monthly_cents: String(p.iptu_monthly_cents / 100),
            condo_monthly_cents: String(p.condo_monthly_cents / 100),
            photo_urls: p.photo_urls ?? [],
        });
        setModal(true);
    }

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        setUploading(true);
        try {
            const urls = await Promise.all(
                files.map((f) => propertyService.uploadPhoto(user!.id, f)),
            );
            setForm((prev) => ({
                ...prev,
                photo_urls: [...prev.photo_urls, ...urls],
            }));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    function removePhoto(url: string) {
        setForm((prev) => ({
            ...prev,
            photo_urls: prev.photo_urls.filter((u) => u !== url),
        }));
    }
    function closeModal() {
        setModal(false);
        setEditing(null);
    }
    const set =
        (k: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm((f) => ({ ...f, [k]: e.target.value }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Imóveis
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Gerencie o seu portfólio
                    </p>
                </div>
                <Button
                    icon={<Plus className="w-4 h-4" />}
                    onClick={openCreate}
                >
                    Novo Imóvel
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <span className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : properties.length === 0 ? (
                <Card className="text-center py-16">
                    <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Nenhum imóvel cadastrado
                    </p>
                    <p className="text-sm text-gray-400 mb-4">
                        Cadastre seu primeiro imóvel para começar
                    </p>
                    <Button
                        icon={<Plus className="w-4 h-4" />}
                        onClick={openCreate}
                    >
                        Cadastrar Imóvel
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {properties.map((p) => (
                        <Card
                            key={p.id}
                            padding={false}
                            className="overflow-hidden"
                        >
                            <div className="h-36 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                                {p.photo_urls?.[0] ? (
                                    <img
                                        src={p.photo_urls[0]}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Building2 className="w-10 h-10 text-primary-400" />
                                )}
                            </div>
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div>
                                        <p className="font-semibold text-gray-900 text-sm">
                                            {p.address_street},{" "}
                                            {p.address_number}
                                        </p>
                                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                            <MapPin className="w-3 h-3" />
                                            {p.address_city} — {p.address_state}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            p.status === PropertyStatus.Vacant
                                                ? "vacant"
                                                : "rented"
                                        }
                                    >
                                        {PROPERTY_STATUS_LABEL[p.status]}
                                    </Badge>
                                </div>
                                <div className="flex gap-3 text-xs text-gray-500 mb-3">
                                    <span>
                                        {PROPERTY_TYPE_LABEL[p.property_type]}
                                    </span>
                                    <span>·</span>
                                    <span>{p.area_sqm} m²</span>
                                    {p.bedrooms != null && (
                                        <>
                                            <span>·</span>
                                            <span>{p.bedrooms} qts</span>
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-2 text-xs text-gray-600 border-t border-gray-100 pt-3 mb-3">
                                    <span>
                                        IPTU: {formatBRL(p.iptu_monthly_cents)}
                                        /mês
                                    </span>
                                    {p.condo_monthly_cents > 0 && (
                                        <span>
                                            · Cond:{" "}
                                            {formatBRL(p.condo_monthly_cents)}
                                            /mês
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={<Edit2 className="w-3 h-3" />}
                                        onClick={() => openEdit(p)}
                                        className="flex-1"
                                    >
                                        Editar
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        icon={<Trash2 className="w-3 h-3" />}
                                        loading={deleteMutation.isPending}
                                        onClick={() => {
                                            if (confirm("Excluir este imóvel?"))
                                                deleteMutation.mutate(p.id);
                                        }}
                                    ></Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={modal}
                onClose={closeModal}
                title={editing ? "Editar Imóvel" : "Novo Imóvel"}
                className="max-w-xl mx-4"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        saveMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <Input
                                label="Rua/Av."
                                id="street"
                                value={form.address_street}
                                onChange={set("address_street")}
                                required
                            />
                        </div>
                        <Input
                            label="Número"
                            id="number"
                            value={form.address_number}
                            onChange={set("address_number")}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Bairro"
                            id="district"
                            value={form.address_neighborhood}
                            onChange={set("address_neighborhood")}
                            required
                        />
                        <Input
                            label="Complemento"
                            id="complement"
                            value={form.address_complement}
                            onChange={set("address_complement")}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <Input
                                label="Cidade"
                                id="city"
                                value={form.address_city}
                                onChange={set("address_city")}
                                required
                            />
                        </div>
                        <Input
                            label="UF"
                            id="state"
                            value={form.address_state}
                            onChange={set("address_state")}
                            maxLength={2}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="CEP"
                            id="zip"
                            value={form.address_zip}
                            onChange={set("address_zip")}
                            required
                        />
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Tipo
                            </label>
                            <select
                                value={form.property_type}
                                onChange={set("property_type")}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary-400"
                            >
                                {Object.values(PropertyType).map((t) => (
                                    <option key={t} value={t}>
                                        {PROPERTY_TYPE_LABEL[t]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Input
                            label="Área (m²)"
                            id="area"
                            type="number"
                            min="1"
                            value={form.area_sqm}
                            onChange={set("area_sqm")}
                            required
                        />
                        <Input
                            label="Quartos"
                            id="beds"
                            type="number"
                            min="0"
                            value={form.bedrooms}
                            onChange={set("bedrooms")}
                        />
                        <Input
                            label="Banheiros"
                            id="baths"
                            type="number"
                            min="0"
                            value={form.bathrooms}
                            onChange={set("bathrooms")}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="IPTU/mês (R$)"
                            id="iptu"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.iptu_monthly_cents}
                            onChange={set("iptu_monthly_cents")}
                            required
                        />
                        <Input
                            label="Condomínio/mês (R$)"
                            id="condo"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.condo_monthly_cents}
                            onChange={set("condo_monthly_cents")}
                            required
                        />
                    </div>

                    {saveMutation.isError && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                            {(saveMutation.error as any)?.message ||
                                "Erro ao salvar"}
                        </p>
                    )}

                    {/* Photo upload */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Fotos do imóvel
                        </label>
                        {form.photo_urls.length > 0 && (
                            <div className="flex gap-2 flex-wrap mb-2">
                                {form.photo_urls.map((url) => (
                                    <div
                                        key={url}
                                        className="relative group w-20 h-20"
                                    >
                                        <img
                                            src={url}
                                            alt=""
                                            className="w-full h-full object-cover rounded-xl border border-gray-200"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removePhoto(url)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handlePhotoUpload}
                        />
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center justify-center gap-2 w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50"
                        >
                            <Camera className="w-4 h-4" />
                            {uploading ? "Enviando..." : "Adicionar fotos"}
                        </button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={closeModal}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" loading={saveMutation.isPending}>
                            {editing ? "Salvar alterações" : "Cadastrar imóvel"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
