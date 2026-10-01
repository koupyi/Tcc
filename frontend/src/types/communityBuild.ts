/** Mirrors the backend's ResolvedBuild / ResolvedBuildItem shape (GET /community-builds). */
export interface CommunityBuildItem {
  id: string;
  category: string;
  sortOrder: number;
  productId: string;
  productSlug: string;
  productName: string;
  categoryId: string | null;
  variantId: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  stockQty: number;
  available: boolean;
}

export interface CommunityBuild {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  layout: string | null;
  likes: number;
  owner: { id: string; name: string | null };
  items: CommunityBuildItem[];
  totalComponents: number;
  availableComponents: number;
  estimatedPrice: number;
}

export interface AddBuildToCartResult {
  added: Array<{ variantId: string; productName: string; quantity: number }>;
  skipped: Array<{ variantId: string; productName: string; reason: string }>;
  totalComponents: number;
}
