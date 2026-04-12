import { ClipboardCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";

export function InspectionsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Vistorias</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Registros de entrada e saída dos imóveis
                </p>
            </div>
            <Card className="text-center py-16">
                <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                    Nenhuma vistoria registrada
                </p>
                <p className="text-sm text-gray-400 mt-1">
                    As vistorias ficam vinculadas aos contratos dos imóveis
                </p>
            </Card>
        </div>
    );
}
