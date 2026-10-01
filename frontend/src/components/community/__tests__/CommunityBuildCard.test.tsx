import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { CartProvider } from "@/context/CartContext";
import { CommunityBuildCard } from "@/components/community/CommunityBuildCard";
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

vi.mock("@/api/communityBuilds", () => ({
  communityBuildsApi: {
    like: vi.fn().mockResolvedValue({ success: true, data: { likes: 235 } }),
    addToCart: vi.fn(),
  },
}));

function makeBuild(overrides: Partial<CommunityBuild> = {}): CommunityBuild {
  return {
    id: "b1",
    title: "Midnight Purple",
    description: "Build de teste",
    imageUrl: "/images/community/midnight-purple.png",
    layout: "65%",
    likes: 234,
    owner: { id: "u1", name: "Comunidade Qwerty" },
    items: [
      { id: "i1", category: "Case", sortOrder: 0, productId: "p1", productSlug: "case-tofu65", productName: "Case Tofu65", categoryId: "c1", variantId: "v1", variantName: "Padrão", sku: "CS-1", imageUrl: null, unitPrice: 599.9, stockQty: 10, available: true },
      { id: "i2", category: "Switch", sortOrder: 1, productId: "p2", productSlug: "gateron-oil-king", productName: "Gateron Oil King", categoryId: "c2", variantId: "v2", variantName: "Padrão", sku: "SW-1", imageUrl: null, unitPrice: 89.9, stockQty: 50, available: true },
    ],
    totalComponents: 2,
    availableComponents: 2,
    estimatedPrice: 689.8,
    ...overrides,
  };
}

function renderCard(build: CommunityBuild) {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AuthProvider,
        null,
        React.createElement(FavoritesProvider, null, React.createElement(CartProvider, null, React.createElement(CommunityBuildCard, { build }))),
      ),
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("CommunityBuildCard", () => {
  it("shows full availability and estimated price for a fully-available build", () => {
    renderCard(makeBuild());
    expect(screen.getByText("2 de 2 componentes disponíveis.")).toBeDefined();
    expect(screen.getByText(/R\$\s*689,80/)).toBeDefined();
    expect(screen.getByLabelText(/Comprar build Midnight Purple/i)).not.toHaveProperty("disabled", true);
  });

  it("shows partial availability and marks the unavailable component", () => {
    const build = makeBuild({
      items: [
        { id: "i1", category: "Case", sortOrder: 0, productId: "p1", productSlug: "case-tofu65", productName: "Case Tofu65", categoryId: "c1", variantId: "v1", variantName: "Padrão", sku: "CS-1", imageUrl: null, unitPrice: 599.9, stockQty: 10, available: true },
        { id: "i2", category: "Switch", sortOrder: 1, productId: "p2", productSlug: "holy-panda", productName: "Holy Panda", categoryId: "c2", variantId: "v2", variantName: "Padrão", sku: "SW-1", imageUrl: null, unitPrice: 129.9, stockQty: 0, available: false },
      ],
      totalComponents: 2,
      availableComponents: 1,
      estimatedPrice: 729.8,
    });
    renderCard(build);
    expect(screen.getByText("1 de 2 componentes disponíveis.")).toBeDefined();
    expect(screen.getByText("Esgotado")).toBeDefined();
  });

  it("disables Comprar build when nothing is available", () => {
    const build = makeBuild({
      items: [{ id: "i1", category: "Switch", sortOrder: 0, productId: "p2", productSlug: "holy-panda", productName: "Holy Panda", categoryId: "c2", variantId: "v2", variantName: "Padrão", sku: "SW-1", imageUrl: null, unitPrice: 129.9, stockQty: 0, available: false }],
      totalComponents: 1,
      availableComponents: 0,
      estimatedPrice: 129.9,
    });
    renderCard(build);
    const buyBtn = screen.getByLabelText(/Comprar build Midnight Purple/i) as HTMLButtonElement;
    expect(buyBtn.disabled).toBe(true);
  });

  it("guest 'Comprar build' adds available components to the local cart", async () => {
    renderCard(makeBuild());
    fireEvent.click(screen.getByLabelText(/Comprar build Midnight Purple/i));

    await waitFor(() => {
      const anonCart = JSON.parse(localStorage.getItem("anon_cart") || "[]");
      expect(anonCart).toHaveLength(2);
    });
  });

  it("links 'Ver build' to the build detail route and 'Montar igual' to a real builder prefill", () => {
    renderCard(makeBuild());
    expect(screen.getByText("Ver build").closest("a")).toHaveProperty("href", expect.stringContaining("/community/b1"));
    const montarIgual = screen.getByText("Montar igual").closest("a");
    expect(montarIgual?.getAttribute("href")).toBe("/builder?communityBuild=b1");
  });
});
