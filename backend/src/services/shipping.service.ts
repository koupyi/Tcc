/**
 * Shipping Provider interface — allows future replacement with real carriers.
 */
export interface ShippingOption {
  id: string;
  code: string;
  name: string;
  carrier: string;
  price: number;
  days: number;
  description: string;
}

export interface ShippingProvider {
  calculateOptions(zipCode: string): ShippingOption[];
}

/**
 * Mock Shipping Provider — deterministic fixed-table calculation.
 * Returns multiple options (Econômico + Expresso) per region.
 * Designed to be swapped with CorreiosProvider, JadlogProvider, etc.
 */
export class MockShippingProvider implements ShippingProvider {
  private static readonly REGIONS: Array<{
    range: [number, number];
    region: string;
    basePrice: number;
    baseDays: number;
  }> = [
    { range: [1, 9], region: 'SP Capital', basePrice: 10.0, baseDays: 2 },
    { range: [10, 19], region: 'SP Interior', basePrice: 15.0, baseDays: 4 },
    { range: [20, 28], region: 'Rio de Janeiro', basePrice: 15.0, baseDays: 4 },
    { range: [29, 29], region: 'Espírito Santo', basePrice: 18.0, baseDays: 5 },
    { range: [30, 39], region: 'Minas Gerais', basePrice: 15.0, baseDays: 4 },
    { range: [40, 48], region: 'Bahia', basePrice: 22.0, baseDays: 6 },
    { range: [49, 49], region: 'Sergipe', basePrice: 22.0, baseDays: 6 },
    { range: [50, 56], region: 'Pernambuco', basePrice: 25.0, baseDays: 7 },
    { range: [57, 57], region: 'Alagoas', basePrice: 25.0, baseDays: 7 },
    { range: [58, 58], region: 'Paraíba', basePrice: 25.0, baseDays: 7 },
    { range: [59, 59], region: 'Rio Grande do Norte', basePrice: 25.0, baseDays: 7 },
    { range: [60, 63], region: 'Ceará', basePrice: 25.0, baseDays: 7 },
    { range: [64, 64], region: 'Piauí', basePrice: 28.0, baseDays: 8 },
    { range: [65, 65], region: 'Maranhão', basePrice: 28.0, baseDays: 8 },
    { range: [66, 68], region: 'Pará', basePrice: 30.0, baseDays: 9 },
    { range: [69, 69], region: 'Amazonas', basePrice: 35.0, baseDays: 10 },
    { range: [70, 72], region: 'Distrito Federal / Goiás', basePrice: 20.0, baseDays: 5 },
    { range: [73, 76], region: 'Goiás / Tocantins', basePrice: 22.0, baseDays: 6 },
    { range: [77, 77], region: 'Tocantins', basePrice: 25.0, baseDays: 7 },
    { range: [78, 78], region: 'Mato Grosso', basePrice: 22.0, baseDays: 6 },
    { range: [79, 79], region: 'Mato Grosso do Sul', basePrice: 20.0, baseDays: 5 },
    { range: [80, 87], region: 'Paraná', basePrice: 18.0, baseDays: 5 },
    { range: [88, 89], region: 'Santa Catarina', basePrice: 18.0, baseDays: 5 },
    { range: [90, 99], region: 'Rio Grande do Sul', basePrice: 20.0, baseDays: 6 },
  ];

  private static readonly DEFAULT_BASE = { basePrice: 25.0, baseDays: 7 };

  calculateOptions(zipCode: string): ShippingOption[] {
    const cleaned = zipCode.replace(/\D/g, '');
    if (cleaned.length !== 8) {
      return this.buildOptions(MockShippingProvider.DEFAULT_BASE.basePrice, MockShippingProvider.DEFAULT_BASE.baseDays);
    }

    const prefix = parseInt(cleaned.substring(0, 2), 10);

    for (const region of MockShippingProvider.REGIONS) {
      if (prefix >= region.range[0] && prefix <= region.range[1]) {
        return this.buildOptions(region.basePrice, region.baseDays);
      }
    }

    return this.buildOptions(MockShippingProvider.DEFAULT_BASE.basePrice, MockShippingProvider.DEFAULT_BASE.baseDays);
  }

  private buildOptions(basePrice: number, baseDays: number): ShippingOption[] {
    return [
      {
        id: 'economico',
        code: 'ECONOMICO',
        name: 'Econômico',
        carrier: 'KeyCaps Express',
        price: basePrice,
        days: baseDays,
        description: `Entrega em ${baseDays} dias úteis`,
      },
      {
        id: 'expresso',
        code: 'EXPRESSO',
        name: 'Expresso',
        carrier: 'KeyCaps Express',
        price: Number((basePrice * 1.8).toFixed(2)),
        days: Math.max(1, Math.ceil(baseDays * 0.5)),
        description: `Entrega em ${Math.max(1, Math.ceil(baseDays * 0.5))} dias úteis`,
      },
    ];
  }
}

/**
 * ShippingService — calculates shipping options and validates selections.
 * Uses a ShippingProvider for the actual calculation.
 */
export class ShippingService {
  private provider: ShippingProvider;

  constructor(provider?: ShippingProvider) {
    this.provider = provider || new MockShippingProvider();
  }

  /**
   * Calculate multiple shipping options for a given ZIP code.
   */
  calculateOptions(zipCode: string): ShippingOption[] {
    return this.provider.calculateOptions(zipCode);
  }

  /**
   * Legacy: calculate single option (backward compatible).
   * Returns the cheapest option.
   */
  calculate(zipCode: string): { name: string; price: number; days: number } {
    const options = this.calculateOptions(zipCode);
    const cheapest = options[0] || { name: 'Padrão', price: 25, days: 7 };
    return { name: cheapest.name, price: cheapest.price, days: cheapest.days };
  }

  /**
   * Validate that a shipping option code is valid for the given ZIP.
   * Returns the option if valid, null otherwise.
   */
  validateOption(zipCode: string, optionCode: string): ShippingOption | null {
    const options = this.calculateOptions(zipCode);
    return options.find((o) => o.code === optionCode) || null;
  }

  /**
   * Generate a deterministic tracking code for sandbox/mock.
   */
  generateTrackingCode(orderId: string): string {
    const hash = orderId.replace(/-/g, '').substring(0, 8).toUpperCase();
    return `KC${hash}BR`;
  }
}
