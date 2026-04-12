import { Megaphone } from "lucide-react";
import { Card } from "../../components/ui/Card";

export function AdsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Gerador de Anúncios
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Crie anúncios para OLX, ZAP Imóveis e Viva Real
                </p>
            </div>
            <Card className="text-center py-16">
                <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                    Selecione um imóvel vago
                </p>
                <p className="text-sm text-gray-400 mt-1">
                    Acesse um imóvel com status "Vago" para gerar o anúncio
                    automaticamente
                </p>
            </Card>
        </div>
    );
}
