import { createHashRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { PhrasePractice } from "./pages/PhrasePractice";
import { VocabPractice } from "./pages/VocabPractice";
import { MistakeDrill } from "./pages/MistakeDrill";
import { VerbIndex } from "./pages/VerbIndex";
import { VerbDetail } from "./pages/VerbDetail";
import { TopicIndex } from "./pages/TopicIndex";
import { TopicDetail } from "./pages/TopicDetail";
import { GrammarIndex } from "./pages/GrammarIndex";
import { GrammarDetail } from "./pages/GrammarDetail";
import { ReferenceIndex } from "./pages/ReferenceIndex";
import { WidgetDetail } from "./pages/WidgetDetail";
import { Settings } from "./pages/Settings";

// createHashRouter (not BrowserRouter) so a deep-link refresh works on
// GitHub Pages without a 404.html rewrite trick — the whole app lives under
// a single served path and routing happens client-side via the URL hash.
export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "practice/phrases", element: <PhrasePractice /> },
      { path: "practice/vocab", element: <VocabPractice /> },
      { path: "practice/mistakes", element: <MistakeDrill /> },
      { path: "verbs", element: <VerbIndex /> },
      { path: "verbs/:verbId", element: <VerbDetail /> },
      { path: "topics", element: <TopicIndex /> },
      { path: "topics/:topicId", element: <TopicDetail /> },
      { path: "grammar", element: <GrammarIndex /> },
      { path: "grammar/:grammarId", element: <GrammarDetail /> },
      { path: "reference", element: <ReferenceIndex /> },
      { path: "reference/:widgetId", element: <WidgetDetail /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
