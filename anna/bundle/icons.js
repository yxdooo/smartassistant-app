// Minimalist 1.65px inline SVG icon factory for SmartAssistant.

const NS = "http://www.w3.org/2000/svg";

const PATHS = {
  brandMark: [
    ["circle", { cx: "12", cy: "12", r: "8" }],
    ["circle", { cx: "12", cy: "12", r: "2.6", fill: "currentColor", stroke: "none" }],
  ],
  home: [
    ["path", { d: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1Z" }],
  ],
  compass: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["polygon", { points: "16 8 14 14 8 16 10 10 16 8" }],
  ],
  layers: [
    ["path", { d: "m12 3 9 4.5-9 4.5-9-4.5Z" }],
    ["path", { d: "m3 12 9 4.5 9-4.5" }],
    ["path", { d: "m3 16.5 9 4.5 9-4.5" }],
  ],
  arrowRight: [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "m13 6 6 6-6 6" }],
  ],
  arrowLeft: [
    ["path", { d: "M19 12H5" }],
    ["path", { d: "m11 6-6 6 6 6" }],
  ],
  sun: [
    ["circle", { cx: "12", cy: "12", r: "4" }],
    ["path", { d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" }],
  ],
  moon: [
    ["path", { d: "M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" }],
  ],
  sparkles: [
    ["path", { d: "M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7Z" }],
  ],
  flame: [
    ["path", { d: "M12 3c.5 3.2-2.2 4.8-2.2 7.4a2.2 2.2 0 0 0 4.4 0c0-1-.4-1.9-1-2.7 2.8 1.1 4.8 3.6 4.8 6.8a6 6 0 1 1-12 0c0-4 3-7 6-11.5Z" }],
  ],
  droplet: [
    ["path", { d: "M12 2.7 6.6 10a6.5 6.5 0 1 0 10.8 0L12 2.7Z" }],
  ],
  bottle: [
    ["path", { d: "M10 2h4v2.4l1.8 2a2 2 0 0 1 .5 1.3V19a2 2 0 0 1-2 2H9.7a2 2 0 0 1-2-2V7.7a2 2 0 0 1 .5-1.3l1.8-2V2Z" }],
    ["path", { d: "M8 12h8" }],
  ],
  wallet: [
    ["rect", { x: "2.5", y: "5.5", width: "19", height: "13", rx: "2.5" }],
    ["path", { d: "M16 12h5.5" }],
    ["circle", { cx: "16", cy: "12", r: "1" }],
  ],
  utensils: [
    ["path", { d: "M5 3v7a2.5 2.5 0 0 0 5 0V3" }],
    ["path", { d: "M7.5 3v18" }],
    ["path", { d: "M16.5 3c2 1.8 2.5 5 2.5 8h-3V21" }],
  ],
  timer: [
    ["circle", { cx: "12", cy: "13", r: "7.5" }],
    ["path", { d: "M12 9v4l2.5 2" }],
    ["path", { d: "M9.5 2.5h5" }],
  ],
  trendingUp: [
    ["path", { d: "M3 17l6-6 4 4 8-8" }],
    ["path", { d: "M15 7h6v6" }],
  ],
  barChart: [
    ["path", { d: "M4 20V11M10 20V5M16 20V9M21 20H3" }],
  ],
  share: [
    ["path", { d: "M12 3v12M7.5 7.5 12 3l4.5 4.5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" }],
  ],
  sliders: [
    ["path", { d: "M4 7h16M4 17h16" }],
    ["circle", { cx: "9", cy: "7", r: "2" }],
    ["circle", { cx: "15", cy: "17", r: "2" }],
  ],
  trash: [
    ["path", { d: "M4 7h16M9 4h6M6 7l1 13a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20l1-13" }],
  ],
  plus: [
    ["path", { d: "M12 5v14M5 12h14" }],
  ],
  check: [
    ["path", { d: "M5 12.5 9.5 17 19 7.5" }],
  ],
  download: [
    ["path", { d: "M12 4v11M7.5 11.5 12 16l4.5-4.5M4 19h16" }],
  ],
  upload: [
    ["path", { d: "M12 16V5M7.5 9.5 12 5l4.5 4.5M4 19h16" }],
  ],
  x: [
    ["path", { d: "M6 6l12 12M18 6 6 18" }],
  ],
  undo: [
    ["path", { d: "M7 7H3v4M3 7a9 9 0 1 1-1.2 9" }],
  ],
  star: [
    ["path", { d: "M12 3l2.6 5.4 6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.3l6-.9Z" }],
  ],
  edit: [
    ["path", { d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" }],
  ],
  clock: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "M12 7v5l3 2" }],
  ],
};

export function icon(name, size = 16, extraClass = "") {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.65");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", extraClass ? `ico ${extraClass}` : "ico");

  for (const [tag, attrs] of PATHS[name] || PATHS.brandMark) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.appendChild(node);
  }
  return svg;
}
