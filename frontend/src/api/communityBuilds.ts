import { apiClient, ApiResponse } from "./client";
import type { AddBuildToCartResult, CommunityBuild } from "@/types/communityBuild";

export const communityBuildsApi = {
  list(limit?: number): Promise<ApiResponse<CommunityBuild[]>> {
    return apiClient.get("/community-builds", limit ? { limit: String(limit) } : undefined);
  },

  getById(id: string): Promise<ApiResponse<CommunityBuild>> {
    return apiClient.get(`/community-builds/${id}`);
  },

  like(id: string): Promise<ApiResponse<{ likes: number }>> {
    return apiClient.post(`/community-builds/${id}/like`);
  },

  /** Authenticated-only atomic bulk add — backend revalidates price/stock fresh at write time. */
  addToCart(id: string): Promise<ApiResponse<AddBuildToCartResult>> {
    return apiClient.post(`/community-builds/${id}/add-to-cart`);
  },
};
