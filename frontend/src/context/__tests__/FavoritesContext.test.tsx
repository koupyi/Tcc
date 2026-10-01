import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider, useFavorites } from "@/context/FavoritesContext";

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

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, React.createElement(FavoritesProvider, null, children));

beforeEach(() => {
  localStorage.clear();
});

describe("FavoritesContext", () => {
  it("starts with nothing favorited", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.isFavorite("p1")).toBe(false));
  });

  it("toggling adds then removes, persisting to localStorage under the guest key", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.isFavorite("p1")).toBe(false));

    act(() => result.current.toggleFavorite("p1", "Produto 1"));
    await waitFor(() => expect(result.current.isFavorite("p1")).toBe(true));
    expect(JSON.parse(localStorage.getItem("favorites_guest") || "[]")).toEqual(["p1"]);

    act(() => result.current.toggleFavorite("p1", "Produto 1"));
    await waitFor(() => expect(result.current.isFavorite("p1")).toBe(false));
    expect(JSON.parse(localStorage.getItem("favorites_guest") || "[]")).toEqual([]);
  });
});
