import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WidgetGrid } from "./WidgetGrid";
import type { WidgetItem, WidgetSet } from "../types/data";

// SpeakButton reads settings from DataContext; it is irrelevant to grouping.
vi.mock("./SpeakButton", () => ({ SpeakButton: () => null }));

function set(items: WidgetItem[]): WidgetSet {
  return { id: "wg_test", kind: "table", title: { ru: "Тест" }, order: 1, practiceable: false, items };
}

const item = (id: string, group?: string): WidgetItem => ({
  id,
  text: id,
  tr: { ru: id },
  ...(group ? { group: { ru: group } } : {}),
});

describe("WidgetGrid", () => {
  it("renders consecutive items of a group under one heading, in item order", () => {
    const html = renderToStaticMarkup(
      <WidgetGrid widget={set([item("a", "Голова"), item("b", "Голова"), item("c", "Руки")])} nativeLang="ru" />,
    );
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]);
    expect(headings).toEqual(["Голова", "Руки"]);
    expect(html.match(/<table/g)).toHaveLength(2);
  });

  it("renders an ungrouped set as a single layout with no headings", () => {
    const html = renderToStaticMarkup(<WidgetGrid widget={set([item("a"), item("b")])} nativeLang="ru" />);
    expect(html).not.toContain("<h2");
    expect(html.match(/<table/g)).toHaveLength(1);
  });
});
