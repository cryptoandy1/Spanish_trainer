import { NavLink } from "react-router-dom";
import { ui } from "../lib/i18n";

const links: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: ui.nav.dashboard, end: true },
  { to: "/practice/phrases", label: ui.nav.practicePhrases },
  { to: "/practice/vocab", label: ui.nav.practiceVocab },
  { to: "/practice/mistakes", label: ui.nav.mistakes },
  { to: "/verbs", label: ui.nav.verbs },
  { to: "/topics", label: ui.nav.topics },
  { to: "/grammar", label: ui.nav.grammar },
  { to: "/reference", label: ui.nav.reference },
  { to: "/settings", label: ui.nav.settings },
];

export function NavBar() {
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
    </nav>
  );
}
