import { describe, expect, it } from "vitest";
import { getModelUrl } from "@/components/builder/KeyboardPreview";

describe("KeyboardPreview model selection", () => {
  it("uses the botanical 75% model when the case or keycaps are botanical", () => {
    expect(getModelUrl("75", { productId: "p1", name: "Keycaps PBT Botanical" }, { productId: "p2", name: "Case Botanical" })).toBe("/Teclado%2075%25%20botanical.glb");
  });

  it("keeps the generic 75% model for standard layouts", () => {
    expect(getModelUrl("75", { productId: "p1", name: "PBT Black" }, null)).toBe("/teclado-75-base.glb");
  });
});
