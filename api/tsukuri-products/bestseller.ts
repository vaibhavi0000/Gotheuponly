import fs from 'fs';
import path from 'path';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { productId } = req.body || {};
      if (productId) {
        const bsPath = path.join(process.cwd(), 'data', 'bestseller_product.json');
        const dir = path.dirname(bsPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(bsPath, JSON.stringify({ productId: Number(productId), updatedAt: new Date().toISOString() }), 'utf-8');
        return res.status(200).json({ success: true, productId: Number(productId) });
      }
    } catch {}
    return res.status(200).json({ success: true });
  }

  try {
    const bsPath = path.join(process.cwd(), 'data', 'bestseller_product.json');
    if (fs.existsSync(bsPath)) {
      const data = JSON.parse(fs.readFileSync(bsPath, 'utf-8'));
      return res.status(200).json(data);
    }
  } catch {}

  return res.status(200).json({ productId: 57005 });
}
