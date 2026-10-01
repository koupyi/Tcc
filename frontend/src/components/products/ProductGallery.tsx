import { useState } from "react";
import type { ProductImage } from "@/types/product";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-accent rounded-lg flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Sem imagem</span>
      </div>
    );
  }

  const currentImage = images[selectedIndex];

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-square bg-accent rounded-lg overflow-hidden flex items-center justify-center">
        <img
          src={currentImage.url}
          alt={currentImage.altText || productName}
          className="w-full h-full object-contain p-4"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setSelectedIndex(index)}
              className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                index === selectedIndex
                  ? "border-primary"
                  : "border-transparent hover:border-border"
              }`}
              aria-label={`Ver imagem ${index + 1}`}
            >
              <img
                src={img.url}
                alt={img.altText || `${productName} - ${index + 1}`}
                className="w-full h-full object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
