import { readFileSync } from "fs";
import path from "path";

import { DEVLINK_SCOPE_CLASS } from "../../devlink/devlinkScope";

/**
 * Regression test for the devlink-patches.css scope wiring.
 *
 * The generated devlink export wraps its CSS in `@scope (.wf-devlink-<hash>)`
 * and stamps the same class on every component root. The hash changes whenever
 * Webflow regenerates the export. `devlink-patches.css` is hand-maintained glue
 * (it restores `.w-layout-blockcontainer`, the main content container layout)
 * and must keep applying after such a sync — so its `@scope` roots must be
 * hash-independent and match whatever class `devlinkScope.ts` currently exports.
 */

const patchesCss = readFileSync(path.join(__dirname, "../../devlink-patches.css"), "utf8");

function extractScopeRoots(css: string): string[] {
  const roots: string[] = [];
  const pattern = /@scope\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    roots.push(match[1].trim());
  }
  return roots;
}

function makeScopeRootFixture(className: string): HTMLElement {
  const root = document.createElement("div");
  root.className = className;
  root.innerHTML = '<div class="w-layout-blockcontainer"></div>';
  return root;
}

describe("devlink-patches.css", () => {
  it("restores the .w-layout-blockcontainer main content container layout", () => {
    expect(patchesCss).toMatch(/\.w-layout-blockcontainer\s*\{[^}]*max-width:\s*940px/);
    expect(patchesCss).toMatch(/\.w-layout-blockcontainer\s*\{[^}]*margin-left:\s*auto/);
    expect(patchesCss).toMatch(/\.w-layout-blockcontainer\s*\{[^}]*margin-right:\s*auto/);
  });

  it("uses at least one @scope root", () => {
    expect(extractScopeRoots(patchesCss).length).toBeGreaterThan(0);
  });

  it("scopes every rule to the scope class the devlink export currently emits", () => {
    const roots = extractScopeRoots(patchesCss);
    const fixture = makeScopeRootFixture(DEVLINK_SCOPE_CLASS);

    for (const root of roots) {
      // A root carrying DEVLINK_SCOPE_CLASS (what devlink components render)
      // must match the @scope root selector, otherwise the patched rules
      // silently stop applying after a devlink sync.
      expect({ root, matches: fixture.matches(root) }).toEqual({
        root,
        matches: true,
      });
    }
  });

  it("keeps matching when the devlink scope hash rotates", () => {
    const roots = extractScopeRoots(patchesCss);
    // Simulate a future devlink sync regenerating the export with a new hash.
    const rotated = makeScopeRootFixture("wf-devlink-0000aaaa1111bbbb2222cccc3333dddd");

    for (const root of roots) {
      expect({ root, matchesRotatedHash: rotated.matches(root) }).toEqual({
        root,
        matchesRotatedHash: true,
      });
    }
  });

  it("does not widen the scope beyond devlink roots", () => {
    const roots = extractScopeRoots(patchesCss);
    const foreignEl = document.createElement("div");
    foreignEl.innerHTML = '<div class="w-layout-blockcontainer"></div>';

    for (const root of roots) {
      expect(foreignEl.matches(root)).toBe(false);
    }
  });
});
