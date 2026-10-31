import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseAccept, preferred, qualityOf } from '../src/index.js';

test('empty and blank headers yield no ranges', () => {
  assert.deepEqual(parseAccept(''), []);
  assert.deepEqual(parseAccept('   '), []);
  assert.equal(preferred(''), null);
});

test('a single range without q defaults to 1', () => {
  const ranges = parseAccept('text/html');
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].type, 'text/html');
  assert.equal(ranges[0].q, 1);
  assert.deepEqual(ranges[0].params, {});
});

test('ranges are ordered by descending q', () => {
  const ranges = parseAccept('text/html;q=0.5, application/json;q=0.9, text/plain');
  assert.deepEqual(
    ranges.map((r) => r.type),
    ['text/plain', 'application/json', 'text/html']
  );
  assert.deepEqual(
    ranges.map((r) => r.q),
    [1, 0.9, 0.5]
  );
});

test('equal q values keep their original header order', () => {
  const ranges = parseAccept('a/b;q=0.7, c/d;q=0.7, e/f;q=0.7');
  assert.deepEqual(
    ranges.map((r) => r.type),
    ['a/b', 'c/d', 'e/f']
  );
});

test('q=0 ranges are dropped', () => {
  const ranges = parseAccept('text/html;q=0, application/json;q=0.4');
  assert.deepEqual(
    ranges.map((r) => r.type),
    ['application/json']
  );
});

test('malformed q values drop only their own range', () => {
  const ranges = parseAccept('text/html;q=banana, application/json;q=0.4, text/plain;q=2');
  assert.deepEqual(
    ranges.map((r) => r.type),
    ['application/json']
  );
});

test('non-q parameters are preserved and lowercased', () => {
  const ranges = parseAccept('text/html;Charset=UTF-8;q=0.8');
  assert.equal(ranges.length, 1);
  assert.deepEqual(ranges[0].params, { charset: 'UTF-8' });
  assert.equal(ranges[0].q, 0.8);
});

test('quoted parameter values are unquoted', () => {
  const ranges = parseAccept('text/html;foo="bar baz";q=0.5');
  assert.deepEqual(ranges[0].params, { foo: 'bar baz' });
});

test('wildcards are kept as literal types', () => {
  const ranges = parseAccept('*/*;q=0.1, text/*;q=0.2');
  assert.deepEqual(
    ranges.map((r) => r.type),
    ['text/*', '*/*']
  );
});

test('types are matched case-insensitively', () => {
  const ranges = parseAccept('TEXT/HTML');
  assert.equal(ranges[0].type, 'text/html');
});

test('malformed ranges are skipped without killing the header', () => {
  const ranges = parseAccept('not a type, application/json;q=0.6, /leading-slash');
  assert.deepEqual(
    ranges.map((r) => r.type),
    ['application/json']
  );
});

test('preferred returns the highest q range', () => {
  assert.deepEqual(preferred('text/html;q=0.2, application/json;q=0.9'), {
    type: 'application/json',
    params: {},
    q: 0.9,
  });
});

test('qualityOf finds an exact type and ignores parameters', () => {
  const header = 'text/html;level=1;q=0.7, application/json;q=0.3';
  assert.equal(qualityOf(header, 'text/html'), 0.7);
  assert.equal(qualityOf(header, 'TEXT/HTML'), 0.7);
  assert.equal(qualityOf(header, 'image/png'), null);
  assert.equal(qualityOf(header, ''), null);
});

test('qualityOf does not expand wildcards', () => {
  const header = 'text/*;q=0.5';
  assert.equal(qualityOf(header, 'text/html'), null);
  assert.equal(qualityOf(header, 'text/*'), 0.5);
});

test('extra whitespace around ranges and parameters is tolerated', () => {
  const ranges = parseAccept('  text/html ; q=0.5 ,  application/json  ');
  assert.deepEqual(
    ranges.map((r) => r.type),
    ['application/json', 'text/html']
  );
});

test('duplicate types keep the first occurrence for qualityOf', () => {
  const header = 'text/html;q=0.9, text/html;q=0.1';
  assert.equal(qualityOf(header, 'text/html'), 0.9);
});
