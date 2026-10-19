import fs from 'fs';
import path from 'path';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let deletedIds: number[] = [1, 100000, 57004, 99999];

  // 1. Fetch real-time tombstone document from Firestore REST API (Works instantly on Vercel serverless)
  try {
    const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/straight-quota-1smzh/databases/ai-studio-printhub3dprinti-8373b87d-2a2b-42b2-8d7e-37afc2f322b9/documents/tsukuri_metadata/deleted_products';
    const response = await fetch(firestoreUrl, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const data = await response.json();
      const rawValues = data?.fields?.ids?.arrayValue?.values;
      if (Array.isArray(rawValues)) {
        const cloudIds = rawValues
          .map((v: any) => Number(v.integerValue || v.stringValue))
          .filter((n: number) => !isNaN(n));
        deletedIds = Array.from(new Set([...deletedIds, ...cloudIds]));
      }
    }
  } catch {}

  // 2. Check local data/deleted_products.json if present
  try {
    const delPath = path.join(process.cwd(), 'data', 'deleted_products.json');
    if (fs.existsSync(delPath)) {
      const delData = JSON.parse(fs.readFileSync(delPath, 'utf-8'));
      if (Array.isArray(delData)) {
        deletedIds = Array.from(new Set([...deletedIds, ...delData.map(Number)]));
      }
    }
  } catch {}

  return res.status(200).json(deletedIds);
}
