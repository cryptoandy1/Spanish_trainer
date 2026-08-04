import type { WidgetSet } from "../types/data";
import { tr } from "../lib/i18n";
import { SpeakButton } from "./SpeakButton";

export function WidgetGrid({ widget, nativeLang }: { widget: WidgetSet; nativeLang: string }) {
  if (widget.kind === "swatch-grid") {
    return (
      <div className="widget-grid widget-grid--swatch">
        {widget.items.map((item) => (
          <div key={item.id} className="widget-swatch">
            <div className="widget-swatch__color" style={{ background: item.swatch }} />
            <div className="widget-swatch__label">{item.text}</div>
            <div className="widget-swatch__native">{tr(item.tr, nativeLang)}</div>
            <SpeakButton text={item.text} />
          </div>
        ))}
      </div>
    );
  }

  if (widget.kind === "table") {
    return (
      <table className="widget-table">
        <tbody>
          {widget.items.map((item) => (
            <tr key={item.id}>
              {item.value != null && <td className="widget-table__value">{item.value}</td>}
              <td className="widget-table__target">
                {item.text} <SpeakButton text={item.text} />
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
      {widget.items.map((item) => (
        <div key={item.id} className="widget-icon-card">
          {item.icon && <div className="widget-icon-card__icon">{item.icon}</div>}
          <div className="widget-icon-card__label">{item.text}</div>
          <div className="widget-icon-card__native">{tr(item.tr, nativeLang)}</div>
          <SpeakButton text={item.text} />
        </div>
      ))}
    </div>
  );
}
