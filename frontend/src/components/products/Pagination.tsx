import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/types/product";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  if (meta.totalPages <= 1) return null;

  const pages: number[] = [];
  for (let i = 1; i <= meta.totalPages; i++) {
    pages.push(i);
  }

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Paginação">
      <button
        onClick={() => onPageChange(meta.page - 1)}
        disabled={!meta.hasPrev}
        className="p-2 rounded-md text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            page === meta.page
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-accent"
          }`}
          aria-label={`Página ${page}`}
          aria-current={page === meta.page ? "page" : undefined}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(meta.page + 1)}
        disabled={!meta.hasNext}
        className="p-2 rounded-md text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
