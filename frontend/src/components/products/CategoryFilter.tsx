import { useCategories } from "@/hooks/useCategories";

interface CategoryFilterProps {
  selectedCategoryId: string | undefined;
  onCategoryChange: (categoryId: string | undefined) => void;
}

export function CategoryFilter({ selectedCategoryId, onCategoryChange }: CategoryFilterProps) {
  const { categories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 bg-accent animate-pulse rounded-md shrink-0" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
      <button
        onClick={() => onCategoryChange(undefined)}
        className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
          !selectedCategoryId
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-foreground hover:border-primary/50"
        }`}
      >
        Todas
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            selectedCategoryId === category.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-foreground hover:border-primary/50"
          }`}
        >
          {category.name}
          {category._count.products > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({category._count.products})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
