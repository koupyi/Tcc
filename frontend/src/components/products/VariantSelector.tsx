import type { ProductVariant } from "@/types/product";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariantId: string | null;
  onSelect: (variant: ProductVariant) => void;
}

export function VariantSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  if (variants.length === 0) {
    return null;
  }

  // Extract unique attributes for grouping
  const attributes = extractAttributes(variants);

  if (variants.length === 1) {
    // Single variant — show info but no selection needed
    const variant = variants[0];
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground-strong">Variante</p>
        <div className="px-3 py-2 bg-accent rounded-md text-sm">
          {variant.name}
          {variant.sku && <span className="text-muted-foreground ml-2">({variant.sku})</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* If variants have distinct switchType, layout, or color — show grouped */}
      {attributes.hasSwitchType && (
        <AttributeGroup
          label="Switch"
          options={getUniqueValues(variants, "switchType")}
          variants={variants}
          selectedVariantId={selectedVariantId}
          attributeKey="switchType"
          onSelect={onSelect}
        />
      )}

      {attributes.hasLayout && (
        <AttributeGroup
          label="Layout"
          options={getUniqueValues(variants, "layout")}
          variants={variants}
          selectedVariantId={selectedVariantId}
          attributeKey="layout"
          onSelect={onSelect}
        />
      )}

      {attributes.hasColor && (
        <AttributeGroup
          label="Cor"
          options={getUniqueValues(variants, "color")}
          variants={variants}
          selectedVariantId={selectedVariantId}
          attributeKey="color"
          onSelect={onSelect}
        />
      )}

      {/* Fallback: if no structured attributes, show as list */}
      {!attributes.hasSwitchType && !attributes.hasLayout && !attributes.hasColor && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground-strong">Variante</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => onSelect(variant)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  selectedVariantId === variant.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/50"
                } ${variant.stockQty === 0 ? "opacity-50 line-through" : ""}`}
                disabled={variant.stockQty === 0}
              >
                {variant.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

interface AttributeGroupProps {
  label: string;
  options: string[];
  variants: ProductVariant[];
  selectedVariantId: string | null;
  attributeKey: "switchType" | "layout" | "color";
  onSelect: (variant: ProductVariant) => void;
}

function AttributeGroup({ label, options, variants, selectedVariantId, attributeKey, onSelect }: AttributeGroupProps) {
  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const selectedValue = selectedVariant ? selectedVariant[attributeKey] : null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground-strong">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const matchingVariant = variants.find((v) => v[attributeKey] === option);
          const isSelected = selectedValue === option;
          const isOutOfStock = matchingVariant ? matchingVariant.stockQty === 0 : false;

          return (
            <button
              key={option}
              onClick={() => {
                if (matchingVariant) onSelect(matchingVariant);
              }}
              disabled={isOutOfStock}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:border-primary/50"
              } ${isOutOfStock ? "opacity-50 line-through cursor-not-allowed" : ""}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function extractAttributes(variants: ProductVariant[]) {
  return {
    hasSwitchType: variants.some((v) => v.switchType !== null),
    hasLayout: variants.some((v) => v.layout !== null),
    hasColor: variants.some((v) => v.color !== null),
  };
}

function getUniqueValues(variants: ProductVariant[], key: "switchType" | "layout" | "color"): string[] {
  const values = new Set<string>();
  variants.forEach((v) => {
    const val = v[key];
    if (val) values.add(val);
  });
  return Array.from(values);
}
