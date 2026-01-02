import fs from 'node:fs';
import path from 'node:path';

// Minimal ICO writer: stores a single PNG image inside the .ico container.
// ICO supports PNG payloads (Vista+), which modern browsers handle fine.

const root = process.cwd();
const pngPath = path.join(root, 'public', 'favicon.svg.png');
const outPath = path.join(root, 'public', 'favicon.ico');

const png = fs.readFileSync(pngPath);

// ICONDIR (6 bytes): reserved(2)=0, type(2)=1, count(2)=1
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

// ICONDIRENTRY (16 bytes)
// width/height: 0 means 256 in ICO format
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // width 256
entry.writeUInt8(0, 1); // height 256
entry.writeUInt8(0, 2); // color count
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bit count (informational for PNG-in-ICO)
entry.writeUInt32LE(png.length, 8); // bytes in resource
entry.writeUInt32LE(6 + 16, 12); // image offset

const ico = Buffer.concat([header, entry, png]);
fs.writeFileSync(outPath, ico);

console.log(`Wrote ${outPath} (${ico.length} bytes) from ${pngPath} (${png.length} bytes)`);


