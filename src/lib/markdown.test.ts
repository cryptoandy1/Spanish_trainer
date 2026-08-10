import { describe, expect, it } from "vitest";
import { stripLeadingH1 } from "./markdown";

describe("stripLeadingH1", () => {
  it("drops a leading H1 and the blank line after it", () => {
    expect(stripLeadingH1("# Герундий и причастие\n\nОбе формы образуются от глагола.")).toBe(
      "Обе формы образуются от глагола.",
    );
  });

  it("leaves a body that starts at H2 alone", () => {
    const body = "## Два набора местоимений\n\nПоловина форм совпадает.";
    expect(stripLeadingH1(body)).toBe(body);
  });

  it("keeps an H1 that is not the first thing in the file", () => {
    const body = "Вступление.\n\n# Заголовок\n\nТекст.";
    expect(stripLeadingH1(body)).toBe(body);
  });

  it("keeps later H2 structure after stripping", () => {
    expect(stripLeadingH1("# Заголовок\n\n## Раздел\n\nТекст.")).toBe("## Раздел\n\nТекст.");
  });

  it("does not mistake a hashtag-like line for a heading", () => {
    const body = "#нетзаголовка\n\nТекст.";
    expect(stripLeadingH1(body)).toBe(body);
  });
});
