import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { CartProvider } from "@/context/CartContext";
import CommunityBuildDetailPage from "@/pages/CommunityBuildDetailPage";
import type { CommunityBuild } from "@/types/communityBuild";

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

const { partialBuild, alternativeSwitch } = vi.hoisted(() => {
  const partialBuild: CommunityBuild = {
    id: "b1",
    title: "Botanical Garden",
    description: "Build de teste",
    imageUrl: null,
    layout: "60%",
    likes: 189,
    owner: { id: "u1", name: "Comunidade Qwerty" },
    items: [
      { id: "i1", category: "Case", sortOrder: 0, productId: "p1", productSlug: "case-bakeneko60", productName: "Case Bakeneko60", categoryId: "c1", variantId: "v1", variantName: "Padrão", sku: "CS-1", imageUrl: null, unitPrice: 449.9, stockQty: 12, available: true },
      { id: "i2", category: "Switch", sortOrder: 1, productId: "p2", productSlug: "holy-panda", productName: "Holy Panda", categoryId: "c2", variantId: "v2", variantName: "Padrão", sku: "SW-1", imageUrl: null, unitPrice: 129.9, stockQty: 0, available: false },
    ],
    totalComponents: 2,
    availableComponents: 1,
    estimatedPrice: 579.8,
  };

  const alternativeSwitch = {
    id: "p3",
    slug: "gateron-oil-king",
    name: "Gateron Oil King",
    description: null,
    brand: "Gateron",
    sku: "SW-2",
    basePrice: "89.90",
    salePrice: null,
    isFeatured: false,
    isActive: true,
    tags: null,
    specs: null,
    categoryId: "c2",
    category: { id: "c2", name: "Switches", slug: "switches" },
    images: [],
    variants: [{ id: "v3", name: "Padrão", sku: "SW-2-DEFAULT", price: "89.90", stockQty: 40 }],
    _count: { variants: 1 },
  };

  return { partialBuild, alternativeSwitch };
});

vi.mock("@/api/communityBuilds", () => ({
  communityBuildsApi: {
    getById: vi.fn().mockResolvedValue({ success: true, data: partialBuild }),
    like: vi.fn().mockResolvedValue({ success: true, data: { likes: 190 } }),
    addToCart: vi.fn().mockResolvedValue({
      success: true,
      data: { added: [{ variantId: "v1", productName: "Case Bakeneko60", quantity: 1 }], skipped: [], totalComponents: 2 },
    }),
  },
}));

vi.mock("@/api/products", () => ({
  productsApi: {
    list: vi.fn().mockResolvedValue({ success: true, data: [alternativeSwitch] }),
    getBySlug: vi.fn(),
    getById: vi.fn(),
    bestSellers: vi.fn(),
  },
}));

function renderPage(initialRoute = "/community/b1") {
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
              React.createElement(Route, { key: "detail", path: "/community/:id", element: React.createElement(CommunityBuildDetailPage) }),
              React.createElement(Route, { key: "cart", path: "/cart", element: React.createElement("div", null, "CART PAGE") }),
            ]),
          ),
        ),
      ),
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("CommunityBuildDetailPage", () => {
  it("shows the partial-availability message and the out-of-stock component", async () => {
    renderPage();
    expect(await screen.findByText("1 de 2 componentes disponíveis.")).toBeDefined();
    expect(screen.getByText("Esgotado")).toBeDefined();
  });

  it("offers 'Substituir' for the unavailable component and lets the user pick a real alternative", async () => {
    renderPage();
    await screen.findByText("1 de 2 componentes disponíveis.");

    fireEvent.click(screen.getByText("Substituir"));
    const altButton = await screen.findByText("Gateron Oil King");
    fireEvent.click(altButton);

    await waitFor(() => {
      expect(screen.getByText("2 de 2 componentes disponíveis.")).toBeDefined();
    });
    // Estimated price now reflects the substituted (real) price instead of the unavailable one.
    expect(screen.getByText(/R\$\s*539,80/)).toBeDefined();
  });

  it("guest 'Comprar build' adds only available components to the local cart and does not call the bulk endpoint", async () => {
    const { communityBuildsApi } = await import("@/api/communityBuilds");
    renderPage();
    await screen.findByText("1 de 2 componentes disponíveis.");

    fireEvent.click(screen.getByText("Comprar build"));

    await waitFor(() => {
      const anonCart = JSON.parse(localStorage.getItem("anon_cart") || "[]");
      expect(anonCart).toHaveLength(1);
      expect(anonCart[0].variantId).toBe("v1");
    });
    expect(communityBuildsApi.addToCart).not.toHaveBeenCalled();
  });

  it("shows the customize hint and enables substitution for available items when ?customize=1", async () => {
    renderPage("/community/b1?customize=1");
    await screen.findByText("1 de 2 componentes disponíveis.");
    expect(screen.getByText(/Modo personalização/)).toBeDefined();
    // Both items (available Case + unavailable Switch) should offer Substituir in customize mode.
    expect(screen.getAllByText("Substituir")).toHaveLength(2);
  });
});
