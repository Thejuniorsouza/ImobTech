import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Save, CheckCircle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";
import { authService } from "../../services/auth.service";

const MARITAL_OPTIONS = [
    "Solteiro(a)",
    "Casado(a)",
    "Divorciado(a)",
    "Viúvo(a)",
    "União Estável",
];

export function SettingsPage() {
    const { user } = useAuth();
    const qc = useQueryClient();

    const { data: profile, isLoading } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => authService.getProfile(user!.id),
        enabled: !!user,
    });

    const [form, setForm] = useState({
        full_name: "",
        phone: "",
        rg: "",
        address: "",
        nationality: "",
        marital_status: "",
        profession: "",
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (profile) {
            setForm({
                full_name: profile.full_name ?? "",
                phone: profile.phone ?? "",
                rg: profile.rg ?? "",
                address: profile.address ?? "",
                nationality: profile.nationality ?? "",
                marital_status: profile.marital_status ?? "",
                profession: profile.profession ?? "",
            });
        }
    }, [profile]);

    function set(field: string) {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm((f) => ({ ...f, [field]: e.target.value }));
    }

    const mutation = useMutation({
        mutationFn: () =>
            authService.updateProfile(user!.id, {
                full_name: form.full_name.trim() || undefined,
                phone: form.phone.trim() || undefined,
                rg: form.rg.trim() || undefined,
                address: form.address.trim() || undefined,
                nationality: form.nationality.trim() || undefined,
                marital_status: form.marital_status || undefined,
                profession: form.profession.trim() || undefined,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <span className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Complete seus dados para que apareçam corretamente nos
                    contratos gerados
                </p>
            </div>

            <Card>
                {/* Read-only identity */}
                <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
                    <div className="w-14 h-14 rounded-full bg-primary-700 flex items-center justify-center text-white text-lg font-semibold shrink-0">
                        {profile?.full_name ? (
                            profile.full_name
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                        ) : (
                            <User className="w-6 h-6" />
                        )}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">
                            {profile?.full_name}
                        </p>
                        <p className="text-sm text-gray-500">
                            {profile?.email}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            CPF: {profile?.cpf}
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        mutation.mutate();
                    }}
                    className="space-y-4 pt-5"
                >
                    <Input
                        label="Nome completo"
                        id="full_name"
                        value={form.full_name}
                        onChange={set("full_name")}
                        placeholder="Nome completo"
                        required
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Telefone"
                            id="phone"
                            value={form.phone}
                            onChange={set("phone")}
                            placeholder="(00) 00000-0000"
                        />
                        <Input
                            label="RG"
                            id="rg"
                            value={form.rg}
                            onChange={set("rg")}
                            placeholder="00.000.000-0"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Nacionalidade"
                            id="nationality"
                            value={form.nationality}
                            onChange={set("nationality")}
                            placeholder="Brasileiro(a)"
                        />
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="marital_status"
                                className="text-sm font-medium text-gray-700"
                            >
                                Estado civil
                            </label>
                            <select
                                id="marital_status"
                                value={form.marital_status}
                                onChange={set("marital_status")}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Selecionar</option>
                                {MARITAL_OPTIONS.map((o) => (
                                    <option key={o}>{o}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <Input
                        label="Profissão"
                        id="profession"
                        value={form.profession}
                        onChange={set("profession")}
                        placeholder="Ex: Empresário"
                    />

                    <Input
                        label="Endereço completo"
                        id="address"
                        value={form.address}
                        onChange={set("address")}
                        placeholder="Rua, Número, Bairro, Cidade – UF"
                    />

                    {mutation.isError && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                            {(mutation.error as any)?.message ??
                                "Erro ao salvar"}
                        </p>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            type="submit"
                            loading={mutation.isPending}
                            icon={<Save className="w-4 h-4" />}
                        >
                            Salvar alterações
                        </Button>
                        {saved && (
                            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                                <CheckCircle className="w-4 h-4" />
                                Salvo com sucesso
                            </span>
                        )}
                    </div>
                </form>
            </Card>

            <Card>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Informações da conta
                </p>
                <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                        <span className="text-gray-400">E-mail</span>
                        <span className="font-medium">{profile?.email}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">CPF</span>
                        <span className="font-medium">{profile?.cpf}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Tipo de conta</span>
                        <span className="font-medium capitalize">
                            {profile?.role === "owner"
                                ? "Proprietário"
                                : "Inquilino"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Membro desde</span>
                        <span className="font-medium">
                            {profile?.created_at
                                ? new Date(
                                      profile.created_at,
                                  ).toLocaleDateString("pt-BR")
                                : "—"}
                        </span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
