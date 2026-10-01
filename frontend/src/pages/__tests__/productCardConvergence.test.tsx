import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { CartProvider } from "@/context/CartContext";

/**
 * Proves convergence: Catalog and Home (Destaques + Mais vendidos) all render
 * through the same canonical <ProductCard /> — recognizable by its exact
 * aria-label contract ("Comprar X agora") — instead of each surface
 * hand-rolling its own commercial card markup.
 */

vi.mock("@/api/auth", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error("No token")),
    refresh: vi.fn(),
  },
}));

vi.mock("@/api/client", () => ({
  apiClient: {
    setToken: vi.fn(),
    getToken: vi.fn(() => null),
  },
}));

vi.mock("@/api/categories", () => ({
  categoriesApi: {
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

const sampleProduct = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  slug: "produto-a",
  name: "Produto A",
  description: null,
  brand: null,
  sku: "SKU-A",
  basePrice: "399.90",
  salePrice: null,
  isFeatured: true,
  isActive: true,
  tags: null,
  specs: null,
  categoryId: "cat-1",
  category: { id: "cat-1", name: "Teclados", slug: "teclados" },
  images: [{ id: "img-1", url: "/images/products/a.png", altText: "Produto A", isPrimary: true, sortOrder: 0 }],
  variants: [{ id: "v1", name: "Padrão", sku: "SKU-A-DEFAULT", price: null, stockQty: 8 }],
  _count: { variants: 1 },
  ...overrides,
});

vi.mock("@/api/products", () => ({
  productsApi: {
    list: vi.fn().mockResolvedValue({
      success: true,
      data: [sampleProduct()],
      meta: { total: 1, page: 1, limit: 8, totalPages: 1, hasNext: false, hasPrev: false },
    }),
    bestSellers: vi.fn().mockResolvedValue({ success: true, data: [sampleProduct({ id: "p2", name: "Produto B" })] }),
    getBySlug: vi.fn(),
    getById: vi.fn(),
  },
}));

function withProviders(ui: React.ReactElement) {
  return React.createElement(
    MemoryRouter,
    null,
    React.createElement(AuthProvider, null, React.createElement(FavoritesProvider, null, React.createElement(CartProvider, null, ui))),
  );
}

describe("Canonical ProductCard convergence", () => {
  it("Catalog (ProductsPage) renders products through the canonical ProductCard buy-now action", async () => {
    const { default: ProductsPage } = await import("@/pages/ProductsPage");
    render(withProviders(React.createElement(ProductsPage)));

    expect(await screen.findByLabelText("Comprar Produto A agora")).toBeDefined();
    expect(screen.getByLabelText("Adicionar Produto A ao carrinho")).toBeDefined();
  });

  it("Home Destaques and Mais vendidos both render through the canonical ProductCard buy-now action", async () => {
    const { default: HomePage } = await import("@/pages/HomePage");
    render(withProviders(React.createElement(HomePage)));

    await waitFor(() => {
      expect(screen.getByText("Produto A")).toBeDefined();
      expect(screen.getByText("Produto B")).toBeDefined();
    });

    expect(screen.getByLabelText("Comprar Produto A agora")).toBeDefined();
    expect(screen.getByLabelText("Comprar Produto B agora")).toBeDefined();
  });
});
