import { useState, useEffect, useCallback, useRef } from "react";
import { paymentsApi, Payment } from "@/api/payments";

interface UsePaymentReturn {
  payment: Payment | null;
  isLoading: boolean;
  error: string | null;
  createPayment: () => Promise<Payment | null>;
  refetch: () => void;
}

export function usePayment(orderId: string | undefined): UsePaymentReturn {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPayment = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await paymentsApi.getByOrderId(orderId);
      if (res.success && res.data) {
        setPayment(res.data);
        // Stop polling if payment is in final state
        if (['PAID', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(res.data.status)) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch (err) {
      // Silently fail for polling requests
    }
  }, [orderId]);

  const createPayment = useCallback(async (): Promise<Payment | null> => {
    if (!orderId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const res = await paymentsApi.create(orderId);
      if (res.success && res.data) {
        setPayment(res.data);
        return res.data;
      }
      setError("Erro ao criar pagamento");
      return null;
    } catch (err) {
      const msg = (err as { message?: string }).message || "Erro ao criar pagamento";
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  // Start polling when payment is PENDING
  useEffect(() => {
    if (payment?.status === 'PENDING' && !pollingRef.current) {
      pollingRef.current = setInterval(fetchPayment, 5000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [payment?.status, fetchPayment]);

  // Initial fetch
  useEffect(() => {
    if (orderId) {
      setIsLoading(true);
      paymentsApi.getByOrderId(orderId)
        .then((res) => {
          if (res.success && res.data) setPayment(res.data);
        })
        .catch(() => { /* Payment may not exist yet */ })
        .finally(() => setIsLoading(false));
    }
  }, [orderId]);

  return { payment, isLoading, error, createPayment, refetch: fetchPayment };
}
