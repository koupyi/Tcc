import { useState, useEffect, useCallback } from "react";
import { ordersApi, Order } from "@/api/orders";

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ordersApi.getMyOrders();
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (err) {
      setError((err as { message?: string }).message || "Erro ao carregar pedidos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return { orders, isLoading, error, refetch: fetchOrders };
}

export function useOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) { setIsLoading(false); return; }
    setIsLoading(true);
    ordersApi.getById(orderId)
      .then((res) => {
        if (res.success && res.data) setOrder(res.data);
        else setError("Pedido não encontrado");
      })
      .catch((err) => setError((err as { message?: string }).message || "Erro"))
      .finally(() => setIsLoading(false));
  }, [orderId]);

  return { order, isLoading, error };
}
