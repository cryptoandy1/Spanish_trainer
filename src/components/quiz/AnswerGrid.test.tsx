import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerGrid } from "./AnswerGrid";

function cells(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
}

describe("AnswerGrid", () => {
  it("colours answered squares by verdict and leaves the rest neutral", () => {
    const html = renderToStaticMarkup(
      <AnswerGrid total={5} verdicts={["perfect", "wrong", "accent"]} current={3} highlighted={3} onSelect={() => {}} />,
    );
    const c = cells(html);
    expect(c).toHaveLength(5);
    expect(c[0]).toContain("answer-grid__cell--correct");
    expect(c[1]).toContain("answer-grid__cell--wrong");
    expect(c[2]).toContain("answer-grid__cell--correct"); // accent-only slip still counts as correct
    expect(c[3]).not.toMatch(/--correct|--wrong/);
    expect(c[3]).toContain("answer-grid__cell--current");
    expect(c[3]).not.toContain("disabled"); // the live question is a way back from review
    expect(c[4]).toContain("disabled"); // questions ahead can't be opened
  });

  it("renders nothing for an empty session", () => {
    expect(renderToStaticMarkup(<AnswerGrid total={0} verdicts={[]} current={0} onSelect={() => {}} />)).toBe("");
  });
});
