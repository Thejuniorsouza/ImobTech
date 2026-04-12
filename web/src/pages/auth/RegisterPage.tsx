import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authService } from "../../services/auth.service";
import { UserRole } from "../../lib/constants";

export function RegisterPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        fullName: "",
        email: "",
        cpf: "",
        password: "",
        role: UserRole.Owner,
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function set(field: string) {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm((f) => ({ ...f, [field]: e.target.value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { error: err } = await authService.signUp(
            form.email,
            form.password,
            form.fullName,
            form.cpf,
            form.role,
        );
        setLoading(false);
        if (err) {
            setError(err.message);
            return;
        }
        navigate("/verify-email");
    }

    return (
        <div className="min-h-screen bg-[#f3f8f5] flex items-center justify-center p-4">
            <div className="w-full max-w-[420px]">
                <div className="flex items-center gap-2 justify-center mb-8">
                    <div className="w-9 h-9 rounded-xl bg-primary-700 flex items-center justify-center">
                        <Home className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900 tracking-tight">
                        ImobTech
                    </span>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                        Criar conta
                    </h1>
                    <p className="text-sm text-gray-500 mb-6">
                        Preencha seus dados para começar
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Nome completo"
                            id="fullName"
                            type="text"
                            placeholder="João da Silva"
                            value={form.fullName}
                            onChange={set("fullName")}
                            required
                        />

                        <Input
                            label="E-mail"
                            id="email"
                            type="email"
                            placeholder="seu@email.com"
                            value={form.email}
                            onChange={set("email")}
                            required
                        />

                        <Input
                            label="CPF"
                            id="cpf"
                            type="text"
                            placeholder="000.000.000-00"
                            value={form.cpf}
                            onChange={set("cpf")}
                            required
                            maxLength={14}
                        />

                        <Input
                            label="Senha"
                            id="password"
                            type="password"
                            placeholder="mínimo 8 caracteres"
                            value={form.password}
                            onChange={set("password")}
                            required
                            minLength={8}
                        />

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Meu perfil
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {(
                                    [
                                        [UserRole.Owner, "Proprietário", "🏠"],
                                        [UserRole.Tenant, "Inquilino", "🔑"],
                                    ] as const
                                ).map(([val, label, icon]) => (
                                    <label
                                        key={val}
                                        className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                                            form.role === val
                                                ? "border-primary-600 bg-primary-50 text-primary-800"
                                                : "border-gray-200 hover:border-primary-300"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="role"
                                            value={val}
                                            checked={form.role === val}
                                            onChange={set("role")}
                                            className="sr-only"
                                        />
                                        <span className="text-lg leading-none">
                                            {icon}
                                        </span>
                                        <span className="text-sm font-medium">
                                            {label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                {error}
                            </p>
                        )}

                        <Button
                            type="submit"
                            loading={loading}
                            className="w-full"
                            size="lg"
                        >
                            Criar conta
                        </Button>
                    </form>

                    <p className="text-sm text-center text-gray-500 mt-5">
                        Já tem conta?{" "}
                        <Link
                            to="/login"
                            className="text-primary-700 font-medium hover:underline"
                        >
                            Entrar
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
