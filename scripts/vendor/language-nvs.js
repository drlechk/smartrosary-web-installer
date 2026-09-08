const PAGE_SIZE = 4096;
const ENTRY_SIZE = 32;
const ENTRY_COUNT_PER_PAGE = 126;
const BITMAP_OFFSET = 32;
const FIRST_ENTRY_OFFSET = 64;
const DEFAULT_PARTITION_SIZE = 20480;
const MAX_KEY_LENGTH = 15;
const PAGE_STATUS = {
  0xffffffff: "Empty",
  0xfffffffe: "Active",
  0xfffffffc: "Full",
  0xfffffff8: "Erasing",
  0x00000000: "Corrupted",
};
const ENTRY_STATE = {
  0b11: "Empty",
  0b10: "Written",
  0b00: "Erased",
};
const ITEM_TYPE = {
  0x01: "uint8_t",
  0x11: "int8_t",
  0x02: "uint16_t",
  0x12: "int16_t",
  0x04: "uint32_t",
  0x14: "int32_t",
  0x08: "uint64_t",
  0x18: "int64_t",
  0x21: "string",
  0x41: "blob",
  0x42: "blob_data",
  0x48: "blob_index",
};
const TYPE_CODE = {
  u8: 0x01,
  i8: 0x11,
  u16: 0x02,
  i16: 0x12,
  u32: 0x04,
  i32: 0x14,
  u64: 0x08,
  i64: 0x18,
  string: 0x21,
  blob: 0x41,
  blobData: 0x42,
  blobIndex: 0x48,
};
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const CRC_TABLE = buildCrcTable();
const SETTINGS_BUFFER_KEYS = new Set([
  "l005",
  "l006",
  "l007",
  "l008",
  "l009",
  "l010",
  "l011",
  "l012",
  "l013",
  "l014",
  "l015",
  "l016",
  "l017",
  "l018",
  "l019",
  "l020",
  "l021",
  "l022",
]);
const SHARED_BUFFER_LIMIT = 1023;
const SETTINGS_BUFFER_LIMIT = 511;

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

function crc32(bytes, initial = 0xffffffff) {
  let crc = (initial ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readU32(bytes, offset) {
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function writeU32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function writeU16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function decodeAsciiKey(bytes) {
  let value = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const code = bytes[i];
    if (code === 0 || code === 0xff) {
      break;
    }
    if (code > 0x7f) {
      return "";
    }
    value += String.fromCharCode(code);
  }
  return value;
}

function decodeUtf8(bytes) {
  return UTF8_DECODER.decode(bytes);
}

function encodeUtf8(value) {
  return UTF8_ENCODER.encode(value);
}

function maxValueBytesForEntry(entry) {
  const key = String(entry.key || "").trim();
  return SETTINGS_BUFFER_KEYS.has(key) ? SETTINGS_BUFFER_LIMIT : SHARED_BUFFER_LIMIT;
}

function extractChildPayload(children, size) {
  const merged = new Uint8Array(children.length * ENTRY_SIZE);
  children.forEach((child, index) => merged.set(child.raw, index * ENTRY_SIZE));
  return merged.slice(0, size);
}

function parseEntryStates(bitmap) {
  const states = [];
  for (let i = 0; i < bitmap.length; i += 1) {
    const byte = bitmap[i];
    for (let shift = 0; shift < 8; shift += 2) {
      states.push(ENTRY_STATE[(byte >> shift) & 0b11] ?? "Invalid");
    }
  }
  return states.slice(0, ENTRY_COUNT_PER_PAGE);
}

function parsePrimitiveValue(typeCode, dataBytes) {
  const view = new DataView(dataBytes.buffer, dataBytes.byteOffset, dataBytes.byteLength);
  switch (typeCode) {
    case TYPE_CODE.u8:
      return view.getUint8(0);
    case TYPE_CODE.i8:
      return view.getInt8(0);
    case TYPE_CODE.u16:
      return view.getUint16(0, true);
    case TYPE_CODE.i16:
      return view.getInt16(0, true);
    case TYPE_CODE.u32:
      return view.getUint32(0, true);
    case TYPE_CODE.i32:
      return view.getInt32(0, true);
    case TYPE_CODE.u64:
      return Number(view.getBigUint64(0, true));
    case TYPE_CODE.i64:
      return Number(view.getBigInt64(0, true));
    default:
      return null;
  }
}

function makePhysicalEntry(raw, state, pageNumber, slotIndex, globalSlotIndex, order) {
  const typeCode = raw[1];
  const itemType = ITEM_TYPE[typeCode] ?? `0x${typeCode.toString(16)}`;
  const span = raw[2] === 0 || raw[2] === 0xff ? 1 : raw[2];
  const chunkIndex = raw[3];
  const namespaceIndex = raw[0];
  const key = decodeAsciiKey(raw.slice(8, 24));
  const headerCrcBuffer = new Uint8Array(28);
  headerCrcBuffer.set(raw.slice(0, 4), 0);
  headerCrcBuffer.set(raw.slice(8, 32), 4);

  return {
    raw,
    state,
    pageNumber,
    slotIndex,
    globalSlotIndex,
    order,
    typeCode,
    itemType,
    span,
    chunkIndex,
    namespaceIndex,
    key,
    headerCrcOriginal: readU32(raw, 4),
    headerCrcComputed: crc32(headerCrcBuffer),
    dataBytes: raw.slice(24, 32),
    children: [],
  };
}

function normalizeNamespaces(entries, namespaceOrder) {
  const seen = new Set();
  const cleanOrder = [];
  namespaceOrder.forEach((name) => {
    const normalized = String(name || "").trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      cleanOrder.push(normalized);
    }
  });

  entries.forEach((entry) => {
    const namespace = String(entry.namespace || "").trim();
    if (namespace && !seen.has(namespace)) {
      seen.add(namespace);
      cleanOrder.push(namespace);
    }
  });

  return cleanOrder;
}

function detectLanguageFromName(name = "") {
  const match = name.toLowerCase().match(/(?:^|[-_])([a-z]{2})(?:\.[^.]+)?$/);
  return match ? match[1] : "";
}

function parseNvsBinary(input, options = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length % PAGE_SIZE !== 0) {
    throw new Error(`NVS data must be aligned to ${PAGE_SIZE} bytes.`);
  }

  const pages = [];
  const physicalEntries = [];
  let globalOrder = 0;

  for (let pageOffset = 0; pageOffset < bytes.length; pageOffset += PAGE_SIZE) {
    const pageBytes = bytes.slice(pageOffset, pageOffset + PAGE_SIZE);
    const pageNumber = pageOffset / PAGE_SIZE;
    const pageStateValue = readU32(pageBytes, 0);
    const pageStatus = PAGE_STATUS[pageStateValue] ?? "Invalid";
    const pageIndex = readU32(pageBytes, 4);
    const version = 256 - pageBytes[8];
    const bitmap = pageBytes.slice(BITMAP_OFFSET, BITMAP_OFFSET + 32);
    const entryStates = parseEntryStates(bitmap);

    pages.push({
      number: pageNumber,
      status: pageStatus,
      pageIndex,
      version,
      crcOriginal: readU32(pageBytes, 28),
      crcComputed: crc32(pageBytes.slice(4, 28)),
    });

    let slot = 0;
    while (slot < ENTRY_COUNT_PER_PAGE) {
      const raw = pageBytes.slice(
        FIRST_ENTRY_OFFSET + (slot * ENTRY_SIZE),
        FIRST_ENTRY_OFFSET + ((slot + 1) * ENTRY_SIZE),
      );
      const entry = makePhysicalEntry(raw, entryStates[slot], pageNumber, slot, globalOrder, globalOrder);
      if (entry.span > 1) {
        for (let childIndex = 1; childIndex < entry.span && slot + childIndex < ENTRY_COUNT_PER_PAGE; childIndex += 1) {
          const childRaw = pageBytes.slice(
            FIRST_ENTRY_OFFSET + ((slot + childIndex) * ENTRY_SIZE),
            FIRST_ENTRY_OFFSET + ((slot + childIndex + 1) * ENTRY_SIZE),
          );
          entry.children.push({
            raw: childRaw,
            state: entryStates[slot + childIndex],
          });
        }
      }
      physicalEntries.push(entry);
      globalOrder += 1;
      slot += entry.span;
    }
  }

  const namespaceByIndex = new Map();
  const namespaceOrder = [];
  const blobChunks = new Map();

  physicalEntries.forEach((entry) => {
    if (entry.state !== "Written" || !entry.key) {
      return;
    }

    if (entry.itemType === "uint8_t" && entry.namespaceIndex === 0) {
      const value = parsePrimitiveValue(entry.typeCode, entry.dataBytes);
      if (typeof value === "number") {
        namespaceByIndex.set(value, entry.key);
        if (!namespaceOrder.includes(entry.key)) {
          namespaceOrder.push(entry.key);
        }
      }
      return;
    }

    if (entry.itemType === "blob_data") {
      const size = readU16(entry.dataBytes, 0);
      const payload = extractChildPayload(entry.children, size);
      blobChunks.set(`${entry.namespaceIndex}:${entry.key}:${entry.chunkIndex}`, {
        payload,
        order: entry.order,
      });
    }
  });

  const logicalEntries = [];

  physicalEntries.forEach((entry) => {
    if (entry.state !== "Written" || !entry.key) {
      return;
    }

    if (entry.itemType === "uint8_t" && entry.namespaceIndex === 0) {
      return;
    }

    const namespace = namespaceByIndex.get(entry.namespaceIndex) ?? `ns_${entry.namespaceIndex}`;

    if (entry.itemType === "blob_data") {
      return;
    }

    if (entry.itemType === "blob_index") {
      const totalSize = readU32(entry.dataBytes, 0);
      const chunkCount = entry.dataBytes[4];
      const chunkStart = entry.dataBytes[5];
      const chunks = [];
      let order = entry.order;

      for (let chunkIndex = chunkStart; chunkIndex < chunkStart + chunkCount; chunkIndex += 1) {
        const chunk = blobChunks.get(`${entry.namespaceIndex}:${entry.key}:${chunkIndex}`);
        if (!chunk) {
          throw new Error(`Missing blob chunk ${chunkIndex} for ${namespace}:${entry.key}.`);
        }
        order = Math.min(order, chunk.order);
        chunks.push(chunk.payload);
      }

      const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      let offset = 0;
      chunks.forEach((chunk) => {
        merged.set(chunk, offset);
        offset += chunk.length;
      });
      const payload = merged.slice(0, totalSize);
      logicalEntries.push({
        namespace,
        key: entry.key,
        value: decodeUtf8(payload),
        valueBytes: payload,
        storageType: "blob",
        encoding: "utf-8",
        order,
      });
      return;
    }

    if (entry.itemType === "blob" || entry.itemType === "string") {
      const size = readU16(entry.dataBytes, 0);
      const payload = extractChildPayload(entry.children, size);
      const textBytes = entry.itemType === "string" && payload[payload.length - 1] === 0
        ? payload.slice(0, payload.length - 1)
        : payload;
      logicalEntries.push({
        namespace,
        key: entry.key,
        value: decodeUtf8(textBytes),
        valueBytes: textBytes,
        storageType: entry.itemType === "string" ? "string" : "blob",
        encoding: "utf-8",
        order: entry.order,
      });
      return;
    }

    logicalEntries.push({
      namespace,
      key: entry.key,
      value: String(parsePrimitiveValue(entry.typeCode, entry.dataBytes) ?? ""),
      valueBytes: entry.dataBytes.slice(),
      storageType: entry.itemType,
      encoding: "primitive",
      order: entry.order,
    });
  });

  logicalEntries.sort((a, b) => a.order - b.order);

  const metadataId = logicalEntries.find(
    (entry) => entry.namespace === "lang" && entry.key === "id",
  )?.value;
  const metadataVersion = logicalEntries.find(
    (entry) => entry.namespace === "lang" && entry.key === "v",
  )?.value;
  const language = metadataId || options.language || detectLanguageFromName(options.name || "");
  const partitionSize = bytes.length || DEFAULT_PARTITION_SIZE;
  const nvsVersion = pages.find((page) => page.status !== "Empty")?.version ?? 2;

  return {
    format: "smartrosary-language-v1",
    language,
    version: metadataVersion || "",
    partitionSize,
    nvsVersion,
    namespaceOrder: normalizeNamespaces(logicalEntries, namespaceOrder),
    entries: logicalEntries.map(({ namespace, key, value, storageType, encoding }) => ({
      namespace,
      key,
      value,
      storageType,
      encoding,
    })),
    diagnostics: {
      totalPages: pages.length,
      activePages: pages.filter((page) => page.status === "Active").length,
      fullPages: pages.filter((page) => page.status === "Full").length,
      reservedPages: pages.filter((page) => page.status === "Empty").length,
      pages,
    },
  };
}

function validateNvsBinaryCrcs(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length % PAGE_SIZE !== 0) {
    throw new Error(`NVS data must be aligned to ${PAGE_SIZE} bytes.`);
  }

  for (let pageOffset = 0; pageOffset < bytes.length; pageOffset += PAGE_SIZE) {
    const pageBytes = bytes.slice(pageOffset, pageOffset + PAGE_SIZE);
    const pageNumber = pageOffset / PAGE_SIZE;
    const pageStateValue = readU32(pageBytes, 0);
    const pageStatus = PAGE_STATUS[pageStateValue] ?? "Invalid";
    if (pageStatus === "Empty") continue;

    const storedPageCrc = readU32(pageBytes, 28);
    const computedPageCrc = crc32(pageBytes.slice(4, 28));
    if (storedPageCrc !== computedPageCrc) {
      throw new Error(`NVS CRC check failed: page ${pageNumber} header CRC 0x${storedPageCrc.toString(16)} != 0x${computedPageCrc.toString(16)}.`);
    }

    const entryStates = parseEntryStates(pageBytes.slice(BITMAP_OFFSET, BITMAP_OFFSET + 32));
    let slot = 0;
    while (slot < ENTRY_COUNT_PER_PAGE) {
      if (entryStates[slot] !== "Written") {
        slot += 1;
        continue;
      }

      const entryOffset = FIRST_ENTRY_OFFSET + (slot * ENTRY_SIZE);
      const raw = pageBytes.slice(entryOffset, entryOffset + ENTRY_SIZE);
      const span = raw[2] === 0 || raw[2] === 0xff ? 1 : raw[2];
      const headerCrcBuffer = new Uint8Array(28);
      headerCrcBuffer.set(raw.slice(0, 4), 0);
      headerCrcBuffer.set(raw.slice(8, 32), 4);
      const storedHeaderCrc = readU32(raw, 4);
      const computedHeaderCrc = crc32(headerCrcBuffer);
      if (storedHeaderCrc !== computedHeaderCrc) {
        throw new Error(`NVS CRC check failed: page ${pageNumber} slot ${slot} header CRC 0x${storedHeaderCrc.toString(16)} != 0x${computedHeaderCrc.toString(16)}.`);
      }

      if (raw[1] === TYPE_CODE.blobData) {
        const dataSize = readU16(raw, 24);
        const dataSlots = Math.max(0, span - 1);
        const payload = pageBytes.slice(entryOffset + ENTRY_SIZE, entryOffset + ENTRY_SIZE + (dataSlots * ENTRY_SIZE));
        const storedDataCrc = readU32(raw, 28);
        const computedDataCrc = crc32(payload.slice(0, dataSize));
        if (storedDataCrc !== computedDataCrc) {
          throw new Error(`NVS CRC check failed: page ${pageNumber} slot ${slot} blob CRC 0x${storedDataCrc.toString(16)} != 0x${computedDataCrc.toString(16)}.`);
        }
      }

      slot += Math.max(1, span);
    }
  }
}

function validateAscii(value, label) {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 0x7f) {
      throw new Error(`${label} must contain only ASCII characters.`);
    }
  }
}

function validateEditorState(state) {
  const partitionSize = Number(state.partitionSize || DEFAULT_PARTITION_SIZE);
  if (!Number.isInteger(partitionSize) || partitionSize < PAGE_SIZE * 3 || partitionSize % PAGE_SIZE !== 0) {
    throw new Error("Partition size must be a multiple of 4096 and at least 12288 bytes.");
  }

  const entries = Array.isArray(state.entries) ? state.entries : [];
  const duplicateCheck = new Set();
  entries.forEach((entry, index) => {
    const namespace = String(entry.namespace || "").trim();
    const key = String(entry.key || "").trim();
    if (!namespace) {
      throw new Error(`Entry ${index + 1} is missing a namespace.`);
    }
    if (!key) {
      throw new Error(`Entry ${index + 1} is missing a key.`);
    }
    if (namespace.length > MAX_KEY_LENGTH) {
      throw new Error(`Namespace "${namespace}" exceeds ${MAX_KEY_LENGTH} characters.`);
    }
    if (key.length > MAX_KEY_LENGTH) {
      throw new Error(`Key "${key}" exceeds ${MAX_KEY_LENGTH} characters.`);
    }
    validateAscii(namespace, `Namespace "${namespace}"`);
    validateAscii(key, `Key "${key}"`);
    const duplicateId = `${namespace}:${key}`;
    if (duplicateCheck.has(duplicateId)) {
      throw new Error(`Duplicate key "${key}" in namespace "${namespace}".`);
    }
    duplicateCheck.add(duplicateId);

    const valueBytes = encodeUtf8(String(entry.value ?? ""));
    const byteLimit = maxValueBytesForEntry(entry);
    if (valueBytes.length > byteLimit) {
      throw new Error(`Value for "${namespace}:${key}" is ${valueBytes.length} UTF-8 bytes, exceeding the device limit of ${byteLimit}.`);
    }
  });
}

function withLanguageMetadata(state) {
  const sourceEntries = Array.isArray(state?.entries) ? state.entries : [];
  const existingId = sourceEntries.find(
    (entry) => String(entry.namespace).trim() === "lang" && String(entry.key).trim() === "id",
  );
  const existingVersion = sourceEntries.find(
    (entry) => String(entry.namespace).trim() === "lang" && String(entry.key).trim() === "v",
  );
  const language = String(state?.language || existingId?.value || "").trim().toLowerCase();
  const version = String(state?.version || existingVersion?.value || "1.0").trim() || "1.0";
  const entries = sourceEntries.filter((entry) => {
    const namespace = String(entry.namespace).trim();
    const key = String(entry.key).trim();
    return namespace !== "lang" || (key !== "id" && key !== "v");
  });

  return {
    ...state,
    language,
    version,
    namespaceOrder: normalizeNamespaces(
      [{ namespace: "lang" }, ...entries],
      state?.namespaceOrder || [],
    ),
    entries: [
      {
        namespace: "lang",
        key: "id",
        value: language,
        storageType: "blob",
        encoding: "utf-8",
      },
      {
        namespace: "lang",
        key: "v",
        value: version,
        storageType: "blob",
        encoding: "utf-8",
      },
      ...entries,
    ],
  };
}

class NvsPageWriter {
  constructor(pageNumber, version, reserved = false) {
    this.pageNumber = pageNumber;
    this.version = version;
    this.entryCount = 0;
    this.buffer = new Uint8Array(PAGE_SIZE);
    this.buffer.fill(0xff);
    this.bitmap = new Uint8Array(32);
    this.bitmap.fill(0xff);

    if (!reserved) {
      writeU32(this.buffer, 0, 0xfffffffe);
      writeU32(this.buffer, 4, pageNumber);
      this.buffer[8] = version === 2 ? 0xfe : 0xff;
      writeU32(this.buffer, 28, crc32(this.buffer.slice(4, 28)));
    }
  }

  writeBitmap() {
    const bitNumber = this.entryCount * 2;
    const byteIndex = Math.floor(bitNumber / 8);
    const bitOffset = bitNumber & 7;
    this.bitmap[byteIndex] &= ~(1 << bitOffset);
    this.buffer.set(this.bitmap, BITMAP_OFFSET);
  }

  writeChunk(data, entryCount) {
    const offset = FIRST_ENTRY_OFFSET + (this.entryCount * ENTRY_SIZE);
    this.buffer.set(data, offset);
    for (let index = 0; index < entryCount; index += 1) {
      this.writeBitmap();
      this.entryCount += 1;
    }
  }

  markFull() {
    if (readU32(this.buffer, 0) === 0xfffffffe) {
      writeU32(this.buffer, 0, 0xfffffffc);
    }
  }
}

class NvsWriter {
  constructor(partitionSize, version = 2) {
    this.partitionSize = partitionSize;
    this.version = version;
    this.pageBudget = partitionSize - PAGE_SIZE;
    if (this.pageBudget < PAGE_SIZE * 2) {
      throw new Error("Partition size is too small for a valid NVS partition.");
    }
    this.pages = [];
    // ESP32-C3 runtime NVS initialization discards generated partitions whose
    // first page uses sequence number 0; start at 1 so the flashed partition
    // survives boot and remains readable via Preferences.
    this.pageNumber = 0;
    this.namespaceCount = 0;
    this.namespaceByName = new Map();
    this.currentNamespace = 0;
    this.createNewPage();
  }

  createNewPage(reserved = false) {
    if (this.pages.length > 0) {
      this.pages[this.pages.length - 1].markFull();
    }
    if (!reserved) {
      if (this.pageBudget === 0) {
        throw new Error("Partition is too small for the current set of entries.");
      }
      this.pageBudget -= PAGE_SIZE;
    }
    this.pageNumber += 1;
    const page = new NvsPageWriter(this.pageNumber, this.version, reserved);
    this.pages.push(page);
    this.currentPage = page;
    return page;
  }

  ensurePageSpace(requiredEntries, allowSplit = false) {
    if (this.currentPage.entryCount >= ENTRY_COUNT_PER_PAGE) {
      this.createNewPage();
      return;
    }
    if (this.currentPage.entryCount + requiredEntries >= ENTRY_COUNT_PER_PAGE && !allowSplit) {
      this.createNewPage();
    }
  }

  setHeaderCrc(entry) {
    const headerBytes = new Uint8Array(28);
    headerBytes.set(entry.slice(0, 4), 0);
    headerBytes.set(entry.slice(8, 32), 4);
    writeU32(entry, 4, crc32(headerBytes));
  }

  writePrimitive(namespaceIndex, key, typeCode, value) {
    this.ensurePageSpace(1);
    const entry = new Uint8Array(32);
    entry.fill(0xff);
    entry[0] = namespaceIndex;
    entry[1] = typeCode;
    entry[2] = 1;
    entry[3] = 0xff;
    entry.set(encodeAsciiKey(key), 8);
    entry[24] = value;
    this.setHeaderCrc(entry);
    this.currentPage.writeChunk(entry, 1);
  }

  writeNamespace(name) {
    if (this.namespaceByName.has(name)) {
      this.currentNamespace = this.namespaceByName.get(name);
      return;
    }
    this.namespaceCount += 1;
    this.currentNamespace = this.namespaceCount;
    this.namespaceByName.set(name, this.currentNamespace);
    this.writePrimitive(0, name, TYPE_CODE.u8, this.currentNamespace);
  }

  writeBlob(key, text) {
    const bytes = encodeUtf8(text);
    let offset = 0;
    let chunkCount = 0;
    const chunkStart = 0;
    const namespaceIndex = this.currentNamespace;
    let indexTargetPage = this.currentPage;

    while (true) {
      if (this.currentPage.entryCount >= ENTRY_COUNT_PER_PAGE) {
        this.createNewPage();
        continue;
      }
      let tailroom = (ENTRY_COUNT_PER_PAGE - this.currentPage.entryCount - 1) * ENTRY_SIZE;
      if (tailroom < 0) {
        this.createNewPage();
        continue;
      }
      const remaining = bytes.length - offset;
      const chunkSize = Math.min(tailroom, remaining);
      const roundedSize = (chunkSize + 31) & ~31;
      const dataEntryCount = roundedSize / ENTRY_SIZE;
      const entry = new Uint8Array(32);
      entry.fill(0xff);
      entry[0] = namespaceIndex;
      entry[1] = TYPE_CODE.blobData;
      entry[2] = dataEntryCount + 1;
      entry[3] = chunkStart + chunkCount;
      entry.set(encodeAsciiKey(key), 8);
      writeU16(entry, 24, chunkSize);
      writeU32(entry, 28, crc32(bytes.slice(offset, offset + chunkSize)));
      this.setHeaderCrc(entry);

      this.currentPage.writeChunk(entry, 1);

      const payload = new Uint8Array(roundedSize);
      payload.fill(0xff);
      payload.set(bytes.slice(offset, offset + chunkSize), 0);
      this.currentPage.writeChunk(payload, dataEntryCount);

      offset += chunkSize;
      chunkCount += 1;
      indexTargetPage = this.currentPage;

      const remainingAfterChunk = bytes.length - offset;
      if (!remainingAfterChunk) {
        break;
      }

      if ((tailroom - chunkSize) < ENTRY_SIZE) {
        this.createNewPage();
      }
    }

    if (indexTargetPage.entryCount >= ENTRY_COUNT_PER_PAGE) {
      this.createNewPage();
      indexTargetPage = this.currentPage;
    }

    const indexEntry = new Uint8Array(32);
    indexEntry.fill(0xff);
    indexEntry[0] = namespaceIndex;
    indexEntry[1] = TYPE_CODE.blobIndex;
    indexEntry[2] = 1;
    indexEntry[3] = 0xff;
    indexEntry.set(encodeAsciiKey(key), 8);
    writeU32(indexEntry, 24, bytes.length);
    indexEntry[28] = chunkCount;
    indexEntry[29] = chunkStart;
    this.setHeaderCrc(indexEntry);
    indexTargetPage.writeChunk(indexEntry, 1);
    this.currentPage = indexTargetPage;
  }

  finalize() {
    while (this.pageBudget > 0) {
      this.createNewPage();
    }
    this.createNewPage(true);
    const output = new Uint8Array(this.pages.length * PAGE_SIZE);
    this.pages.forEach((page, index) => output.set(page.buffer, index * PAGE_SIZE));
    return output;
  }

  getUsageStats() {
    const totalPages = this.partitionSize / PAGE_SIZE;
    const usablePages = Math.max(0, totalPages - 1);
    const usedPages = this.pages.length;
    return {
      pageSize: PAGE_SIZE,
      totalPages,
      usablePages,
      usedPages,
      totalBytes: this.partitionSize,
      usableBytes: usablePages * PAGE_SIZE,
      usedBytes: usedPages * PAGE_SIZE,
    };
  }
}

function encodeAsciiKey(value) {
  validateAscii(value, `Key "${value}"`);
  if (value.length > MAX_KEY_LENGTH) {
    throw new Error(`Key "${value}" exceeds ${MAX_KEY_LENGTH} characters.`);
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i);
  }
  return bytes;
}

function encodeNvsBinary(state) {
  const normalized = withLanguageMetadata(state);
  validateEditorState(normalized);
  const partitionSize = Number(normalized.partitionSize || DEFAULT_PARTITION_SIZE);
  const namespaceOrder = normalizeNamespaces(normalized.entries, normalized.namespaceOrder || []);
  const writer = new NvsWriter(partitionSize, 2);

  namespaceOrder.forEach((namespace) => {
    writer.writeNamespace(namespace);
    normalized.entries
      .filter((entry) => String(entry.namespace).trim() === namespace)
      .forEach((entry) => {
        writer.writeBlob(String(entry.key).trim(), String(entry.value ?? ""));
      });
  });

  return writer.finalize();
}

function calculatePartitionUsage(state) {
  const normalized = withLanguageMetadata(state);
  validateEditorState(normalized);
  const partitionSize = Number(normalized.partitionSize || DEFAULT_PARTITION_SIZE);
  const namespaceOrder = normalizeNamespaces(normalized.entries, normalized.namespaceOrder || []);
  const writer = new NvsWriter(partitionSize, 2);

  namespaceOrder.forEach((namespace) => {
    writer.writeNamespace(namespace);
    normalized.entries
      .filter((entry) => String(entry.namespace).trim() === namespace)
      .forEach((entry) => {
        writer.writeBlob(String(entry.key).trim(), String(entry.value ?? ""));
      });
  });

  return writer.getUsageStats();
}

function stateToJson(state) {
  const normalized = withLanguageMetadata(state);
  const namespaceOrder = normalizeNamespaces(normalized.entries || [], normalized.namespaceOrder || []);
  const namespaces = namespaceOrder.map((name) => ({
    name,
    entries: (normalized.entries || [])
      .filter((entry) => String(entry.namespace).trim() === name)
      .map((entry) => ({
        key: String(entry.key ?? ""),
        value: String(entry.value ?? ""),
      })),
  }));

  return JSON.stringify({
    format: "smartrosary-language-v1",
    language: normalized.language || "",
    version: normalized.version || "1.0",
    partitionSize: Number(normalized.partitionSize || DEFAULT_PARTITION_SIZE),
    nvsVersion: 2,
    namespaces,
  }, null, 2);
}

function jsonToState(jsonText, fallback = {}) {
  const data = JSON.parse(jsonText);
  const namespaces = Array.isArray(data.namespaces)
    ? data.namespaces
    : Object.entries(data.namespaces || {}).map(([name, entries]) => ({ name, entries }));
  const entries = [];
  const namespaceOrder = [];

  namespaces.forEach((namespaceBlock) => {
    const namespace = String(namespaceBlock.name || "").trim();
    if (!namespace) {
      return;
    }
    namespaceOrder.push(namespace);
    const nsEntries = Array.isArray(namespaceBlock.entries) ? namespaceBlock.entries : [];
    nsEntries.forEach((entry) => {
      entries.push({
        namespace,
        key: String(entry.key || "").trim(),
        value: String(entry.value ?? ""),
        storageType: "blob",
        encoding: "utf-8",
      });
    });
  });

  const state = {
    format: "smartrosary-language-v1",
    language: String(data.language || fallback.language || ""),
    version: String(data.version || fallback.version || ""),
    partitionSize: Number(data.partitionSize || fallback.partitionSize || DEFAULT_PARTITION_SIZE),
    nvsVersion: 2,
    namespaceOrder,
    entries,
    diagnostics: fallback.diagnostics || null,
  };
  validateEditorState(state);
  return withLanguageMetadata(state);
}

function downloadBytes(filename, bytes, mimeType = "application/octet-stream") {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30000);
}

async function readFileAsText(file) {
  return file.text();
}

async function readFileAsBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}


globalThis.NvsEditorLib = {
  DEFAULT_PARTITION_SIZE,
  crc32,
  detectLanguageFromName,
  parseNvsBinary,
  validateNvsBinaryCrcs,
  validateEditorState,
  withLanguageMetadata,
  encodeNvsBinary,
  calculatePartitionUsage,
  stateToJson,
  jsonToState,
  downloadBytes,
  readFileAsText,
  readFileAsBytes,
  maxValueBytesForEntry,
};
