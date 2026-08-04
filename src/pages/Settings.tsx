import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useData } from "../lib/DataContext";
import { exportAll, importAll, removeItem } from "../lib/storage";
import { ui } from "../lib/i18n";

export function Settings() {
  const { settings, setSettings } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleExport() {
    const data = exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spanish-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        try {
          const data = JSON.parse(text) as Record<string, unknown>;
          importAll(data);
          setMessage("Прогресс импортирован. Обнови страницу, чтобы увидеть изменения.");
        } catch {
          setMessage("Не удалось прочитать файл — он повреждён или имеет неверный формат.");
        }
      })
      .catch(() => setMessage("Не удалось прочитать файл."));
    e.target.value = "";
  }

  function handleReset() {
    if (!window.confirm(ui.settings.resetConfirm)) return;
    removeItem(`st.progress.v1.${settings.targetLang}`);
    setMessage("Прогресс сброшен. Обнови страницу.");
  }

  return (
    <div className="page">
      <h1>{ui.nav.settings}</h1>

      <section className="settings-section">
        <label className="field field--row">
          <input
            type="checkbox"
            checked={settings.strictAccents}
            onChange={(e) => setSettings((s) => ({ ...s, strictAccents: e.target.checked }))}
          />
          <span>{ui.settings.strictAccents}</span>
        </label>

        <label className="field">
          <span>{ui.settings.sessionSize}</span>
          <input
            type="number"
            min={5}
            max={100}
            value={settings.sessionSize}
            onChange={(e) => setSettings((s) => ({ ...s, sessionSize: Number(e.target.value) || s.sessionSize }))}
          />
        </label>
      </section>

      <section className="settings-section settings-section--actions">
        <button type="button" className="btn" onClick={handleExport}>
          {ui.settings.exportProgress}
        </button>
        <button type="button" className="btn" onClick={handleImportClick}>
          {ui.settings.importProgress}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />
        <button type="button" className="btn btn--danger" onClick={handleReset}>
          {ui.settings.resetProgress}
        </button>
      </section>

      {message && <p className="muted">{message}</p>}
    </div>
  );
}
