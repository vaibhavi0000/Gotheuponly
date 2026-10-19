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
// Products Server & Firestore Dual-Persistence
// -------------------------------------------------------------

export async function fetchServerProducts(): Promise<CalculatedProduct[]> {
  // 1. Try Server API endpoint
  try {
    const res = await fetch('/api/calculator-products');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(recalculateStoredProduct);
      }
    }
  } catch (err) {
    console.warn('Error fetching products from server API:', err);
  }

  // 2. Try Firestore 'calculator_products'
  try {
    const snap = await getDocs(collection(db, 'calculator_products'));
    if (!snap.empty) {
      const list: CalculatedProduct[] = [];
      snap.forEach((d) => {
        const item = d.data() as CalculatedProduct;
        list.push(recalculateStoredProduct({ ...item, id: d.id }));
      });
      if (list.length > 0) {
        // Sync to server disk in background
        fetch('/api/calculator-products/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: list, user: 'System Sync' }),
        }).catch(() => {});
        return list;
      }
    }
  } catch (fErr) {
    console.warn('Error fetching products from Firestore:', fErr);
  }

  // 3. Fallback to initial default preset products & sync to server
  try {
    fetch('/api/calculator-products/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: INITIAL_PRESET_PRODUCTS, user: 'Initial Seed' }),
    }).catch(() => {});
  } catch {}

  return INITIAL_PRESET_PRODUCTS;
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
  // 1. Delete on Express Server API
  try {
    await fetch(`/api/calculator-products/${encodeURIComponent(id)}?user=${encodeURIComponent(actor)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Server delete error:', err);
  }

  // 2. Delete on Firestore
  try {
    await deleteDoc(doc(db, 'calculator_products', id));
  } catch (fErr) {
    console.warn('Firestore delete error:', fErr);
  }

  // 3. Record in Audit Log
  await recordAuditLog({
    actor,
    action: 'DELETE_PRODUCT',
    entityId: id,
    entityName: productName,
    details: `${actor} deleted product "${productName || id}".`,
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
// Real-Time Live Sync Subscription
// -------------------------------------------------------------

export function subscribeToProductUpdates(
  onProducts: (products: CalculatedProduct[]) => void
): () => void {
  // Try Firestore onSnapshot listener
  try {
    const unsub = onSnapshot(
      collection(db, 'calculator_products'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CalculatedProduct[] = [];
          snapshot.forEach((d) => {
            const item = d.data() as CalculatedProduct;
            list.push(recalculateStoredProduct({ ...item, id: d.id }));
          });
          if (list.length > 0) {
            onProducts(list);
          }
        }
      },
      (err) => {
        console.warn('Firestore onSnapshot listener error, relying on server polling:', err);
      }
    );
    return unsub;
  } catch (e) {
    console.warn('Unable to bind snapshot listener:', e);
    return () => {};
  }
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
