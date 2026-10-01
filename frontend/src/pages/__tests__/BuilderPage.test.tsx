import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { CartProvider } from "@/context/CartContext";
import BuilderPage from "@/pages/BuilderPage";
import type { BuilderOptionsResponse } from "@/types/builder";

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

const { mockOptions } = vi.hoisted(() => {
  const mockOptions: BuilderOptionsResponse = {
    layouts: ["60", "65", "75"],
    options: {
      case: [
        { productId: "p-case-75", variantId: "v-case-75", category: "case", slug: "case-75", name: "Case Modular 75%", variantName: "Padrão", imageUrl: null, unitPrice: 600, stockQty: 5, layout: "75", switchType: null, specs: null },
        { productId: "p-case-60", variantId: "v-case-60", category: "case", slug: "case-60", name: "Case Compacto 60%", variantName: "Padrão", imageUrl: null, unitPrice: 400, stockQty: 5, layout: "60", switchType: null, specs: null },
      ],
      pcb: [
        { productId: "p-pcb-75", variantId: "v-pcb-75", category: "pcb", slug: "pcb-75", name: "PCB Hotswap 75%", variantName: "Padrão", imageUrl: null, unitPrice: 350, stockQty: 5, layout: "75", switchType: "MX", specs: null },
      ],
      plate: [
        { productId: "p-plate-75", variantId: "v-plate-75", category: "plate", slug: "plate-75", name: "Plate Alumínio 75%", variantName: "Padrão", imageUrl: null, unitPrice: 150, stockQty: 5, layout: "75", switchType: null, specs: null },
      ],
      switch: [
        { productId: "p-sw-mx", variantId: "v-sw-mx", category: "switch", slug: "sw-mx", name: "Gateron Oil King", variantName: "Padrão", imageUrl: null, unitPrice: 90, stockQty: 20, layout: null, switchType: "MX", specs: { packSize: 10 } },
        { productId: "p-sw-optical", variantId: "v-sw-optical", category: "switch", slug: "sw-optical", name: "Switch Óptico", variantName: "Padrão", imageUrl: null, unitPrice: 70, stockQty: 20, layout: null, switchType: "Optical", specs: { packSize: 10 } },
      ],
      keycap: [
        { productId: "p-kc-75", variantId: "v-kc-75", category: "keycap", slug: "kc-75", name: "Keycaps GMK Laser", variantName: "Padrão", imageUrl: null, unitPrice: 350, stockQty: 10, layout: "full", switchType: "MX", specs: null },
      ],
      extra: [
        { productId: "p-extra-cable", variantId: "v-extra-cable", category: "extra", slug: "extra-cable", name: "Cabo Coiled", variantName: "Padrão", imageUrl: null, unitPrice: 150, stockQty: 10, layout: null, switchType: null, specs: null },
        { productId: "p-extra-deskmat", variantId: "v-extra-deskmat", category: "extra", slug: "extra-deskmat", name: "Deskmat", variantName: "Padrão", imageUrl: null, unitPrice: 90, stockQty: 10, layout: null, switchType: null, specs: null },
      ],
    },
  };
  return { mockOptions };
});

vi.mock("@/api/builder", () => ({
  builderApi: {
    getOptions: vi.fn().mockResolvedValue({ success: true, data: mockOptions }),
    validate: vi.fn(),
    addToCart: vi.fn(),
  },
}));

vi.mock("@/api/communityBuilds", () => ({
  communityBuildsApi: {
    getById: vi.fn(),
    list: vi.fn(),
    like: vi.fn(),
    addToCart: vi.fn(),
  },
}));

import { builderApi } from "@/api/builder";
import { communityBuildsApi } from "@/api/communityBuilds";

function renderBuilder(initialRoute = "/builder") {
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
              React.createElement(Route, { key: "builder", path: "/builder", element: React.createElement(BuilderPage) }),
              React.createElement(Route, { key: "cart", path: "/cart", element: React.createElement("div", null, "CART PAGE") }),
            ]),
          ),
        ),
      ),
    ),
  );
}

async function selectLayout75() {
  fireEvent.click(await screen.findByText("75%"));
}

function goNext() {
  fireEvent.click(screen.getByText("Próximo"));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(builderApi.getOptions).mockResolvedValue({ success: true, message: "ok", data: mockOptions });
});

describe("BuilderPage", () => {
  it("loads real catalog options — every option has a real productId/variantId (no phantom items)", async () => {
    renderBuilder();
    await screen.findByText("1. Layout");
    expect(builderApi.getOptions).toHaveBeenCalled();
    for (const list of Object.values(mockOptions.options)) {
      for (const opt of list) {
        expect(opt.productId).toBeTruthy();
        expect(opt.variantId).toBeTruthy();
      }
    }
  });

  it("navigates through steps via the stepper progression", async () => {
    renderBuilder();
    await screen.findByText("1. Layout");
    await selectLayout75();
    goNext();
    expect(await screen.findByText("2. Case")).toBeDefined();
    goNext();
    expect(await screen.findByText("3. PCB")).toBeDefined();
  });

  it("filters out an incompatible case for the chosen layout (never silently selectable)", async () => {
    renderBuilder();
    await screen.findByText("1. Layout");
    await selectLayout75();
    goNext();
    await screen.findByText("2. Case");

    const incompatibleCard = screen.getByText("Case Compacto 60%").closest("button");
    expect(incompatibleCard).toHaveProperty("disabled", true);
    expect(screen.getByText("Este case não é compatível com o layout selecionado.")).toBeDefined();
  });

  it("updates the real-time total when selecting and deselecting a component", async () => {
    renderBuilder();
    await screen.findByText("1. Layout");
    await selectLayout75();
    goNext();
    await screen.findByText("2. Case");

    const total = () => screen.getByTestId("builder-total");
    expect(total()).toHaveTextContent("R$ 0,00");

    const caseCard = () => screen.getByRole("button", { name: /Case Modular 75%/ });
    fireEvent.click(caseCard());
    await waitFor(() => {
      expect(total()).toHaveTextContent("R$ 600,00");
    });

    fireEvent.click(caseCard()); // toggle off
    await waitFor(() => {
      expect(total()).toHaveTextContent("R$ 0,00");
    });
  });

  it("allows multiple extras to coexist and both contribute to the total", async () => {
    renderBuilder();
    await screen.findByText("1. Layout");
    await selectLayout75();
    for (let i = 0; i < 6; i++) goNext(); // Layout->Case->PCB->Plate->Switches->Keycaps->Extras
    expect(await screen.findByText("7. Extras")).toBeDefined();

    fireEvent.click(screen.getByText("Cabo Coiled"));
    fireEvent.click(screen.getByText("Deskmat"));

    await waitFor(() => {
      expect(screen.getByTestId("builder-total")).toHaveTextContent("R$ 240,00"); // 150 + 90
    });
  });

  it("cascade-invalidates a downstream selection when the layout changes, with an explanatory message", async () => {
    renderBuilder();
    await screen.findByText("1. Layout");
    await selectLayout75();
    goNext();
    await screen.findByText("2. Case");
    fireEvent.click(screen.getByRole("button", { name: /Case Modular 75%/ }));
    await waitFor(() => expect(screen.getByTestId("builder-total")).toHaveTextContent("R$ 600,00"));

    fireEvent.click(screen.getByRole("button", { name: /^Layout$/ })); // stepper jump back to step 1
    await screen.findByText("1. Layout");
    fireEvent.click(await screen.findByText("60%"));

    await waitFor(() => {
      expect(screen.getByTestId("builder-total")).toHaveTextContent("R$ 0,00");
    });
  });

  it("guest: completing a full build and adding to cart produces only real-variant anon_cart items", async () => {
    vi.mocked(builderApi.validate).mockResolvedValue({
      success: true,
      message: "ok",
      data: {
        valid: true,
        missingRequired: [],
        items: [
          { category: "case", variantId: "v-case-75", quantity: 1, valid: true, productName: "Case Modular 75%", unitPrice: 600 },
          { category: "pcb", variantId: "v-pcb-75", quantity: 1, valid: true, productName: "PCB Hotswap 75%", unitPrice: 350 },
          { category: "plate", variantId: "v-plate-75", quantity: 1, valid: true, productName: "Plate Alumínio 75%", unitPrice: 150 },
          { category: "switch", variantId: "v-sw-mx", quantity: 9, valid: true, productName: "Gateron Oil King", unitPrice: 90 },
          { category: "keycap", variantId: "v-kc-75", quantity: 1, valid: true, productName: "Keycaps GMK Laser", unitPrice: 350 },
        ],
      },
    });

    renderBuilder();
    await screen.findByText("1. Layout");
    await selectLayout75();
    goNext();
    await screen.findByText("2. Case");
    fireEvent.click(screen.getByText("Case Modular 75%"));
    goNext();
    await screen.findByText("3. PCB");
    fireEvent.click(screen.getByText("PCB Hotswap 75%"));
    goNext();
    await screen.findByText("4. Plate");
    fireEvent.click(screen.getByText("Plate Alumínio 75%"));
    goNext();
    await screen.findByText("5. Switches");
    fireEvent.click(screen.getByText("Gateron Oil King"));
    goNext();
    await screen.findByText("6. Keycaps");
    fireEvent.click(screen.getByText("Keycaps GMK Laser"));
    goNext();
    await screen.findByText("7. Extras");
    goNext();
    await screen.findByText("8. Revisão");

    const submit = screen.getByText("Adicionar configuração ao carrinho");
    expect(submit).not.toHaveProperty("disabled", true);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText("CART PAGE")).toBeDefined();
    });

    const anonCart = JSON.parse(localStorage.getItem("anon_cart") || "[]");
    expect(anonCart.length).toBe(5);
    for (const item of anonCart) {
      expect(item.variantId).toBeTruthy();
    }
  });

  it("guest: an invalid configuration on submit shows reasons and does not navigate or touch the cart", async () => {
    vi.mocked(builderApi.validate).mockResolvedValue({
      success: true,
      message: "ok",
      data: {
        valid: false,
        missingRequired: [],
        items: [
          { category: "case", variantId: "v-case-75", quantity: 1, valid: false, reason: "Estoque insuficiente. Disponível: 0" },
        ],
      },
    });

    renderBuilder();
    await screen.findByText("1. Layout");
    await selectLayout75();
    goNext();
    await screen.findByText("2. Case");
    fireEvent.click(screen.getByText("Case Modular 75%"));
    goNext();
    await screen.findByText("3. PCB");
    fireEvent.click(screen.getByText("PCB Hotswap 75%"));
    goNext();
    await screen.findByText("4. Plate");
    fireEvent.click(screen.getByText("Plate Alumínio 75%"));
    goNext();
    await screen.findByText("5. Switches");
    fireEvent.click(screen.getByText("Gateron Oil King"));
    goNext();
    await screen.findByText("6. Keycaps");
    fireEvent.click(screen.getByText("Keycaps GMK Laser"));
    goNext();
    await screen.findByText("7. Extras");
    goNext();
    await screen.findByText("8. Revisão");

    fireEvent.click(screen.getByText("Adicionar configuração ao carrinho"));

    await waitFor(() => {
      expect(screen.getByText("Estoque insuficiente. Disponível: 0")).toBeDefined();
    });
    expect(screen.queryByText("CART PAGE")).toBeNull();
    expect(JSON.parse(localStorage.getItem("anon_cart") || "[]")).toHaveLength(0);
  });

  it("community prefill: pre-selects real available variants and flags an unavailable one", async () => {
    vi.mocked(communityBuildsApi.getById).mockResolvedValue({
      success: true,
      message: "ok",
      data: {
        id: "b1",
        title: "Some Build",
        description: null,
        imageUrl: null,
        layout: "75%",
        likes: 10,
        owner: { id: "u1", name: "Someone" },
        items: [
          { id: "i1", category: "Case", sortOrder: 0, productId: "p-case-75", productSlug: "case-75", productName: "Case Modular 75%", categoryId: "c1", variantId: "v-case-75", variantName: "Padrão", sku: "SKU1", imageUrl: null, unitPrice: 600, stockQty: 5, available: true },
          { id: "i2", category: "Switch", sortOrder: 1, productId: "p-sw-unknown", productSlug: "sw-unknown", productName: "Switch Raro Descontinuado", categoryId: "c2", variantId: "v-sw-unknown", variantName: "Padrão", sku: "SKU2", imageUrl: null, unitPrice: 100, stockQty: 0, available: false },
        ],
        totalComponents: 2,
        availableComponents: 1,
        estimatedPrice: 700,
      },
    });

    renderBuilder("/builder?communityBuild=b1");
    await screen.findByText("1. Layout");

    await waitFor(() => {
      expect(screen.getByTestId("builder-total")).toHaveTextContent("R$ 600,00"); // prefilled case reflected in the summary total
    });

    expect(communityBuildsApi.getById).toHaveBeenCalledWith("b1");
  });
});
