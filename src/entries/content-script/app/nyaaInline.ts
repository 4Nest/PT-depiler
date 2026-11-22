import { type ITorrent, parseSizeString } from "@ptd/site";
import type { IRemoteDownloadDialogData } from "./types.ts";
import { siteInstance } from "./utils.ts";

const PUSH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;"><path d="M12 13v8l-4-4"/><path d="m12 21 4-4"/><path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284"/></svg>`;

function parseRowTorrent(tr: HTMLTableRowElement): ITorrent | null {
  const viewAnchor = tr.querySelector<HTMLAnchorElement>('a[href*="/view/"]:not([href*="#"])');
  const dlAnchor = tr.querySelector<HTMLAnchorElement>('a[href*="/download/"]');
  const magnetAnchor = tr.querySelector<HTMLAnchorElement>('a[href^="magnet:"]');

  const link = dlAnchor?.href || magnetAnchor?.href || "";
  if (!link) return null;

  const pageUrl = viewAnchor?.href || window.location.href;
  const idMatch = pageUrl.match(/\/view\/(\d+)/) || link.match(/\/download\/(\d+)\.torrent/);
  const id = idMatch ? idMatch[1] : pageUrl;
  const title = (viewAnchor?.getAttribute("title") || viewAnchor?.textContent || "").trim();

  const catImg = tr.querySelector<HTMLImageElement>("img.category-icon");
  const rawCategory = (catImg?.getAttribute("alt") || "").trim();
  const category = rawCategory ? rawCategory.split("-")[0].trim() : undefined;

  const timeTd = tr.querySelector<HTMLTableCellElement>("td[data-timestamp]");
  const sizeTd = (timeTd?.previousElementSibling as HTMLTableCellElement | null) ?? null;
  const seedersTd = (timeTd?.nextElementSibling as HTMLTableCellElement | null) ?? null;
  const leechersTd = (seedersTd?.nextElementSibling as HTMLTableCellElement | null) ?? null;
  const completedTd = (leechersTd?.nextElementSibling as HTMLTableCellElement | null) ?? null;

  const rawSize = (sizeTd?.textContent || "").trim();
  const rawTimestamp = Number(timeTd?.getAttribute("data-timestamp") || 0);

  return {
    site: "nyaa",
    id,
    title: title || `Nyaa #${id}`,
    subTitle: rawCategory || undefined,
    url: pageUrl,
    link,
    size: rawSize ? parseSizeString(rawSize) : undefined,
    time: rawTimestamp > 0 ? rawTimestamp * 1000 : undefined,
    seeders: seedersTd ? Number(seedersTd.textContent?.trim() || 0) : undefined,
    leechers: leechersTd ? Number(leechersTd.textContent?.trim() || 0) : undefined,
    completed: completedTd ? Number(completedTd.textContent?.trim() || 0) : undefined,
    category,
  };
}

async function parseDetailTorrentFallback(doc: Document): Promise<ITorrent | null> {
  if (siteInstance.value) {
    try {
      const parsed = await siteInstance.value.transformDetailPage(doc);
      if (parsed?.link) return parsed;
    } catch {
      // ignore and fallback to direct DOM extraction
    }
  }

  const dlAnchor = doc.querySelector<HTMLAnchorElement>('.panel-footer a[href*="/download/"], a[href*="/download/"]');
  const magnetAnchor = doc.querySelector<HTMLAnchorElement>('.panel-footer a[href^="magnet:"], a[href^="magnet:"]');
  const link = dlAnchor?.href || magnetAnchor?.href || "";
  if (!link) return null;

  const heading = doc.querySelector<HTMLElement>(".panel-heading h3.panel-title");
  const title = (heading?.textContent || doc.title || "").trim();
  const idMatch = window.location.pathname.match(/\/view\/(\d+)/) || link.match(/\/download\/(\d+)\.torrent/);
  const id = idMatch ? idMatch[1] : window.location.href;

  return {
    site: "nyaa",
    id,
    title: title || `Nyaa #${id}`,
    url: window.location.href,
    link,
  };
}

export function mountNyaaInlineButtons(
  doc: Document,
  dialogData: IRemoteDownloadDialogData,
  getLabel: () => string,
): () => void {
  const openPushDialog = (torrent: ITorrent) => {
    dialogData.torrents = [torrent];
    dialogData.isDefaultSend = false;
    dialogData.show = true;
  };

  const injectOnce = () => {
    const labelText = getLabel();

    // 1. 列表页（首页 / 搜索页 / 发布组 /user/* 页）：在每行下载与磁力图标旁追加推送按钮
    const listTable = doc.querySelector<HTMLTableElement>("table.torrent-list");
    if (listTable) {
      const linkHeader = listTable.querySelector<HTMLTableCellElement>("thead th.hdr-link");
      if (linkHeader && linkHeader.dataset.ptdWidened !== "1") {
        linkHeader.dataset.ptdWidened = "1";
        linkHeader.style.width = "90px";
      }

      const rows = listTable.querySelectorAll<HTMLTableRowElement>("tbody > tr");
      rows.forEach((tr) => {
        if (tr.querySelector("[data-ptd-nyaa-push='row']")) return;
        const firstLink = tr.querySelector<HTMLAnchorElement>('td a[href*="/download/"], td a[href^="magnet:"]');
        const linkCell = firstLink?.closest("td") as HTMLTableCellElement | null;
        if (!linkCell) return;

        linkCell.style.whiteSpace = "nowrap";

        const btn = doc.createElement("a");
        btn.href = "#";
        btn.dataset.ptdNyaaPush = "row";
        btn.title = labelText;
        btn.setAttribute("aria-label", labelText);
        btn.style.cssText =
          "display:inline-flex;align-items:center;justify-content:center;min-width:22px;min-height:22px;margin-left:4px;vertical-align:middle;touch-action:manipulation;";
        btn.innerHTML = PUSH_ICON_SVG;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const torrent = parseRowTorrent(tr);
          if (torrent) {
            openPushDialog(torrent);
          }
        });

        linkCell.appendChild(btn);
      });
    }

    // 2. 详情页（/view/\d+）：在 .panel-footer 的 Download Torrent | Magnet 后追加推送链接
    const footer = doc.querySelector<HTMLElement>(".panel-footer");
    if (footer && !footer.querySelector("[data-ptd-nyaa-push='detail']")) {
      const hasDownloadOrMagnet = footer.querySelector('a[href*="/download/"], a[href^="magnet:"]');
      if (hasDownloadOrMagnet) {
        const sep = doc.createElement("span");
        sep.dataset.ptdNyaaPushSep = "1";
        sep.textContent = " or ";

        const btn = doc.createElement("a");
        btn.href = "#";
        btn.dataset.ptdNyaaPush = "detail";
        btn.className = "card-footer-item";
        btn.innerHTML = `${PUSH_ICON_SVG} <span data-ptd-nyaa-push-text="1">${labelText}</span>`;
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const torrent = await parseDetailTorrentFallback(doc);
          if (torrent) {
            openPushDialog(torrent);
          }
        });

        footer.appendChild(sep);
        footer.appendChild(btn);
      }
    }
  };

  injectOnce();

  let rafId = 0;
  const observer = new MutationObserver(() => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      injectOnce();
    });
  });

  if (doc.body) {
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  return () => {
    observer.disconnect();
    if (rafId) window.cancelAnimationFrame(rafId);
    doc.querySelectorAll("[data-ptd-nyaa-push], [data-ptd-nyaa-push-sep]").forEach((el) => el.remove());
  };
}
