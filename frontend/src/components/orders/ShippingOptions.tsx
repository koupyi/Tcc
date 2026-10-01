import { motion } from "framer-motion";
import { Truck, Loader2, Zap } from "lucide-react";
import type { ShippingOption } from "@/api/shipping";

interface ShippingOptionsProps {
  options: ShippingOption[];
  selectedOption: ShippingOption | null;
  onSelect: (option: ShippingOption) => void;
  isLoading: boolean;
}

export function ShippingOptions({ options, selectedOption, onSelect, isLoading }: ShippingOptionsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Calculando opções de frete...</span>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Selecione um endereço para calcular o frete.
      </p>
    );
  }

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Opções de frete">
      {options.map((option) => {
        const isSelected = selectedOption?.code === option.code;
        const Icon = option.code === 'EXPRESSO' ? Zap : Truck;
        const formattedPrice = option.price.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

        return (
          <motion.button
            key={option.id}
            type="button"
            onClick={() => onSelect(option)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/50"
            }`}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${option.name} - ${formattedPrice} - ${option.days} dias`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground-strong">{option.name}</p>
              <p className="text-xs text-muted-foreground">
                {option.carrier} • {option.days} {option.days === 1 ? "dia útil" : "dias úteis"}
              </p>
            </div>
            <span className={`text-sm font-bold tabular-nums ${isSelected ? "text-primary" : "text-foreground"}`}>
              {formattedPrice}
            </span>
            {/* Radio indicator */}
            <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              isSelected ? "border-primary" : "border-border"
            }`}>
              {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
