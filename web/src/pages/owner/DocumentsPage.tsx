import { FolderOpen } from "lucide-react";
import { Card } from "../../components/ui/Card";

export function DocumentsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Documentos compartilhados com inquilinos
                </p>
            </div>
            <Card className="text-center py-16">
                <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                    Nenhum documento compartilhado
                </p>
                <p className="text-sm text-gray-400 mt-1">
                    Acesse um contrato para enviar e visualizar documentos
                </p>
            </Card>
        </div>
    );
}
