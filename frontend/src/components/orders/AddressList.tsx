import { motion } from "framer-motion";
import { Trash2, MapPin } from "lucide-react";
import { formatCep } from "@/utils/cep";

interface Address {
  id: string;
  label: string | null;
  recipientName: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

interface AddressListProps {
  addresses: Address[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AddressList({ addresses, selectedId, onSelect, onDelete }: AddressListProps) {
  if (addresses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Você ainda não possui um endereço cadastrado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.map((address) => (
        <motion.label
          key={address.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedId === address.id
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          <input
            type="radio"
            name="address"
            checked={selectedId === address.id}
            onChange={() => onSelect(address.id)}
            className="mt-1 accent-primary"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium text-foreground-strong">
                {address.label || address.recipientName || "Endereço"}
              </span>
              {address.isDefault && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium ml-1">
                  Padrão
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {address.street}, {address.number}
              {address.complement ? ` - ${address.complement}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {address.neighborhood && `${address.neighborhood} · `}
              {address.city} - {address.state} · {formatCep(address.zipCode)}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onDelete(address.id); }}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remover endereço"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </motion.label>
      ))}
    </div>
  );
}
