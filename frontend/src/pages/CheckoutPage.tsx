import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useAddresses } from "@/hooks/useAddresses";
import { useShipping } from "@/hooks/useShipping";
import { ordersApi } from "@/api/orders";

import { CheckoutStepper } from "@/components/orders/CheckoutStepper";
import { AddressList } from "@/components/orders/AddressList";
import { AddressForm, AddressFormData } from "@/components/orders/AddressForm";
import { ShippingOptions } from "@/components/orders/ShippingOptions";
import { OrderSummary } from "@/components/orders/OrderSummary";

type Step = 1 | 2 | 3 | 4;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { items, totalPrice, clearCart, isLoading: cartLoading } = useCart();
  const { addresses, createAddress, deleteAddress, isLoading: addressesLoading } = useAddresses();
  const { options: shippingOptions, selectedOption, shipping, calculate, selectOption, isLoading: shippingLoading } = useShipping();

  const [step, setStep] = useState<Step>(1);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressFormLoading, setAddressFormLoading] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Cart guard
  useEffect(() => {
    if (!cartLoading && items.length === 0 && !isSubmitting) {
      navigate("/cart", { replace: true });
    }
  }, [cartLoading, items.length, isSubmitting, navigate]);

  // Auto-select default address when addresses load
  useEffect(() => {
    if (!addressesLoading && addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find((a) => a.isDefault);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
      }
    }
  }, [addressesLoading, addresses, selectedAddressId]);

  // Auto-calculate shipping when address is selected and moving to step 2
  useEffect(() => {
    if (step === 2 && selectedAddressId) {
      const address = addresses.find((a) => a.id === selectedAddressId);
      if (address) {
        calculate(address.zipCode);
      }
    }
  }, [step, selectedAddressId, addresses, calculate]);

  const handleAddressCreate = async (data: AddressFormData) => {
    setAddressFormLoading(true);
    try {
      const created = await createAddress({
        recipientName: data.recipientName,
        street: data.street,
        number: data.number,
        complement: data.complement || undefined,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        label: data.label || undefined,
        isDefault: data.isDefault,
      });
      if (created) {
        setSelectedAddressId(created.id);
        setShowAddressForm(false);
        toast.success("Endereço salvo com sucesso!");
      }
    } catch {
      toast.error("Erro ao salvar endereço. Tente novamente.");
    } finally {
      setAddressFormLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !selectedAddressId) {
      toast.error("Selecione ou cadastre um endereço.");
      return;
    }
    if (step === 2 && !shipping) {
      toast.error("Aguarde o cálculo do frete.");
      return;
    }
    if (step < 4) {
      setStep((s) => (s + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
    }
  };

  const handleConfirmOrder = async () => {
    if (!selectedAddressId || !shipping) return;
    setIsSubmitting(true);
    try {
      const res = await ordersApi.create(selectedAddressId, "PIX", selectedOption?.code);
      if (res.success && res.data) {
        clearCart();
        toast.success("Pedido realizado com sucesso!");
        navigate(`/orders/${res.data.id}/payment`, { replace: true });
      } else {
        toast.error("Erro ao criar pedido. Tente novamente.");
      }
    } catch {
      toast.error("Erro ao criar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || cartLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-foreground-strong">Checkout</h1>

      <CheckoutStepper currentStep={step} />

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        {/* Step 1: Address */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground-strong">Endereço de entrega</h2>

            {addressesLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando endereços...</span>
              </div>
            ) : (
              <AddressList
                addresses={addresses}
                selectedId={selectedAddressId}
                onSelect={setSelectedAddressId}
                onDelete={deleteAddress}
              />
            )}

            {!showAddressForm ? (
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="text-sm text-primary font-medium hover:underline"
              >
                + Adicionar novo endereço
              </button>
            ) : (
              <div className="border border-border rounded-lg p-4">
                <AddressForm
                  onSubmit={handleAddressCreate}
                  onCancel={() => setShowAddressForm(false)}
                  isLoading={addressFormLoading}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Shipping */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground-strong">Frete</h2>
            <ShippingOptions options={shippingOptions} selectedOption={selectedOption} onSelect={selectOption} isLoading={shippingLoading} />
          </div>
        )}

        {/* Step 3: Order Summary */}
        {step === 3 && shipping && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground-strong">Resumo do pedido</h2>
            <OrderSummary
              items={items}
              shipping={shipping}
              subtotal={totalPrice}
              total={totalPrice + shipping.price}
            />
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-lg font-semibold text-foreground-strong">
              Confirme seu pedido
            </h2>
            <p className="text-sm text-muted-foreground">
              Ao confirmar, seu pedido será processado e você receberá as instruções de pagamento.
            </p>
            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className="w-full max-w-sm mx-auto py-3 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Processando..." : "Confirmar pedido"}
            </button>
          </div>
        )}
      </motion.div>

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 transition-opacity text-sm"
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}
