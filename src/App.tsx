import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  TrendingUp,
  Plus,
  ShieldCheck,
  ClipboardList,
  LogOut,
  RefreshCw,
  User,
  Sparkles,
} from 'lucide-react';
import { CalculatedProduct, AuditLogEntry, PartnerName } from './types/calculator.ts';
import {
  getActivePartnerSession,
  clearPartnerSession,
  fetchServerProducts,
  saveProductToServer,
  deleteProductFromServer,
  updateProductSalesOnServer,
  updateProductPriceOnServer,
  subscribeToProductUpdates,
  fetchServerAuditLogs,
  recordAuditLog,
} from './lib/calculatorServerSync.ts';
import { recalculateStoredProduct, INITIAL_PRESET_PRODUCTS } from './lib/calculatorStorage.ts';
import { ProductCalculator } from './components/ProductCalculator.tsx';
import { ProductProfitTracker } from './components/ProductProfitTracker.tsx';
import { AuditLogViewer } from './components/AuditLogViewer.tsx';
import { AuthGate } from './components/AuthGate.tsx';

export const App: React.FC = () => {
  // 1. Partner Authentication Session
  const [activePartner, setActivePartner] = useState<PartnerName | null>(() => {
    const session = getActivePartnerSession();
    return session?.username || null;
  });

  // 2. Main Catalog & Navigation State
  const [products, setProducts] = useState<CalculatedProduct[]>(INITIAL_PRESET_PRODUCTS);
  const [activeTab, setActiveTab] = useState<'tracker' | 'calculator' | 'audit'>('tracker');
  const [editingProduct, setEditingProduct] = useState<CalculatedProduct | null>(null);

  // 3. Server Sync & Audit State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');

  // Initial Data Fetch from Server
  const loadDataFromServer = useCallback(async () => {
    if (!activePartner) return;
    setIsSyncing(true);
    setSyncStatusMsg('Syncing with server...');
    try {
      const [prods, logs] = await Promise.all([
        fetchServerProducts(),
        fetchServerAuditLogs(),
      ]);
      if (prods && prods.length > 0) {
        setProducts(prods);
      }
      setAuditLogs(logs);
      setSyncStatusMsg('Synced with server');
    } catch (e) {
      console.warn('Sync warning:', e);
      setSyncStatusMsg('Local cache active');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(''), 3000);
    }
  }, [activePartner]);

  // Boot & Real-time Live Synchronization Subscription
  useEffect(() => {
    if (!activePartner) return;

    loadDataFromServer();

    // Subscribe to Firestore real-time updates across devices
    const unsub = subscribeToProductUpdates((liveProducts) => {
      if (Array.isArray(liveProducts) && liveProducts.length > 0) {
        setProducts(liveProducts);
      }
    });

    return () => {
      unsub();
    };
  }, [activePartner, loadDataFromServer]);

  // Handle Logout
  const handleSignOut = () => {
    if (activePartner) {
      recordAuditLog({
        actor: activePartner,
        action: 'LOGIN',
        details: `${activePartner} signed out of session.`,
      }).catch(() => {});
    }
    clearPartnerSession();
    setActivePartner(null);
  };

  // Handle Saving New or Edited Product
  const handleSaveProduct = async (
    productData: Omit<
      CalculatedProduct,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'materialCost'
      | 'electricityCost'
      | 'machineCost'
      | 'laborCost'
      | 'customCostsTotal'
      | 'totalCostPerUnit'
      | 'profitPerUnit'
      | 'profitMarginPercent'
      | 'totalRevenue'
      | 'totalProfit'
    >,
    existingId?: string
  ) => {
    if (!activePartner) return;
    setIsSyncing(true);

    if (existingId) {
      const existing = products.find((p) => p.id === existingId);
      const updatedProduct: CalculatedProduct = {
        ...(existing || ({} as CalculatedProduct)),
        ...productData,
        id: existingId,
        lastModifiedBy: activePartner,
        updatedAt: new Date().toISOString(),
      };

      const recalculated = recalculateStoredProduct(updatedProduct);

      // Optimistic state update
      setProducts((prev) =>
        prev.map((p) => (p.id === existingId ? recalculated : p))
      );

      // Persist to server and record audit log
      await saveProductToServer(recalculated, activePartner);
      await recordAuditLog({
        actor: activePartner,
        action: 'UPDATE_PRODUCT',
        entityId: existingId,
        entityName: recalculated.name,
        details: `${activePartner} updated calculation for "${recalculated.name}" (Price: ₹${recalculated.sellingPrice}, Margin: ${recalculated.profitMarginPercent}%).`,
      });
    } else {
      const newProd: CalculatedProduct = {
        ...productData,
        id: `prod-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastModifiedBy: activePartner,
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
      };

      const recalculated = recalculateStoredProduct(newProd);

      // Optimistic update
      setProducts((prev) => [recalculated, ...prev]);

      // Persist to server
      await saveProductToServer(recalculated, activePartner);
      await recordAuditLog({
        actor: activePartner,
        action: 'CREATE_PRODUCT',
        entityId: recalculated.id,
        entityName: recalculated.name,
        details: `${activePartner} created 3D print model calculation "${recalculated.name}" at target price ₹${recalculated.sellingPrice}.`,
      });
    }

    // Refresh audit logs in background
    fetchServerAuditLogs().then(setAuditLogs).catch(() => {});

    setIsSyncing(false);
    setEditingProduct(null);
    setActiveTab('tracker');
  };

  // Handle Deleting a Product (Zero window.confirm dependency for sandboxed environments)
  const handleDeleteProduct = async (id: string) => {
    if (!activePartner) return;
    const target = products.find((p) => p.id === id);

    // Optimistically remove from client state
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (editingProduct?.id === id) {
      setEditingProduct(null);
    }

    // Persist deletion to server and Firestore, and record in audit log
    await deleteProductFromServer(id, activePartner, target?.name);
    fetchServerAuditLogs().then(setAuditLogs).catch(() => {});
    setActiveTab('tracker');
  };

  // Handle Sales Volume Update
  const handleUpdateSales = async (id: string, newUnitsSold: number) => {
    if (!activePartner) return;
    const target = products.find((p) => p.id === id);
    const oldUnits = target?.unitsSold || 0;
    const safeUnits = Math.max(0, newUnitsSold);

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, unitsSold: safeUnits, lastModifiedBy: activePartner };
          return recalculateStoredProduct(updated);
        }
        return p;
      })
    );

    await updateProductSalesOnServer(id, safeUnits, activePartner, target?.name, oldUnits);
    fetchServerAuditLogs().then(setAuditLogs).catch(() => {});
  };

  // Handle Inline Target Selling Price Update
  const handleUpdatePrice = async (product: CalculatedProduct, newPrice: number) => {
    if (!activePartner) return;
    const safePrice = Math.max(0, Number(newPrice) || 0);

    const updated = recalculateStoredProduct({
      ...product,
      sellingPrice: safePrice,
      lastModifiedBy: activePartner,
      updatedAt: new Date().toISOString(),
    });

    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? updated : p))
    );

    await updateProductPriceOnServer(product, safePrice, activePartner);
    fetchServerAuditLogs().then(setAuditLogs).catch(() => {});
  };

  const handleOpenCalculatorNew = () => {
    setEditingProduct(null);
    setActiveTab('calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditProduct = (prod: CalculatedProduct) => {
    setEditingProduct(prod);
    setActiveTab('calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetCatalog = async () => {
    if (!activePartner) return;
    setProducts(INITIAL_PRESET_PRODUCTS);
    try {
      await fetch('/api/calculator-products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: INITIAL_PRESET_PRODUCTS, user: activePartner }),
      });
      await recordAuditLog({
        actor: activePartner,
        action: 'RESET_CATALOG',
        details: `${activePartner} reset catalog to initial default presets.`,
      });
      fetchServerAuditLogs().then(setAuditLogs).catch(() => {});
    } catch {}
    setActiveTab('tracker');
  };

  // -------------------------------------------------------------
  // Full Website Gatekeeper: Render AuthGate if Not Logged In
  // -------------------------------------------------------------
  if (!activePartner) {
    return <AuthGate onAuthenticated={(partner) => setActivePartner(partner)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 font-sans antialiased pb-16">
      {/* Top Header Navbar with Anti-Slop Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark (Clean single-line element) */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center font-bold shadow-xs">
              <Calculator className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-tight">
                  3D Print Profit Engine
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Server Synced
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Precision manufacturing cost calculator & product sales profit rankings
              </p>
            </div>
          </div>

          {/* Zone 2: Navigation Links (Single-line segmented controls) */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setActiveTab('tracker');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'tracker'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sales Tracker</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                {products.length}
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenCalculatorNew}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'calculator'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>{editingProduct ? 'Edit Calculator' : 'Cost Calculator'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
              <span>Audit Logs</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                {auditLogs.length}
              </span>
            </button>
          </div>

          {/* Zone 3: Active Partner Indicator & Action CTA */}
          <div className="flex items-center gap-2">
            {/* Sync Status Badge */}
            {syncStatusMsg && (
              <span className="text-[11px] text-emerald-600 font-medium hidden lg:inline-block animate-pulse">
                {syncStatusMsg}
              </span>
            )}

            <button
              type="button"
              onClick={loadDataFromServer}
              disabled={isSyncing}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Refresh from server"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {/* Active Partner Badge */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                  activePartner === 'Aditya'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {activePartner.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none">
                  Active Partner
                </span>
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {activePartner}
                </span>
              </div>
            </div>

            {/* Sign Out CTA */}
            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Sign out of partner portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'tracker' && (
          <ProductProfitTracker
            products={products}
            activePartner={activePartner}
            onSelectProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onAddNew={handleOpenCalculatorNew}
            onUpdateSales={handleUpdateSales}
            onUpdatePrice={handleUpdatePrice}
          />
        )}

        {activeTab === 'calculator' && (
          <ProductCalculator
            initialProduct={editingProduct}
            activePartner={activePartner}
            existingCategories={Array.from(new Set(products.map((p) => p.category).filter(Boolean)))}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onCancel={() => {
              setEditingProduct(null);
              setActiveTab('tracker');
            }}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogViewer
            logs={auditLogs}
            onRefresh={loadDataFromServer}
            isLoading={isSyncing}
          />
        )}
      </main>
    </div>
  );
};

export default App;
