import { describe, it, expect } from "vitest";
import { checkCompatibility } from "@/utils/builderCompatibility";

describe("builderCompatibility", () => {
  describe("case", () => {
    it("layout 75 + case 75 → compatible", () => {
      const result = checkCompatibility("case", { layout: "75", switchType: null }, { layout: "75", switchType: null });
      expect(result.compatible).toBe(true);
    });

    it("layout 75 + case 60 → incompatible with reason", () => {
      const result = checkCompatibility("case", { layout: "60", switchType: null }, { layout: "75", switchType: null });
      expect(result.compatible).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it("a case with supportedLayouts covering the chosen layout is compatible", () => {
      const result = checkCompatibility(
        "case",
        { layout: "75", switchType: null, supportedLayouts: ["65", "75"] },
        { layout: "65", switchType: null },
      );
      expect(result.compatible).toBe(true);
    });
  });

  describe("pcb", () => {
    it("PCB compatible with matching layout", () => {
      const result = checkCompatibility("pcb", { layout: "65", switchType: "MX" }, { layout: "65", switchType: null });
      expect(result.compatible).toBe(true);
    });

    it("PCB incompatible with mismatched layout — FAIL + reason", () => {
      const result = checkCompatibility("pcb", { layout: "60", switchType: "MX" }, { layout: "65", switchType: null });
      expect(result.compatible).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it("PCB incompatible with a different switch mount family already locked in", () => {
      const result = checkCompatibility("pcb", { layout: "65", switchType: "MX" }, { layout: "65", switchType: "Optical" });
      expect(result.compatible).toBe(false);
    });
  });

  describe("plate", () => {
    it("plate compatible with matching layout", () => {
      const result = checkCompatibility("plate", { layout: "75", switchType: null }, { layout: "75", switchType: null });
      expect(result.compatible).toBe(true);
    });

    it("plate incompatible with mismatched layout — FAIL + reason", () => {
      const result = checkCompatibility("plate", { layout: "60", switchType: null }, { layout: "75", switchType: null });
      expect(result.compatible).toBe(false);
      expect(result.reason).toBeTruthy();
    });
  });

  describe("switch", () => {
    it("compatible when mount family matches the locked-in context", () => {
      const result = checkCompatibility("switch", { layout: null, switchType: "MX" }, { layout: null, switchType: "MX" });
      expect(result.compatible).toBe(true);
    });

    it("incompatible when mount family differs (optical vs MX)", () => {
      const result = checkCompatibility("switch", { layout: null, switchType: "Optical" }, { layout: null, switchType: "MX" });
      expect(result.compatible).toBe(false);
    });
  });

  describe("keycap", () => {
    it("a keycap set covering a larger layout than the board is compatible", () => {
      const result = checkCompatibility("keycap", { layout: "full", switchType: "MX" }, { layout: "65", switchType: "MX" });
      expect(result.compatible).toBe(true);
    });

    it("a keycap set that only covers 65% is incompatible with a 75% layout", () => {
      const result = checkCompatibility("keycap", { layout: "65", switchType: "MX" }, { layout: "75", switchType: "MX" });
      expect(result.compatible).toBe(false);
    });

    it("incompatible stem family even if layout coverage is fine", () => {
      const result = checkCompatibility("keycap", { layout: "full", switchType: "Optical" }, { layout: "65", switchType: "MX" });
      expect(result.compatible).toBe(false);
    });
  });

  describe("extra", () => {
    it("an extra without a layout constraint is always compatible", () => {
      const result = checkCompatibility("extra", { layout: null, switchType: null }, { layout: "75", switchType: "MX" });
      expect(result.compatible).toBe(true);
    });

    it("a layout-constrained extra (e.g. case foam) is incompatible with a different layout", () => {
      const result = checkCompatibility("extra", { layout: "75", switchType: null }, { layout: "65", switchType: null });
      expect(result.compatible).toBe(false);
    });
  });

  describe("cascade scenario", () => {
    it("a PCB valid for 75% becomes invalid after the layout context changes to 65%", () => {
      const pcbFacts = { layout: "75", switchType: "MX" };
      const before = checkCompatibility("pcb", pcbFacts, { layout: "75", switchType: null });
      const after = checkCompatibility("pcb", pcbFacts, { layout: "65", switchType: null });
      expect(before.compatible).toBe(true);
      expect(after.compatible).toBe(false);
    });
  });
});
