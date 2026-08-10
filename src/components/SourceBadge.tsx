import type { SourceOrigin, SourceRef } from "../types/data";

const originLabel: Record<SourceOrigin, string> = {
  chatgpt: "из истории ChatGPT",
  claude: "добавлено через Claude",
  manual: "добавлено вручную",
  youtube: "из видео на YouTube",
};

export function SourceBadge({ source }: { source: SourceRef }) {
  const date = source.createdAt ? new Date(source.createdAt).toLocaleDateString("ru-RU") : null;
  return (
    <span className="source-badge" title={source.conversationTitle}>
      {originLabel[source.origin]}
      {date ? ` · ${date}` : ""}
    </span>
  );
}
