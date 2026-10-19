export const APEXPAY_GATEWAY_URL = 'https://apex-seven-ashy.vercel.app';
export const APEXPAY_WEBHOOK_SECRET = 'whsec_98f12a88e91d84b238ef';

export const TSUKURI_UPI_DETAILS = {
  vpa: 'joshi2010@slc',
  beneficiary: 'Aditya Joshi',
  bankName: 'North East Small Finance Bank',
  accountNumber: '033311501086572',
  ifsc: 'NESF0000333',
};

/**
 * Builds the exact redirect URL to Apex Live Payment Gateway
 * Format:
 * https://apex-seven-ashy.vercel.app/?checkout=live&amount=${totalAmount}&order_id=${orderId}&description=${encodeURIComponent(productTitle)}&customer_name=${customerName}&customer_email=${customerEmail}&return_url=${window.location.origin}/order-success
 */
export function buildApexCheckoutUrl(params: {
  amount: number;
  orderId: string | number;
  productTitle: string;
  customerName: string;
  customerEmail: string;
  returnUrl?: string;
}): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tsukuri3d.store';
  const returnUrl = params.returnUrl || `${origin}/order-success`;

  const queryParams = new URLSearchParams({
    checkout: 'live',
    amount: String(Math.round(params.amount)),
    order_id: String(params.orderId),
    description: params.productTitle || 'Tsukuri3D Custom Print',
    customer_name: params.customerName || 'Customer',
    customer_email: params.customerEmail || '',
    return_url: returnUrl,
  });

  return `${APEXPAY_GATEWAY_URL}/?${queryParams.toString()}`;
}

/**
 * Builds UPI payment deep link
 */
export function buildUpiDeepLink(params: {
  vpa?: string;
  name?: string;
  amount: number;
  orderNumber: string;
}): string {
  const vpa = params.vpa || TSUKURI_UPI_DETAILS.vpa;
  const name = params.name || TSUKURI_UPI_DETAILS.beneficiary;
  const note = `Tsukuri3D Order #${params.orderNumber}`;
  return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${params.amount}&cu=INR&tn=${encodeURIComponent(note)}`;
}
