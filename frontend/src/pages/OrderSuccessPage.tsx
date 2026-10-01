import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Package, ShoppingBag } from "lucide-react";
import { Loader2 } from "lucide-react";

import { useOrder } from "@/hooks/useOrders";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export default function OrderSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const { order, isLoading, error } = useOrder(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Link to="/orders" className="text-primary text-sm hover:underline mt-4 inline-block">
          Ver meus pedidos
        </Link>
      </div>
    );
  }

  const formattedTotal = order.total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        >
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground-strong">Pedido realizado!</h1>
          <p className="text-muted-foreground text-sm">
            Seu pedido foi criado com sucesso e está sendo processado.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Número</span>
            <span className="text-sm font-semibold text-foreground-strong">
              #{order.orderNumber}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-sm font-bold text-primary tabular-nums">{formattedTotal}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <OrderStatusBadge status={order.status as OrderStatus} />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Link
            to="/orders"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 transition-opacity"
          >
            <Package className="h-4 w-4" />
            Ver meus pedidos
          </Link>
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 border border-border text-foreground-strong font-medium rounded-md hover:bg-muted transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            Continuar comprando
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
