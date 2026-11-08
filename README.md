# http-accept-header-parse

Breaks down an HTTP Accept header into quality-weighted media ranges, ordered by preference.

```js
import { parseAccept, preferred, qualityOf } from 'http-accept-header-parse';

parseAccept('text/html;q=0.5, application/json;q=0.9, text/plain');
// [
//   { type: 'text/plain', params: {}, q: 1 },
//   { type: 'application/json', params: {}, q: 0.9 },
//   { type: 'text/html', params: {}, q: 0.5 }
// ]

preferred('text/html;q=0.2, application/json;q=0.9');
// { type: 'application/json', params: {}, q: 0.9 }

qualityOf('text/html;level=1;q=0.7, application/json;q=0.3', 'text/html');
// 0.7
```

## Why this exists

An Accept header is a comma-separated list where each entry is a media range with an optional `q` parameter. The awkward part is that the ordering rules are not obvious: entries with no `q` default to 1, entries with `q=0` mean "not acceptable", and entries that share a `q` are meant to keep their original order. Naively sorting by q loses that last property, so this library carries the original index through the sort instead of trusting the engine's sort to be stable.

The trade-off made here is strictness about `q`. A range whose `q` is unparseable or outside `0..1` is dropped rather than being coerced to 1 or clamped. The header is then unusable for that range, and quietly promoting it to the top would invert what the client asked for. Dropping it keeps the rest of the header usable and lets the caller notice the omission if it matters.

## The edge you will hit

Wildcards are kept as literal strings. `parseAccept('text/*;q=0.5')` gives you `{ type: 'text/*', params: {}, q: 0.5 }`, and `qualityOf(header, 'text/html')` will not match it against `text/*`. This library parses and orders the header; it does not perform content negotiation. If you need to resolve a concrete type against a wildcard range, do that on top of the parsed output.

## API

- `parseAccept(header)` returns media ranges sorted by descending `q`, ties in original order. Each range is `{ type, params, q }`, where `type` is lowercased, `params` holds every non-`q` parameter with lowercased names and unquoted values, and `q` is a number in `0..1`. Malformed ranges and ranges with `q=0` are omitted.
- `preferred(header)` returns the first range from `parseAccept`, or `null` for an empty or unusable header.
- `qualityOf(header, type)` returns the `q` value for an exact, case-insensitive type match, ignoring parameters, or `null` if the type is absent. It does not expand wildcards.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

