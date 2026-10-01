import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { CartProvider } from "@/context/CartContext";
import { ProductCard } from "@/components/products/ProductCard";
import type { ProductCardModel } from "@/types/productCard";

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

vi.mock("@/api/cart", () => ({
  cartApi: {
    get: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    merge: vi.fn(),
  },
}));

import { authApi } from "@/api/auth";
import { cartApi } from "@/api/cart";

function baseModel(overrides: Partial<ProductCardModel> = {}): ProductCardModel {
  return {
    id: "p1",
    slug: "produto-teste",
    name: "Qwerty Aurora 75",
    imageUrl: "/images/products/aurora.png",
    imageAlt: "Qwerty Aurora 75",
    categoryName: "Teclados",
    basePrice: 599.9,
    salePrice: null,
    rating: null,
    reviewCount: 0,
    stockQty: 10,
    variantId: "v1",
    variantCount: 1,
    ...overrides,
  };
}

function renderCard(model: ProductCardModel, initialRoute = "/") {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          FavoritesProvider,
          null,
          React.createElement(
            CartProvider,
            null,
            React.createElement(Routes, null, [
              React.createElement(Route, { key: "home", path: "/", element: React.createElement(ProductCard, { product: model }) }),
              React.createElement(Route, { key: "checkout", path: "/checkout", element: React.createElement("div", null, "CHECKOUT PAGE") }),
            ]),
          ),
        ),
      ),
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("ProductCard", () => {
  it("renders name, BRL price, image and stock badge", async () => {
    renderCard(baseModel());
    expect(screen.getByText("Qwerty Aurora 75")).toBeDefined();
    expect(await screen.findByText(/R\$\s*599,90/)).toBeDefined();
    expect(screen.getByAltText("Qwerty Aurora 75")).toBeDefined();
    expect(screen.getByText(/Em estoque/)).toBeDefined();
  });

  it("shows a safe empty state instead of fabricated stars when there is no rating", () => {
    renderCard(baseModel());
    expect(screen.getByText("Sem avaliações")).toBeDefined();
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it("enables purchase actions when in stock", () => {
    renderCard(baseModel({ stockQty: 5 }));
    expect(screen.getByLabelText(/Adicionar Qwerty Aurora 75 ao carrinho/i)).not.toHaveProperty("disabled", true);
    expect(screen.getByLabelText(/Comprar Qwerty Aurora 75 agora/i)).not.toHaveProperty("disabled", true);
  });

  it("shows Esgotado and disables purchase actions when out of stock", () => {
    renderCard(baseModel({ stockQty: 0 }));
    expect(screen.getByText("Esgotado")).toBeDefined();
    const addBtn = screen.getByLabelText(/Adicionar Qwerty Aurora 75 ao carrinho/i) as HTMLButtonElement;
    const buyBtn = screen.getByLabelText(/Comprar Qwerty Aurora 75 agora/i) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    expect(buyBtn.disabled).toBe(true);
  });

  it("never silently picks a variant — shows 'Escolher opções' for multi-variant products", () => {
    renderCard(baseModel({ variantId: null, variantCount: 3 }));
    expect(screen.getByText("Escolher opções")).toBeDefined();
    expect(screen.queryByLabelText(/Adicionar .* ao carrinho/i)).toBeNull();
    expect(screen.queryByLabelText(/Comprar .* agora/i)).toBeNull();
  });

  it("toggles favorite state and persists it with aria-pressed", () => {
    renderCard(baseModel());
    const favBtn = screen.getByLabelText(/Adicionar Qwerty Aurora 75 aos favoritos/i);
    expect(favBtn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(favBtn);

    expect(screen.getByLabelText(/Remover Qwerty Aurora 75 dos favoritos/i).getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(localStorage.getItem("favorites_guest") || "[]")).toContain("p1");
  });

  it("buy now adds the item and navigates to /checkout on success (guest cart)", async () => {
    renderCard(baseModel());
    fireEvent.click(screen.getByLabelText(/Comprar Qwerty Aurora 75 agora/i));

    await waitFor(() => {
      expect(screen.getByText("CHECKOUT PAGE")).toBeDefined();
    });

    const anonCart = JSON.parse(localStorage.getItem("anon_cart") || "[]");
    expect(anonCart).toHaveLength(1);
    expect(anonCart[0].variantId).toBe("v1");
  });

  it("add to cart adds the item without navigating away", async () => {
    renderCard(baseModel());
    fireEvent.click(screen.getByLabelText(/Adicionar Qwerty Aurora 75 ao carrinho/i));

    await waitFor(() => {
      const anonCart = JSON.parse(localStorage.getItem("anon_cart") || "[]");
      expect(anonCart).toHaveLength(1);
    });

    expect(screen.queryByText("CHECKOUT PAGE")).toBeNull();
  });

  it("buy now does NOT navigate to checkout when the add fails (authenticated, stock rejected server-side)", async () => {
    localStorage.setItem("access_token", "token-123");
    localStorage.setItem("refresh_token", "refresh-123");
    vi.mocked(authApi.me).mockResolvedValueOnce({
      success: true,
      message: "OK",
      data: { user: { id: "u1", email: "user@test.com", name: "User", role: "USER" } },
    });
    vi.mocked(cartApi.addItem).mockRejectedValueOnce({
      success: false,
      message: "Estoque insuficiente",
      code: "INSUFFICIENT_STOCK",
    });

    renderCard(baseModel());

    await waitFor(() => {
      expect(screen.getByLabelText(/Comprar Qwerty Aurora 75 agora/i)).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText(/Comprar Qwerty Aurora 75 agora/i));

    await waitFor(() => {
      expect(cartApi.addItem).toHaveBeenCalled();
    });

    expect(screen.queryByText("CHECKOUT PAGE")).toBeNull();
  });
});
