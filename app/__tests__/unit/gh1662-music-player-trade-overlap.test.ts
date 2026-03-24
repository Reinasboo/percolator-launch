/**
 * GH#1662 — MusicPlayer overlap in STATS panel at 1440px desktop
 *
 * Root cause: MusicPlayer is `fixed bottom-5 right-5` and at 1440px overlaps
 * the 340px right STATS column (◀ ▶ ✕ volume controls visible over stat cells).
 *
 * Fix: On /trade routes at lg+ breakpoints, the player moves to bottom-LEFT
 * (lg:left-5 lg:right-auto) so it sits below the chart, away from right panel.
 */

import { readFileSync } from "fs";
import { join } from "path";

const playerSrc = readFileSync(
  join(__dirname, "../../components/ui/MusicPlayer.tsx"),
  "utf8"
);

describe("GH#1662 – MusicPlayer does not overlap STATS panel at 1440px", () => {
  it("defines MOVE_TO_BOTTOM_LEFT_ROUTES_LG constant containing /trade", () => {
    expect(playerSrc).toContain("MOVE_TO_BOTTOM_LEFT_ROUTES_LG");
    // Must include /trade
    const match = playerSrc.match(/MOVE_TO_BOTTOM_LEFT_ROUTES_LG\s*=\s*\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('"/trade"');
  });

  it("applies lg:left-5 and lg:right-auto classes on /trade routes", () => {
    expect(playerSrc).toContain("lg:left-5");
    expect(playerSrc).toContain("lg:right-auto");
  });

  it("uses moveToBottomLeftLg flag derived from MOVE_TO_BOTTOM_LEFT_ROUTES_LG", () => {
    expect(playerSrc).toContain("moveToBottomLeftLg");
    expect(playerSrc).toContain(
      "MOVE_TO_BOTTOM_LEFT_ROUTES_LG.some((r) => pathname?.startsWith(r))"
    );
  });

  it("places lg position classes inside the conditional className (not unconditionally)", () => {
    // The lg:left-5 must appear only inside the moveToBottomLeftLg ternary branch,
    // not in the fallback or the moveToTop branch.
    const lines = playerSrc.split("\n");
    const lgLeftIdx = lines.findIndex((l) => l.includes("lg:left-5"));
    expect(lgLeftIdx).toBeGreaterThan(-1);
    // The line or its predecessor must reference moveToBottomLeftLg
    const context = lines.slice(lgLeftIdx - 2, lgLeftIdx + 1).join("\n");
    expect(context).toMatch(/moveToBottomLeftLg/);
  });

  it("does not change behaviour for non-trade routes (fallback branch unchanged)", () => {
    // The original bottom-right fallback classes still appear
    expect(playerSrc).toContain("bottom-3 right-3 sm:bottom-5 sm:right-5");
  });
});
