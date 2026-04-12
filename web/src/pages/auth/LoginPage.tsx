import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, Eye, EyeOff } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authService } from "../../services/auth.service";

export function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { data, error: err } = await authService.signIn(email, password);
        setLoading(false);
        if (err) {
            setError("E-mail ou senha inválidos.");
            return;
        }
        const role = data.user?.user_metadata?.role;
        navigate(role === "tenant" ? "/tenant/dashboard" : "/owner/dashboard");
    }

    return (
        <div className="min-h-screen bg-[#f3f8f5] flex items-center justify-center p-4">
            <div className="w-full max-w-[400px]">
                {/* Logo */}
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
                        Bem-vindo de volta
                    </h1>
                    <p className="text-sm text-gray-500 mb-6">
                        Entre na sua conta
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="E-mail"
                            id="email"
                            type="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium text-gray-700"
                            >
                                Senha
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPwd ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    required
                                    autoComplete="current-password"
                                    className="w-full px-3 py-2 pr-10 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary-400 focus:bg-white transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(!showPwd)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPwd ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
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
                            Entrar
                        </Button>
                    </form>

                    <p className="text-sm text-center text-gray-500 mt-5">
                        Não tem conta?{" "}
                        <Link
                            to="/register"
                            className="text-primary-700 font-medium hover:underline"
                        >
                            Cadastre-se
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
