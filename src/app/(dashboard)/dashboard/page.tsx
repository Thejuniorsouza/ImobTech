"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  totalProperties: number;
  rentedProperties: number;
  availableProperties: number;
  totalTenants: number;
  activeContracts: number;
  pendingPayments: number;
  overduePayments: number;
  totalRevenue: number;
  recentPayments: RecentPayment[];
}

interface RecentPayment {
  id: string;
  dueDate: string;
  amount: number;
  status: string;
  contract: {
    property: { name: string };
    tenant: { name: string };
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Erro ao carregar dados</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Total de Imóveis",
      value: data.totalProperties,
      icon: "🏠",
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Imóveis Alugados",
      value: data.rentedProperties,
      icon: "🔑",
      color: "bg-green-50 text-green-700",
    },
    {
      label: "Imóveis Disponíveis",
      value: data.availableProperties,
      icon: "🏗️",
      color: "bg-yellow-50 text-yellow-700",
    },
    {
      label: "Inquilinos",
      value: data.totalTenants,
      icon: "👤",
      color: "bg-purple-50 text-purple-700",
    },
    {
      label: "Contratos Ativos",
      value: data.activeContracts,
      icon: "📄",
      color: "bg-indigo-50 text-indigo-700",
    },
    {
      label: "Pagamentos Pendentes",
      value: data.pendingPayments,
      icon: "⏳",
      color: "bg-orange-50 text-orange-700",
    },
    {
      label: "Pagamentos Atrasados",
      value: data.overduePayments,
      icon: "⚠️",
      color: "bg-red-50 text-red-700",
    },
    {
      label: "Receita Total",
      value: `R$ ${data.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: "💰",
      color: "bg-emerald-50 text-emerald-700",
    },
  ];

  const statusLabel: Record<string, { text: string; className: string }> = {
    pending: {
      text: "Pendente",
      className: "bg-yellow-100 text-yellow-800",
    },
    paid: { text: "Pago", className: "bg-green-100 text-green-800" },
    overdue: { text: "Atrasado", className: "bg-red-100 text-red-800" },
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Pagamentos Recentes
          </h2>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-4 text-center text-gray-500 text-sm"
                  >
                    Nenhum pagamento encontrado
                  </td>
                </tr>
              ) : (
                data.recentPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="p-4 text-sm text-gray-900">
                      {payment.contract.property.name}
                    </td>
                    <td className="p-4 text-sm text-gray-900">
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
                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabel[payment.status]?.className || "bg-gray-100 text-gray-800"}`}
                      >
                        {statusLabel[payment.status]?.text || payment.status}
                      </span>
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
