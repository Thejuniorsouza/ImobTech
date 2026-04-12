import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏢 ImobTech</h1>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium hover:text-blue-200 transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            Criar Conta
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-bold leading-tight mb-6">
            Gerencie seus aluguéis com{" "}
            <span className="text-blue-400">simplicidade</span>
          </h2>
          <p className="text-xl text-blue-200 mb-10">
            Controle completo de imóveis, inquilinos, contratos e pagamentos em
            uma única plataforma.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition-colors"
          >
            Começar Gratuitamente
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20 max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="text-3xl mb-4">🏠</div>
            <h3 className="text-lg font-semibold mb-2">Gestão de Imóveis</h3>
            <p className="text-blue-200 text-sm">
              Cadastre e gerencie todos os seus imóveis em um só lugar.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="text-3xl mb-4">📄</div>
            <h3 className="text-lg font-semibold mb-2">Contratos</h3>
            <p className="text-blue-200 text-sm">
              Crie e acompanhe contratos de aluguel com facilidade.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="text-3xl mb-4">💰</div>
            <h3 className="text-lg font-semibold mb-2">Pagamentos</h3>
            <p className="text-blue-200 text-sm">
              Controle os pagamentos e identifique inadimplências.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
