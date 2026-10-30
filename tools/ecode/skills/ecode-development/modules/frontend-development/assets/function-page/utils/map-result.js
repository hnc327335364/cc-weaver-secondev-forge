// Pure mapping example; the caller supplies a validated application response.
export function mapItems(items) {
  return Array.isArray(items) ? items.map(item => ({ ...item })) : [];
}
