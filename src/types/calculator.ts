export type PartnerName = 'Aditya' | 'Anshuman';

export interface PartnerSession {
  username: PartnerName;
  authenticatedAt: string;
  token: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: PartnerName;
  action:
    | 'LOGIN'
    | 'CREATE_PRODUCT'
    | 'UPDATE_PRODUCT'
    | 'DELETE_PRODUCT'
    | 'UPDATE_PRICE'
    | 'UPDATE_SALES'
    | 'CREATE_CATEGORY'
    | 'DELETE_CATEGORY'
    | 'RESET_CATALOG';
  entityId?: string;
  entityName?: string;
  details: string;
}

export interface CustomCostField {
  id: string;
  name: string;
  value: number; // In ₹ or user's currency
  type: 'fixed' | 'per_gram' | 'per_hour'; // whether it scales or is a flat cost
}

export interface CalculatedProduct {
  id: string;
  name: string;
  category: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: PartnerName;

  // 3D Print Machine & Material parameters
  filamentType: string;
  filamentWeightGrams: number;
  filamentCostPerKg: number; // e.g. ₹1200 / kg

  printTimeHours: number;
  printerWattage: number; // e.g. 150W
  electricityRatePerKwh: number; // e.g. ₹8.5 / kWh

  machineDepreciationPerHour: number; // e.g. ₹20 / hr
  failureRatePercent: number; // e.g. 5% contingency for misprints

  // Labor & Finishing
  laborHours: number; // e.g. 0.3 hrs
  laborRatePerHour: number; // e.g. ₹100 / hr
  postProcessingCost: number; // e.g. ₹25 (alcohol, sanding, primer, magnets)

  // Packaging & Logistics
  packagingCost: number; // e.g. ₹30 (box, bubble wrap, stickers)
  shippingCost: number; // e.g. ₹60 or 0 if customer pays

  // Platform & Taxes
  platformFeePercent: number; // e.g. 8% (Shopify/Payment gateway/Amazon)
  taxPercent: number; // e.g. 18% GST (or 0)

  // Target or Actual Selling Price (Accepts ANY custom decimal or integer)
  sellingPrice: number; // e.g. ₹599

  // Custom User-Defined Cost Fields
  customFields: CustomCostField[];

  // Sales & Performance Tracking
  unitsSold: number; // Total units sold
  targetMonthlySales: number; // Target monthly volume

  // Computed summary fields for quick querying & sorting
  materialCost: number;
  electricityCost: number;
  machineCost: number;
  laborCost: number;
  customCostsTotal: number;
  totalCostPerUnit: number;
  profitPerUnit: number;
  profitMarginPercent: number; // (profitPerUnit / sellingPrice) * 100
  totalRevenue: number; // unitsSold * sellingPrice
  totalProfit: number; // unitsSold * profitPerUnit
}

export interface CalculatorSettings {
  currencySymbol: string;
  defaultFilamentCostPerKg: number;
  defaultElectricityRatePerKwh: number;
  defaultPrinterWattage: number;
  defaultMachineDepreciationPerHour: number;
  defaultLaborRatePerHour: number;
  defaultFailureRatePercent: number;
  defaultPlatformFeePercent: number;
  defaultTaxPercent: number;
}

export const DEFAULT_SETTINGS: CalculatorSettings = {
  currencySymbol: '₹',
  defaultFilamentCostPerKg: 1300,
  defaultElectricityRatePerKwh: 8.5,
  defaultPrinterWattage: 150,
  defaultMachineDepreciationPerHour: 20,
  defaultLaborRatePerHour: 120,
  defaultFailureRatePercent: 5,
  defaultPlatformFeePercent: 3,
  defaultTaxPercent: 0,
};
