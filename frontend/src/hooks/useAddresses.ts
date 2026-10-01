import { useState, useEffect, useCallback } from "react";
import { addressApi, Address, CreateAddressInput } from "@/api/addresses";

interface UseAddressesReturn {
  addresses: Address[];
  isLoading: boolean;
  error: string | null;
  createAddress: (input: CreateAddressInput) => Promise<Address | null>;
  deleteAddress: (id: string) => Promise<void>;
  refetch: () => void;
}

export function useAddresses(): UseAddressesReturn {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await addressApi.list();
      if (res.success && res.data) {
        setAddresses(res.data);
      }
    } catch (err) {
      setError((err as { message?: string }).message || "Erro ao carregar endereços");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const createAddress = useCallback(async (input: CreateAddressInput): Promise<Address | null> => {
    try {
      const res = await addressApi.create(input);
      if (res.success && res.data) {
        setAddresses((prev) => [res.data!, ...prev]);
        return res.data;
      }
      return null;
    } catch (err) {
      throw err;
    }
  }, []);

  const deleteAddress = useCallback(async (id: string) => {
    await addressApi.remove(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { addresses, isLoading, error, createAddress, deleteAddress, refetch: fetchAddresses };
}
