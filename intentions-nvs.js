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

  global.IntentionsNVS = { parseIntentions };
})(window);
