import type { Tr } from "../types/data";

/**
 * Read a language-dependent value out of a Tr map, falling back to the first
 * available language if the requested one is missing (rather than crashing —
 * data packs may be partially translated while a new native language is added).
 */
export function tr(map: Tr | undefined, nativeLang: string): string {
  if (!map) return "";
  if (map[nativeLang] != null) return map[nativeLang];
  const first = Object.values(map)[0];
  return first ?? "";
}

// UI chrome strings. Kept small and flat on purpose — this app has exactly
// one native language (ru) today; if a second is added, promote this to a
// Record<LangCode, typeof ruStrings> and select by nativeLang like data Tr maps.
export const ui = {
  appName: "Испанский тренажёр",
  nav: {
    dashboard: "Главная",
    practicePhrases: "Фразы",
    practiceVocab: "Слова",
    mistakes: "Мои ошибки",
    verbs: "Глаголы",
    topics: "Темы",
    grammar: "Грамматика",
    reference: "Справочник",
    settings: "Настройки",
  },
  quiz: {
    start: "Начать",
    continue: "Продолжить",
    check: "Проверить",
    next: "Далее",
    skip: "Пропустить",
    finish: "Завершить сессию",
    modeChoice: "Выбор варианта",
    modeTyping: "Ввод текста",
    modeSpeech: "Голосом",
    directionToTarget: "Русский → Испанский",
    directionToNative: "Испанский → Русский",
    correct: "Верно!",
    accent: "Верно, но проверь ударения/акценты",
    typo: "Почти! Похоже на опечатку",
    wrong: "Неверно",
    correctAnswerWas: "Правильный ответ:",
    yourAnswer: "Твой ответ:",
    sessionDone: "Сессия завершена",
    micUnsupported: "Голосовой ввод работает в Chrome/Edge/Safari; в этом браузере недоступен",
    micDenied: "Доступ к микрофону не разрешён",
    micListening: "Слушаю…",
    speak: "Произнести",
    noItems: "В этой колоде пока нет карточек",
  },
  settings: {
    strictAccents: "Строго проверять ударения",
    sessionSize: "Размер сессии",
    exportProgress: "Экспортировать прогресс",
    importProgress: "Импортировать прогресс",
    resetProgress: "Сбросить весь прогресс",
    resetConfirm: "Точно сбросить весь прогресс? Это необратимо.",
  },
} as const;
