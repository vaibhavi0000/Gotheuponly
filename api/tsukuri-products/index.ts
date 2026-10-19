import { INITIAL_TSUKURI_PRODUCTS } from '../../src/components/tsukuri/tsukuriData.ts';
import fs from 'fs';
import path from 'path';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Load deleted IDs if available
  let deletedIds: number[] = [1, 100000, 57004, 99999];
  try {
    const delPath = path.join(process.cwd(), 'data', 'deleted_products.json');
    if (fs.existsSync(delPath)) {
      const delData = JSON.parse(fs.readFileSync(delPath, 'utf-8'));
      if (Array.isArray(delData)) deletedIds = Array.from(new Set([...deletedIds, ...delData.map(Number)]));
    }
  } catch {}

  if (req.method === 'GET') {
    // Try reading data/tsukuri_products.json
    try {
      const prodPath = path.join(process.cwd(), 'data', 'tsukuri_products.json');
      if (fs.existsSync(prodPath)) {
        const list = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
        if (Array.isArray(list) && list.length > 0) {
          const clean = list.filter((p: any) => !deletedIds.includes(Number(p.id)));
          return res.status(200).json(clean);
        }
      }
    } catch {}

    // Fallback to built-in curated catalog
    const fallback = INITIAL_TSUKURI_PRODUCTS.filter((p) => !deletedIds.includes(Number(p.id)));
    return res.status(200).json(fallback);
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const prodPath = path.join(process.cwd(), 'data', 'tsukuri_products.json');
      let list: any[] = [];
      if (fs.existsSync(prodPath)) {
        list = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
      }
      const prod = req.body;
      if (prod && prod.id) {
        list = [prod, ...list.filter((p: any) => Number(p.id) !== Number(prod.id))];
        const dir = path.dirname(prodPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(prodPath, JSON.stringify(list, null, 2), 'utf-8');
      }
    } catch {}
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    try {
      const id = req.query?.id || (req.url && req.url.split('/').pop());
      if (id) {
        const numId = Number(id);
        const delPath = path.join(process.cwd(), 'data', 'deleted_products.json');
        let delList: number[] = [1, 100000, 57004, 99999];
        if (fs.existsSync(delPath)) {
          delList = JSON.parse(fs.readFileSync(delPath, 'utf-8'));
        }
        if (!delList.includes(numId)) {
          delList.push(numId);
          const dir = path.dirname(delPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(delPath, JSON.stringify(delList, null, 2), 'utf-8');
        }
      }
    } catch {}
    return res.status(200).json({ success: true });
  }

  return res.status(200).json({ success: true });
}
