/** Random, collision-safe id with a readable prefix, e.g. "ses_k3j9…". */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('')}`;
}
