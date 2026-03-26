-- Migration: Hotfix — correct wBTC mainnet CA for GH#1730 oracle fix
--
-- Previous migration 20260326100000 used the wrong mainnet wBTC CA:
--   WRONG:  9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E  (Wrapped Bitcoin Sollet, deprecated, ~$390)
--   RIGHT:  3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh  (Wrapped BTC Wormhole, canonical, ~$68,000)
--
-- The oracle-keeper's JUPITER_MINTS uses 3NZ9JMVBmGAq... which is correct.
-- This migration corrects devnet_mints and markets to match.
--
-- References: GH#1730, QA review of PR #1732, 2026-03-26

-- ── Fix devnet_mints: update Sollet CA → Wormhole CA ────────────────────────
UPDATE devnet_mints
SET
  mainnet_ca = '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  notes      = COALESCE(notes, '') || ' | CORRECTED 2026-03-26: replaced deprecated Sollet wBTC (9n4nbM75) with canonical Wormhole wBTC (3NZ9JMVBmGAq) per GH#1730 QA review',
  updated_at = NOW()
WHERE devnet_mint = 'CJUyV594JzJpK2BUakNpm6NbmCkhQoPJWkKjfKTvxJ3C'
  AND mainnet_ca = '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E';

-- ── Fix markets: update any rows with the wrong Sollet CA ───────────────────
UPDATE markets
SET
  mainnet_ca = '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  updated_at = NOW()
WHERE mint_address = 'CJUyV594JzJpK2BUakNpm6NbmCkhQoPJWkKjfKTvxJ3C'
  AND mainnet_ca = '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E';

-- Verify (informational):
-- SELECT devnet_mint, mainnet_ca, symbol FROM devnet_mints
-- WHERE devnet_mint = 'CJUyV594JzJpK2BUakNpm6NbmCkhQoPJWkKjfKTvxJ3C';
-- → mainnet_ca should be 3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh (~$68,000)
--
-- SELECT slab_address, mainnet_ca FROM markets
-- WHERE mint_address = 'CJUyV594JzJpK2BUakNpm6NbmCkhQoPJWkKjfKTvxJ3C';
-- → mainnet_ca should be 3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh
