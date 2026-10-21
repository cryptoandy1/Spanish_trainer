import { NavLink } from "react-router-dom";
import { ui } from "../lib/i18n";
import { useData } from "../lib/DataContext";

const links: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: ui.nav.dashboard, end: true },
  { to: "/practice/phrases", label: ui.nav.practicePhrases },
  { to: "/practice/vocab", label: ui.nav.practiceVocab },
  { to: "/practice/conjugation", label: ui.nav.practiceConjugation },
  { to: "/verbs", label: ui.nav.verbs },
  { to: "/topics", label: ui.nav.topics },
  { to: "/grammar", label: ui.nav.grammar },
  { to: "/reference", label: ui.nav.reference },
  { to: "/recent", label: ui.nav.recent },
  { to: "/settings", label: ui.nav.settings },
];

/** True if the page is currently rendered dark, whichever way that was decided. */
function isDarkNow(theme: string | undefined): boolean {
  if (theme === "dark" || theme === "light") return theme === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function NavBar() {
  const { settings, setSettings } = useData();
  const dark = isDarkNow(settings.theme);

  return (
    <nav className="navbar">
      <div className="navbar__brand">🇪🇸 {ui.appName}</div>
      <div className="navbar__links">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => "navbar__link" + (isActive ? " navbar__link--active" : "")}
          >
            {l.label}
          </NavLink>
        ))}
      </div>
      <button
        type="button"
        className="navbar__theme"
        title={ui.settings.toggleTheme}
        aria-label={ui.settings.toggleTheme}
        onClick={() => setSettings((s) => ({ ...s, theme: dark ? "light" : "dark" }))}
      >
        {dark ? "☀️" : "🌙"}
      </button>
    </nav>
  );
}
