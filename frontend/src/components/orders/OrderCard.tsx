import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Package } from "lucide-react";
import { OrderStatusBadge } from "./OrderStatusBadge";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

interface OrderItem {
  productName: string;
}

interface OrderCardProps {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: number;
    createdAt: string;
    items: OrderItem[];
  };
}

export function OrderCard({ order }: OrderCardProps) {
  const formattedDate = new Date(order.createdAt).toLocaleDateString("pt-BR");
  const formattedTotal = order.total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow"
    >
      <Link to={`/orders/${order.id}`} className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground-strong">
              Pedido #{order.orderNumber}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
            <p className="text-xs text-muted-foreground truncate mt-1">
              {order.items.map((i) => i.productName).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <OrderStatusBadge status={order.status} />
          <span className="text-sm font-bold text-primary tabular-nums">{formattedTotal}</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </motion.div>
  );
}
