// Versioned, manually curated text from the existing site. Changes require code review.
// Never ingest arbitrary web pages, uploaded documents, or user-provided URLs here.
export const POLICY_VERSION = '2026-09-26.1';
export const REFUSAL = 'I can’t provide guidance on human or animal use, dosage, injection, reconstitution, treatment, side effects, or health outcomes. Pepcision products are for laboratory research use only and are not for human or animal consumption. I can help with documentation, shipping, availability, or order support.';
export const HANDOFF = 'I don’t have approved information to answer that. Contact the Pepcision team at orders@pepcision.com for product documentation, availability, or order support. Please do not include payment details or medical information.';
export const SENSITIVE = 'Please don’t share personal, payment, account, or medical information in chat. For order support, contact orders@pepcision.com. I can help with general documentation and shipping questions.';
export const KB = Object.freeze([
  { id: 'shipping', title: 'Shipping & fulfillment', answer: 'Orders are fulfilled from Tampa, Florida. Pepcision does not direct-ship customer orders from overseas. For delivery timing, destinations, or shipping charges, contact orders@pepcision.com.', source: '/faq.html', sourceLabel: 'Shipping FAQ', phrases: ['shipping', 'where do orders ship from', 'where do you ship from', 'shipping and fulfillment'] },
  { id: 'coa', title: 'COAs & lot documents', answer: 'Lot-specific analytical documentation is provided when available. Contact orders@pepcision.com with the product and lot number you need. I can’t confirm a lot’s purity or testing results without its documentation.', source: '/faq.html', sourceLabel: 'Documentation FAQ', phrases: ['coa', 'coas', 'do you provide coas', 'lot documents', 'documentation', 'purity'] },
  { id: 'availability', title: 'Product availability', answer: 'Contact orders@pepcision.com for current product availability. This chat does not have live inventory or pricing.', source: '/contact.html', sourceLabel: 'Contact Pepcision', phrases: ['availability', 'product availability', 'what is in stock', 'pricing'] },
  { id: 'storage', title: 'Storage documentation', answer: 'Refer to the documentation for your specific product and lot for storage information. Contact orders@pepcision.com if you need those documents. I don’t have approved temperatures, shelf lives, or preparation instructions to provide.', source: '/contact.html', sourceLabel: 'Request lot documentation', phrases: ['storage', 'storage documentation', 'how should products be stored'] },
  { id: 'support', title: 'Order support', answer: 'For order questions, contact orders@pepcision.com. This chat cannot access order records or process payments. Do not share card details, passwords, or medical information here.', source: '/contact.html', sourceLabel: 'Contact Pepcision', phrases: ['support', 'order support', 'contact', 'contact support', 'where is my order', 'payment'] },
  { id: 'research_policy', title: 'Research-use policy', answer: 'Pepcision products are for laboratory research use only and are not for human or animal consumption. Pepcision does not provide medical, dosing, reconstitution, or human-use guidance.', source: '/faq.html', sourceLabel: 'Research-use FAQ', phrases: ['research use policy', 'research only', 'what is your research use policy'] }
].map(entry => Object.freeze({ ...entry, active: true, reviewedAt: '2026-09-26', expiresAt: '2026-12-25', provenance: 'Existing Pepcision site; curated for this implementation' })));

export function approvedEntry(id, now = new Date()) {
  return KB.find(entry => entry.id === id && entry.active && now < new Date(`${entry.expiresAt}T23:59:59Z`));
}

// The server always builds the response; model-generated text never crosses this boundary.
export function renderDecision(decision, now = new Date()) {
  if (decision.action === 'refused') return { action: 'refused', answer: REFUSAL, source: null };
  if (decision.action === 'sensitive') return { action: 'sensitive', answer: SENSITIVE, source: null };
  const entry = decision.action === 'answered' && approvedEntry(decision.answerId, now);
  if (!entry) return { action: 'escalated', answer: HANDOFF, source: null };
  return { action: 'answered', answer: entry.answer, source: { path: entry.source, label: entry.sourceLabel } };
}
