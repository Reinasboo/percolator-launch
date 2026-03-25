import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");

const SLABS = [
  "3LzuDyhZzhSchxSqkBQCEaGAsXwu9vYZqSVH3MvNQB9k",
  "ykoRHvTmJRsCmN1guhBCWpdDhRhZb1oTutCZy5EgPEd",
];

const PYTH_PUSH_PROGRAM = "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT";

function derivePythPushOraclePDA(feedIdHex) {
  const feedId = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    feedId[i] = parseInt(feedIdHex.substring(i * 2, i * 2 + 2), 16);
  }
  const shardBuf = new Uint8Array(2);
  return PublicKey.findProgramAddressSync([shardBuf, feedId], new PublicKey(PYTH_PUSH_PROGRAM));
}

for (const addr of SLABS) {
  try {
    const info = await conn.getAccountInfo(new PublicKey(addr));
    if (!info) { console.log(addr, "ACCOUNT NOT FOUND"); continue; }
    const data = info.data;
    // Parse config: skip header (tag=1byte, magic=4, version=4, slot_count=2, kind=1), then config
    // Magic = 4 bytes at offset 1
    const magic = data.readUInt32LE(1);
    const version = data.readUInt8(5);
    const slotCount = data.readUInt16LE(6);
    const kind = data.readUInt8(8);
    
    // Config starts at offset 9 (after header tag+magic+version+slot_count+kind)
    // Actually let me look at actual SDK parsing
    // Header: 9 bytes (tag=1, magic=4, version=1, slot_count=2, kind=1) 
    // Config: admin(32) + mint(32) + indexFeedId(32) + oracleAuthority(32) + ...
    const configOff = 9;
    const adminKey = new PublicKey(data.subarray(configOff, configOff + 32));
    const mint = new PublicKey(data.subarray(configOff + 32, configOff + 64));
    const indexFeedId = data.subarray(configOff + 64, configOff + 96);
    const indexFeedIdHex = Buffer.from(indexFeedId).toString('hex');
    const oracleAuthority = new PublicKey(data.subarray(configOff + 96, configOff + 128));
    
    const isAllZeros = indexFeedId.every(b => b === 0);
    const oracleIsDefault = oracleAuthority.equals(PublicKey.default);
    const isAdminOracle = !oracleIsDefault;
    
    console.log(`\n--- ${addr} ---`);
    console.log("  magic:", magic.toString(16), "| version:", version, "| slotCount:", slotCount, "| kind:", kind);
    console.log("  admin:", adminKey.toBase58());
    console.log("  mint:", mint.toBase58());
    console.log("  indexFeedId (hex):", indexFeedIdHex);
    console.log("  indexFeedId allZeros:", isAllZeros);
    console.log("  oracleAuthority:", oracleAuthority.toBase58());
    console.log("  oracleAuthority isDefault:", oracleIsDefault);
    console.log("  isAdminOracle:", isAdminOracle);
    
    if (!isAdminOracle) {
      const [pda] = derivePythPushOraclePDA(indexFeedIdHex);
      console.log("  Pyth PDA:", pda.toBase58());
      const pdaInfo = await conn.getAccountInfo(pda);
      console.log("  Pyth PDA exists:", !!pdaInfo, pdaInfo ? `(${pdaInfo.data.length} bytes, owner: ${pdaInfo.owner.toBase58()})` : "");
    }
    console.log("  program (owner):", info.owner.toBase58());
  } catch (e) {
    console.log(addr, "ERROR:", e.message);
  }
}
