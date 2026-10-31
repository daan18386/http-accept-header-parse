/**
 * Parser for HTTP Accept headers.
 *
 * The Accept header is a comma-separated list of media ranges, each with an
 * optional `q` parameter that expresses a relative preference between 0 and 1.
 * A missing `q` means 1. Ranges without a `q` therefore tie with each other,
 * and the spec says ties keep their original order in the header.
 *
 * Interpretation chosen here (stated once, and tested):
 *   - A range with a malformed `q` (not a number, outside 0..1) is dropped,
 *     because the header is unusable for that range and silently treating it
 *     as q=1 would invert the client's intent.
 *   - `q=0` means "not acceptable" and the range is dropped too.
 *   - Parameters other than `q` are preserved as-is on the parsed range so
 *     callers can inspect them, but they do not affect ordering.
 *   - Wildcards (`*`) and type wildcards (`text/*`) are accepted as literal
 *     strings; this module does not try to match them against a concrete type.
 */

/**
 * Parse a single media range such as `text/html;q=0.8;level=1`.
 *
 * Returns null when the range is malformed or carries a q value that makes
 * it unusable. Returning null instead of throwing keeps `parseAccept` able to
 * skip one bad range without discarding the rest of the header.
 *
 * @param {string} raw
 * @returns {{type: string, params: Record<string, string>, q: number} | null}
 */
function parseRange(raw) {
  const text = raw.trim();
  if (text === '') return null;

  const parts = text.split(';');
  const type = parts[0].trim().toLowerCase();
  if (type === '') return null;

  // A media range must look like `type/subtype` or a bare `*`. Anything else
  // is not something we can order meaningfully, so it is rejected.
  if (type !== '*') {
    const slash = type.indexOf('/');
    if (slash <= 0 || slash === type.length - 1) return null;
    if (type.indexOf('/', slash + 1) !== -1) return null;
  }

  const params = {};
  let q = 1;
  let sawQ = false;

  for (let i = 1; i < parts.length; i++) {
    const piece = parts[i].trim();
    if (piece === '') continue;

    const eq = piece.indexOf('=');
    if (eq === -1) {
      // A parameter with no value is legal enough to keep, but it carries no
      // information we can use. Store it with an empty value.
      params[piece.toLowerCase()] = '';
      continue;
    }

    const name = piece.slice(0, eq).trim().toLowerCase();
    let value = piece.slice(eq + 1).trim();
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
      value = value.slice(1, -1);
    }

    if (name === 'q') {
      sawQ = true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return null;
      q = parsed;
      continue;
    }

    params[name] = value;
  }

  if (sawQ && q === 0) return null;

  return { type, params, q };
}

/**
 * Parse an Accept header into an array of media ranges ordered by preference.
 *
 * Ordering is by descending q, with ties broken by the original position in
 * the header. That is the ordering the HTTP specification describes, and it is
 * stable, which matters because callers often rely on the first entry being
 * the client's genuine first choice.
 *
 * @param {string} header
 * @returns {Array<{type: string, params: Record<string, string>, q: number}>}
 */
export function parseAccept(header) {
  if (typeof header !== 'string' || header.trim() === '') return [];

  const ranges = [];
  const pieces = header.split(',');

  for (let i = 0; i < pieces.length; i++) {
    const parsed = parseRange(pieces[i]);
    if (parsed === null) continue;
    // Remember the original index so the sort can be stable without relying
    // on Array.prototype.sort's stability guarantee across engines.
    parsed._index = i;
    ranges.push(parsed);
  }

  ranges.sort((a, b) => {
    if (b.q !== a.q) return b.q - a.q;
    return a._index - b._index;
  });

  return ranges.map((range) => {
    const { type, params, q } = range;
    return { type, params, q };
  });
}

/**
 * Return the first media range in the header, or null when there is none.
 *
 * This is a convenience for the common case of "what does the client want".
 *
 * @param {string} header
 * @returns {{type: string, params: Record<string, string>, q: number} | null}
 */
export function preferred(header) {
  const ranges = parseAccept(header);
  return ranges.length > 0 ? ranges[0] : null;
}

/**
 * Look up the q value for an exact media type string, or null if absent.
 *
 * Matching is exact and case-insensitive on the type, and ignores parameters.
 * Wildcards are not expanded here; this is a direct lookup helper, not a
 * content-negotiation engine.
 *
 * @param {string} header
 * @param {string} type
 * @returns {number | null}
 */
export function qualityOf(header, type) {
  if (typeof type !== 'string') return null;
  const wanted = type.trim().toLowerCase();
  if (wanted === '') return null;

  const ranges = parseAccept(header);
  for (const range of ranges) {
    if (range.type === wanted) return range.q;
  }
  return null;
}
