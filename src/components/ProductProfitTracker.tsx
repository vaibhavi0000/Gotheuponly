import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  ArrowUpDown,
  Search,
  Filter,
  Trash2,
  Edit,
  Plus,
  Sparkles,
  Award,
  Layers,
  ChevronDown,
  Download,
  AlertCircle,
  Tag,
  Check,
  X,
  Package,
} from 'lucide-react';
import { CalculatedProduct, PartnerName } from '../types/calculator.ts';
import { formatINR } from '../lib/calculatorEngine.ts';

interface ProductProfitTrackerProps {
  products: CalculatedProduct[];
  categories?: string[];
  activePartner?: PartnerName;
  onSelectProduct: (product: CalculatedProduct) => void;
  onDeleteProduct: (id: string) => void;
  onAddNew: () => void;
  onUpdateSales: (id: string, newUnitsSold: number) => void;
  onUpdatePrice?: (product: CalculatedProduct, newPrice: number) => void;
  onAddCategory?: (categoryName: string) => Promise<void> | void;
  onDeleteCategory?: (categoryName: string) => Promise<void> | void;
  onRestorePresets?: () => void;
}

export type SortKey = 'profit' | 'revenue' | 'margin' | 'sales' | 'name' | 'unitProfit';

const POPULAR_CATEGORY_SUGGESTIONS = [
  'Robotics & Tools',
  'Cosplay & Props',
  'Gaming & Dice',
  'Automotive & Garage',
  'Miniature Figures',
  'Kitchen & Food Safe',
  'Lighting & Lamps',
  'Jewelry & Fashion',
  'Medical & Dental',
];

export const ProductProfitTracker: React.FC<ProductProfitTrackerProps> = ({
  products,
  categories: externalCategories,
  activePartner,
  onSelectProduct,
  onDeleteProduct,
  onAddNew,
  onUpdateSales,
  onUpdatePrice,
  onAddCategory,
  onDeleteCategory,
  onRestorePresets,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('profit');
  const [sortAsc, setSortAsc] = useState(false);
  const [editingSalesId, setEditingSalesId] = useState<string | null>(null);
  const [tempSales, setTempSales] = useState<number>(0);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [productPendingDelete, setProductPendingDelete] = useState<CalculatedProduct | null>(null);

  // Category creation & management state
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [categoryToast, setCategoryToast] = useState<string | null>(null);

  // Compute merged categories list
  const allCategories = useMemo(() => {
    const fromProducts = products.map((p) => p.category).filter(Boolean);
    const fromExternal = externalCategories || [];
    const set = new Set([...fromExternal, ...fromProducts]);
    return Array.from(set);
  }, [products, externalCategories]);

  interface TrackerSummary {
    totalRevenue: number;
    totalProfit: number;
    totalUnits: number;
    overallMargin: number;
    topProduct: CalculatedProduct | null;
    highestMarginProduct: CalculatedProduct | null;
    productCount: number;
  }

  // High-level aggregates
  const summary: TrackerSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalUnits = 0;
    let topProduct: CalculatedProduct | null = null;
    let highestMarginProduct: CalculatedProduct | null = null;

    products.forEach((p) => {
      totalRevenue += p.totalRevenue || 0;
      totalProfit += p.totalProfit || 0;
      totalUnits += p.unitsSold || 0;

      if (!topProduct || (p.totalProfit || 0) > (topProduct.totalProfit || 0)) {
        topProduct = p;
      }
      if (
        !highestMarginProduct ||
        (p.profitMarginPercent || 0) > (highestMarginProduct.profitMarginPercent || 0)
      ) {
        highestMarginProduct = p;
      }
    });

    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalProfit,
      totalUnits,
      overallMargin,
      topProduct,
      highestMarginProduct,
      productCount: products.length,
    };
  }, [products]);

  // Filtered & sorted products
  const sortedProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.category.toLowerCase().includes(search.toLowerCase()) ||
          (p.filamentType && p.filamentType.toLowerCase().includes(search.toLowerCase()));
        const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === 'profit') diff = (b.totalProfit || 0) - (a.totalProfit || 0);
        else if (sortKey === 'revenue') diff = (b.totalRevenue || 0) - (a.totalRevenue || 0);
        else if (sortKey === 'margin') diff = (b.profitMarginPercent || 0) - (a.profitMarginPercent || 0);
        else if (sortKey === 'sales') diff = (b.unitsSold || 0) - (a.unitsSold || 0);
        else if (sortKey === 'unitProfit') diff = (b.profitPerUnit || 0) - (a.profitPerUnit || 0);
        else if (sortKey === 'name') diff = a.name.localeCompare(b.name);

        return sortAsc ? -diff : diff;
      });
  }, [products, search, categoryFilter, sortKey, sortAsc]);

  const handleExportCSV = () => {
    const headers = [
      'Product Name',
      'Category',
      'Filament Type',
      'Weight (g)',
      'Print Hours',
      'Cost Per Unit',
      'Selling Price',
      'Profit Per Unit',
      'Margin %',
      'Units Sold',
      'Total Revenue',
      'Total Profit',
    ];

    const rows = sortedProducts.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      `"${p.filamentType || ''}"`,
      p.filamentWeightGrams,
      p.printTimeHours,
      p.totalCostPerUnit,
      p.sellingPrice,
      p.profitPerUnit,
      p.profitMarginPercent,
      p.unitsSold || 0,
      p.totalRevenue || 0,
      p.totalProfit || 0,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `3d_print_profit_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateCategorySubmit = async (nameToUse?: string) => {
    const target = (nameToUse || newCategoryName || '').trim();
    if (!target) return;

    if (onAddCategory) {
      await onAddCategory(target);
    }
    setCategoryFilter(target);
    setNewCategoryName('');
    setIsAddingCategory(false);
    setCategoryToast(`✓ Category "${target}" created & synced across devices!`);
    setTimeout(() => setCategoryToast(null), 3500);
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!categoryToDelete) return;
    const cat = categoryToDelete;
    setCategoryToDelete(null);
    if (onDeleteCategory) {
      await onDeleteCategory(cat);
    }
    if (categoryFilter === cat) {
      setCategoryFilter('All');
    }
    setCategoryToast(`Category "${cat}" removed.`);
    setTimeout(() => setCategoryToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {categoryToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{categoryToast}</span>
        </div>
      )}

      {/* Top Aggregates Summary Cards (Anti-Slop Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Realized Profit */}
        <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-800 to-teal-950 text-white p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              Total Realized Profit
            </span>
            <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              ₹
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black block tracking-tight">
              {formatINR(summary.totalProfit)}
            </span>
            <span className="text-xs text-emerald-200/90 font-medium block mt-1">
              Overall Margin: {summary.overallMargin.toFixed(1)}% net
            </span>
          </div>
        </div>

        {/* Total Gross Revenue */}
        <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-900 to-slate-950 text-white p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
              Total Revenue (Lifetime)
            </span>
            <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-blue-300">
              📈
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black block tracking-tight">
              {formatINR(summary.totalRevenue)}
            </span>
            <span className="text-xs text-blue-200/90 font-medium block mt-1">
              {summary.totalUnits} items sold across {summary.productCount} models
            </span>
          </div>
        </div>

        {/* #1 Most Profitable Product */}
        <div className="rounded-2xl sm:rounded-3xl bg-amber-500 text-slate-950 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-950/80">
              👑 #1 Profit Leader
            </span>
            <span className="text-xl">🏆</span>
          </div>
          <div className="mt-3">
            <span className="text-base sm:text-lg font-black block leading-tight truncate">
              {summary.topProduct ? summary.topProduct.name : 'No items yet'}
            </span>
            <span className="text-xs font-bold text-amber-950/90 mt-1 block">
              {summary.topProduct
                ? `${formatINR(summary.topProduct.totalProfit)} profit (${summary.topProduct.unitsSold} sold)`
                : 'Calculate your first product'}
            </span>
          </div>
        </div>

        {/* Highest Margin % Leader */}
        <div className="rounded-2xl sm:rounded-3xl bg-purple-700 text-white p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200">
              ⚡ Highest Margin %
            </span>
            <span className="text-xl">💎</span>
          </div>
          <div className="mt-3">
            <span className="text-base sm:text-lg font-black block leading-tight truncate">
              {summary.highestMarginProduct ? summary.highestMarginProduct.name : 'No items yet'}
            </span>
            <span className="text-xs font-bold text-purple-200 mt-1 block">
              {summary.highestMarginProduct
                ? `${summary.highestMarginProduct.profitMarginPercent.toFixed(1)}% margin (₹${summary.highestMarginProduct.profitPerUnit}/pc)`
                : 'Configure above'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table & Filter Controls Container */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Product Performance & Profit Rankings</span>
              <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                {products.length} models
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Live server-synced unit economics, target selling prices, and sales performance.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={products.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Export report to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={onAddNew}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Calculate New Product</span>
            </button>
          </div>
        </div>

        {/* -------------------------------------------------------------
            CATEGORY MANAGEMENT BAR (Interactive Pills + Create New Category)
           ------------------------------------------------------------- */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Product Categories ({allCategories.length})
              </span>
            </div>

            {!isAddingCategory ? (
              <button
                type="button"
                onClick={() => setIsAddingCategory(true)}
                className="px-3 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create New Category</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingCategory(false);
                  setNewCategoryName('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Inline Create Category Form */}
          {isAddingCategory && (
            <div className="bg-white border-2 border-emerald-500 rounded-xl p-3 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter new category name (e.g. Robotics, Miniature Figures, Cosplay)..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCategorySubmit();
                    } else if (e.key === 'Escape') {
                      setIsAddingCategory(false);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => handleCreateCategorySubmit()}
                  disabled={!newCategoryName.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  Save Category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryName('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-400 font-medium">Quick suggestions:</span>
                {POPULAR_CATEGORY_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleCreateCategorySubmit(sug)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 text-[10px] font-medium transition cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {/* All Pill */}
            <button
              type="button"
              onClick={() => setCategoryFilter('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                categoryFilter === 'All'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>All Categories</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  categoryFilter === 'All' ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {products.length}
              </span>
            </button>

            {/* Individual Category Pills */}
            {allCategories.map((cat) => {
              const count = products.filter((p) => p.category === cat).length;
              const isSelected = categoryFilter === cat;

              return (
                <div key={cat} className="flex items-center group shrink-0">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>

                  {/* Delete custom category button (visible if 0 products attached) */}
                  {count === 0 && onDeleteCategory && (
                    <button
                      type="button"
                      onClick={() => setCategoryToDelete(cat)}
                      className="ml-1 p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title={`Remove unused category "${cat}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Bar & Sorters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Search */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name, material, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Category Filter Dropdown (Syncs with pills above) */}
          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                if (e.target.value === '__NEW__') {
                  setIsAddingCategory(true);
                } else {
                  setCategoryFilter(e.target.value);
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
            >
              <option value="All">All Categories ({products.length})</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c} ({products.filter((p) => p.category === c).length})
                </option>
              ))}
              <option value="__NEW__">+ Create New Category...</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-4 flex items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white outline-none cursor-pointer"
            >
              <option value="profit">Sort by: Total Profit (Highest)</option>
              <option value="sales">Sort by: Units Sold (Most Popular)</option>
              <option value="revenue">Sort by: Total Revenue</option>
              <option value="margin">Sort by: Margin %</option>
              <option value="unitProfit">Sort by: Profit per Unit</option>
              <option value="name">Sort by: Name (A-Z)</option>
            </select>

            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Product Comparison Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Rank & Product</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Print Time & Weight</th>
                <th className="p-3 text-right">Cost / Unit</th>
                <th className="p-3 text-right">Selling Price</th>
                <th className="p-3 text-right">Profit / Unit</th>
                <th className="p-3 text-center">Margin %</th>
                <th className="p-3 text-center">Units Sold</th>
                <th className="p-3 text-right">Total Revenue</th>
                <th className="p-3 text-right">Total Profit</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 px-4">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                        📦
                      </div>
                      <h4 className="font-bold text-sm text-slate-800">
                        {products.length === 0
                          ? 'Catalog is currently empty'
                          : `No products found in category "${categoryFilter}"`}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {products.length === 0
                          ? 'All products were deleted or none have been calculated yet. Click below to add your first 3D printed model or restore defaults.'
                          : 'Try selecting "All Categories" or click below to calculate a new model in this category.'}
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={onAddNew}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                        >
                          + Calculate New Product
                        </button>
                        {products.length === 0 && onRestorePresets && (
                          <button
                            type="button"
                            onClick={onRestorePresets}
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                          >
                            Restore 3 Initial Presets
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedProducts.map((p, idx) => {
                  const isTopProfit = summary.topProduct?.id === p.id;
                  const isTopMargin = summary.highestMarginProduct?.id === p.id;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-emerald-50/30 transition-colors group"
                    >
                      {/* Rank & Name */}
                      <td className="p-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                              idx === 0
                                ? 'bg-amber-400 text-amber-950'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-800'
                                : idx === 2
                                ? 'bg-amber-700/30 text-amber-900'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                onClick={() => onSelectProduct(p)}
                                className="font-bold text-slate-900 hover:text-emerald-700 cursor-pointer hover:underline text-xs"
                              >
                                {p.name}
                              </span>
                              {isTopProfit && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-extrabold text-[9px]">
                                  ★ Top Profit
                                </span>
                              )}
                              {isTopMargin && (
                                <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 font-extrabold text-[9px]">
                                  ★ High Margin
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {p.filamentType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3 font-medium text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {p.category}
                        </span>
                      </td>

                      {/* Print Time & Weight */}
                      <td className="p-3 text-right font-mono text-slate-600">
                        <div>{p.printTimeHours} hrs</div>
                        <div className="text-[10px] text-slate-400">{p.filamentWeightGrams}g PLA</div>
                      </td>

                      {/* Total Cost Per Unit */}
                      <td className="p-3 text-right font-mono text-slate-700">
                        {formatINR(p.totalCostPerUnit)}
                      </td>

                      {/* Selling Price (Inline Editable) */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {editingPriceId === p.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              autoFocus
                              value={tempPrice}
                              onChange={(e) => setTempPrice(Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (onUpdatePrice) onUpdatePrice(p, tempPrice);
                                  setEditingPriceId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingPriceId(null);
                                }
                              }}
                              className="w-20 px-1.5 py-0.5 border border-emerald-500 rounded text-right text-xs font-mono font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (onUpdatePrice) onUpdatePrice(p, tempPrice);
                                setEditingPriceId(null);
                              }}
                              className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPriceId(p.id);
                              setTempPrice(p.sellingPrice);
                            }}
                            className="px-2 py-0.5 rounded hover:bg-slate-100 font-mono font-bold text-slate-900 cursor-pointer group-hover:text-emerald-700 transition inline-flex items-center gap-1"
                            title="Click to inline edit custom price"
                          >
                            <span>{formatINR(p.sellingPrice)}</span>
                            <span className="text-[10px] text-slate-400 opacity-60 group-hover:opacity-100">✎</span>
                          </button>
                        )}
                      </td>

                      {/* Profit / Unit */}
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={p.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatINR(p.profitPerUnit)}
                        </span>
                      </td>

                      {/* Margin % */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            p.profitMarginPercent >= 50
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.profitMarginPercent >= 30
                              ? 'bg-blue-100 text-blue-800'
                              : p.profitMarginPercent >= 15
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.profitMarginPercent.toFixed(1)}%
                        </span>
                      </td>

                      {/* Units Sold (Inline editable) */}
                      <td className="p-3 text-center font-bold">
                        {editingSalesId === p.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={tempSales}
                              onChange={(e) => setTempSales(Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onUpdateSales(p.id, tempSales);
                                  setEditingSalesId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingSalesId(null);
                                }
                              }}
                              className="w-14 px-1.5 py-0.5 border border-emerald-500 rounded text-center text-xs font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateSales(p.id, tempSales);
                                setEditingSalesId(null);
                              }}
                              className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSalesId(p.id);
                              setTempSales(p.unitsSold || 0);
                            }}
                            className="px-2 py-0.5 rounded hover:bg-slate-100 font-mono text-slate-800 cursor-pointer group-hover:text-emerald-700"
                            title="Click to quickly update units sold"
                          >
                            {p.unitsSold || 0} pcs ✎
                          </button>
                        )}
                      </td>

                      {/* Total Revenue */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatINR(p.totalRevenue || 0)}
                      </td>

                      {/* Total Profit */}
                      <td className="p-3 text-right font-mono font-black text-sm text-emerald-700">
                        {formatINR(p.totalProfit || 0)}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectProduct(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            title="Edit / View detailed calculation"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductPendingDelete(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-app Product Delete Confirmation Modal (Zero window.confirm dependency) */}
      {productPendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Product Calculation?</h3>
                <p className="text-xs text-slate-500">Permanently removes item from server database.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">"{productPendingDelete.name}"</strong>? This will remove all associated unit economics, custom fields, and profit tracking data from the server across all partner devices.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Category:</span>
                <span className="text-slate-900 font-semibold">{productPendingDelete.category}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Selling Price:</span>
                <span className="font-mono text-slate-900 font-bold">{formatINR(productPendingDelete.sellingPrice)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Units Sold:</span>
                <span className="font-mono text-slate-900 font-bold">{productPendingDelete.unitsSold} pcs</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Realized Profit:</span>
                <span className="font-mono text-emerald-700 font-bold">{formatINR(productPendingDelete.totalProfit)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductPendingDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = productPendingDelete.id;
                  const name = productPendingDelete.name;
                  setProductPendingDelete(null);
                  onDeleteProduct(id);
                  setCategoryToast(`✓ Deleted "${name}" from server.`);
                  setTimeout(() => setCategoryToast(null), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Remove Category?</h3>
                <p className="text-xs text-slate-500">Deletes custom category from catalog.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove the category <strong className="text-slate-900">"{categoryToDelete}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCategoryConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
