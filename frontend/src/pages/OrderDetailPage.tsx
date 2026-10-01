import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
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

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { order, isLoading, error } = useOrder(id);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const formatPrice = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-muted-foreground">{error || "Pedido não encontrado."}</p>
        <Link to="/orders" className="text-primary text-sm hover:underline inline-block mt-2">
          Voltar para meus pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Meus pedidos
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground-strong">
              Pedido #{order.orderNumber}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(order.createdAt)}
            </p>
          </div>
          <OrderStatusBadge status={order.status as OrderStatus} />
        </div>

        {/* Items */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="font-semibold text-foreground-strong text-sm">Itens do pedido</h2>
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground-strong truncate">
                    {item.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.variantName} · SKU: {item.sku}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Qtd: {item.quantity} × {formatPrice(item.unitPrice)}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                  {formatPrice(item.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Prices */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Frete</span>
            <span className="tabular-nums">{formatPrice(order.shippingCost)}</span>
          </div>
          <div className="flex justify-between font-bold text-foreground-strong pt-2 border-t border-border">
            <span>Total</span>
            <span className="tabular-nums text-primary">{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Payment */}
        {order.payment && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h2 className="font-semibold text-foreground-strong text-sm">Pagamento</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Método</span>
              <span className="text-foreground-strong">{order.payment.method}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="text-foreground-strong">{order.payment.status}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h2 className="font-semibold text-foreground-strong text-sm">Observações</h2>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
