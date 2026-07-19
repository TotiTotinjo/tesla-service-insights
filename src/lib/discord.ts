/**
 * Optional operator alerts via Discord incoming webhook.
 * Never sends PDFs, IPs, hashes, or free-text invoice content.
 * No-op when DISCORD_WEBHOOK_URL is unset.
 */

export type DiscordAlert =
  | {
      kind: "analyze";
      issueCount: number;
      models: string[];
      pageCount: number;
      pdfCount: number;
      titles: string[];
    }
  | {
      kind: "duplicate";
      issueCount: number;
      match: "pdf" | "text" | string;
    }
  | {
      kind: "publish";
      issueCount: number;
      models: string[];
      titles: string[];
    };

const COLORS = {
  analyze: 0x3b82f6, // blue
  duplicate: 0x94a3b8, // slate
  publish: 0x22c55e, // green
} as const;

function uniqModels(models: string[]): string {
  const u = [...new Set(models.filter(Boolean))];
  return u.length ? u.join(", ") : "Unknown";
}

function formatTitles(titles: string[]): string {
  if (!titles.length) return "—";
  return titles
    .slice(0, 5)
    .map((t) => `• ${t.slice(0, 80)}`)
    .join("\n")
    .slice(0, 900);
}

function buildPayload(alert: DiscordAlert): Record<string, unknown> {
  const site = "https://roinsights.org";
  const ts = new Date().toISOString();

  if (alert.kind === "analyze") {
    return {
      embeds: [
        {
          title: "Analyze (draft — not public yet)",
          color: COLORS.analyze,
          description: "Someone uploaded a PDF. Waiting for publish confirm.",
          fields: [
            { name: "Issues found", value: String(alert.issueCount), inline: true },
            { name: "Model(s)", value: uniqModels(alert.models), inline: true },
            {
              name: "PDF / pages",
              value: `${alert.pdfCount} file(s), ${alert.pageCount} page(s)`,
              inline: true,
            },
            { name: "Titles (preview)", value: formatTitles(alert.titles) },
          ],
          footer: { text: "RO Insights · no PII · originals not stored" },
          timestamp: ts,
          url: `${site}/upload`,
        },
      ],
    };
  }

  if (alert.kind === "duplicate") {
    return {
      embeds: [
        {
          title: "Duplicate upload (no Grok call)",
          color: COLORS.duplicate,
          fields: [
            {
              name: "Match",
              value: alert.match === "pdf" ? "same PDF" : "same invoice text",
              inline: true,
            },
            {
              name: "Existing issues",
              value: String(alert.issueCount),
              inline: true,
            },
          ],
          footer: { text: "RO Insights · free path" },
          timestamp: ts,
          url: `${site}/insights`,
        },
      ],
    };
  }

  // publish
  return {
    embeds: [
      {
        title: "Published to community",
        color: COLORS.publish,
        description: "New insight(s) are live on the site.",
        fields: [
          { name: "Issues", value: String(alert.issueCount), inline: true },
          { name: "Model(s)", value: uniqModels(alert.models), inline: true },
          { name: "Titles", value: formatTitles(alert.titles) },
        ],
        footer: { text: "RO Insights · public board" },
        timestamp: ts,
        url: `${site}/insights`,
      },
    ],
  };
}

/**
 * Fire Discord alert. Swallows errors so product flow never fails on webhook.
 * Prefer scheduling via scheduleDiscordNotify on Workers (waitUntil).
 */
export async function notifyDiscord(alert: DiscordAlert): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(alert)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "discord webhook failed",
        res.status,
        text.slice(0, 200)
      );
    }
  } catch (err) {
    console.error("discord webhook error", err);
  }
}

/**
 * Best-effort background notify (Workers waitUntil when available).
 */
export function scheduleDiscordNotify(alert: DiscordAlert): void {
  const task = notifyDiscord(alert);

  void (async () => {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const ctx = await getCloudflareContext({ async: true });
      const exec = ctx?.ctx as
        | { waitUntil?: (p: Promise<unknown>) => void }
        | undefined;
      if (typeof exec?.waitUntil === "function") {
        exec.waitUntil(task);
        return;
      }
    } catch {
      // local Node / no CF context
    }
    await task;
  })();
}
