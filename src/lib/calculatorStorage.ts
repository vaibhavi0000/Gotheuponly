import { CalculatedProduct, CustomCostField, DEFAULT_SETTINGS, CalculatorSettings } from '../types/calculator.ts';
import { computeProductMetrics } from './calculatorEngine.ts';

const STORAGE_KEY_PRODUCTS = 'tsukuri_calc_products_v2';
const STORAGE_KEY_SETTINGS = 'tsukuri_calc_settings_v2';

const BASE_PRESETS: CalculatedProduct[] = [
  {
    id: 'prod-dragon-1',
    name: 'Articulated Crystal Dragon',
    category: 'Toys & Fidgets',
    notes: 'Silk dual-color PLA, 0.2mm layer height. Best seller at local pop-ups & online store.',
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    filamentType: 'Silk Dual-Color PLA',
    filamentWeightGrams: 145,
    filamentCostPerKg: 1600,
    printTimeHours: 6.5,
    printerWattage: 160,
    electricityRatePerKwh: 8.5,
    machineDepreciationPerHour: 20,
    failureRatePercent: 4,
    laborHours: 0.25,
    laborRatePerHour: 120,
    postProcessingCost: 15,
    packagingCost: 35,
    shippingCost: 50,
    platformFeePercent: 4,
    taxPercent: 0,
    sellingPrice: 799,
    customFields: [
      { id: 'cf-1', name: 'Branded Rigid Box & Straw Wrap', value: 20, type: 'fixed' },
      { id: 'cf-2', name: 'Thank-you Card & QR Sticker', value: 8, type: 'fixed' },
    ],
    unitsSold: 48,
    targetMonthlySales: 50,
    materialCost: 0,
    electricityCost: 0,
    machineCost: 0,
    laborCost: 0,
    customCostsTotal: 0,
    totalCostPerUnit: 0,
    profitPerUnit: 0,
    profitMarginPercent: 0,
    totalRevenue: 0,
    totalProfit: 0,
  },
  {
    id: 'prod-planter-2',
    name: 'Parametric Ribbed Self-Watering Planter',
    category: 'Home & Living',
    notes: 'Matte Matcha Green PLA with leak-proof inner basin. High margin home decor piece.',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    filamentType: 'Matte Matcha PLA',
    filamentWeightGrams: 190,
    filamentCostPerKg: 1450,
    printTimeHours: 7.2,
    printerWattage: 150,
    electricityRatePerKwh: 8.5,
    machineDepreciationPerHour: 20,
    failureRatePercent: 3,
    laborHours: 0.3,
    laborRatePerHour: 120,
    postProcessingCost: 20,
    packagingCost: 40,
    shippingCost: 60,
    platformFeePercent: 5,
    taxPercent: 0,
    sellingPrice: 899,
    customFields: [
      { id: 'cf-3', name: 'Absorbent Cotton Wick & Mesh', value: 15, type: 'fixed' },
    ],
    unitsSold: 32,
    targetMonthlySales: 30,
    materialCost: 0,
    electricityCost: 0,
    machineCost: 0,
    laborCost: 0,
    customCostsTotal: 0,
    totalCostPerUnit: 0,
    profitPerUnit: 0,
    profitMarginPercent: 0,
    totalRevenue: 0,
    totalProfit: 0,
  },
  {
    id: 'prod-keycaps-3',
    name: 'Artisan Mechanical Keyboard Keycaps (Set of 4)',
    category: 'Desk & Tech',
    notes: 'UV-cured silk PLA, Cherry MX fit. Very high profit margin per gram of filament.',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    filamentType: 'Silk Obsidian & Gold PLA',
    filamentWeightGrams: 28,
    filamentCostPerKg: 1800,
    printTimeHours: 1.8,
    printerWattage: 120,
    electricityRatePerKwh: 8.5,
    machineDepreciationPerHour: 20,
    failureRatePercent: 6,
    laborHours: 0.4,
    laborRatePerHour: 120,
    postProcessingCost: 25,
    packagingCost: 30,
    shippingCost: 40,
    platformFeePercent: 4,
    taxPercent: 0,
    sellingPrice: 649,
    customFields: [
      { id: 'cf-4', name: 'Tin Metal Case & Custom Foam', value: 35, type: 'fixed' },
    ],
    unitsSold: 65,
    targetMonthlySales: 60,
    materialCost: 0,
    electricityCost: 0,
    machineCost: 0,
    laborCost: 0,
    customCostsTotal: 0,
    totalCostPerUnit: 0,
    profitPerUnit: 0,
    profitMarginPercent: 0,
    totalRevenue: 0,
    totalProfit: 0,
  },
  {
    id: 'prod-headphone-4',
    name: 'Torii Minimalist Headphone Stand',
    category: 'Desk & Tech',
    notes: 'Architectural desk stand. Sturdy 25% gyroid infill, heavy terracotta PETG.',
    createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    filamentType: 'Terracotta Matte PETG',
    filamentWeightGrams: 320,
    filamentCostPerKg: 1350,
    printTimeHours: 9.5,
    printerWattage: 180,
    electricityRatePerKwh: 8.5,
    machineDepreciationPerHour: 22,
    failureRatePercent: 4,
    laborHours: 0.2,
    laborRatePerHour: 120,
    postProcessingCost: 15,
    packagingCost: 45,
    shippingCost: 70,
    platformFeePercent: 5,
    taxPercent: 0,
    sellingPrice: 1299,
    customFields: [
      { id: 'cf-5', name: 'Anti-slip Silicone Rubber Feet (4x)', value: 12, type: 'fixed' },
    ],
    unitsSold: 21,
    targetMonthlySales: 25,
    materialCost: 0,
    electricityCost: 0,
    machineCost: 0,
    laborCost: 0,
    customCostsTotal: 0,
    totalCostPerUnit: 0,
    profitPerUnit: 0,
    profitMarginPercent: 0,
    totalRevenue: 0,
    totalProfit: 0,
  },
  {
    id: 'prod-lamp-5',
    name: 'Origami Lithophane Ambient Lamp',
    category: 'Home & Living',
    notes: 'Fine 0.12mm layers with warm LED USB-C puck base.',
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    filamentType: 'Translucent Opal PLA',
    filamentWeightGrams: 230,
    filamentCostPerKg: 1500,
    printTimeHours: 10.0,
    printerWattage: 160,
    electricityRatePerKwh: 8.5,
    machineDepreciationPerHour: 20,
    failureRatePercent: 5,
    laborHours: 0.5,
    laborRatePerHour: 120,
    postProcessingCost: 20,
    packagingCost: 50,
    shippingCost: 80,
    platformFeePercent: 5,
    taxPercent: 0,
    sellingPrice: 1499,
    customFields: [
      { id: 'cf-6', name: 'USB-C 3-Step Warm LED Light Puck', value: 160, type: 'fixed' },
    ],
    unitsSold: 18,
    targetMonthlySales: 20,
    materialCost: 0,
    electricityCost: 0,
    machineCost: 0,
    laborCost: 0,
    customCostsTotal: 0,
    totalCostPerUnit: 0,
    profitPerUnit: 0,
    profitMarginPercent: 0,
    totalRevenue: 0,
    totalProfit: 0,
  },
];

export function recalculateStoredProduct(p: CalculatedProduct): CalculatedProduct {
  const breakdown = computeProductMetrics({
    filamentWeightGrams: p.filamentWeightGrams,
    filamentCostPerKg: p.filamentCostPerKg,
    printTimeHours: p.printTimeHours,
    printerWattage: p.printerWattage,
    electricityRatePerKwh: p.electricityRatePerKwh,
    machineDepreciationPerHour: p.machineDepreciationPerHour,
    failureRatePercent: p.failureRatePercent,
    laborHours: p.laborHours,
    laborRatePerHour: p.laborRatePerHour,
    postProcessingCost: p.postProcessingCost,
    packagingCost: p.packagingCost,
    shippingCost: p.shippingCost,
    platformFeePercent: p.platformFeePercent,
    taxPercent: p.taxPercent,
    sellingPrice: p.sellingPrice,
    customFields: p.customFields || [],
    unitsSold: p.unitsSold || 0,
  });

  return {
    ...p,
    materialCost: Math.round(breakdown.materialCost * 100) / 100,
    electricityCost: Math.round(breakdown.electricityCost * 100) / 100,
    machineCost: Math.round(breakdown.machineDepreciationCost * 100) / 100,
    laborCost: Math.round(breakdown.laborCost * 100) / 100,
    customCostsTotal: Math.round(breakdown.customCostsTotal * 100) / 100,
    totalCostPerUnit: Math.round(breakdown.totalCostPerUnit * 100) / 100,
    profitPerUnit: Math.round(breakdown.profitPerUnit * 100) / 100,
    profitMarginPercent: Math.round(breakdown.profitMarginPercent * 10) / 10,
    totalRevenue: Math.round(breakdown.totalRevenue),
    totalProfit: Math.round(breakdown.totalProfit),
  };
}

export const INITIAL_PRESET_PRODUCTS: CalculatedProduct[] = BASE_PRESETS.map((p) =>
  recalculateStoredProduct(p)
);

export function loadCalculatorProducts(): CalculatedProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(recalculateStoredProduct);
      }
    }
  } catch (e) {
    console.warn('Failed to load calculator products from localStorage:', e);
  }
  return INITIAL_PRESET_PRODUCTS;
}

export function saveCalculatorProducts(products: CalculatedProduct[]): void {
  try {
    const computed = products.map(recalculateStoredProduct);
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(computed));
  } catch (e) {
    console.warn('Failed to save calculator products:', e);
  }
}

export function loadCalculatorSettings(): CalculatorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveCalculatorSettings(settings: CalculatorSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {}
}
