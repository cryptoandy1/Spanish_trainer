import type { VocabWord } from "../types/data";
import { tr } from "../lib/i18n";
import { SpeakButton } from "./SpeakButton";
import { SourceBadge } from "./SourceBadge";
import { ExampleLine } from "./ExampleLine";

export function VocabCard({ word, nativeLang }: { word: VocabWord; nativeLang: string }) {
  return (
    <div className="item-card">
      <div className="item-card__row">
        <span className="item-card__target">{word.lemma}</span>
        {word.gender && <span className="item-card__tag">{word.gender}</span>}
        <span className="item-card__tag item-card__tag--pos">{word.pos}</span>
        <SpeakButton text={word.lemma} />
      </div>
      <div className="item-card__native">{tr(word.tr, nativeLang)}</div>
      {word.examples.map((ex, i) => (
        <ExampleLine key={i} example={ex} nativeLang={nativeLang} />
      ))}
      <SourceBadge source={word.source} />
    </div>
  );
}
