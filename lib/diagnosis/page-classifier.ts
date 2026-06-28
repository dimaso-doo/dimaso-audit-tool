import type { PageType } from "./types";

export function classifyPage(url: string, title = "", h1 = ""): PageType {
  const text = `${url} ${title} ${h1}`.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();
  if (path === "/" || path === "") return "home";
  if (/contact/.test(text)) return "contact";
  if (/about|team|company/.test(text)) return "about";
  if (/privacy|terms|legal|cookie/.test(text)) return "legal";
  if (/donat|give/.test(text)) return "donation";
  if (/book|appointment|reservation/.test(text)) return "booking";
  if (/event|conference|webinar/.test(text)) return "event";
  if (/member|join|login/.test(text)) return "member";
  if (/directory|people|partners/.test(text)) return "directory";
  if (/blog|news|article/.test(text)) return "blog";
  if (/resource|publication|report|guide|download|library/.test(text)) return "resource";
  if (/product|shop|cart/.test(text)) return "product";
  if (/category|collection/.test(text)) return "category";
  if (/service|solution|consult/.test(text)) return "service";
  return "unknown";
}
