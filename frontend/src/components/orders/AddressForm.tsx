import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { maskCep, normalizeCep, isValidCepFormat, isValidUF, formatCep, VALID_UFS } from "@/utils/cep";
import { useCepLookup, CepLookupStatus } from "@/hooks/useCepLookup";

export interface AddressFormData {
  recipientName: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  label: string;
  isDefault: boolean;
}

interface AddressFormProps {
  onSubmit: (data: AddressFormData) => Promise<void> | void;
  onCancel?: () => void;
  isLoading?: boolean;
  initialData?: Partial<AddressFormData>;
}

const EMPTY_FORM: AddressFormData = {
  recipientName: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  label: "",
  isDefault: false,
};

export function AddressForm({ onSubmit, onCancel, isLoading = false, initialData }: AddressFormProps) {
  const [form, setForm] = useState<AddressFormData>(() => ({
    ...EMPTY_FORM,
    ...initialData,
    zipCode: initialData?.zipCode ? formatCep(initialData.zipCode) : "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { status: cepStatus, lookup, reset: resetCepLookup } = useCepLookup();
  const numberInputRef = useRef<HTMLInputElement>(null);
  const prevCepRef = useRef<string>("");

  // Trigger ViaCEP lookup when CEP reaches 8 digits
  useEffect(() => {
    const normalized = normalizeCep(form.zipCode);
    if (normalized === prevCepRef.current) return;
    prevCepRef.current = normalized;

    if (normalized.length === 8 && isValidCepFormat(normalized)) {
      lookup(normalized).then((result) => {
        if (result) {
          setForm((prev) => ({
            ...prev,
            // Only fill fields from ViaCEP, never overwrite number/complement
            street: result.street || prev.street,
            neighborhood: result.neighborhood || prev.neighborhood,
            city: result.city || prev.city,
            state: result.state || prev.state,
          }));
          // Clear errors for auto-filled fields
          setErrors((prev) => {
            const next = { ...prev };
            if (result.street) delete next.street;
            if (result.neighborhood) delete next.neighborhood;
            if (result.city) delete next.city;
            if (result.state) delete next.state;
            return next;
          });
          // Focus number field after auto-fill
          setTimeout(() => numberInputRef.current?.focus(), 100);
        }
      });
    } else if (normalized.length < 8) {
      resetCepLookup();
    }
  }, [form.zipCode, lookup, resetCepLookup]);

  const handleChange = (field: keyof AddressFormData, value: string | boolean) => {
    if (field === "zipCode" && typeof value === "string") {
      setForm((prev) => ({ ...prev, zipCode: maskCep(value) }));
    } else if (field === "state" && typeof value === "string") {
      setForm((prev) => ({ ...prev, state: value.toUpperCase().slice(0, 2) }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.recipientName.trim() || form.recipientName.trim().length < 2) {
      newErrors.recipientName = "Nome do destinatário é obrigatório (mín. 2 caracteres).";
    }

    const normalizedCep = normalizeCep(form.zipCode);
    if (!isValidCepFormat(normalizedCep)) {
      newErrors.zipCode = "Informe um CEP válido com 8 dígitos.";
    }

    if (!form.street.trim() || form.street.trim().length < 2) {
      newErrors.street = "Rua é obrigatória.";
    }

    if (!form.number.trim()) {
      newErrors.number = "Número é obrigatório.";
    }

    if (!form.neighborhood.trim() || form.neighborhood.trim().length < 2) {
      newErrors.neighborhood = "Bairro é obrigatório.";
    }

    if (!form.city.trim() || form.city.trim().length < 2) {
      newErrors.city = "Cidade é obrigatória.";
    }

    if (!form.state.trim() || form.state.trim().length !== 2) {
      newErrors.state = "UF é obrigatória (2 caracteres).";
    } else if (!isValidUF(form.state)) {
      newErrors.state = "UF inválida.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!validate()) return;

    // Normalize data before sending
    const normalized: AddressFormData = {
      ...form,
      recipientName: form.recipientName.trim(),
      zipCode: maskCep(normalizeCep(form.zipCode)), // Send in 00000-000 format (backend accepts both)
      street: form.street.trim(),
      number: form.number.trim(),
      complement: form.complement.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      state: form.state.toUpperCase().trim(),
      label: form.label.trim(),
    };

    await onSubmit(normalized);
  };

  const inputCls = "w-full px-3 py-2 bg-card border border-border rounded-md text-sm focus:ring-2 focus:ring-ring outline-none";
  const labelCls = "block text-sm font-medium text-foreground mb-1";
  const errorCls = "text-xs text-destructive mt-1";

  const getCepStatusMessage = (): { text: string; type: 'info' | 'error' | 'success' } | null => {
    switch (cepStatus) {
      case 'loading':
        return { text: 'Buscando endereço...', type: 'info' };
      case 'not-found':
        return { text: 'CEP não encontrado. Confira o número informado.', type: 'error' };
      case 'error':
        return { text: 'Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.', type: 'error' };
      case 'success':
        return { text: 'Endereço encontrado!', type: 'success' };
      default:
        return null;
    }
  };

  const cepMessage = getCepStatusMessage();

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Destinatário */}
        <div className="sm:col-span-2">
          <label htmlFor="addr-recipient" className={labelCls}>Destinatário *</label>
          <input
            id="addr-recipient"
            className={inputCls}
            value={form.recipientName}
            onChange={(e) => handleChange("recipientName", e.target.value)}
            autoComplete="name"
            aria-invalid={!!errors.recipientName}
            aria-describedby={errors.recipientName ? "addr-recipient-err" : undefined}
          />
          {errors.recipientName && <p id="addr-recipient-err" className={errorCls} role="alert">{errors.recipientName}</p>}
        </div>

        {/* CEP */}
        <div>
          <label htmlFor="addr-cep" className={labelCls}>CEP *</label>
          <div className="relative">
            <input
              id="addr-cep"
              className={inputCls}
              value={form.zipCode}
              onChange={(e) => handleChange("zipCode", e.target.value)}
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
              autoComplete="postal-code"
              aria-invalid={!!(errors.zipCode || cepStatus === 'not-found')}
              aria-describedby="addr-cep-status"
            />
            {cepStatus === 'loading' && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {/* CEP status messages (aria-live for accessibility) */}
          <div id="addr-cep-status" aria-live="polite" aria-atomic="true" className="mt-1">
            {cepMessage && (
              <p className={`text-xs ${
                cepMessage.type === 'error' ? 'text-destructive' :
                cepMessage.type === 'success' ? 'text-green-600' :
                'text-muted-foreground'
              }`}>
                {cepMessage.text}
              </p>
            )}
          </div>
          {errors.zipCode && submitAttempted && !cepMessage && (
            <p className={errorCls} role="alert">{errors.zipCode}</p>
          )}
        </div>

        {/* Rótulo */}
        <div>
          <label htmlFor="addr-label" className={labelCls}>Rótulo</label>
          <input
            id="addr-label"
            className={inputCls}
            value={form.label}
            onChange={(e) => handleChange("label", e.target.value)}
            placeholder="Ex: Casa, Trabalho"
          />
        </div>

        {/* Rua */}
        <div className="sm:col-span-2">
          <label htmlFor="addr-street" className={labelCls}>Rua *</label>
          <input
            id="addr-street"
            className={inputCls}
            value={form.street}
            onChange={(e) => handleChange("street", e.target.value)}
            autoComplete="street-address"
            aria-invalid={!!errors.street}
            aria-describedby={errors.street ? "addr-street-err" : undefined}
          />
          {errors.street && <p id="addr-street-err" className={errorCls} role="alert">{errors.street}</p>}
        </div>

        {/* Número */}
        <div>
          <label htmlFor="addr-number" className={labelCls}>Número *</label>
          <input
            id="addr-number"
            ref={numberInputRef}
            className={inputCls}
            value={form.number}
            onChange={(e) => handleChange("number", e.target.value)}
            placeholder="123, S/N, 123A"
            aria-invalid={!!errors.number}
            aria-describedby={errors.number ? "addr-number-err" : undefined}
          />
          {errors.number && <p id="addr-number-err" className={errorCls} role="alert">{errors.number}</p>}
        </div>

        {/* Complemento */}
        <div>
          <label htmlFor="addr-complement" className={labelCls}>Complemento</label>
          <input
            id="addr-complement"
            className={inputCls}
            value={form.complement}
            onChange={(e) => handleChange("complement", e.target.value)}
            placeholder="Apto, Bloco, Sala"
            autoComplete="address-line2"
          />
        </div>

        {/* Bairro */}
        <div>
          <label htmlFor="addr-neighborhood" className={labelCls}>Bairro *</label>
          <input
            id="addr-neighborhood"
            className={inputCls}
            value={form.neighborhood}
            onChange={(e) => handleChange("neighborhood", e.target.value)}
            aria-invalid={!!errors.neighborhood}
            aria-describedby={errors.neighborhood ? "addr-neighborhood-err" : undefined}
          />
          {errors.neighborhood && <p id="addr-neighborhood-err" className={errorCls} role="alert">{errors.neighborhood}</p>}
        </div>

        {/* Cidade */}
        <div>
          <label htmlFor="addr-city" className={labelCls}>Cidade *</label>
          <input
            id="addr-city"
            className={inputCls}
            value={form.city}
            onChange={(e) => handleChange("city", e.target.value)}
            autoComplete="address-level2"
            aria-invalid={!!errors.city}
            aria-describedby={errors.city ? "addr-city-err" : undefined}
          />
          {errors.city && <p id="addr-city-err" className={errorCls} role="alert">{errors.city}</p>}
        </div>

        {/* Estado (UF) */}
        <div>
          <label htmlFor="addr-state" className={labelCls}>Estado (UF) *</label>
          <select
            id="addr-state"
            className={inputCls}
            value={form.state}
            onChange={(e) => handleChange("state", e.target.value)}
            aria-invalid={!!errors.state}
            aria-describedby={errors.state ? "addr-state-err" : undefined}
          >
            <option value="">Selecione</option>
            {VALID_UFS.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
          {errors.state && <p id="addr-state-err" className={errorCls} role="alert">{errors.state}</p>}
        </div>
      </div>

      {/* Endereço padrão */}
      <label htmlFor="addr-default" className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          id="addr-default"
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => handleChange("isDefault", e.target.checked)}
          className="rounded border-border"
        />
        Definir como endereço padrão
      </label>

      {/* Botões */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Salvando..." : "Salvar endereço"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-border rounded-md text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
