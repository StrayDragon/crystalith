/** Minimal OOXML .docx (stored ZIP) for parser-docx tests — no mammoth/office dep. */

function crc32(data: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xed_b8_83_20 & -(crc & 1));
    }
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

function zipStore(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    local[0] = 0x50;
    local[1] = 0x4b;
    local[2] = 0x03;
    local[3] = 0x04;
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    central[0] = 0x50;
    central[1] = 0x4b;
    central[2] = 0x01;
    central[3] = 0x02;
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const cdOffset = offset;
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  eocd[0] = 0x50;
  eocd[1] = 0x4b;
  eocd[2] = 0x05;
  eocd[3] = 0x06;
  ev.setUint16(8, locals.length, true);
  ev.setUint16(10, locals.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  const out = new Uint8Array(cdOffset + cdSize + eocd.length);
  let pos = 0;
  for (const part of locals) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centrals) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const PKG_NS = 'http://schemas.openxmlformats.org/package/2006';
const OD_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';

/** Build a one-paragraph .docx whose mammoth markdown contains `text`. */
export function buildMinimalDocx(text: string): Uint8Array {
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return zipStore({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${PKG_NS}/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_NS}/relationships">
  <Relationship Id="rId1" Type="${OD_REL}" Target="word/document.xml"/>
</Relationships>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NS}">
  <w:body>
    <w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_NS}/relationships"/>`,
  });
}
