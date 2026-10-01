import { describe, it, expect } from "vitest";
import { toProductCardModel } from "@/adapters/productCard";
import type { ProductListItem } from "@/types/product";

function makeProduct(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: "p1",
    slug: "produto-teste",
    name: "Produto Teste",
    description: null,
    brand: null,
    sku: "SKU-1",
    basePrice: "299.90",
    salePrice: null,
    isFeatured: false,
    isActive: true,
    tags: null,
    specs: null,
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Teclados", slug: "teclados" },
    images: [{ id: "img-1", url: "/images/products/foo.png", altText: "Foo", isPrimary: true, sortOrder: 0 }],
    variants: [{ id: "v1", name: "Padrão", sku: "SKU-1-DEFAULT", price: null, stockQty: 10 }],
    _count: { variants: 1 },
    ...overrides,
  };
}

describe("toProductCardModel", () => {
  it("maps a single-variant in-stock product", () => {
    const model = toProductCardModel(makeProduct());
    expect(model.id).toBe("p1");
    expect(model.name).toBe("Produto Teste");
    expect(model.basePrice).toBe(299.9);
    expect(model.salePrice).toBeNull();
    expect(model.stockQty).toBe(10);
    expect(model.variantId).toBe("v1");
    expect(model.variantCount).toBe(1);
    expect(model.rating).toBeNull(); // no real rating system — never fabricated
    expect(model.imageUrl).toBe("/images/products/foo.png");
  });

  it("never silently exposes a variantId when there are multiple variants", () => {
    const model = toProductCardModel(
      makeProduct({ _count: { variants: 3 }, variants: [{ id: "v1", name: "Red", sku: "SKU-1-RED", price: "10.00", stockQty: 5 }] }),
    );
    expect(model.variantCount).toBe(3);
    expect(model.variantId).toBeNull();
  });

  it("derives a sale price only when the variant/sale price is strictly lower than base", () => {
    const model = toProductCardModel(
      makeProduct({ basePrice: "300.00", variants: [{ id: "v1", name: "Padrão", sku: "SKU-1", price: "250.00", stockQty: 4 }] }),
    );
    expect(model.salePrice).toBe(250);
  });

  it("falls back to the placeholder image when there is no product image", () => {
    const model = toProductCardModel(makeProduct({ images: [] }));
    expect(model.imageUrl).toBe("/images/product-placeholder.svg");
  });

  it("reports zero stock for an out-of-stock representative variant", () => {
    const model = toProductCardModel(
      makeProduct({ variants: [{ id: "v1", name: "Padrão", sku: "SKU-1", price: null, stockQty: 0 }] }),
    );
    expect(model.stockQty).toBe(0);
  });
});
