import type { Phrase } from "../types/data";
import { tr } from "../lib/i18n";
import { SpeakButton } from "./SpeakButton";
import { SourceBadge } from "./SourceBadge";

export function PhraseCard({ phrase, nativeLang }: { phrase: Phrase; nativeLang: string }) {
  return (
    <div className="item-card">
      <div className="item-card__row">
        <span className="item-card__target">{phrase.text}</span>
        <SpeakButton text={phrase.text} />
      </div>
      <div className="item-card__native">{tr(phrase.tr, nativeLang)}</div>
      {phrase.literal && <div className="item-card__literal">{tr(phrase.literal, nativeLang)}</div>}
      {phrase.notes && <div className="item-card__notes">{tr(phrase.notes, nativeLang)}</div>}
      <SourceBadge source={phrase.source} />
    </div>
  );
}
