import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { StockBadge } from '@/components/products/StockBadge';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { Pagination } from '@/components/products/Pagination';
import { SearchInput } from '@/components/products/SearchInput';
import type { PaginationMeta } from '@/types/product';

describe('StockBadge', () => {
  it('shows "Em estoque" when stockQty > 0', () => {
    render(React.createElement(StockBadge, { stockQty: 10 }));
    expect(screen.getByText(/Em estoque/)).toBeDefined();
  });

  it('shows "Esgotado" when stockQty === 0', () => {
    render(React.createElement(StockBadge, { stockQty: 0 }));
    expect(screen.getByText(/Esgotado/)).toBeDefined();
  });
});

describe('PriceDisplay', () => {
  it('shows base price formatted as BRL', () => {
    render(React.createElement(PriceDisplay, { basePrice: 299.9 }));
    expect(screen.getByText(/R\$\s*299,90/)).toBeDefined();
  });

  it('shows sale price with original crossed out', () => {
    render(React.createElement(PriceDisplay, { basePrice: 299.9, salePrice: 249.9 }));
    expect(screen.getByText(/R\$\s*249,90/)).toBeDefined();
    expect(screen.getByText(/R\$\s*299,90/)).toBeDefined();
  });
});

describe('Pagination', () => {
  const meta: PaginationMeta = {
    total: 10,
    page: 2,
    limit: 3,
    totalPages: 4,
    hasNext: true,
    hasPrev: true,
  };

  it('renders page buttons', () => {
    const onPageChange = vi.fn();
    render(React.createElement(Pagination, { meta, onPageChange }));
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('calls onPageChange when clicking a page', () => {
    const onPageChange = vi.fn();
    render(React.createElement(Pagination, { meta, onPageChange }));
    fireEvent.click(screen.getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('does not render when totalPages is 1', () => {
    const singlePage: PaginationMeta = { ...meta, totalPages: 1 };
    const onPageChange = vi.fn();
    const { container } = render(React.createElement(Pagination, { meta: singlePage, onPageChange }));
    expect(container.innerHTML).toBe('');
  });
});

describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('calls onSearch after debounce', async () => {
    vi.useRealTimers();
    const onSearch = vi.fn();
    render(React.createElement(SearchInput, { onSearch }));
    const input = screen.getByPlaceholderText('Buscar produtos...');
    fireEvent.change(input, { target: { value: 'teclado' } });
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('teclado');
    }, { timeout: 600 });
  });
});
