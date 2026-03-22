import { permanentRedirect } from "next/navigation";

interface Props {
  params: Promise<{ slab: string }>;
}

/**
 * /markets/[slab] → /trade/[slab]
 *
 * The /markets list links to /trade/[slab] directly, but users who bookmarked
 * or received a shared /markets/[slab] URL were hitting a 404 because there
 * was no server-rendered route at that path.
 *
 * This page issues a permanent (308) redirect to the canonical trade URL so
 * that direct navigation, bookmarks, and shared links all resolve correctly.
 *
 * GH#1552 — fix: /markets/[slab] 404 on direct navigation
 */
export default async function MarketSlabRedirect({ params }: Props) {
  const { slab } = await params;
  permanentRedirect(`/trade/${slab}`);
}
