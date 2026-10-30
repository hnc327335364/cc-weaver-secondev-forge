export function normalizeBaseline(value) {
  const text = String(value ?? '').trim();
  const match = /^(?:10\.0\.(\d{4})\.01|(\d{4})|(\d{2})[. ](\d{2}))$/.exec(text);
  if (!match) return null;
  const key = match[1] || match[2] || match[3] + match[4];
  const month = Number(key.slice(2));
  return month >= 1 && month <= 12 ? `10.0.${key}.01` : null;
}

export function baselinesInPrompt(text, allowShort = false) {
  const pattern = allowShort
    ? /(?<![a-z\d.])(?:10\.0\.\d{4}\.01|\d{2}[. ]\d{2}|\d{4})(?![a-z\d.]|\s*(?:个|行|条))/gi
    : /(?<![a-z\d.])10\.0\.\d{4}\.01(?![a-z\d.])/gi;
  return [...new Set([...text.matchAll(pattern)].map(match => normalizeBaseline(match[0])).filter(Boolean))];
}
