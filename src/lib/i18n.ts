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
    practiceConjugation: "Спряжения",
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
    irregularForm: "неправильная форма",
    practiceToggle: "Тренировать",
    showTable: "Показать таблицу",
    showList: "Показать список",
    mode: "Режим",
    directionLabel: "Направление",
    sessionSize: "Карточек в сессии",
    sizeAll: "Все",
    prevQuestion: "← Предыдущий",
    nextReviewed: "Следующий →",
    backToCurrent: "Вернуться к текущему",
    reviewTitle: "Просмотр пройденного",
    reviewPosition: "Вопрос",
  },
  phrases: {
    modePractice: "Тренировка",
    modeList: "Список",
    modeNarrator: "Диктор",
  },
  narrator: {
    title: "Диктор",
    play: "Слушать",
    pause: "Пауза",
    hint: "Фразы читаются вперемешку и по кругу: сначала по-испански, потом перевод.",
    idle: "Нажми «Слушать», чтобы начать.",
    unsupported: "Этот браузер не умеет читать вслух — режим «Диктор» недоступен.",
    noNativeVoice: "Для родного языка не задан голос, поэтому читается только испанская сторона.",
  },
  settings: {
    strictAccents: "Строго проверять ударения",
    sessionSize: "Размер сессии",
    exportProgress: "Экспортировать прогресс",
    importProgress: "Импортировать прогресс",
    resetProgress: "Сбросить весь прогресс",
    resetConfirm: "Точно сбросить весь прогресс? Это необратимо.",
    reloadData: "Обновить данные",
    reloading: "Проверяю…",
    reloadNothingNew: "Новых данных нет — у тебя уже последняя версия.",
    reloadFailed: "Не удалось обновить данные.",
    dataVintage: "Данные от",
  },
} as const;
