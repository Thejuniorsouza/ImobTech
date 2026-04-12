"use client";

import { useEffect, useState } from "react";

interface Contract {
  id: string;
  property: { name: string };
  tenant: { name: string };
  rentValue: number;
}

interface Payment {
  id: string;
  dueDate: string;
  amount: number;
  status: string;
  paidAt: string | null;
  contract: {
    property: { name: string };
    tenant: { name: string };
  };
}

const statusLabels: Record<string, { text: string; className: string }> = {
  pending: {
    text: "Pendente",
    className: "bg-yellow-100 text-yellow-800",
  },
  paid: { text: "Pago", className: "bg-green-100 text-green-800" },
  overdue: { text: "Atrasado", className: "bg-red-100 text-red-800" },
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    contractId: "",
    dueDate: "",
    amount: "",
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [paymentsRes, contractsRes] = await Promise.all([
        fetch("/api/payments"),
        fetch("/api/contracts"),
      ]);
      const [paymentsData, contractsData] = await Promise.all([
        paymentsRes.json(),
        contractsRes.json(),
      ]);
      setPayments(paymentsData);
      setContracts(contractsData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setForm({ contractId: "", dueDate: "", amount: "" });
        setShowForm(false);
        loadData();
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "paid" }),
      });
      loadData();
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancelar" : "+ Novo Pagamento"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Registrar Pagamento
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contrato
              </label>
              <select
                value={form.contractId}
                onChange={(e) =>
                  setForm({ ...form, contractId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                required
              >
                <option value="">Selecione um contrato</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.property.name} - {c.tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="1500.00"
                required
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-4 text-sm font-medium text-gray-500">
                  Imóvel
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">
                  Inquilino
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">
                  Vencimento
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">
                  Valor
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">
                  Status
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-gray-500 text-sm"
                  >
                    Nenhum pagamento registrado
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="p-4 text-sm font-medium text-gray-900">
                      {payment.contract.property.name}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {payment.contract.tenant.name}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(payment.dueDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-4 text-sm text-gray-900 font-medium">
                      R${" "}
                      {payment.amount.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[payment.status]?.className || "bg-gray-100 text-gray-800"}`}
                      >
                        {statusLabels[payment.status]?.text || payment.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {payment.status !== "paid" && (
                        <button
                          onClick={() => markAsPaid(payment.id)}
                          className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          Marcar como Pago
                        </button>
                      )}
                      {payment.paidAt && (
                        <span className="text-xs text-gray-500">
                          Pago em{" "}
                          {new Date(payment.paidAt).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
