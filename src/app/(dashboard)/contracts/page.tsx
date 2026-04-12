"use client";

import { useEffect, useState } from "react";

interface Property {
  id: string;
  name: string;
}

interface Tenant {
  id: string;
  name: string;
}

interface Contract {
  id: string;
  startDate: string;
  endDate: string;
  rentValue: number;
  status: string;
  property: Property;
  tenant: Tenant;
}

const statusLabels: Record<string, { text: string; className: string }> = {
  active: { text: "Ativo", className: "bg-green-100 text-green-800" },
  ended: { text: "Encerrado", className: "bg-gray-100 text-gray-800" },
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    propertyId: "",
    tenantId: "",
    startDate: "",
    endDate: "",
    rentValue: "",
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [contractsRes, propertiesRes, tenantsRes] = await Promise.all([
        fetch("/api/contracts"),
        fetch("/api/properties"),
        fetch("/api/tenants"),
      ]);
      const [contractsData, propertiesData, tenantsData] = await Promise.all([
        contractsRes.json(),
        propertiesRes.json(),
        tenantsRes.json(),
      ]);
      setContracts(contractsData);
      setProperties(propertiesData);
      setTenants(tenantsData);
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
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setForm({
          propertyId: "",
          tenantId: "",
          startDate: "",
          endDate: "",
          rentValue: "",
        });
        setShowForm(false);
        loadData();
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancelar" : "+ Novo Contrato"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Criar Contrato
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Imóvel
              </label>
              <select
                value={form.propertyId}
                onChange={(e) =>
                  setForm({ ...form, propertyId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                required
              >
                <option value="">Selecione um imóvel</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inquilino
              </label>
              <select
                value={form.tenantId}
                onChange={(e) =>
                  setForm({ ...form, tenantId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                required
              >
                <option value="">Selecione um inquilino</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Início
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Fim
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor do Aluguel (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.rentValue}
                onChange={(e) =>
                  setForm({ ...form, rentValue: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="1500.00"
                required
              />
            </div>
            <div className="flex items-end">
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
                  Início
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">
                  Fim
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
              {contracts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-gray-500 text-sm"
                  >
                    Nenhum contrato cadastrado
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="p-4 text-sm font-medium text-gray-900">
                      {contract.property.name}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {contract.tenant.name}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(contract.startDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(contract.endDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-4 text-sm text-gray-900 font-medium">
                      R${" "}
                      {contract.rentValue.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[contract.status]?.className || "bg-gray-100 text-gray-800"}`}
                      >
                        {statusLabels[contract.status]?.text ||
                          contract.status}
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
