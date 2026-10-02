// Minimal dependency-free markdown renderer (headings, bold/italic, lists,
// links). Shared by the content renderer (topics, course sections) and the CMS content preview.
export function MarkdownView({ markdown }: { markdown: string }) {
  if (!markdown?.trim()) return <p className="text-muted-foreground">No content.</p>;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(
        /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a class="text-violet-600 underline" href="$2" target="_blank" rel="noreferrer">$1</a>',
      );

  const html: string[] = [];
  let inList = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (/^-\s+/.test(line)) {
      if (!inList) {
        html.push("<ul class='list-disc pl-5 space-y-1'>");
        inList = true;
      }
      html.push(`<li>${inline(line.replace(/^-\s+/, ""))}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (/^##\s+/.test(line))
      html.push(`<h3 class='font-semibold text-lg mt-4 mb-1'>${inline(line.replace(/^##\s+/, ""))}</h3>`);
    else if (/^#\s+/.test(line))
      html.push(`<h2 class='font-bold text-xl mt-4 mb-2'>${inline(line.replace(/^#\s+/, ""))}</h2>`);
    else if (line === "") html.push("<div class='h-3'></div>");
    else html.push(`<p>${inline(line)}</p>`);
  }
  if (inList) html.push("</ul>");
  return (
    <div
      className="text-sm leading-relaxed text-foreground space-y-1"
      dangerouslySetInnerHTML={{ __html: html.join("") }}
    />
  );
}
