import { useState, useCallback } from "react";
import { shippingApi, ShippingOption } from "@/api/shipping";

export function useShipping() {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async (zipCode: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedOption(null);
    try {
      const res = await shippingApi.calculate(zipCode);
      if (res.success && res.data) {
        const opts = res.data as ShippingOption[];
        setOptions(opts);
        // Auto-select first (cheapest) option
        if (opts.length > 0) {
          setSelectedOption(opts[0]);
        }
        return opts;
      }
      return [];
    } catch (err) {
      setError((err as { message?: string }).message || "Erro ao calcular frete");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectOption = useCallback((option: ShippingOption) => {
    setSelectedOption(option);
  }, []);

  // Legacy: shipping property (backward compatible)
  const shipping = selectedOption ? { name: selectedOption.name, price: selectedOption.price, days: selectedOption.days } : null;

  return { options, selectedOption, shipping, isLoading, error, calculate, selectOption };
}
