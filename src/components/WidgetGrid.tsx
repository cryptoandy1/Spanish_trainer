import type { WidgetItem, WidgetKind, WidgetSet } from "../types/data";
import { tr } from "../lib/i18n";
import { ExampleLine } from "./ExampleLine";
import { SpeakButton } from "./SpeakButton";

/** Usage examples + the occasional usage note, shared by all widget layouts. */
function WidgetExtras({ item, nativeLang }: { item: WidgetItem; nativeLang: string }) {
  if (!item.note && !item.examples?.length) return null;
  return (
    <div className="widget-extras">
      {item.note && <div className="widget-extras__note">{tr(item.note, nativeLang)}</div>}
      {item.examples?.map((example, i) => (
        <ExampleLine key={i} example={example} nativeLang={nativeLang} />
      ))}
    </div>
  );
}

/** Consecutive runs of items sharing a group title (an ungrouped item gets an empty title). */
function groupRuns(items: WidgetItem[], nativeLang: string): { title: string; items: WidgetItem[] }[] {
  const runs: { title: string; items: WidgetItem[] }[] = [];
  for (const item of items) {
    const title = item.group ? tr(item.group, nativeLang) : "";
    const last = runs[runs.length - 1];
    if (last && last.title === title) last.items.push(item);
    else runs.push({ title, items: [item] });
  }
  return runs;
}

export function WidgetGrid({ widget, nativeLang }: { widget: WidgetSet; nativeLang: string }) {
  if (!widget.items.some((item) => item.group)) {
    return <WidgetLayout kind={widget.kind} items={widget.items} nativeLang={nativeLang} />;
  }
  return (
    <>
      {groupRuns(widget.items, nativeLang).map((run, i) => (
        <section key={i} className="widget-group">
          {run.title && <h2 className="widget-group__title">{run.title}</h2>}
          <WidgetLayout kind={widget.kind} items={run.items} nativeLang={nativeLang} />
        </section>
      ))}
    </>
  );
}

function WidgetLayout({ kind, items, nativeLang }: { kind: WidgetKind; items: WidgetItem[]; nativeLang: string }) {
  if (kind === "swatch-grid") {
    return (
      <div className="widget-grid widget-grid--swatch">
        {items.map((item) => (
          <div key={item.id} className="widget-swatch">
            <div className="widget-swatch__color" style={{ background: item.swatch }} />
            <div className="widget-swatch__label">{item.text}</div>
            <div className="widget-swatch__native">{tr(item.tr, nativeLang)}</div>
            <SpeakButton text={item.text} />
            <WidgetExtras item={item} nativeLang={nativeLang} />
          </div>
        ))}
      </div>
    );
  }

  if (kind === "table") {
    return (
      <table className="widget-table">
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {item.value != null && <td className="widget-table__value">{item.value.toLocaleString("es-ES")}</td>}
              <td className="widget-table__target">
                {item.text} <SpeakButton text={item.text} />
                <WidgetExtras item={item} nativeLang={nativeLang} />
              </td>
              <td className="widget-table__native">{tr(item.tr, nativeLang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // icon-grid / list
  return (
    <div className="widget-grid widget-grid--icon">
      {items.map((item) => (
        <div key={item.id} className="widget-icon-card">
          {item.icon && <div className="widget-icon-card__icon">{item.icon}</div>}
          <div className="widget-icon-card__label">{item.text}</div>
          <div className="widget-icon-card__native">{tr(item.tr, nativeLang)}</div>
          <SpeakButton text={item.text} />
          <WidgetExtras item={item} nativeLang={nativeLang} />
        </div>
      ))}
    </div>
  );
}
