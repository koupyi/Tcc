import { apiClient, ApiResponse } from "./client";
import type { BuilderOptionsResponse, BuilderValidationResult, BuilderAddToCartResult, BuilderCategory } from "@/types/builder";

export interface BuilderItemPayload {
  category: BuilderCategory;
  variantId: string;
  quantity: number;
}

export interface BuilderConfigurationPayload {
  layout: string | null;
  items: BuilderItemPayload[];
}

export const builderApi = {
  getOptions(): Promise<ApiResponse<BuilderOptionsResponse>> {
    return apiClient.get("/builder/options");
  },

  validate(payload: BuilderConfigurationPayload): Promise<ApiResponse<BuilderValidationResult>> {
    return apiClient.post("/builder/validate", payload);
  },

  addToCart(payload: BuilderConfigurationPayload): Promise<ApiResponse<BuilderAddToCartResult>> {
    return apiClient.post("/builder/add-to-cart", payload);
  },
};
