import { getInvoicesCollection } from './db.js';

/**
 * Generates the next invoice number in format INV-YYYYMM-NNN.
 * Finds the max sequence number for the current month and increments it.
 */
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `INV-${yyyy}${mm}-`;

  const invoices = getInvoicesCollection();
  const latest = await invoices
    .find({ invoiceNumber: { $regex: `^${prefix}` } })
    .sort({ invoiceNumber: -1 })
    .limit(1)
    .toArray();

  let seq = 1;
  if (latest.length > 0) {
    const lastSeq = parseInt(latest[0].invoiceNumber.slice(prefix.length), 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}
