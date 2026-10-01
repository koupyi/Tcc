type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

const statusConfig: Record<OrderStatus, { label: string; classes: string }> = {
  PENDING: { label: "Pendente", classes: "bg-yellow-100 text-yellow-800" },
  CONFIRMED: { label: "Confirmado", classes: "bg-blue-100 text-blue-800" },
  PROCESSING: { label: "Processando", classes: "bg-indigo-100 text-indigo-800" },
  SHIPPED: { label: "Enviado", classes: "bg-purple-100 text-purple-800" },
  DELIVERED: { label: "Entregue", classes: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelado", classes: "bg-red-100 text-red-800" },
  REFUNDED: { label: "Reembolsado", classes: "bg-gray-100 text-gray-800" },
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
    >
      {config.label}
    </span>
  );
}
