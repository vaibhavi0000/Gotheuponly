import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  Zap,
  Package,
  Layers,
  Wrench,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CalculatedProduct, CustomCostField, PartnerName } from '../types/calculator.ts';
import { computeProductMetrics, formatINR } from '../lib/calculatorEngine.ts';

interface ProductCalculatorProps {
  initialProduct?: CalculatedProduct | null;
  activePartner?: PartnerName;
  existingCategories?: string[];
  onSaveProduct: (productData: Omit<CalculatedProduct, 'id' | 'createdAt' | 'updatedAt' | 'materialCost' | 'electricityCost' | 'machineCost' | 'laborCost' | 'customCostsTotal' | 'totalCostPerUnit' | 'profitPerUnit' | 'profitMarginPercent' | 'totalRevenue' | 'totalProfit'>, existingId?: string) => void;
  onDeleteProduct?: (id: string) => void;
  onAddCategory?: (categoryName: string) => Promise<void> | void;
  onCancel?: () => void;
}

const DEFAULT_CATEGORIES = [
  'Home & Living',
  'Desk & Tech',
  'Toys & Fidgets',
  'Miniatures & Gaming',
  'Wearables & Jewelry',
  'Custom CAD & Prototype',
  'Automotive & Tools',
  'Organizers & Storage',
  'Art & Sculptures',
  'Other',
];

export const ProductCalculator: React.FC<ProductCalculatorProps> = ({
  initialProduct,
  activePartner,
  existingCategories = [],
  onSaveProduct,
  onDeleteProduct,
  onAddCategory,
  onCancel,
}) => {
  // Product info
  const [name, setName] = useState(initialProduct?.name || '');
  const [category, setCategory] = useState(initialProduct?.category || 'Home & Living');
  const [notes, setNotes] = useState(initialProduct?.notes || '');

  // Category creation & management
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    const combined = new Set([
      ...DEFAULT_CATEGORIES,
      ...existingCategories.filter(Boolean),
      ...(initialProduct?.category ? [initialProduct.category] : []),
    ]);
    return Array.from(combined);
  });

  useEffect(() => {
    if (existingCategories && existingCategories.length > 0) {
      setCategoriesList((prev) => Array.from(new Set([...prev, ...existingCategories])));
    }
  }, [existingCategories]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 3D Printing & Machine parameters
  const [filamentType, setFilamentType] = useState(initialProduct?.filamentType || 'Matte PLA');
  const [filamentWeightGrams, setFilamentWeightGrams] = useState<number>(initialProduct?.filamentWeightGrams ?? 120);
  const [filamentCostPerKg, setFilamentCostPerKg] = useState<number>(initialProduct?.filamentCostPerKg ?? 1300);
  const [printTimeHours, setPrintTimeHours] = useState<number>(initialProduct?.printTimeHours ?? 5.5);
  const [printerWattage, setPrinterWattage] = useState<number>(initialProduct?.printerWattage ?? 150);
  const [electricityRatePerKwh, setElectricityRatePerKwh] = useState<number>(initialProduct?.electricityRatePerKwh ?? 8.5);
  const [machineDepreciationPerHour, setMachineDepreciationPerHour] = useState<number>(initialProduct?.machineDepreciationPerHour ?? 20);
  const [failureRatePercent, setFailureRatePercent] = useState<number>(initialProduct?.failureRatePercent ?? 5);

  // Labor & Post-Processing
  const [laborHours, setLaborHours] = useState<number>(initialProduct?.laborHours ?? 0.3);
  const [laborRatePerHour, setLaborRatePerHour] = useState<number>(initialProduct?.laborRatePerHour ?? 120);
  const [postProcessingCost, setPostProcessingCost] = useState<number>(initialProduct?.postProcessingCost ?? 20);

  // Packaging & Shipping
  const [packagingCost, setPackagingCost] = useState<number>(initialProduct?.packagingCost ?? 35);
  const [shippingCost, setShippingCost] = useState<number>(initialProduct?.shippingCost ?? 50);

  // Platform & Tax
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(initialProduct?.platformFeePercent ?? 3);
  const [taxPercent, setTaxPercent] = useState<number>(initialProduct?.taxPercent ?? 0);

  // Selling Price
  const [sellingPrice, setSellingPrice] = useState<number>(initialProduct?.sellingPrice ?? 599);

  // Sales Tracking & Volume
  const [unitsSold, setUnitsSold] = useState<number>(initialProduct?.unitsSold ?? 10);
  const [targetMonthlySales, setTargetMonthlySales] = useState<number>(initialProduct?.targetMonthlySales ?? 30);

  // Custom User-Defined Fields
  const [customFields, setCustomFields] = useState<CustomCostField[]>(
    initialProduct?.customFields?.length
      ? initialProduct.customFields
      : [
          { id: 'cf-default-1', name: 'Branded Sticker & Card', value: 10, type: 'fixed' },
        ]
  );

  // UI state
  const [showAdvancedMachine, setShowAdvancedMachine] = useState(false);
  const [showFulfillment, setShowFulfillment] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live real-time metrics
  const metrics = computeProductMetrics({
    filamentWeightGrams,
    filamentCostPerKg,
    printTimeHours,
    printerWattage,
    electricityRatePerKwh,
    machineDepreciationPerHour,
    failureRatePercent,
    laborHours,
    laborRatePerHour,
    postProcessingCost,
    packagingCost,
    shippingCost,
    platformFeePercent,
    taxPercent,
    sellingPrice,
    customFields,
    unitsSold,
  });

  // Handlers for Custom Fields
  const handleAddCustomField = () => {
    const newField: CustomCostField = {
      id: `cf-${Date.now()}`,
      name: '',
      value: 0,
      type: 'fixed',
    };
    setCustomFields((prev) => [...prev, newField]);
  };

  const handleUpdateCustomField = (id: string, updates: Partial<CustomCostField>) => {
    setCustomFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, ...updates } : field))
    );
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((field) => field.id !== id));
  };

  // Quick preset loader
  const handleApplyPreset = (type: 'fidget' | 'decor' | 'mini' | 'functional') => {
    if (type === 'fidget') {
      setName('Flexi Articulated Toy');
      setCategory('Toys & Fidgets');
      setFilamentType('Silk Tri-Color PLA');
      setFilamentWeightGrams(110);
      setFilamentCostPerKg(1500);
      setPrintTimeHours(4.5);
      setPostProcessingCost(10);
      setPackagingCost(25);
      setShippingCost(45);
      setSellingPrice(549);
      setUnitsSold(25);
    } else if (type === 'decor') {
      setName('Minimalist Spiral Vase');
      setCategory('Home & Living');
      setFilamentType('Terracotta Matte PETG');
      setFilamentWeightGrams(180);
      setFilamentCostPerKg(1400);
      setPrintTimeHours(6.5);
      setPostProcessingCost(15);
      setPackagingCost(40);
      setShippingCost(60);
      setSellingPrice(799);
      setUnitsSold(15);
    } else if (type === 'mini') {
      setName('Tabletop Dragon Miniature (32mm)');
      setCategory('Miniatures & Gaming');
      setFilamentType('High-Speed Matte PLA');
      setFilamentWeightGrams(25);
      setFilamentCostPerKg(1800);
      setPrintTimeHours(2.0);
      setLaborHours(0.5);
      setPostProcessingCost(25);
      setPackagingCost(20);
      setShippingCost(40);
      setSellingPrice(449);
      setUnitsSold(40);
    } else if (type === 'functional') {
      setName('Under-Desk Cable Organizer & Mount');
      setCategory('Desk & Tech');
      setFilamentType('Durable PETG / ABS');
      setFilamentWeightGrams(140);
      setFilamentCostPerKg(1300);
      setPrintTimeHours(5.0);
      setPostProcessingCost(15);
      setPackagingCost(30);
      setShippingCost(50);
      setSellingPrice(649);
      setUnitsSold(20);
    }
  };

  // Form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a product name');
      return;
    }
    setErrorMsg('');

    const resolvedCategory = isCreatingCategory && newCategoryName.trim()
      ? newCategoryName.trim()
      : category.trim() || 'Home & Living';

    if (isCreatingCategory && newCategoryName.trim()) {
      const trimmed = newCategoryName.trim();
      if (!categoriesList.includes(trimmed)) {
        setCategoriesList((prev) => [...prev, trimmed]);
      }
      onAddCategory?.(trimmed);
      setCategory(resolvedCategory);
      setIsCreatingCategory(false);
    }

    onSaveProduct(
      {
        name: name.trim(),
        category: resolvedCategory,
        notes,
        filamentType,
        filamentWeightGrams: Number(filamentWeightGrams) || 0,
        filamentCostPerKg: Number(filamentCostPerKg) || 0,
        printTimeHours: Number(printTimeHours) || 0,
        printerWattage: Number(printerWattage) || 150,
        electricityRatePerKwh: Number(electricityRatePerKwh) || 8.5,
        machineDepreciationPerHour: Number(machineDepreciationPerHour) || 0,
        failureRatePercent: Number(failureRatePercent) || 0,
        laborHours: Number(laborHours) || 0,
        laborRatePerHour: Number(laborRatePerHour) || 0,
        postProcessingCost: Number(postProcessingCost) || 0,
        packagingCost: Number(packagingCost) || 0,
        shippingCost: Number(shippingCost) || 0,
        platformFeePercent: Number(platformFeePercent) || 0,
        taxPercent: Number(taxPercent) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        customFields: customFields.filter((cf) => cf.name.trim() !== ''),
        unitsSold: Number(unitsSold) || 0,
        targetMonthlySales: Number(targetMonthlySales) || 0,
      },
      initialProduct?.id
    );

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Presets */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-xs font-semibold tracking-wide uppercase">
              3D Print Cost & Margin Engine
            </span>
            {initialProduct && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
                Editing: {initialProduct.name}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1 tracking-tight">
            {initialProduct ? 'Update Product Calculation' : 'Calculate & Save New 3D Printed Product'}
          </h2>
          <p className="text-emerald-200 text-xs sm:text-sm mt-0.5">
            Configure raw filament, print time, machine depreciation, labor, custom fees, and analyze real-time profit.
          </p>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-emerald-200 font-medium mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset('fidget')}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer"
          >
            🐉 Fidget Dragon
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('decor')}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer"
          >
            🪴 Zen Planter
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('mini')}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer"
          >
            ⚔️ Miniature
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('functional')}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer"
          >
            🔧 Tech Mount
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Input Fields (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Product Basic Info */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Product Information</h3>
              </div>
              <span className="text-xs text-slate-400">Required</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hexagonal Desk Lamp, Torii Stand, Flexi Slug"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 text-sm text-slate-900 outline-none transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Category *
                  </label>
                  {!isCreatingCategory ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingCategory(true);
                        setNewCategoryName('');
                      }}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Create New</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(false)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Select Existing
                    </button>
                  )}
                </div>

                {!isCreatingCategory ? (
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingCategory(true);
                        setNewCategoryName('');
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 text-sm text-slate-800 bg-white outline-none cursor-pointer"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__NEW__">+ Create New Category...</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="Type new category (e.g. Robotics, Medical, Kitchen)"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCategoryName.trim()) {
                          e.preventDefault();
                          const trimmed = newCategoryName.trim();
                          if (!categoriesList.includes(trimmed)) {
                            setCategoriesList((prev) => [...prev, trimmed]);
                          }
                          onAddCategory?.(trimmed);
                          setCategory(trimmed);
                          setIsCreatingCategory(false);
                        }
                      }}
                      className="flex-1 px-3 py-2.5 rounded-xl border-2 border-emerald-500 focus:border-emerald-600 text-sm text-slate-900 bg-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCategoryName.trim()) {
                          const trimmed = newCategoryName.trim();
                          if (!categoriesList.includes(trimmed)) {
                            setCategoriesList((prev) => [...prev, trimmed]);
                          }
                          onAddCategory?.(trimmed);
                          setCategory(trimmed);
                          setIsCreatingCategory(false);
                        }
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      Add
                    </button>
                  </div>
                )}
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {isCreatingCategory
                    ? 'Type your custom category name and click Add.'
                    : 'Select category or click "+ Create New" to create any custom category.'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Filament Material / Type
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bambu Matte PLA, PETG, TPU 95A"
                  value={filamentType}
                  onChange={(e) => setFilamentType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 text-sm text-slate-800 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Slicer Settings (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0.16mm layer height, 15% gyroid infill, tree supports"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Card 2: 3D Printing & Filament Parameters */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Print Slicing & Machine Specs</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedMachine(!showAdvancedMachine)}
                className="text-xs text-blue-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{showAdvancedMachine ? 'Hide Advanced' : 'Power & Depreciation'}</span>
                {showAdvancedMachine ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3.5">
              {/* Filament Weight */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Filament Weight (Grams)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={filamentWeightGrams}
                    onChange={(e) => setFilamentWeightGrams(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">grams</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">From slicer (e.g. Bambu Studio / Cura)</span>
              </div>

              {/* Filament Spool Cost */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Filament Cost per Kg (1000g)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={filamentCostPerKg}
                    onChange={(e) => setFilamentCostPerKg(Number(e.target.value))}
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 text-sm font-semibold text-slate-900 outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Average ₹1,100 – ₹1,800 / kg</span>
              </div>

              {/* Print Time Hours */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Print Duration (Hours)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={printTimeHours}
                    onChange={(e) => setPrintTimeHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">hrs</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  ≈ {Math.round(printTimeHours * 60)} minutes
                </span>
              </div>

              {/* Failure / Contingency % */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Failure Contingency Rate
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    value={failureRatePercent}
                    onChange={(e) => setFailureRatePercent(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Covers occasional spaghetti / misprints</span>
              </div>
            </div>

            {/* Advanced Machine Details (Power, Rate, Machine Wear) */}
            {showAdvancedMachine && (
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-xl">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Printer Wattage (W)
                  </label>
                  <input
                    type="number"
                    min="20"
                    value={printerWattage}
                    onChange={(e) => setPrinterWattage(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Avg 120W – 180W</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Electricity (₹ / kWh Unit)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={electricityRatePerKwh}
                    onChange={(e) => setElectricityRatePerKwh(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">State commercial / home tariff</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Machine Wear (₹ / hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={machineDepreciationPerHour}
                    onChange={(e) => setMachineDepreciationPerHour(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Nozzle, belts, build plate wear</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Labor, Post-Processing, Packaging & Shipping */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Labor, Finishing & Packaging</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFulfillment(!showFulfillment)}
                className="text-xs text-amber-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{showFulfillment ? 'Collapse' : 'Expand'}</span>
                {showFulfillment ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showFulfillment && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Labor Time (Hours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={laborHours}
                    onChange={(e) => setLaborHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {Math.round(laborHours * 60)} mins (removal & prep)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Labor Rate (₹ / hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={laborRatePerHour}
                    onChange={(e) => setLaborRatePerHour(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Operator hourly wage</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Finishing & Hardware (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={postProcessingCost}
                    onChange={(e) => setPostProcessingCost(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Sanding, screws, inserts</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Packaging (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={packagingCost}
                    onChange={(e) => setPackagingCost(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Cardboard box & bubble wrap</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Shipping / Courier (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Set 0 if buyer pays shipping</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gateway Fee (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={platformFeePercent}
                    onChange={(e) => setPlatformFeePercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Razorpay / Shopify / Etsy fee</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: CUSTOM USER-DEFINED COST FIELDS */}
          <div className="bg-white rounded-2xl p-5 border-2 border-dashed border-purple-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-sm">
                  ✨
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Custom Cost Fields</h3>
                  <p className="text-[11px] text-slate-500">
                    Add custom line-items (e.g. magnets, brass inserts, custom electronics, gifts, special licensing)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddCustomField}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Field</span>
              </button>
            </div>

            {customFields.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 bg-purple-50/50 rounded-xl">
                No custom fields added yet. Click "+ Add Field" above to include custom components or fees.
              </div>
            ) : (
              <div className="space-y-2.5">
                {customFields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-purple-50/40 border border-purple-100 rounded-xl"
                  >
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Cost item name (e.g. Neodymium Magnets, LED Puck, Custom Paint)"
                        value={field.name}
                        onChange={(e) => handleUpdateCustomField(field.id, { name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 bg-white"
                      />
                    </div>

                    <div className="w-28 relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={field.value || ''}
                        onChange={(e) => handleUpdateCustomField(field.id, { value: Number(e.target.value) })}
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                      />
                    </div>

                    <div className="w-28">
                      <select
                        value={field.type}
                        onChange={(e) => handleUpdateCustomField(field.id, { type: e.target.value as any })}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white cursor-pointer"
                      >
                        <option value="fixed">Fixed Flat ₹</option>
                        <option value="per_gram">₹ per Kg</option>
                        <option value="per_hour">₹ per Hour</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(field.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer self-end sm:self-center"
                      title="Remove field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-end text-xs font-bold text-purple-900 pr-2">
                  Total Custom Additions: {formatINR(metrics.customCostsTotal)}
                </div>
              </div>
            )}
          </div>

          {/* Card 5: Selling Price & Sales Tracking */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Selling Price & Sales Volume Tracking</h3>
              </div>
              <span className="text-xs text-emerald-700 font-bold">Live Profit Calculator</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Target Selling Price (₹) *
                  </label>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                    Custom Price
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="e.g. 499 or 249.50"
                    value={sellingPrice === 0 ? '' : sellingPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSellingPrice(val === '' ? 0 : parseFloat(val));
                    }}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border-2 border-emerald-500 focus:border-emerald-600 text-base font-bold text-emerald-900 outline-none transition"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Takes any custom retail price (no fixed multiples required)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Units Sold to Date
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={unitsSold}
                    onChange={(e) => setUnitsSold(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-base font-bold text-slate-900 outline-none"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-medium">pcs</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">To track total revenue & profit</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Monthly Volume
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={targetMonthlySales}
                    onChange={(e) => setTargetMonthlySales(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-base font-bold text-slate-900 outline-none"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-medium">pcs / mo</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">For capacity planning</span>
              </div>
            </div>

            {/* Quick Price Suggestions */}
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-slate-500 font-medium">Suggested Prices:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSellingPrice(metrics.suggestedPrices.margin30)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  30% Margin: {formatINR(metrics.suggestedPrices.margin30)}
                </button>
                <button
                  type="button"
                  onClick={() => setSellingPrice(metrics.suggestedPrices.margin50)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition cursor-pointer"
                >
                  50% Margin: {formatINR(metrics.suggestedPrices.margin50)}
                </button>
                <button
                  type="button"
                  onClick={() => setSellingPrice(metrics.suggestedPrices.margin65)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  65% Margin: {formatINR(metrics.suggestedPrices.margin65)}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Calculation & Sales Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main Profit Card */}
          <div className="bg-gradient-to-br from-[#1a2e26] to-[#0f1f19] text-white rounded-3xl p-6 shadow-md space-y-5 sticky top-5 border border-emerald-800/40">
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  REAL-TIME MARGIN SUMMARY
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">Per-Unit Economics</h3>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-black ${
                metrics.profitMarginPercent >= 45
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                  : metrics.profitMarginPercent > 20
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                  : 'bg-rose-500/30 text-rose-300 border border-rose-400/40'
              }`}>
                {metrics.profitMarginPercent >= 0 ? '+' : ''}{metrics.profitMarginPercent.toFixed(1)}% MARGIN
              </div>
            </div>

            {/* Profit Hero Numbers */}
            <div className="grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
              <div>
                <span className="text-[11px] text-emerald-300/80 font-medium block">Total Cost / Unit</span>
                <span className="text-xl sm:text-2xl font-black text-white block mt-0.5">
                  {formatINR(metrics.totalCostPerUnit)}
                </span>
                <span className="text-[10px] text-slate-400">All materials + fees</span>
              </div>
              <div>
                <span className="text-[11px] text-emerald-300/80 font-medium block">Net Profit / Unit</span>
                <span className={`text-xl sm:text-2xl font-black block mt-0.5 ${
                  metrics.profitPerUnit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatINR(metrics.profitPerUnit)}
                </span>
                <span className="text-[10px] text-slate-400">
                  Markup: {metrics.markupPercent.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Cost Breakdown Items */}
            <div className="space-y-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Cost Breakdown Breakdown
              </span>

              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Raw Filament ({filamentWeightGrams}g)
                </span>
                <span className="font-semibold text-white">{formatINR(metrics.materialCost)}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Electricity ({metrics.electricityKwh.toFixed(2)} kWh)
                </span>
                <span className="font-semibold text-white">{formatINR(metrics.electricityCost)}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Machine Depreciation ({printTimeHours} hrs)
                </span>
                <span className="font-semibold text-white">{formatINR(metrics.machineDepreciationCost)}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Failure Contingency ({failureRatePercent}%)
                </span>
                <span className="font-semibold text-white">{formatINR(metrics.failureContingencyCost)}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Labor & Post-Processing
                </span>
                <span className="font-semibold text-white">
                  {formatINR(metrics.laborCost + metrics.postProcessingCost)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  Packaging & Shipping
                </span>
                <span className="font-semibold text-white">
                  {formatINR(metrics.packagingCost + metrics.shippingCost)}
                </span>
              </div>

              {metrics.customCostsTotal > 0 && (
                <div className="flex justify-between items-center py-1 border-b border-white/5 text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    Custom Fields ({metrics.customFieldBreakdown.length} items)
                  </span>
                  <span className="font-bold">{formatINR(metrics.customCostsTotal)}</span>
                </div>
              )}

              {metrics.platformFeeAmount > 0 && (
                <div className="flex justify-between items-center py-1 border-b border-white/5 text-slate-400">
                  <span>Platform / Payment Fee ({platformFeePercent}%)</span>
                  <span>{formatINR(metrics.platformFeeAmount)}</span>
                </div>
              )}
            </div>

            {/* Total Sales & Cumulative Profit Tracking Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-teal-950/80 border border-emerald-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Cumulative Sales Tracking
                </span>
                <span className="text-xs font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">
                  {metrics.unitsSold} units sold
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Total Revenue</span>
                  <span className="text-base sm:text-lg font-black text-white block mt-0.5">
                    {formatINR(metrics.totalRevenue)}
                  </span>
                </div>
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-emerald-300/80 block">Total Realized Profit</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 block mt-0.5">
                    {formatINR(metrics.totalProfit)}
                  </span>
                </div>
              </div>

              {targetMonthlySales > 0 && (
                <div className="text-[11px] text-slate-300 text-center pt-1">
                  Monthly Target Profit: <strong className="text-emerald-300">{formatINR(targetMonthlySales * metrics.profitPerUnit)}</strong> ({targetMonthlySales} units/mo)
                </div>
              )}
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Save Button */}
            {/* Save & Delete Action Buttons */}
            <div className="pt-2 flex items-center gap-2.5 flex-wrap">
              <button
                type="submit"
                className="flex-1 min-w-[180px] py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Calculator className="w-4 h-4" />
                <span>{initialProduct ? 'SAVE PRODUCT CHANGES' : 'SAVE TO PRODUCT CATALOG'}</span>
              </button>

              {initialProduct && onDeleteProduct && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="py-3 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-100 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Delete this product calculation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            {saveSuccess && (
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs text-center font-bold animate-in fade-in">
                ✓ Product successfully saved to tracking catalog!
              </div>
            )}
          </div>
        </div>
      </form>

      {/* In-app Delete Confirmation Modal (Zero window.confirm dependency) */}
      {showDeleteModal && initialProduct && onDeleteProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-950/80 border border-rose-700/50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Delete Product Calculation?</h3>
                <p className="text-xs text-slate-400">Permanently removes item from server database.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">"{initialProduct.name}"</strong>? This will remove its cost calculation, pricing, and all profit tracking logs from the server.
            </p>

            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Category:</span>
                <span className="text-slate-200 font-semibold">{initialProduct.category}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Selling Price:</span>
                <span className="font-mono text-white font-bold">{formatINR(initialProduct.sellingPrice)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Units Sold:</span>
                <span className="font-mono text-white font-bold">{initialProduct.unitsSold} pcs</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  onDeleteProduct(initialProduct.id);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
