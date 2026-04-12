import { Link } from "react-router-dom";
import { Mail, Home } from "lucide-react";

export function VerifyEmailPage() {
    return (
        <div className="min-h-screen bg-[#f3f8f5] flex items-center justify-center p-4">
            <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-5">
                    <Mail className="w-7 h-7 text-primary-700" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                    Verifique seu e-mail
                </h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                    Enviamos um link de confirmação para o seu e-mail. Acesse a
                    caixa de entrada e clique no link para ativar sua conta.
                </p>
                <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:underline"
                >
                    <Home className="w-4 h-4" /> Voltar para o login
                </Link>
            </div>
        </div>
    );
}
