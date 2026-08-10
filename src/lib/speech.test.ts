import { describe, expect, it } from "vitest";
import { rankVoices, textForSpeech, type VoiceLike } from "./speech";

const voice = (name: string, lang: string, localService?: boolean): VoiceLike => ({
  name,
  lang,
  localService,
  voiceURI: name,
});

describe("rankVoices", () => {
  it("drops voices for other languages", () => {
    const picked = rankVoices([voice("Irina", "ru-RU"), voice("Elvira", "es-ES")], "es-ES");
    expect(picked.map((v) => v.name)).toEqual(["Elvira"]);
  });

  it("prefers a natural-sounding voice over a plain one", () => {
    const picked = rankVoices(
      [voice("Microsoft Helena", "es-ES", true), voice("Microsoft Alvaro Online (Natural)", "es-ES", false)],
      "es-ES",
    );
    expect(picked[0].name).toBe("Microsoft Alvaro Online (Natural)");
  });

  it("prefers the exact locale over another region of the same language", () => {
    const picked = rankVoices([voice("Paulina", "es-MX"), voice("Monica", "es-ES")], "es-ES");
    expect(picked[0].name).toBe("Monica");
  });

  it("still accepts another region when the exact locale is missing", () => {
    const picked = rankVoices([voice("Paulina", "es-MX")], "es-ES");
    expect(picked[0].name).toBe("Paulina");
  });

  it("keeps a premium local voice ahead of a plain cloud one", () => {
    const picked = rankVoices(
      [voice("Google español", "es-ES", false), voice("Monica (Premium)", "es-ES", true)],
      "es-ES",
    );
    expect(picked[0].name).toBe("Monica (Premium)");
  });

  it("is stable when nothing distinguishes two voices", () => {
    const picked = rankVoices([voice("A", "es-ES"), voice("B", "es-ES")], "es-ES");
    expect(picked.map((v) => v.name)).toEqual(["A", "B"]);
  });

  it("returns nothing rather than a wrong-language voice", () => {
    expect(rankVoices([voice("Irina", "ru-RU")], "es-ES")).toEqual([]);
  });
});

describe("textForSpeech", () => {
  it("turns a transformation arrow into a sentence break", () => {
    expect(textForSpeech("Doy el libro a Juan. → Se lo doy.")).toBe("Doy el libro a Juan. Se lo doy.");
  });

  it("handles an arrow between fragments with no punctuation", () => {
    expect(textForSpeech("Veo la película → La veo")).toBe("Veo la película. La veo");
  });

  it("turns a spaced equals into a pause", () => {
    expect(textForSpeech("Estoy leyéndolo. = Lo estoy leyendo.")).toBe("Estoy leyéndolo. Lo estoy leyendo.");
  });

  it("turns a spaced slash between alternatives into a pause", () => {
    expect(textForSpeech("¡Dáselo! / ¡No se lo des!")).toBe("¡Dáselo! ¡No se lo des!");
  });

  it("leaves a gender slash inside a word alone", () => {
    expect(textForSpeech("No seas tonto/a.")).toBe("No seas tonto/a.");
    expect(textForSpeech("Qué tonto/a eres.")).toBe("Qué tonto/a eres.");
  });

  it("leaves an ordinary sentence untouched", () => {
    expect(textForSpeech("¿Cuál es tu fecha de nacimiento?")).toBe("¿Cuál es tu fecha de nacimiento?");
  });

  it("collapses the whitespace it creates", () => {
    expect(textForSpeech("  Hola   →   Adiós  ")).toBe("Hola. Adiós");
  });
});
