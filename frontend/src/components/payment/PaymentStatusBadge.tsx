import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface PaymentStatusBadgeProps {
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Aguardando pagamento", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  PAID: { label: "Pago", color: "text-green-600 bg-green-50", icon: CheckCircle },
  CONFIRMED: { label: "Pago", color: "text-green-600 bg-green-50", icon: CheckCircle },
  FAILED: { label: "Falhou", color: "text-red-600 bg-red-50", icon: XCircle },
  CANCELLED: { label: "Expirado", color: "text-gray-600 bg-gray-50", icon: AlertTriangle },
  REFUNDED: { label: "Estornado", color: "text-blue-600 bg-blue-50", icon: AlertTriangle },
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
      <Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
}
