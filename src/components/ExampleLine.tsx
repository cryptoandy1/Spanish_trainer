import type { Example } from "../types/data";
import { tr } from "../lib/i18n";
import { SpeakButton } from "./SpeakButton";

export function ExampleLine({ example, nativeLang }: { example: Example; nativeLang: string }) {
  return (
    <div className="example-line">
      <span className="example-line__target">{example.text}</span>
      <SpeakButton text={example.text} />
      <span className="example-line__native">{tr(example.tr, nativeLang)}</span>
    </div>
  );
}
