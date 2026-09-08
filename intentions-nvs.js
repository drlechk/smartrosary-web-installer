// Minimal ESP-IDF NVS V2 parser for SmartRosary intentions package binaries.
(function (global) {
  'use strict';

  const TYPES = {
    U8: 0x01,
    I32: 0x14,
    SZ: 0x21,
    BLOB_DATA: 0x42,
    BLOB_IDX: 0x48,
  };

  const PAGE_SIZE = 4096;
  const HEADER_SIZE = 32;
  const ENTRY_OFFSET = 64;
  const ENTRY_SIZE = 32;
  const MAX_ENTRIES = 126;

  function allFF(bytes) {
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0xff) return false;
    }
    return true;
  }

  function readAsciiKey(bytes) {
    let end = 8;
    while (end < 24 && bytes[end] !== 0x00) end++;
    if (end === 8) return '';
    return new TextDecoder().decode(bytes.slice(8, end));
  }

  class Parser {
    constructor(buffer) {
      this.buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      this.namespaces = {};
      this.nsByIdx = {};
      this.entries = {};
      this.chunks = {};
    }

    parse() {
      const pages = Math.floor(this.buf.length / PAGE_SIZE);
      for (let page = 0; page < pages; page++) {
        const pageOff = page * PAGE_SIZE;
        if (allFF(this.buf.slice(pageOff, pageOff + HEADER_SIZE))) continue;

        let entryIndex = 0;
        while (entryIndex < MAX_ENTRIES) {
          const entryOff = pageOff + ENTRY_OFFSET + entryIndex * ENTRY_SIZE;
          const entry = this.buf.slice(entryOff, entryOff + ENTRY_SIZE);
          if (allFF(entry)) {
            entryIndex++;
            continue;
          }

          const nsIdx = entry[0];
          const type = entry[1];
          const span = entry[2];
          const chunkIndex = entry[3];
          const key = readAsciiKey(entry);
          if (!key) {
            entryIndex++;
            continue;
          }

          if (type === TYPES.U8 && span === 1) {
            const idx = entry[24];
            this.namespaces[key] = idx;
            this.nsByIdx[idx] = key;
            this.entries[key] = this.entries[key] || {};
            entryIndex++;
            continue;
          }

          const nsName = this.nsByIdx[nsIdx] || String(nsIdx);
          this.entries[nsName] = this.entries[nsName] || {};

          if (type === TYPES.I32 && span === 1) {
            this.entries[nsName][key] = new DataView(entry.buffer, entry.byteOffset, entry.byteLength).getInt32(24, true);
            entryIndex++;
            continue;
          }

          if (type === TYPES.SZ) {
            const total = new DataView(entry.buffer, entry.byteOffset, entry.byteLength).getUint16(24, true);
            const rounded = (total + 31) & ~31;
            const count = rounded / ENTRY_SIZE;
            const dataStart = pageOff + ENTRY_OFFSET + (entryIndex + 1) * ENTRY_SIZE;
            const data = this.buf.slice(dataStart, dataStart + total);
            this.entries[nsName][key] = new TextDecoder().decode(data).replace(/\0+$/, '');
            entryIndex += 1 + count;
            continue;
          }

          if (type === TYPES.BLOB_DATA) {
            const chunkSize = new DataView(entry.buffer, entry.byteOffset, entry.byteLength).getUint16(24, true);
            const rounded = (chunkSize + 31) & ~31;
            const count = rounded / ENTRY_SIZE;
            const dataStart = pageOff + ENTRY_OFFSET + (entryIndex + 1) * ENTRY_SIZE;
            this.chunks[`${nsIdx}|${key}|${chunkIndex}`] = this.buf.slice(dataStart, dataStart + chunkSize);
            entryIndex += 1 + count;
            continue;
          }

          if (type === TYPES.BLOB_IDX) {
            const view = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
            const totalSize = view.getUint32(24, true);
            const chunkCount = entry[28];
            const chunkStart = entry[29];
            const parts = [];
            let complete = true;
            for (let idx = 0; idx < chunkCount; idx++) {
              const part = this.chunks[`${nsIdx}|${key}|${chunkStart + idx}`];
              if (!part) {
                complete = false;
                break;
              }
              parts.push(part);
            }
            if (complete) {
              const total = new Uint8Array(totalSize);
              let offset = 0;
              for (const part of parts) {
                total.set(part, offset);
                offset += part.length;
              }
              this.entries[nsName][key] = total;
            }
            entryIndex++;
            continue;
          }

          entryIndex += Math.max(1, span);
        }
      }
      return this.entries;
    }
  }

  function decodeBlob(value) {
    if (value instanceof Uint8Array) {
      return new TextDecoder().decode(value);
    }
    return '';
  }

  function parseIntentions(buffer) {
    const parser = new Parser(buffer);
    const data = parser.parse().intentions || {};
    const count = Math.max(0, Math.min(Number(data.numIntentions ?? 0) || 0, 32));
    const titles = [];
    const descs = [];
    for (let idx = 0; idx < count; idx++) {
      titles.push(decodeBlob(data[`iT${idx}`]));
      descs.push(decodeBlob(data[`iD${idx}`]));
    }
    return {
      numIntentions: count,
      iS: titles.join('\n'),
      titles,
      descs,
    };
  }

  // Encoder adapted from smartrosary-intentions-editor/nvs.js.
  // Refuse overflow instead of truncating data into the reserved NVS page.
  const CONSTS = {
    PAGE_SIZE: 4096,
    HEADER_SIZE: 32,
    BITMAP_OFFSET: 32,
    BITMAP_SIZE: 32,
    ENTRY_OFFSET: 64,
    ENTRY_SIZE: 32,
    MAX_ENTRIES: 126,
    STATE_ACTIVE: 0xFFFFFFFE,
    STATE_FULL: 0xFFFFFFFC,
    VERSION2: 0xFE,
    CHUNK_ANY: 0xFF,
  };

  // CRC32 (IEEE) table-driven, streaming-compatible with zlib.crc32(seed=0xFFFFFFFF)
  class CRC32 {
    constructor() {
      this.table = CRC32._makeTable();
    }
    static _makeTable() {
      const tbl = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        tbl[n] = c >>> 0;
      }
      return tbl;
    }
    // Matches Python's zlib.crc32(data, seed) semantics
    run(data, seed = 0) {
      let c = (seed ^ 0xFFFFFFFF) >>> 0;
      const tbl = this.table;
      if (data instanceof ArrayBuffer) data = new Uint8Array(data);
      for (let i = 0; i < data.length; i++) {
        c = (c >>> 8) ^ tbl[(c ^ data[i]) & 0xFF];
      }
      return (c ^ 0xFFFFFFFF) >>> 0;
    }
  }

  const crc32 = new CRC32();

  class NvsBuilder {
    constructor({ totalBytes = 20480, version = CONSTS.VERSION2 } = {}) {
      if (totalBytes % CONSTS.PAGE_SIZE !== 0) throw new Error('totalBytes must be multiple of 4096');
      this.version = version;
      this.totalBytes = totalBytes;
      this.activePages = (totalBytes / CONSTS.PAGE_SIZE) - 1; // last reserved
      this.pages = [];
      this.cur = null;
      this.namespaceCount = 0;
      this.writtenNamespaces = new Map();
      this._newPage();
    }
    _newPage({ reserved = false } = {}) {
      if (this.pages.length >= this.activePages) {
        throw new Error('intentionsTooLarge');
      }
      const pageIndex = this.pages.length;
      // mark previous as FULL
      if (this.cur && !this.cur.reserved) {
        const dvprev = new DataView(this.cur.buf.buffer, this.cur.buf.byteOffset, this.cur.buf.byteLength);
        dvprev.setUint32(0, CONSTS.STATE_FULL, true);
      }
      const buf = new Uint8Array(CONSTS.PAGE_SIZE);
      buf.fill(0xFF);
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      if (!reserved) {
        dv.setUint32(0, CONSTS.STATE_ACTIVE, true);
        dv.setUint32(4, pageIndex >>> 0, true); // seq
        buf[8] = this.version;
        // header crc over bytes 4..27
        const hdrCrc = crc32.run(buf.slice(4, 28), 0xFFFFFFFF) >>> 0;
        dv.setUint32(28, hdrCrc >>> 0, true);
      }
      const page = { buf, dv, entryNum: 0, reserved };
      this.pages.push(page);
      this.cur = page;
      return page;
    }
    _ensureSpace(entriesNeeded) {
      if (this.cur.reserved) this._newPage();
      const available = CONSTS.MAX_ENTRIES - this.cur.entryNum;
      if (available >= entriesNeeded) return;
      // open next page; if exceeded active pages, still create but keep total pages bounded later
      if (this.pages.length < this.activePages) {
        this._newPage();
      } else {
        this._newPage(); // allow spill; reserved page appended later anyway
      }
    }
    _writeBitmapBit() {
      const bitnum = this.cur.entryNum * 2;
      const byteIdx = CONSTS.BITMAP_OFFSET + (bitnum >> 3);
      const bitOffset = bitnum & 7;
      const mask = ~(1 << bitOffset) & 0xFF;
      this.cur.buf[byteIdx] = this.cur.buf[byteIdx] & mask;
    }
    _writeEntryBytes(bytes) {
      const off = CONSTS.ENTRY_OFFSET + this.cur.entryNum * CONSTS.ENTRY_SIZE;
      this.cur.buf.set(bytes, off);
      this._writeBitmapBit();
      this.cur.entryNum += 1;
    }
    _writeDataChunk(data) {
      // writes N 32-byte entries filled with data then 0xFF padding
      const rounded = (data.length + 31) & ~31;
      const cnt = rounded / 32;
      const padded = new Uint8Array(rounded);
      padded.fill(0xFF);
      padded.set(data);
      for (let i = 0; i < cnt; i++) {
        const block = padded.slice(i * 32, i * 32 + 32);
        this._ensureSpace(1);
        this._writeEntryBytes(block);
      }
      return cnt;
    }
    _entryHeaderTemplate() {
      const e = new Uint8Array(32);
      e.fill(0xFF);
      e[2] = 1; // span default
      e[3] = CONSTS.CHUNK_ANY;
      // key area zero-padded
      for (let i = 8; i < 24; i++) e[i] = 0x00;
      return e;
    }
    _setKey(e, key) {
      const enc = new TextEncoder();
      const kb = enc.encode(key);
      const n = Math.min(16, kb.length);
      e.set(kb.slice(0, n), 8);
    }
    _setHeaderCrc(e) {
      // header CRC over [0..3] + [8..31]
      const tmp = new Uint8Array(28);
      tmp.set(e.slice(0, 4), 0);
      tmp.set(e.slice(8, 32), 4);
      const c = crc32.run(tmp, 0xFFFFFFFF) >>> 0;
      new DataView(e.buffer, e.byteOffset, e.byteLength).setUint32(4, c, true);
    }
    writeNamespace(name) {
      if (this.writtenNamespaces.has(name)) return this.writtenNamespaces.get(name);
      const idx = ++this.namespaceCount;
      const e = this._entryHeaderTemplate();
      e[0] = 0; // namespace entries have nsIdx 0
      e[1] = TYPES.U8;
      e[2] = 1;
      e[3] = CONSTS.CHUNK_ANY;
      this._setKey(e, name);
      e[24] = idx & 0xFF;
      this._setHeaderCrc(e);
      this._ensureSpace(1);
      this._writeEntryBytes(e);
      this.writtenNamespaces.set(name, idx);
      return idx;
    }
    writeI32(nsIdx, key, value) {
      const e = this._entryHeaderTemplate();
      e[0] = nsIdx;
      e[1] = TYPES.I32;
      this._setKey(e, key);
      new DataView(e.buffer, e.byteOffset, e.byteLength).setInt32(24, value | 0, true);
      this._setHeaderCrc(e);
      this._ensureSpace(1);
      this._writeEntryBytes(e);
    }
    writeBlob(nsIdx, key, bytes) {
      // V2 multipage blob: write one or more BLOB_DATA chunks followed by a BLOB_IDX index entry.
      const chunks = [];
      let remaining = bytes.length;
      let offset = 0;
      let chunkStart = 0;
      let chunkCount = 0;
      while (remaining > 0) {
        // tailroom available on current page (in bytes) for data following 1 header entry
        const tailroom = (CONSTS.MAX_ENTRIES - this.cur.entryNum - 1) * CONSTS.ENTRY_SIZE;
        let chunkSize = Math.min(remaining, Math.max(tailroom, 0));
        if (chunkSize <= 0) {
          this._newPage();
          continue;
        }
        // header
        const e = this._entryHeaderTemplate();
        e[0] = nsIdx;
        e[1] = TYPES.BLOB_DATA;
        // Span = (1 header + N data entries)
        const rounded = (chunkSize + 31) & ~31;
        const cnt = rounded / 32;
        e[2] = (1 + cnt) & 0xFF;
        e[3] = (chunkStart + chunkCount) & 0xFF; // chunk index
        this._setKey(e, key);
        new DataView(e.buffer, e.byteOffset, e.byteLength).setUint16(24, chunkSize, true);
        // CRC of data chunk at 28..31
        const dataChunk = bytes.slice(offset, offset + chunkSize);
        const dataCrc = crc32.run(dataChunk, 0xFFFFFFFF) >>> 0;
        new DataView(e.buffer, e.byteOffset, e.byteLength).setUint32(28, dataCrc, true);
        this._setHeaderCrc(e);
        this._ensureSpace(1);
        this._writeEntryBytes(e);
        // write data blocks
        this._ensureSpace(cnt);
        this._writeDataChunk(dataChunk);
        chunks.push({ idx: chunkStart + chunkCount, size: chunkSize });
        chunkCount++;
        offset += chunkSize;
        remaining -= chunkSize;
        // Move to new page if not enough space left for at least 1 header entry
        const leftover = (CONSTS.MAX_ENTRIES - this.cur.entryNum) * 32;
        if (remaining > 0 && leftover < 32) this._newPage();
      }
      // index entry
      const idxE = this._entryHeaderTemplate();
      idxE[0] = nsIdx;
      idxE[1] = TYPES.BLOB_IDX;
      idxE[2] = 1; // span
      idxE[3] = CONSTS.CHUNK_ANY;
      this._setKey(idxE, key);
      new DataView(idxE.buffer, idxE.byteOffset, idxE.byteLength).setUint32(24, bytes.length >>> 0, true);
      idxE[28] = chunkCount & 0xFF;
      idxE[29] = chunkStart & 0xFF;
      this._setHeaderCrc(idxE);
      this._ensureSpace(1);
      this._writeEntryBytes(idxE);
    }
    finalize() {
      // ensure we have exactly activePages non-reserved pages
      while (this.pages.length < this.activePages) this._newPage();
      // add reserved page
      const reserved = new Uint8Array(CONSTS.PAGE_SIZE);
      reserved.fill(0xFF);
      this.pages.push({ buf: reserved, reserved: true });
      // stitch
      const out = new Uint8Array(this.pages.length * CONSTS.PAGE_SIZE);
      for (let i = 0; i < this.pages.length; i++) {
        out.set(this.pages[i].buf, i * CONSTS.PAGE_SIZE);
      }
      // truncate to fixed totalBytes
      return out.slice(0, this.totalBytes);
    }
  }

  function utf8Encode(s) { return new TextEncoder().encode(s); }

  function buildIntentionsBin({ numIntentions = 12, iS = '', titles = [], descs = [] }) {
    if (!Number.isInteger(numIntentions) || numIntentions < 0 || numIntentions > 32) {
      throw new Error('intentionsTooMany');
    }
    const b = new NvsBuilder({ totalBytes: 20480, version: CONSTS.VERSION2 });
    const nsIdx = b.writeNamespace('intentions');
    b.writeI32(nsIdx, 'numIntentions', numIntentions | 0);
    b.writeBlob(nsIdx, 'iS', utf8Encode(iS));
    for (let i = 0; i < numIntentions; i++) {
      const t = titles[i] || '';
      const d = descs[i] || '';
      b.writeBlob(nsIdx, 'iT' + i, utf8Encode(t));
      b.writeBlob(nsIdx, 'iD' + i, utf8Encode(d));
    }
    return b.finalize();
  }

  global.IntentionsNVS = { parseIntentions, buildIntentionsBin };
})(window);
