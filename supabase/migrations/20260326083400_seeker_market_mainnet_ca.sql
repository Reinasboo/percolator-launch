-- GH#1726: Add mainnet_ca for SEEKER/USD market so oracle-keeper discovers and prices it.
--
-- Root cause: SEEKER/USD slab (FPFcixRnhYDVY7wLVRTATVV1banRFefQAfX9Gn2LyoRY) was created
-- with a devnet collateral mint (7KyVYJNha6bKNMmMHzsirKc4QGjFCqsSEzDJNtdGoZn7) that has
-- no DexScreener/Jupiter listing. The oracle-keeper's discoverNewMarkets() skips markets
-- where mainnet_ca is null. Setting mainnet_ca to the SKR mainnet address allows the
-- oracle-keeper to fetch a live price via Jupiter/DexScreener and push it on-chain.
--
-- SKR (Seeker/Solana Mobile) mainnet mint: SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3
-- Oracle authority: FF7KFfU5Bb3Mze2AasDHCCZuyhdaSLjUZy2K3JvjdB7x (matches keeper admin key)

UPDATE markets
SET
  mainnet_ca  = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
  symbol      = 'SKR',
  name        = 'Seeker'
WHERE slab_address = 'FPFcixRnhYDVY7wLVRTATVV1banRFefQAfX9Gn2LyoRY';
