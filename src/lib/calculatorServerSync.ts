import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.ts';
import { CalculatedProduct, AuditLogEntry, PartnerName, PartnerSession } from '../types/calculator.ts';
import { recalculateStoredProduct, INITIAL_PRESET_PRODUCTS } from './calculatorStorage.ts';

const SESSION_STORAGE_KEY = 'tsukuri_partner_session';
const MASTER_PASSWORD = '50CROREBY2035';
const PARTNER_PASSCODES: Record<string, string> = {
  aditya: '3078',
  anshuman: '7985',
};

// -------------------------------------------------------------
// Partner Authentication & Session Management
// -------------------------------------------------------------

export function getActivePartnerSession(): PartnerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.username === 'Aditya' || parsed.username === 'Anshuman')) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function savePartnerSession(username: PartnerName): PartnerSession {
  const session: PartnerSession = {
    username,
    authenticatedAt: new Date().toISOString(),
    token: `auth-${username.toLowerCase()}-${Date.now()}`,
  };
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {}
  return session;
}

export function clearPartnerSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

export async function loginPartner(
  usernameInput: string,
  passwordInput: string,
  passcodeInput: string
): Promise<{ success: boolean; partner?: PartnerName; error?: string }> {
  const trimmedUser = (usernameInput || '').trim();
  const trimmedPass = (passwordInput || '').trim();
  const trimmedCode = (passcodeInput || '').trim();
  const normalized = trimmedUser.toLowerCase();

  // Try Server Authentication API first
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: trimmedUser,
        password: trimmedPass,
        passcode: trimmedCode,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        const partner = data.user as PartnerName;
        savePartnerSession(partner);
        return { success: true, partner };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) {
        return { success: false, error: errData.error };
      }
    }
  } catch (apiErr) {
    console.warn('Backend login route unavailable, evaluating local security validation:', apiErr);
  }

  // Authoritative Client-Side Verification (matches server invariants)
  if (trimmedPass !== MASTER_PASSWORD) {
    await recordAuditLog({
      actor: 'Aditya', // default actor placeholder for denied attempts
      action: 'LOGIN',
      details: 'Denied login: Incorrect master password.',
    }).catch(() => {});
    return { success: false, error: 'Incorrect master password. Access denied.' };
  }

  if (normalized !== 'aditya' && normalized !== 'anshuman') {
    return { success: false, error: 'Partner username not recognized. Please check your credentials.' };
  }

  const expectedCode = PARTNER_PASSCODES[normalized];
  if (trimmedCode !== expectedCode) {
    return { success: false, error: 'Invalid partner passcode. Access denied.' };
  }

  const formalName: PartnerName = normalized === 'aditya' ? 'Aditya' : 'Anshuman';
  savePartnerSession(formalName);

  await recordAuditLog({
    actor: formalName,
    action: 'LOGIN',
    details: `${formalName} logged in with master credentials and partner passcode.`,
  }).catch(() => {});

  return { success: true, partner: formalName };
}

// -------------------------------------------------------------
// Products Server & Firestore Dual-Persistence with Tombstones
// -------------------------------------------------------------

export function getLocalDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem('calc_deleted_product_ids');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {}
  return [];
}

export function recordLocalDeletedId(id: string): void {
  try {
    const current = getLocalDeletedIds();
    const strId = String(id).trim();
    if (strId && !current.includes(strId)) {
      current.push(strId);
      localStorage.setItem('calc_deleted_product_ids', JSON.stringify(current));
    }
  } catch {}
}

export function removeLocalDeletedId(id: string): void {
  try {
    const current = getLocalDeletedIds();
    const strId = String(id).trim();
    const filtered = current.filter((item) => item !== strId);
    localStorage.setItem('calc_deleted_product_ids', JSON.stringify(filtered));
  } catch {}
}

export async function fetchServerProducts(): Promise<CalculatedProduct[]> {
  let serverDeletedIds: string[] = getLocalDeletedIds();

  // 1a. Fetch deleted IDs tombstones from Firestore (Essential for cross-continental sync between India & Australia)
  try {
    const firestoreDelSnap = await getDocs(collection(db, 'calculator_deleted_ids'));
    if (!firestoreDelSnap.empty) {
      const fDelIds: string[] = [];
      firestoreDelSnap.forEach((d) => {
        if (d.id) fDelIds.push(String(d.id).trim());
      });
      if (fDelIds.length > 0) {
        serverDeletedIds = Array.from(new Set([...serverDeletedIds, ...fDelIds]));
        localStorage.setItem('calc_deleted_product_ids', JSON.stringify(serverDeletedIds));
      }
    }
  } catch (fDelErr) {
    console.warn('Error fetching deleted IDs from Firestore:', fDelErr);
  }

  // 1b. Fetch deleted IDs tombstones from server API
  try {
    const delRes = await fetch('/api/calculator-products/deleted-ids');
    if (delRes.ok) {
      const delList = await delRes.json();
      if (Array.isArray(delList)) {
        serverDeletedIds = Array.from(new Set([...serverDeletedIds, ...delList.map(String)]));
        localStorage.setItem('calc_deleted_product_ids', JSON.stringify(serverDeletedIds));
      }
    }
  } catch (err) {
    console.warn('Error fetching deleted IDs from server:', err);
  }

  // 1c. Sync merged tombstones to server in background
  if (serverDeletedIds.length > 0) {
    fetch('/api/calculator-products/deleted-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: serverDeletedIds }),
    }).catch(() => {});
  }

  // 2. Fetch authoritative products list from Server API
  let serverList: CalculatedProduct[] = [];
  try {
    const res = await fetch('/api/calculator-products');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Filter out any tombstoned IDs deleted by either partner
        serverList = data
          .filter((p: any) => p && p.id && !serverDeletedIds.includes(String(p.id)))
          .map(recalculateStoredProduct);
      }
    }
  } catch (err) {
    console.warn('Error fetching products from server API:', err);
  }

  // 3. Fallback/Supplement from Firestore 'calculator_products'
  try {
    const snap = await getDocs(collection(db, 'calculator_products'));
    if (!snap.empty) {
      const firestoreList: CalculatedProduct[] = [];
      snap.forEach((d) => {
        if (!serverDeletedIds.includes(d.id)) {
          const item = d.data() as CalculatedProduct;
          firestoreList.push(recalculateStoredProduct({ ...item, id: d.id }));
        }
      });
      // If server returned products, prefer server products merged with any unique firestore products
      if (serverList.length > 0) {
        const serverIds = new Set(serverList.map((p) => p.id));
        const extraFromFirestore = firestoreList.filter((p) => !serverIds.has(p.id));
        const combined = [...serverList, ...extraFromFirestore];
        return combined.filter((p) => !serverDeletedIds.includes(p.id));
      } else if (firestoreList.length > 0) {
        return firestoreList.filter((p) => !serverDeletedIds.includes(p.id));
      }
    }
  } catch (fErr) {
    console.warn('Error fetching products from Firestore:', fErr);
  }

  return serverList;
}

export async function saveProductToServer(
  product: CalculatedProduct,
  actor: PartnerName
): Promise<CalculatedProduct[]> {
  const recalculated = recalculateStoredProduct({
    ...product,
    lastModifiedBy: actor,
    updatedAt: new Date().toISOString(),
  });

  // If this product was previously marked deleted, untombstone it
  removeLocalDeletedId(recalculated.id);
  try {
    await deleteDoc(doc(db, 'calculator_deleted_ids', recalculated.id));
  } catch {}

  // 1. Save to Express server API
  try {
    const res = await fetch('/api/calculator-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: recalculated, user: actor }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products)) {
        // Update Firestore in background
        try {
          await setDoc(doc(db, 'calculator_products', recalculated.id), recalculated);
        } catch {}
        return data.products.map(recalculateStoredProduct);
      }
    }
  } catch (err) {
    console.warn('Failed to save to server API, updating Firestore:', err);
  }

  // 2. Fallback to direct Firestore write
  try {
    await setDoc(doc(db, 'calculator_products', recalculated.id), recalculated);
  } catch (fErr) {
    console.warn('Firestore write warning:', fErr);
  }

  return [recalculated];
}

export async function deleteProductFromServer(
  id: string,
  actor: PartnerName,
  productName?: string
): Promise<boolean> {
  const strId = String(id).trim();
  recordLocalDeletedId(strId);

  // 1. Register Cloud Tombstone on Firestore FIRST (Immediate global broadcast to all clients)
  try {
    await setDoc(doc(db, 'calculator_deleted_ids', strId), {
      id: strId,
      deletedAt: new Date().toISOString(),
      deletedBy: actor,
      productName: productName || strId,
    });
    await deleteDoc(doc(db, 'calculator_products', strId));
  } catch (fErr) {
    console.warn('Firestore delete error:', fErr);
  }

  // 2. Delete on Express Server API + Register Server Tombstone
  try {
    await fetch(`/api/calculator-products/${encodeURIComponent(strId)}?user=${encodeURIComponent(actor)}`, {
      method: 'DELETE',
    });
    await fetch('/api/calculator-products/deleted-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: strId }),
    });
  } catch (err) {
    console.warn('Server delete error:', err);
  }

  // 3. Record in Audit Log
  await recordAuditLog({
    actor,
    action: 'DELETE_PRODUCT',
    entityId: strId,
    entityName: productName,
    details: `${actor} deleted product "${productName || strId}".`,
  }).catch(() => {});

  return true;
}

export async function updateProductSalesOnServer(
  id: string,
  newUnits: number,
  actor: PartnerName,
  productName?: string,
  oldUnits?: number
): Promise<boolean> {
  try {
    await fetch(`/api/calculator-products/${encodeURIComponent(id)}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitsSold: newUnits, user: actor }),
    });
  } catch (err) {
    console.warn('Server sales update error:', err);
  }

  // Record audit log
  await recordAuditLog({
    actor,
    action: 'UPDATE_SALES',
    entityId: id,
    entityName: productName,
    details: `${actor} updated sales volume for "${productName || id}" from ${oldUnits ?? '?'} to ${newUnits} pcs.`,
  }).catch(() => {});

  return true;
}

export async function updateProductPriceOnServer(
  product: CalculatedProduct,
  newPrice: number,
  actor: PartnerName
): Promise<CalculatedProduct> {
  const oldPrice = product.sellingPrice;
  const updated = recalculateStoredProduct({
    ...product,
    sellingPrice: Number(newPrice) || 0,
    lastModifiedBy: actor,
    updatedAt: new Date().toISOString(),
  });

  await saveProductToServer(updated, actor);

  await recordAuditLog({
    actor,
    action: 'UPDATE_PRICE',
    entityId: product.id,
    entityName: product.name,
    details: `${actor} changed target selling price for "${product.name}" from ₹${oldPrice} to ₹${newPrice}.`,
  }).catch(() => {});

  return updated;
}

// -------------------------------------------------------------
// Real-Time Cross-Device Synchronization (Server Polling + Firestore)
// -------------------------------------------------------------

export function subscribeToProductUpdates(
  onProducts: (products: CalculatedProduct[]) => void
): () => void {
  let isMounted = true;
  let lastProductFingerprint = '';
  const inMemoryDeletedIds = new Set<string>(getLocalDeletedIds());

  // Helper to re-emit filtered products
  const applyProductUpdate = (rawList: CalculatedProduct[]) => {
    if (!isMounted) return;
    const active = rawList.filter((p) => p && p.id && !inMemoryDeletedIds.has(String(p.id).trim()));
    const fingerprint = JSON.stringify(
      active.map((p) => ({
        id: p.id,
        price: p.sellingPrice,
        units: p.unitsSold,
        updatedAt: p.updatedAt,
      }))
    );
    if (fingerprint !== lastProductFingerprint) {
      lastProductFingerprint = fingerprint;
      onProducts(active);
    }
  };

  // 1. High-frequency active Server Poll (every 2.5 seconds)
  // Ensures Anshuman's desktop in Australia reflects deletions made by Aditya immediately
  const pollServer = async () => {
    if (!isMounted) return;
    try {
      const activeProducts = await fetchServerProducts();
      if (!isMounted) return;
      applyProductUpdate(activeProducts);
    } catch (e) {
      console.warn('Real-time sync poll error:', e);
    }
  };

  // Immediate first poll
  pollServer();
  const pollInterval = setInterval(pollServer, 2500);

  // 2. Real-time Firestore Tombstone Listener (Crucial: Instantly catches deletions across continents!)
  let unsubDeletedDocs = () => {};
  try {
    unsubDeletedDocs = onSnapshot(
      collection(db, 'calculator_deleted_ids'),
      (snapshot) => {
        if (!isMounted) return;
        let hasNew = false;
        snapshot.forEach((d) => {
          const strId = String(d.id).trim();
          if (strId && !inMemoryDeletedIds.has(strId)) {
            inMemoryDeletedIds.add(strId);
            hasNew = true;
          }
        });
        if (hasNew) {
          const arr = Array.from(inMemoryDeletedIds);
          localStorage.setItem('calc_deleted_product_ids', JSON.stringify(arr));
          // Propagate to local server API
          fetch('/api/calculator-products/deleted-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: arr }),
          }).catch(() => {});
          // Trigger immediate server poll to refresh UI
          pollServer();
        }
      },
      (err) => {
        console.warn('Deleted IDs snapshot listener notice:', err);
      }
    );
  } catch (e) {
    console.warn('Unable to bind deleted IDs snapshot listener:', e);
  }

  // 3. Firestore onSnapshot real-time products listener
  let unsubFirestoreProducts = () => {};
  try {
    unsubFirestoreProducts = onSnapshot(
      collection(db, 'calculator_products'),
      (snapshot) => {
        if (!isMounted) return;
        const list: CalculatedProduct[] = [];
        snapshot.forEach((d) => {
          const strId = String(d.id).trim();
          if (!inMemoryDeletedIds.has(strId)) {
            const item = d.data() as CalculatedProduct;
            list.push(recalculateStoredProduct({ ...item, id: d.id }));
          }
        });
        if (list.length > 0) {
          applyProductUpdate(list);
        }
      },
      (err) => {
        console.warn('Firestore onSnapshot listener warning, continuing on server poll:', err);
      }
    );
  } catch (e) {
    console.warn('Unable to bind snapshot listener:', e);
  }

  return () => {
    isMounted = false;
    clearInterval(pollInterval);
    unsubDeletedDocs();
    unsubFirestoreProducts();
  };
}

export async function restoreCatalogPresetsOnServer(
  actor: PartnerName
): Promise<CalculatedProduct[]> {
  // 1. Clear demo preset IDs from local storage
  INITIAL_PRESET_PRODUCTS.forEach((p) => {
    removeLocalDeletedId(p.id);
  });

  // 2. Clear from Firestore calculator_deleted_ids
  try {
    for (const p of INITIAL_PRESET_PRODUCTS) {
      await deleteDoc(doc(db, 'calculator_deleted_ids', p.id));
    }
  } catch {}

  // 3. Save to server API restore endpoint
  try {
    await fetch('/api/calculator-products/restore-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: actor }),
    });
  } catch (err) {
    console.warn('Server restore presets error:', err);
  }

  // 4. Save presets to Firestore
  try {
    for (const p of INITIAL_PRESET_PRODUCTS) {
      await setDoc(doc(db, 'calculator_products', p.id), p);
    }
  } catch {}

  // 5. Record Audit Log
  await recordAuditLog({
    actor,
    action: 'RESET_CATALOG',
    details: `${actor} restored 3 demo product calculations to live catalog.`,
  }).catch(() => {});

  return INITIAL_PRESET_PRODUCTS;
}

// -------------------------------------------------------------
// Category Management & Server / Firestore Live Sync
// -------------------------------------------------------------

export const DEFAULT_PRODUCT_CATEGORIES: string[] = [
  'Home & Living',
  'Desk & Tech',
  'Toys & Fidgets',
  'Art & Sculptures',
  'Mechanical & Tools',
  'Accessories & Wearables',
  'Outdoor & Garden',
  'Custom Print Commission',
];

export async function fetchServerCategories(): Promise<string[]> {
  // 1. Fetch from Server API
  try {
    const res = await fetch('/api/calculator-categories');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        return data.categories;
      }
    }
  } catch (err) {
    console.warn('Error fetching categories from server API:', err);
  }

  // 2. Fetch from Firestore fallback
  try {
    const snap = await getDocs(collection(db, 'calculator_categories'));
    if (!snap.empty) {
      const list: string[] = [];
      snap.forEach((d) => {
        const name = d.data()?.name || d.id;
        if (name && !list.includes(name)) list.push(name);
      });
      if (list.length > 0) return list;
    }
  } catch (fErr) {
    console.warn('Error fetching categories from Firestore:', fErr);
  }

  return DEFAULT_PRODUCT_CATEGORIES;
}

export async function saveCategoryToServer(
  name: string,
  actor: PartnerName
): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) return DEFAULT_PRODUCT_CATEGORIES;

  // 1. Post to Server API
  try {
    const res = await fetch('/api/calculator-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, user: actor }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.categories)) {
        // Also persist to Firestore in background
        try {
          const docId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_');
          await setDoc(doc(db, 'calculator_categories', docId), {
            name: trimmed,
            createdBy: actor,
            createdAt: new Date().toISOString(),
          });
        } catch {}
        return data.categories;
      }
    }
  } catch (err) {
    console.warn('Error saving category to server API:', err);
  }

  // 2. Firestore fallback
  try {
    const docId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await setDoc(doc(db, 'calculator_categories', docId), {
      name: trimmed,
      createdBy: actor,
      createdAt: new Date().toISOString(),
    });
  } catch {}

  // 3. Record Audit Log
  await recordAuditLog({
    actor,
    action: 'CREATE_CATEGORY',
    details: `${actor} created new product category "${trimmed}".`,
  }).catch(() => {});

  return [trimmed];
}

export async function deleteCategoryFromServer(
  name: string,
  actor: PartnerName
): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  // 1. Delete on Server API
  try {
    const res = await fetch(`/api/calculator-categories/${encodeURIComponent(trimmed)}?user=${encodeURIComponent(actor)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.categories)) {
        try {
          const docId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_');
          await deleteDoc(doc(db, 'calculator_categories', docId));
        } catch {}
        return data.categories;
      }
    }
  } catch (err) {
    console.warn('Error deleting category from server API:', err);
  }

  // 2. Delete on Firestore
  try {
    const docId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await deleteDoc(doc(db, 'calculator_categories', docId));
  } catch {}

  await recordAuditLog({
    actor,
    action: 'DELETE_CATEGORY',
    details: `${actor} deleted category "${trimmed}".`,
  }).catch(() => {});

  return [];
}

export function subscribeToCategoryUpdates(
  onCategories: (cats: string[]) => void
): () => void {
  let isMounted = true;
  let lastFingerprint = '';

  const pollCategories = async () => {
    if (!isMounted) return;
    try {
      const cats = await fetchServerCategories();
      if (!isMounted) return;
      const fp = JSON.stringify(cats);
      if (fp !== lastFingerprint) {
        lastFingerprint = fp;
        onCategories(cats);
      }
    } catch {}
  };

  pollCategories();
  const interval = setInterval(pollCategories, 2500);

  let unsubFirestore = () => {};
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'calculator_categories'),
      (snapshot) => {
        if (!isMounted) return;
        const list: string[] = [];
        snapshot.forEach((d) => {
          const name = d.data()?.name || d.id;
          if (name && !list.includes(name)) list.push(name);
        });
        if (list.length > 0) {
          const merged = Array.from(new Set([...DEFAULT_PRODUCT_CATEGORIES, ...list]));
          const fp = JSON.stringify(merged);
          if (fp !== lastFingerprint) {
            lastFingerprint = fp;
            onCategories(merged);
          }
        }
      },
      () => {}
    );
  } catch {}

  return () => {
    isMounted = false;
    clearInterval(interval);
    unsubFirestore();
  };
}

// -------------------------------------------------------------
// Audit Trail Server & Firestore Storage
// -------------------------------------------------------------

export async function fetchServerAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const res = await fetch('/api/audit-logs');
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        return list.map((item) => ({
          id: item.id || `audit-${Date.now()}`,
          timestamp: item.timestamp || new Date().toISOString(),
          actor: (item.user as PartnerName) || (item.actor as PartnerName) || 'Aditya',
          action: item.action || 'UPDATE_PRODUCT',
          entityId: item.entityId,
          entityName: item.entityName,
          details: item.details || item.message || '',
        }));
      }
    }
  } catch (err) {
    console.warn('Error fetching audit logs from server:', err);
  }

  // Firestore fallback
  try {
    const snap = await getDocs(collection(db, 'calculator_audit_logs'));
    if (!snap.empty) {
      const logs: AuditLogEntry[] = [];
      snap.forEach((d) => logs.push(d.data() as AuditLogEntry));
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  } catch {}

  return [];
}

export async function recordAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): Promise<void> {
  const fullEntry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // 1. Post to Server API
  try {
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: entry.actor,
        action: entry.action,
        category: 'calculator',
        details: entry.details,
        status: 'Success',
      }),
    });
  } catch (err) {
    console.warn('Server audit log append error:', err);
  }

  // 2. Also write to Firestore
  try {
    await setDoc(doc(db, 'calculator_audit_logs', fullEntry.id), fullEntry);
  } catch {}
}
