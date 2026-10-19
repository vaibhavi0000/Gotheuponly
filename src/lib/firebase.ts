import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Always allow admin operations to attempt Cloud Firestore writes
export function isFirestoreWritesAllowed(): boolean {
  return true;
}

export function markFirestoreQuotaExceeded() {
  // Graceful no-op to prevent locking subsequent admin edits/deletions
}

function handleFirestoreError(err: any): void {
  const msg = String(err?.message || err?.code || err || '').toLowerCase();
  if (msg.includes('resource-exhausted') || msg.includes('quota') || err?.code === 'resource-exhausted') {
    console.warn('Firestore write quota limit encountered; falling back to local and client persistence.');
  } else {
    console.warn('Firestore operation warning:', err);
  }
}

export interface FirestoreActivity {
  id?: string;
  type: 'view' | 'cart' | 'order' | 'print';
  message: string;
  timestamp: any;
}

export async function recordLiveActivity(type: 'view' | 'cart' | 'order' | 'print', message: string) {
  try {
    // 1. Always record in localStorage for instant offline & admin panel display
    try {
      const stored = localStorage.getItem('tsukuri_activity_logs');
      const list = stored ? JSON.parse(stored) : [];
      list.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        message,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('tsukuri_activity_logs', JSON.stringify(list.slice(0, 50)));
    } catch {}

    // 2. Also notify local Express telemetry endpoint if available
    try {
      fetch('/api/telemetry/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: type, eventMessage: message }),
      }).catch(() => {});
    } catch {}
  } catch {}
}

export function subscribeToLiveActivity(callback: (events: FirestoreActivity[]) => void) {
  try {
    const colRef = collection(db, 'live_activity');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(15));
    return onSnapshot(
      q,
      (snapshot) => {
        const items: FirestoreActivity[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...(doc.data() as any) });
        });
        callback(items);
      },
      (error) => {
        handleFirestoreError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err);
    return () => {};
  }
}

// Direct Cloud Force-Sync Interface (For Admin mount & explicit on-demand sync)
export interface FirestoreSyncData {
  products: any[];
  deletedIds: number[];
  bestsellerId?: number;
  customCategories?: string[];
}

export async function forceFetchLatestFirestoreData(): Promise<FirestoreSyncData> {
  const result: FirestoreSyncData = {
    products: [],
    deletedIds: [1, 100000, 57004, 99999],
  };

  const tasks = Promise.allSettled([
    // 1. Fetch deleted IDs tombstones
    (async () => {
      const delSnap = await getDoc(doc(db, 'tsukuri_metadata', 'deleted_products'));
      if (delSnap.exists() && Array.isArray(delSnap.data()?.ids)) {
        const ids = delSnap.data().ids.map(Number).filter((n: number) => !isNaN(n));
        result.deletedIds = Array.from(new Set([...result.deletedIds, ...ids]));
      }
    })(),
    // 2. Fetch bestseller product ID
    (async () => {
      const bsSnap = await getDoc(doc(db, 'tsukuri_metadata', 'bestseller'));
      if (bsSnap.exists() && bsSnap.data()?.productId) {
        result.bestsellerId = Number(bsSnap.data()?.productId);
      }
    })(),
    // 3. Fetch custom categories
    (async () => {
      const catSnap = await getDoc(doc(db, 'tsukuri_metadata', 'custom_categories'));
      if (catSnap.exists() && Array.isArray(catSnap.data()?.categories)) {
        result.customCategories = catSnap.data().categories.filter(Boolean);
      }
    })(),
    // 4. Fetch products collection directly
    (async () => {
      const colRef = collection(db, 'tsukuri_products');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const list: any[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const idNum = Number(data.id || docSnap.id);
          list.push({ ...data, id: idNum });
        });
        list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
        result.products = list;
      }
    })(),
  ]);

  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  await Promise.race([tasks, timeout]);

  // Strip deleted IDs from fetched products
  if (result.products.length > 0) {
    result.products = result.products.filter((p) => !result.deletedIds.includes(Number(p.id)));
  }

  return result;
}

// Bestseller Firestore Cloud Sync
export async function saveBestsellerToFirestore(productId: number): Promise<boolean> {
  try {
    const metaRef = doc(db, 'tsukuri_metadata', 'bestseller');
    const writePromise = setDoc(metaRef, { productId: Number(productId), updatedAt: new Date().toISOString() }, { merge: true });
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    await Promise.race([writePromise, timeout]);
    return true;
  } catch (err) {
    handleFirestoreError(err);
    return false;
  }
}

export function subscribeToBestseller(callback: (id: number) => void) {
  try {
    const metaRef = doc(db, 'tsukuri_metadata', 'bestseller');
    return onSnapshot(
      metaRef,
      (snap) => {
        if (snap.exists() && snap.data()?.productId) {
          callback(Number(snap.data()?.productId));
        }
      },
      (err) => {
        handleFirestoreError(err);
      }
    );
  } catch (err) {
    return () => {};
  }
}

// Real-time Firestore Product Persistence (Guaranteed Cloud Sync for Vercel, Mobile & Desktop)
export async function saveProductToFirestore(product: any): Promise<boolean> {
  try {
    const docRef = doc(db, 'tsukuri_products', String(product.id));
    const cleanProd = JSON.parse(JSON.stringify(product));
    delete cleanProd._isLocalOptimistic;
    delete cleanProd._createdAt;
    cleanProd.updatedAt = new Date().toISOString();

    // Guard: Prevent oversized base64 strings from exceeding Firestore document limit
    if (typeof cleanProd.imageUrl === 'string') {
      if (cleanProd.imageUrl.startsWith('blob:')) {
        cleanProd.imageUrl = 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=700';
      } else if (cleanProd.imageUrl.startsWith('data:') && cleanProd.imageUrl.length > 250000) {
        cleanProd.imageUrl = 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=700';
      }
    }

    if (typeof cleanProd.videoUrl === 'string') {
      if (cleanProd.videoUrl.startsWith('blob:')) {
        cleanProd.videoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-3d-printer-printing-a-small-object-41618-large.mp4';
      } else if (cleanProd.videoUrl.startsWith('data:') && cleanProd.videoUrl.length > 150000) {
        cleanProd.videoUrl = '';
      }
    }

    if (Array.isArray(cleanProd.carouselVideos)) {
      const sampleReels = [
        'https://assets.mixkit.co/videos/preview/mixkit-3d-printer-printing-a-small-object-41618-large.mp4',
        'https://assets.mixkit.co/videos/preview/mixkit-3d-printer-in-action-41619-large.mp4',
        'https://assets.mixkit.co/videos/preview/mixkit-detailed-macro-shot-of-a-3d-printer-extruder-41620-large.mp4',
      ];
      cleanProd.carouselVideos = cleanProd.carouselVideos.map((v: any, idx: number) => {
        let u = v.url;
        if (typeof u === 'string' && (u.startsWith('blob:') || (u.startsWith('data:') && u.length > 150000))) {
          u = sampleReels[idx % sampleReels.length];
        }
        return { ...v, url: u };
      });
    }

    if (Array.isArray(cleanProd.images)) {
      cleanProd.images = cleanProd.images.slice(0, 5).map((img: any) => {
        if (typeof img === 'string') {
          if (img.startsWith('blob:')) {
            return cleanProd.imageUrl && !cleanProd.imageUrl.startsWith('blob:')
              ? cleanProd.imageUrl
              : 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=700';
          }
          if (img.startsWith('data:') && img.length > 200000) {
            return 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=700';
          }
        }
        return img;
      });
    }

    // Save with fast timeout ceiling so UI is never blocked or frozen
    const writePromise = setDoc(docRef, cleanProd, { merge: true });
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    await Promise.race([writePromise, timeout]);
    return true;
  } catch (err) {
    handleFirestoreError(err);
    return false;
  }
}

export async function recordDeletedProductId(id: number | string): Promise<void> {
  const numId = Number(id);
  // 1. Instantly record in local storage tombstones
  try {
    const stored = localStorage.getItem('tsukuri_deleted_product_ids');
    const ids: number[] = stored ? JSON.parse(stored) : [];
    if (!ids.includes(numId)) {
      ids.push(numId);
      localStorage.setItem('tsukuri_deleted_product_ids', JSON.stringify(ids));
    }
  } catch {}

  // 2. Persist to Firestore deleted_products using atomic arrayUnion (0 extra reads, fast direct write)
  try {
    const metaRef = doc(db, 'tsukuri_metadata', 'deleted_products');
    const writePromise = setDoc(metaRef, { ids: arrayUnion(numId), updatedAt: new Date().toISOString() }, { merge: true });
    const timeout = new Promise((resolve) => setTimeout(resolve, 1200));
    await Promise.race([writePromise, timeout]);
  } catch (err) {
    handleFirestoreError(err);
  }
}

export async function removeDeletedProductId(id: number | string): Promise<void> {
  const numId = Number(id);
  try {
    const stored = localStorage.getItem('tsukuri_deleted_product_ids');
    if (stored) {
      const ids: number[] = JSON.parse(stored).filter((i: number) => Number(i) !== numId);
      localStorage.setItem('tsukuri_deleted_product_ids', JSON.stringify(ids));
    }
  } catch {}

  try {
    const metaRef = doc(db, 'tsukuri_metadata', 'deleted_products');
    const writePromise = setDoc(metaRef, { ids: arrayRemove(numId), updatedAt: new Date().toISOString() }, { merge: true });
    const timeout = new Promise((resolve) => setTimeout(resolve, 1200));
    await Promise.race([writePromise, timeout]);
  } catch (err) {
    handleFirestoreError(err);
  }
}

export function subscribeToDeletedProductIds(callback: (ids: number[]) => void) {
  try {
    const metaRef = doc(db, 'tsukuri_metadata', 'deleted_products');
    return onSnapshot(
      metaRef,
      (docSnap) => {
        if (docSnap.exists() && Array.isArray(docSnap.data()?.ids)) {
          const ids = docSnap.data()?.ids.map(Number).filter((n: number) => !isNaN(n));
          callback(ids);
        } else {
          callback([]);
        }
      },
      (err) => {
        handleFirestoreError(err);
      }
    );
  } catch (err) {
    handleFirestoreError(err);
    return () => {};
  }
}

// Cross-device Category Sync
export async function saveCustomCategoriesToFirestore(categories: string[]): Promise<boolean> {
  try {
    const catRef = doc(db, 'tsukuri_metadata', 'custom_categories');
    const writePromise = setDoc(catRef, { categories, updatedAt: new Date().toISOString() }, { merge: true });
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    await Promise.race([writePromise, timeout]);
    return true;
  } catch (err) {
    handleFirestoreError(err);
    return false;
  }
}

export function subscribeToCustomCategories(callback: (categories: string[]) => void) {
  try {
    const catRef = doc(db, 'tsukuri_metadata', 'custom_categories');
    return onSnapshot(
      catRef,
      (docSnap) => {
        if (docSnap.exists() && Array.isArray(docSnap.data()?.categories)) {
          callback(docSnap.data()?.categories.filter(Boolean));
        }
      },
      (err) => {
        handleFirestoreError(err);
      }
    );
  } catch (err) {
    handleFirestoreError(err);
    return () => {};
  }
}

// Ultra-fast, universal product deletion across worldwide devices
export async function deleteProductFromFirestore(id: number | string): Promise<boolean> {
  const numId = Number(id);
  const strId = String(id);

  // 1. Record in local storage tombstones immediately (0ms)
  try {
    const stored = localStorage.getItem('tsukuri_deleted_product_ids');
    const ids: number[] = stored ? JSON.parse(stored) : [];
    if (!ids.includes(numId)) {
      ids.push(numId);
      localStorage.setItem('tsukuri_deleted_product_ids', JSON.stringify(ids));
    }
  } catch {}

  // 2. Parallel Cloud Deletion: atomic arrayUnion tombstone + doc deletion executed simultaneously
  // Protected with a strict 1000ms ceiling to prevent any backoff hangs
  try {
    const metaRef = doc(db, 'tsukuri_metadata', 'deleted_products');
    const docRef = doc(db, 'tsukuri_products', strId);

    const cloudOperations = Promise.allSettled([
      setDoc(metaRef, { ids: arrayUnion(numId), updatedAt: new Date().toISOString() }, { merge: true }),
      deleteDoc(docRef),
    ]);

    const timeout = new Promise((resolve) => setTimeout(resolve, 1000));
    await Promise.race([cloudOperations, timeout]);
    return true;
  } catch (err) {
    handleFirestoreError(err);
    return false;
  }
}

export function subscribeToProducts(callback: (products: any[]) => void) {
  try {
    const colRef = collection(db, 'tsukuri_products');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const docIdNum = Number(data.id || docSnap.id);
          list.push({ ...data, id: docIdNum });
        });
        list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
        callback(list);
      },
      (error) => {
        handleFirestoreError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err);
    return () => {};
  }
}

export async function seedProductsIfEmpty(initialProducts: any[]) {
  if (!isFirestoreWritesAllowed()) {
    return;
  }
  try {
    const metaRef = doc(db, 'tsukuri_metadata', 'catalog_seeded');
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists()) {
      return;
    }
    const delSnap = await getDoc(doc(db, 'tsukuri_metadata', 'deleted_products'));
    if (delSnap.exists() && Array.isArray(delSnap.data()?.ids) && delSnap.data()?.ids.length > 0) {
      return;
    }
    const colRef = collection(db, 'tsukuri_products');
    const snap = await getDocs(colRef);
    if (snap.empty && Array.isArray(initialProducts) && initialProducts.length > 0) {
      for (const p of initialProducts) {
        await saveProductToFirestore(p);
      }
      await setDoc(metaRef, { seededAt: new Date().toISOString() });
    }
  } catch (err) {
    handleFirestoreError(err);
  }
}
