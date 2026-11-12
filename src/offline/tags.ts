// Reads title / artist / album / cover from audio files (own implementation):
//   MP3: ID3v2.2, v2.3, v2.4 (+ ID3v1 at the end as a fallback)
//   M4A/AAC/MP4: iTunes-style metadata (moov › [udta ›] meta › ilst)
// Anything unrecognised is simply ignored; the importer falls back to the file name.

export interface ParsedTags {
  title?: string;
  artist?: string;
  album?: string;
  cover?: { data: Uint8Array; mime: string };
}

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const syncsafe = (b: Uint8Array, o: number) =>
  ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

const clean = (s: string | undefined) => {
  const t = s?.replace(/\0+$/g, '').split('\0')[0].trim();
  return t ? t : undefined;
};

function decode(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return '';
  }
}

/** ID3 text: first byte = encoding (0 latin1, 1 UTF-16+BOM, 2 UTF-16BE, 3 UTF-8). */
function id3Text(d: Uint8Array): string | undefined {
  if (d.length < 2) return undefined;
  const enc = d[0];
  const body = d.subarray(1);
  const text =
    enc === 0
      ? decode(body, 'latin1')
      : enc === 1
        ? body[0] === 0xfe && body[1] === 0xff
          ? decode(body.subarray(2), 'utf-16be')
          : decode(body[0] === 0xff && body[1] === 0xfe ? body.subarray(2) : body, 'utf-16le')
        : enc === 2
          ? decode(body, 'utf-16be')
          : decode(body, 'utf-8');
  return clean(text);
}

/** Offset just past a NUL terminator (1 byte for latin1/UTF-8, 2 aligned bytes for UTF-16). */
function skipTerminated(d: Uint8Array, start: number, enc: number): number {
  if (enc === 1 || enc === 2) {
    for (let i = start; i + 1 < d.length; i += 2) if (d[i] === 0 && d[i + 1] === 0) return i + 2;
    return d.length;
  }
  const i = d.indexOf(0, start);
  return i < 0 ? d.length : i + 1;
}

function sniffImage(data: Uint8Array): string {
  if (data[0] === 0x89 && data[1] === 0x50) return 'image/png';
  return 'image/jpeg';
}

/** Removes ID3 "unsynchronisation" (0xFF 0x00 → 0xFF). */
function deUnsync(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length);
  let j = 0;
  for (let i = 0; i < b.length; i++) {
    out[j++] = b[i];
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, j);
}

function parseId3v2(file: Uint8Array): ParsedTags {
  const out: ParsedTags = {};
  if (file.length < 10) return out;
  const ver = file[3];
  const flags = file[5];
  const size = syncsafe(file, 6);
  let b = file.subarray(0, Math.min(file.length, 10 + size));
  if (flags & 0x80 && ver < 4) b = deUnsync(b); // v2.4 unsyncs per frame instead
  let o = 10;
  if (flags & 0x40 && ver >= 3) o += ver === 4 ? syncsafe(b, 10) : 4 + u32(b, 10);

  let coverType = -1;
  const handle = (id: string, d: Uint8Array) => {
    if (id === 'TIT2' || id === 'TT2') out.title ??= id3Text(d);
    else if (id === 'TPE1' || id === 'TP1') out.artist ??= id3Text(d);
    else if (id === 'TALB' || id === 'TAL') out.album ??= id3Text(d);
    else if (id === 'APIC' || id === 'PIC') {
      const enc = d[0];
      let i: number;
      let mime: string;
      if (id === 'PIC') {
        mime = ascii(d, 1, 3).toUpperCase() === 'PNG' ? 'image/png' : 'image/jpeg';
        i = 4;
      } else {
        const mEnd = d.indexOf(0, 1);
        mime = decode(d.subarray(1, mEnd < 0 ? 1 : mEnd), 'latin1').toLowerCase();
        i = (mEnd < 0 ? d.length : mEnd) + 1;
      }
      const type = d[i];
      i = skipTerminated(d, i + 1, enc);
      const data = d.subarray(i);
      // Keep the first picture, but let a front cover (type 3) replace a non-front one.
      if (data.length > 0 && (!out.cover || (type === 3 && coverType !== 3))) {
        coverType = type;
        if (!mime.startsWith('image/')) mime = sniffImage(data);
        if (mime === 'image/jpg') mime = 'image/jpeg';
        out.cover = { data: data.slice(), mime };
      }
    }
  };

  if (ver === 2) {
    while (o + 6 <= b.length) {
      const id = ascii(b, o, 3);
      const sz = (b[o + 3] << 16) | (b[o + 4] << 8) | b[o + 5];
      if (!/^[A-Z0-9]{3}$/.test(id) || sz <= 0) break;
      handle(id, b.subarray(o + 6, o + 6 + sz));
      o += 6 + sz;
    }
  } else {
    while (o + 10 <= b.length) {
      const id = ascii(b, o, 4);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const sz = ver === 4 ? syncsafe(b, o + 4) : u32(b, o + 4);
      if (sz <= 0) break;
      const fmt = b[o + 9];
      let d = b.subarray(o + 10, o + 10 + sz);
      if (ver === 4) {
        if (fmt & 0x01) d = d.subarray(4); // data-length indicator
        if (fmt & 0x02) d = deUnsync(d); // per-frame unsynchronisation
      }
      const compressedOrEncrypted = ver === 4 ? fmt & 0x0c : fmt & 0xc0;
      if (!compressedOrEncrypted) handle(id, d);
      o += 10 + sz;
    }
  }
  return out;
}

function parseId3v1(b: Uint8Array): ParsedTags {
  if (b.length < 128) return {};
  const t = b.subarray(b.length - 128);
  if (ascii(t, 0, 3) !== 'TAG') return {};
  const field = (o: number) => clean(decode(t.subarray(o, o + 30), 'latin1'));
  return { title: field(3), artist: field(33), album: field(63) };
}

// ---------- MP4 / M4A ----------

function eachBox(b: Uint8Array, start: number, end: number, cb: (type: string, from: number, to: number) => void) {
  let o = start;
  while (o + 8 <= end) {
    let size = u32(b, o);
    const type = ascii(b, o + 4, 4);
    let header = 8;
    if (size === 1) {
      size = u32(b, o + 8) * 2 ** 32 + u32(b, o + 12);
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < header || o + size > end) break;
    cb(type, o + header, o + size);
    o += size;
  }
}

function findBox(b: Uint8Array, start: number, end: number, type: string): [number, number] | null {
  let found: [number, number] | null = null;
  eachBox(b, start, end, (t, from, to) => {
    if (!found && t === type) found = [from, to];
  });
  return found;
}

function parseMp4(b: Uint8Array): ParsedTags {
  const out: ParsedTags = {};
  const moov = findBox(b, 0, b.length, 'moov');
  if (!moov) return out;
  // meta can sit in moov/udta/meta or directly in moov/meta; it's a "full box" (4 extra bytes).
  const udta = findBox(b, moov[0], moov[1], 'udta');
  const meta = (udta && findBox(b, udta[0], udta[1], 'meta')) || findBox(b, moov[0], moov[1], 'meta');
  if (!meta) return out;
  const ilst = findBox(b, meta[0] + 4, meta[1], 'ilst');
  if (!ilst) return out;

  eachBox(b, ilst[0], ilst[1], (item, from, to) => {
    const data = findBox(b, from, to, 'data');
    if (!data) return;
    const typeCode = u32(b, data[0]) & 0xffffff;
    const value = b.subarray(data[0] + 8, data[1]); // skip type (4) + locale (4)
    const text = () => clean(decode(value, 'utf-8'));
    if (item === '©nam') out.title ??= text();
    else if (item === '©ART') out.artist ??= text();
    else if (item === 'aART') out.artist ??= text();
    else if (item === '©alb') out.album ??= text();
    else if (item === 'covr' && !out.cover && value.length > 0) {
      out.cover = { data: value.slice(), mime: typeCode === 14 ? 'image/png' : typeCode === 13 ? 'image/jpeg' : sniffImage(value) };
    }
  });
  return out;
}

/** Parses whatever tags the file has. Never throws. */
export function parseTags(buffer: ArrayBuffer): ParsedTags {
  try {
    const b = new Uint8Array(buffer);
    if (b.length > 8 && ascii(b, 4, 4) === 'ftyp') return parseMp4(b);
    const v1 = parseId3v1(b);
    const v2 = ascii(b, 0, 3) === 'ID3' ? parseId3v2(b) : {};
    return {
      title: v2.title ?? v1.title,
      artist: v2.artist ?? v1.artist,
      album: v2.album ?? v1.album,
      cover: v2.cover,
    };
  } catch (e) {
    console.warn('[import] could not read tags', e);
    return {};
  }
}
