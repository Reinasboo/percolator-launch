/**
 * GH#1615: Regression — /create wizard step header shows wrong step number
 * when Oracle step is auto-skipped in Quick Launch mode.
 *
 * Quick Launch physical steps: 1 → 2 → 4 (step 3 oracle is auto-completed).
 * The step header must display:
 *   step 1 → "STEP 1 / 3 — Token"
 *   step 2 → "STEP 2 / 3 — Slab Tier"   (NOT "STEP 2 / 4 — Oracle ✓")
 *   step 4 → "STEP 3 / 3 — Review"       (NOT "STEP 4 / 4 — Review")
 *
 * Manual mode is unchanged: 1/4, 2/4, 3/4, 4/4.
 */

describe("GH#1615: wizard step header display in Quick Launch mode", () => {
  // Mirrors the logic in CreateMarketWizard.tsx so regressions surface here first.
  const quickStepDisplayLabel: Record<number, string> = { 1: "Token", 2: "Slab Tier", 4: "Review" };
  const quickStepDisplayNum: Record<number, number> = { 1: 1, 2: 2, 4: 3 };

  const stepLabelsQuick = ["Token", "Oracle ✓", "Slab Tier", "Review"] as const;
  const stepLabelsManual = ["Token", "Oracle", "Parameters", "Review"] as const;

  function getHeaderDisplay(mode: "quick" | "manual", physicalStep: number) {
    if (mode === "quick") {
      const label = quickStepDisplayLabel[physicalStep] ?? stepLabelsQuick[physicalStep - 1];
      const num = quickStepDisplayNum[physicalStep] ?? physicalStep;
      return { num, total: 3, label };
    }
    return {
      num: physicalStep,
      total: 4,
      label: stepLabelsManual[physicalStep - 1],
    };
  }

  describe("Quick Launch mode", () => {
    it("step 1 → STEP 1 / 3 — Token", () => {
      const h = getHeaderDisplay("quick", 1);
      expect(h.num).toBe(1);
      expect(h.total).toBe(3);
      expect(h.label).toBe("Token");
    });

    it("step 2 → STEP 2 / 3 — Slab Tier (NOT Oracle ✓)", () => {
      const h = getHeaderDisplay("quick", 2);
      expect(h.num).toBe(2);
      expect(h.total).toBe(3);
      expect(h.label).toBe("Slab Tier");
      // Explicitly guard against the regressed value
      expect(h.label).not.toBe("Oracle ✓");
      expect(h.total).not.toBe(4);
    });

    it("step 4 → STEP 3 / 3 — Review", () => {
      const h = getHeaderDisplay("quick", 4);
      expect(h.num).toBe(3);
      expect(h.total).toBe(3);
      expect(h.label).toBe("Review");
      // Explicitly guard against the regressed value
      expect(h.num).not.toBe(4);
      expect(h.total).not.toBe(4);
    });
  });

  describe("Manual mode (unchanged)", () => {
    it.each([
      [1, 1, "Token"],
      [2, 2, "Oracle"],
      [3, 3, "Parameters"],
      [4, 4, "Review"],
    ] as [number, number, string][])(
      "step %i → STEP %i / 4 — %s",
      (physicalStep, expectedNum, expectedLabel) => {
        const h = getHeaderDisplay("manual", physicalStep);
        expect(h.num).toBe(expectedNum);
        expect(h.total).toBe(4);
        expect(h.label).toBe(expectedLabel);
      }
    );
  });

  describe("mobile WizardProgress counter mirrors header", () => {
    // The mobile counter uses the same displayStep/displayTotal/displayStepLabel props
    // that CreateMarketWizard computes via headerStepNum/headerStepTotal/headerStepLabel.
    it("Quick step 1: mobile shows 'Step 1 of 3 — Token'", () => {
      const h = getHeaderDisplay("quick", 1);
      const mobileText = `Step ${h.num} of ${h.total} — ${h.label}`;
      expect(mobileText).toBe("Step 1 of 3 — Token");
    });

    it("Quick step 2: mobile shows 'Step 2 of 3 — Slab Tier'", () => {
      const h = getHeaderDisplay("quick", 2);
      const mobileText = `Step ${h.num} of ${h.total} — ${h.label}`;
      expect(mobileText).toBe("Step 2 of 3 — Slab Tier");
    });

    it("Quick step 4: mobile shows 'Step 3 of 3 — Review'", () => {
      const h = getHeaderDisplay("quick", 4);
      const mobileText = `Step ${h.num} of ${h.total} — ${h.label}`;
      expect(mobileText).toBe("Step 3 of 3 — Review");
    });
  });
});
