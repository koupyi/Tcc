import { motion } from "framer-motion";

interface CartItem {
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface ShippingInfo {
  price: number;
  name: string;
}

interface OrderSummaryProps {
  items: CartItem[];
  shipping: ShippingInfo;
  subtotal: number;
  total: number;
}

export function OrderSummary({ items, shipping, subtotal, total }: OrderSummaryProps) {
  const formatPrice = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-4 space-y-4"
    >
      <h3 className="font-semibold text-foreground-strong">Resumo do pedido</h3>

      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-3">
            <img
              src={item.image}
              alt={item.name}
              className="h-12 w-12 rounded-md object-cover border border-border"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground-strong truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
            </div>
            <span className="text-sm font-medium tabular-nums">
              {formatPrice(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-border pt-3 space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Frete ({shipping.name})</span>
          <span className="tabular-nums">{formatPrice(shipping.price)}</span>
        </div>
        <div className="flex justify-between font-bold text-foreground-strong pt-1 border-t border-border">
          <span>Total</span>
          <span className="tabular-nums text-primary">{formatPrice(total)}</span>
        </div>
      </div>
    </motion.div>
  );
}
