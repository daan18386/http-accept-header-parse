/**
 * Public entry point for http-accept-header-parse.
 *
 * Keeping the re-export surface tiny makes the package easy to audit: the
 * only things consumers can reach are the parser and its two data shapes.
 */
export { parseAccept, preferred, qualityOf } from './core.js';
