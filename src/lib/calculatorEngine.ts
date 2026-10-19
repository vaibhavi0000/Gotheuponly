import { CalculatedProduct, CustomCostField } from '../types/calculator.ts';

export interface CalculationBreakdown {
  materialCost: number;
  electricityKwh: number;
  electricityCost: number;
  machineDepreciationCost: number;
  failureContingencyCost: number;
  laborCost: number;
  directProductionCost: number;

  postProcessingCost: number;
  packagingCost: number;
  shippingCost: number;
  fulfillmentCost: number;

  customCostsTotal: number;
  customFieldBreakdown: { name: string; amount: number }[];

  subtotalCost: number;
  platformFeeAmount: number;
  taxAmount: number;
  totalCostPerUnit: number;

  sellingPrice: number;
  profitPerUnit: number;
  profitMarginPercent: number;
  markupPercent: number;

  // Volume & Sales tracking
  unitsSold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;

  // Recommended selling prices at various target margins
  suggestedPrices: {
    margin30: number;
    margin50: number;
    margin65: number;
    margin80: number;
  };
}

export function computeProductMetrics(input: {
  filamentWeightGrams: number;
  filamentCostPerKg: number;
  printTimeHours: number;
  printerWattage: number;
  electricityRatePerKwh: number;
  machineDepreciationPerHour: number;
  failureRatePercent: number;
  laborHours: number;
  laborRatePerHour: number;
  postProcessingCost: number;
  packagingCost: number;
  shippingCost: number;
  platformFeePercent: number;
  taxPercent: number;
  sellingPrice: number;
  customFields?: CustomCostField[];
  unitsSold?: number;
}): CalculationBreakdown {
  const {
    filamentWeightGrams = 0,
    filamentCostPerKg = 0,
    printTimeHours = 0,
    printerWattage = 150,
    electricityRatePerKwh = 8.5,
    machineDepreciationPerHour = 0,
    failureRatePercent = 0,
    laborHours = 0,
    laborRatePerHour = 0,
    postProcessingCost = 0,
    packagingCost = 0,
    shippingCost = 0,
    platformFeePercent = 0,
    taxPercent = 0,
    sellingPrice = 0,
    customFields = [],
    unitsSold = 0,
  } = input;

  // 1. Raw material
  const materialCost = (Math.max(0, filamentWeightGrams) / 1000) * Math.max(0, filamentCostPerKg);

  // 2. Electricity = (Watts * hours / 1000) * rate
  const electricityKwh = (Math.max(0, printerWattage) * Math.max(0, printTimeHours)) / 1000;
  const electricityCost = electricityKwh * Math.max(0, electricityRatePerKwh);

  // 3. Machine wear & tear
  const machineDepreciationCost = Math.max(0, printTimeHours) * Math.max(0, machineDepreciationPerHour);

  // 4. Contingency / failure rate applied to machine + material
  const basePrintCost = materialCost + electricityCost + machineDepreciationCost;
  const failureContingencyCost = basePrintCost * (Math.max(0, failureRatePercent) / 100);

  // 5. Labor
  const laborCost = Math.max(0, laborHours) * Math.max(0, laborRatePerHour);

  // Direct manufacturing cost
  const directProductionCost = basePrintCost + failureContingencyCost + laborCost;

  // 6. Fulfillment
  const fulfillmentCost = Math.max(0, postProcessingCost) + Math.max(0, packagingCost) + Math.max(0, shippingCost);

  // 7. Custom Fields calculation
  let customCostsTotal = 0;
  const customFieldBreakdown = (customFields || []).map((cf) => {
    let amt = 0;
    const val = Number(cf.value) || 0;
    if (cf.type === 'per_gram') {
      amt = (Math.max(0, filamentWeightGrams) / 1000) * val;
    } else if (cf.type === 'per_hour') {
      amt = Math.max(0, printTimeHours) * val;
    } else {
      amt = val;
    }
    customCostsTotal += amt;
    return { name: cf.name || 'Custom Fee', amount: amt };
  });

  // Base production + fulfillment + custom before selling price fees
  const subtotalCost = directProductionCost + fulfillmentCost + customCostsTotal;

  // Platform & Tax deductions
  const platformFeeAmount = Math.max(0, sellingPrice) * (Math.max(0, platformFeePercent) / 100);
  const taxAmount = Math.max(0, sellingPrice) * (Math.max(0, taxPercent) / 100);

  const totalCostPerUnit = subtotalCost + platformFeeAmount + taxAmount;
  const profitPerUnit = sellingPrice - totalCostPerUnit;
  const profitMarginPercent = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
  const markupPercent = totalCostPerUnit > 0 ? (profitPerUnit / totalCostPerUnit) * 100 : 0;

  // Sales Volume & Profit Tracking
  const safeUnitsSold = Math.max(0, unitsSold);
  const totalRevenue = safeUnitsSold * Math.max(0, sellingPrice);
  const totalCost = safeUnitsSold * totalCostPerUnit;
  const totalProfit = safeUnitsSold * profitPerUnit;

  // Recommended Selling Prices at various margins
  // Target Price = subtotalCost / (1 - (targetMargin% + platformFee% + tax%) / 100)
  const calcPriceForMargin = (targetMargin: number) => {
    const totalRate = (targetMargin + platformFeePercent + taxPercent) / 100;
    if (totalRate >= 0.99) return subtotalCost * 3;
    const raw = subtotalCost / (1 - totalRate);
    return Math.ceil(Math.max(0, raw) / 10) * 10;
  };

  return {
    materialCost,
    electricityKwh,
    electricityCost,
    machineDepreciationCost,
    failureContingencyCost,
    laborCost,
    directProductionCost,
    postProcessingCost: Math.max(0, postProcessingCost),
    packagingCost: Math.max(0, packagingCost),
    shippingCost: Math.max(0, shippingCost),
    fulfillmentCost,
    customCostsTotal,
    customFieldBreakdown,
    subtotalCost,
    platformFeeAmount,
    taxAmount,
    totalCostPerUnit,
    sellingPrice,
    profitPerUnit,
    profitMarginPercent,
    markupPercent,
    unitsSold: safeUnitsSold,
    totalRevenue,
    totalCost,
    totalProfit,
    suggestedPrices: {
      margin30: calcPriceForMargin(30),
      margin50: calcPriceForMargin(50),
      margin65: calcPriceForMargin(65),
      margin80: calcPriceForMargin(80),
    },
  };
}

export function formatINR(val: number, symbol = '₹'): string {
  if (isNaN(val)) return `${symbol}0`;
  return `${symbol}${Math.round(val).toLocaleString('en-IN')}`;
}

export function formatDecimal(val: number, decimals = 2): string {
  if (isNaN(val)) return '0';
  return val.toFixed(decimals);
}
