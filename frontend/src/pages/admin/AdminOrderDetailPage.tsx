import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { adminApi } from "@/api/admin";
import { mapApiError } from "@/utils/errorMapper";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

/**
 * Mirrors backend OrderService.updateStatus state machine EXACTLY.
 * The backend remains the source of truth (it rejects invalid transitions with 400);
 * this only limits the options offered so the admin never sees an obviously-invalid one.
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  PROCESSING: "Processando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

interface AdminOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number | string;
  shippingCost: number | string;
  total: number | string;
  notes?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  user?: { id: string; name?: string | null; email: string; phone?: string | null };
  items: Array<{ id: string; productName: string; variantName: string; sku: string; quantity: number; unitPrice: number | string; total: number | string }>;
  payment?: { method: string; status: string; amount: number | string } | null;
  shipment?: {
    status: string;
    carrier?: string | null;
    serviceName?: string | null;
    snapshotRecipientName?: string | null;
    snapshotStreet?: string | null;
    snapshotNumber?: string | null;
    snapshotComplement?: string | null;
    snapshotNeighborhood?: string | null;
    snapshotCity?: string | null;
    snapshotState?: string | null;
    snapshotZipCode?: string | null;
  } | null;
}

function formatPrice(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [cancelReason, setCancelReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = !!user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const loadOrder = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    adminApi
      .getOrder(id)
      .then((res) => {
        if (res.success && res.data) {
          setOrder(res.data as AdminOrder);
          setNextStatus("");
        } else {
          setError("Pedido não encontrado.");
        }
      })
      .catch((err) => setError(mapApiError(err).message))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) loadOrder();
  }, [isAuthenticated, isAdmin, loadOrder]);

  const handleStatusChange = async () => {
    if (!id || !nextStatus || isSaving) return;
    setIsSaving(true);
    try {
      const res = await adminApi.updateOrderStatus(id, nextStatus, nextStatus === "CANCELLED" ? cancelReason || undefined : undefined);
      if (res.success) {
        toast.success("Status atualizado.");
        loadOrder();
      } else {
        toast.error("Não foi possível atualizar o status.");
      }
    } catch (err) {
      // Backend is source of truth — surface its friendly message (e.g. invalid transition).
      toast.error(mapApiError(err).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-muted-foreground">{error || "Pedido não encontrado."}</p>
        <Link to="/admin/orders" className="text-primary text-sm hover:underline inline-block mt-2">Voltar aos pedidos</Link>
      </div>
    );
  }

  const allowedNext = VALID_TRANSITIONS[order.status] ?? [];
  const s = order.shipment;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pedidos
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground-strong">Pedido #{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Customer */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <h2 className="font-semibold text-sm mb-2">Cliente</h2>
        <p className="text-sm">{order.user?.name || "—"}</p>
        <p className="text-sm text-muted-foreground">{order.user?.email}</p>
        {order.user?.phone && <p className="text-sm text-muted-foreground">{order.user.phone}</p>}
      </div>

      {/* Address (snapshot frozen at order time) */}
      {s && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <h2 className="font-semibold text-sm mb-2">Endereço de entrega</h2>
          <p className="text-sm">{s.snapshotRecipientName || order.user?.name}</p>
          <p className="text-sm text-muted-foreground">
            {s.snapshotStreet}, {s.snapshotNumber}{s.snapshotComplement ? ` - ${s.snapshotComplement}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {s.snapshotNeighborhood} — {s.snapshotCity}/{s.snapshotState} — CEP {s.snapshotZipCode}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Envio: {s.carrier || "—"} {s.serviceName ? `· ${s.serviceName}` : ""} · {s.status}
          </p>
        </div>
      )}

      {/* Items (keyboard components / products with snapshot) */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="font-semibold text-sm">Itens / componentes</h2>
        <ul className="divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.variantName} · SKU: {item.sku}</p>
                <p className="text-xs text-muted-foreground">Qtd: {item.quantity} × {formatPrice(item.unitPrice)}</p>
              </div>
              <span className="text-sm font-medium tabular-nums shrink-0 ml-4">{formatPrice(item.total)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatPrice(order.subtotal)}</span></div>
        <div className="flex justify-between text-sm text-muted-foreground"><span>Frete</span><span className="tabular-nums">{formatPrice(order.shippingCost)}</span></div>
        <div className="flex justify-between font-bold text-foreground-strong pt-2 border-t border-border"><span>Total</span><span className="tabular-nums text-primary">{formatPrice(order.total)}</span></div>
      </div>

      {/* Payment */}
      {order.payment && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold text-sm">Pagamento</h2>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Método</span><span>{order.payment.method}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><span>{order.payment.status}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valor</span><span className="tabular-nums">{formatPrice(order.payment.amount)}</span></div>
        </div>
      )}

      {order.cancelReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <h2 className="font-semibold text-sm text-destructive mb-1">Motivo do cancelamento</h2>
          <p className="text-sm text-muted-foreground">{order.cancelReason}</p>
        </div>
      )}

      {/* Status change */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-sm">Alterar status</h2>
        {allowedNext.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este pedido está em um estado final ({STATUS_LABEL[order.status]}). Não há transições disponíveis.</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
                aria-label="Novo status"
              >
                <option value="">Selecione o novo status…</option>
                {allowedNext.map((st) => (
                  <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={!nextStatus || isSaving}
                className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Aplicar
              </button>
            </div>
            {nextStatus === "CANCELLED" && (
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo do cancelamento (opcional)"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
