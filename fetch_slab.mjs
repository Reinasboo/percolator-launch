import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = "https://devnet.helius-rpc.com/?api-key=ecfc91c7-b704-4c37-b10e-a277392830aa";
const connection = new Connection(RPC_URL, "confirmed");

const SLAB_257200 = "2M1NvXDbdSkUXTWERcrh5e3LjPKpzeEHPUYcw5rBXaDV";
const SLAB_992560 = "3Eq3G6fiPFkvqQdUXNMGRrgqVCcNV74Mo7Td9qhvq3HR";

function dv(data) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}
function readU32LE(data, off) { return dv(data).getUint32(off, true); }
function readU64LE(data, off) { return dv(data).getBigUint64(off, true); }
function readU16LE(data, off) { return dv(data).getUint16(off, true); }

async function inspect(addr, label) {
  const info = await connection.getAccountInfo(new PublicKey(addr));
  if (!info) { console.log(`${addr}: NOT FOUND`); return; }
  const data = new Uint8Array(info.data);
  console.log(`\n=== ${label}: ${addr} ===`);
  console.log(`  dataLen: ${data.length}`);
  const magic = Buffer.from(data.slice(0, 8)).toString('hex');
  const magicStr = Buffer.from(data.slice(0, 8)).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
  console.log(`  magic hex: ${magic}  ascii: ${magicStr}`);
  const version = readU32LE(data, 8);
  console.log(`  version: ${version}`);
  console.log(`  bump: ${data[12]}, flags: ${data[13]}`);
  // Try roff at 48 and 80
  for (const roff of [48, 80]) {
    if (data.length > roff + 16) {
      console.log(`  nonce@${roff}: ${readU64LE(data, roff)}, lastThr@${roff+8}: ${readU64LE(data, roff+8)}`);
    }
  }
  // Check what TIERS/maxAccounts could give 257200 and 992560
  // Formula: engineOff + bitmapOff + bitmapWords*8 + 18 + maxAccounts*2 padded + maxAccounts*accountSize
  console.log(`\n  --- Reverse-engineer layout ---`);
  const len = data.length;
  // If accountSize=248 (V1/V2), try engineOffs: 480(V0 no), 600(V2), 640(V1)
  for (const engineOff of [480, 520, 560, 600, 640]) {
    for (const bitmapOff of [320, 432, 656]) {
      for (const maxAccounts of [64, 256, 1024, 4096]) {
        for (const accountSize of [240, 248]) {
          const bitmapWords = Math.ceil(maxAccounts / 64);
          const bitmapBytes = bitmapWords * 8;
          const postBitmap = 18;
          const nextFreeBytes = maxAccounts * 2;
          const preAccountsLen = bitmapOff + bitmapBytes + postBitmap + nextFreeBytes;
          const accountsOffRel = Math.ceil(preAccountsLen / 8) * 8;
          const computed = engineOff + accountsOffRel + maxAccounts * accountSize;
          if (computed === len) {
            console.log(`  MATCH: engineOff=${engineOff}, bitmapOff=${bitmapOff}, maxAccounts=${maxAccounts}, accountSize=${accountSize}, accountsOffRel=${accountsOffRel}`);
          }
        }
      }
    }
  }
  // First 128 bytes hex for manual inspection
  console.log(`  first128: ${Buffer.from(data.slice(0, 128)).toString('hex')}`);
}

(async () => {
  await inspect(SLAB_257200, "257200-byte slab");
  await inspect(SLAB_992560, "992560-byte slab");
})().catch(console.error);
