# Squads Multisig Setup — Percolator Program Upgrade Authority

**Purpose:** Transfer the Percolator mainnet program upgrade authority from a single keypair (`7JVQvrAfzj3aasLxCkoLYX5KQcrb5nEZhUe5Qa8PvV5G`) to a Squads V4 multisig vault. This is a **mainnet go/no-go blocker** (GH#1823, PERC-8168).

**Risk:** This is a one-way operation on mainnet. Test on devnet first. Once transferred, program upgrades require multisig approval — you cannot undo this without another approved multisig transaction.

---

## Overview

| Item | Value |
|------|-------|
| Mainnet program | `ESa89R5Es3rJ5mnwGybVRG1GrNt9etP11Z5V2QWD4edv` |
| Current authority | `7JVQvrAfzj3aasLxCkoLYX5KQcrb5nEZhUe5Qa8PvV5G` |
| Authority keypair | `~/.percolator-mainnet/keys/deploy-authority.json` |
| Devnet authority | `FF7KFfU5Bb3Mze2AasDHCCZuyhdaSLjUZy2K3JvjdB7x` |
| Devnet program (medium) | `g9msRSV3sJmmE3r5Twn9HuBsxzuuRGTjKCVTKudm9in` |
| Squads V4 Program | `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` (same on mainnet + devnet) |

---

## Step 1 — Create Squads Multisig (Browser, 10 min)

1. Go to **https://v4.squads.so**
2. Connect your wallet (use the wallet that will be a member — ideally a hardware wallet or at minimum a separate hot wallet, **not** the deploy key)
3. Click **"Create Multisig"**
4. Configure:
   - **Name:** `Percolator Upgrade Authority`
   - **Members:** Add all co-signers by wallet address
     - Recommended minimum: **2-of-3** threshold
     - Add Khubair's primary wallet + 2 trusted hardware wallets
   - **Threshold:** `2` (require 2 approvals for any upgrade)
   - **Time lock:** `0` for now (can increase later via config proposal)
5. Confirm and submit the transaction
6. **Record the Multisig address** shown on the created multisig page

> 💡 The multisig address is the PDA; the **vault** is a derived PDA used as the actual authority. See Step 2.

---

## Step 2 — Get the Vault PDA (the actual new authority)

The vault PDA (index 0) is what you'll set as the new upgrade authority — NOT the multisig PDA itself.

**Option A — From Squads UI:**
1. Open your multisig at https://v4.squads.so
2. Go to **Settings → Program Manager** (or check the vault address shown under "Vault 0")
3. Copy the **Vault 0** address — this is your new upgrade authority

**Option B — Derive it programmatically:**
```bash
cd ~/percolator-launch
npx ts-node scripts/get-squads-vault.ts <MULTISIG_PDA>
```

Or inline with node:
```bash
node -e "
const { getVaultPda } = require('@sqds/multisig');
const { PublicKey } = require('@solana/web3.js');
const [vault] = getVaultPda({ multisigPda: new PublicKey('YOUR_MULTISIG_PDA_HERE'), index: 0 });
console.log('Vault 0 (new upgrade authority):', vault.toString());
"
```

**Record this vault address** — you'll use it in Step 4.

---

## Step 3 — Devnet Test Run (Required Before Mainnet)

Run the automated test script to verify the full flow works on devnet before touching mainnet:

```bash
cd ~/percolator-launch

# Dry-run first — shows what would happen, does NOT submit
bash scripts/transfer-upgrade-authority.sh --network devnet --dry-run

# Live devnet run
bash scripts/transfer-upgrade-authority.sh --network devnet
```

The script will:
1. Verify current upgrade authority on-chain
2. Submit the `set-upgrade-authority` transaction
3. Confirm the new authority on-chain
4. Print a verification link to Solana explorer

**Expected output:**
```
[INFO] Current authority: FF7KFfU5Bb3Mze2AasDHCCZuyhdaSLjUZy2K3JvjdB7x
[INFO] New authority:     <YOUR_SQUADS_VAULT_PDA>
[INFO] Program:           g9msRSV3sJmmE3r5Twn9HuBsxzuuRGTjKCVTKudm9in (devnet)
...
[SUCCESS] Upgrade authority transferred. Verification: https://explorer.solana.com/...
[INFO] Final authority on-chain: <YOUR_SQUADS_VAULT_PDA> ✓
```

If devnet succeeds → proceed to Step 4.

---

## Step 4 — Mainnet Transfer (One-Way, Irreversible)

> ⚠️ **This is irreversible.** After this step, ALL future program upgrades require a Squads multisig proposal + threshold approval. You will NOT be able to upgrade the program with just the deploy key.

Ensure you have:
- [ ] Created the Squads multisig (Step 1)
- [ ] Recorded the vault PDA (Step 2)
- [ ] Successfully tested on devnet (Step 3)
- [ ] `~/.percolator-mainnet/keys/deploy-authority.json` available and accessible
- [ ] Enough SOL in `7JVQvr...` wallet for transaction fee (~0.000005 SOL)

Run:
```bash
cd ~/percolator-launch

# Dry-run first
bash scripts/transfer-upgrade-authority.sh \
  --network mainnet \
  --new-authority <SQUADS_VAULT_PDA> \
  --dry-run

# Live mainnet run (type YES when prompted)
bash scripts/transfer-upgrade-authority.sh \
  --network mainnet \
  --new-authority <SQUADS_VAULT_PDA>
```

**Verify immediately after:**
```bash
solana program show ESa89R5Es3rJ5mnwGybVRG1GrNt9etP11Z5V2QWD4edv --url mainnet-beta
# "Upgrade Authority" field must now show your Squads vault PDA
```

---

## Step 5 — Post-Transfer: How to Upgrade Programs via Squads

After the authority is transferred, all program upgrades go through Squads:

1. **Build the new `.so`:**
   ```bash
   cd ~/percolator-prog && anchor build
   ```

2. **Buffer upload** (pre-upload the new bytecode; does NOT require multisig):
   ```bash
   solana program write-buffer target/deploy/percolator_prog.so \
     --url mainnet-beta \
     --keypair ~/.percolator-mainnet/keys/deploy-authority.json
   # Note the buffer address printed
   ```

3. **Set buffer authority to Squads vault:**
   ```bash
   solana program set-buffer-authority <BUFFER_ADDRESS> \
     --new-buffer-authority <SQUADS_VAULT_PDA> \
     --url mainnet-beta \
     --keypair ~/.percolator-mainnet/keys/deploy-authority.json
   ```

4. **Create Squads proposal** at https://v4.squads.so:
   - Go to your multisig → **Developer Tools** → **Program Upgrade**
   - Enter program ID: `ESa89R5Es3rJ5mnwGybVRG1GrNt9etP11Z5V2QWD4edv`
   - Enter buffer address from step 2
   - Submit proposal

5. **Collect approvals** from required multisig members (reach threshold)

6. **Execute** the proposal once threshold is met

---

## Rollback Plan (Devnet Only)

If you need to restore the devnet upgrade authority back to the single keypair after testing:

```bash
# Only possible if you are still a member of the multisig AND the proposal passes
# This requires creating a Squads config transaction to transfer authority back
# Use the Squads UI: Settings → Transfer Upgrade Authority → back to FF7KFf...
```

> Mainnet: There is no simple rollback. The multisig itself can approve a transfer back to a single key via a config transaction, but this requires reaching threshold.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: Upgrade authority does not match` | Wrong keypair | Check `--keypair` path matches current authority |
| `Error: unable to confirm transaction` | Network congestion | Retry; increase `--with-compute-unit-price` |
| `insufficient funds` | Deploy wallet low on SOL | Fund `7JVQvr...` with ≥0.01 SOL |
| `Error: Account not found` | Wrong program ID | Verify program ID with `solana program show` |
| Squads vault PDA wrong | Wrong multisig address | Re-derive vault using `getVaultPda` with correct multisig PDA |

---

## References

- [Squads V4 Docs](https://docs.squads.so)
- [Squads App (Mainnet)](https://v4.squads.so)
- [Squads V4 SDK](https://github.com/Squads-Protocol/v4)
- GH Issue: [#1823](https://github.com/dcccrypto/percolator-launch/issues/1823)
- Task: PERC-8351 / PERC-8168
