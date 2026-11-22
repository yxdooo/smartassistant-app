// Precision Swiss Editorial SVG charts & Canvas PNG Share Poster generator.

const NS = "http://www.w3.org/2000/svg";
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CAT_COLORS = ["var(--accent)", "var(--ice)", "var(--lilac)", "var(--sage)", "var(--sand)", "var(--muted)"];

function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.appendChild(c);
  return el;
}

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids.flat()) if (k != null && k !== false) node.append(k);
  return node;
}

function dayLabel(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return SHORT_DAYS[dt.getUTCDay()] || isoDate.slice(8);
}

export function pulseRingSvg(score) {
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  const r = 34;
  const circ = +(2 * Math.PI * r).toFixed(2);
  const offset = +(circ * (1 - s / 100)).toFixed(2);

  const svg = svgEl("svg", { viewBox: "0 0 80 80", class: "pulse-svg", role: "img", "aria-label": `Daily Pulse ${s} out of 100` }, [
    svgEl("circle", { cx: 40, cy: 40, r, class: "ring-track", "stroke-width": 4.5, fill: "none" }),
    svgEl("circle", {
      cx: 40, cy: 40, r,
      "stroke-width": 4.5,
      "stroke-linecap": "round",
      fill: "none",
      stroke: s >= 75 ? "var(--sage)" : "var(--accent)",
      "stroke-dasharray": circ,
      "stroke-dashoffset": offset,
      transform: "rotate(-90 40 40)",
    }),
  ]);

  return el("div", { class: "pulse-gauge" },
    svg,
    el("div", { class: "pulse-center" },
      el("span", { class: "pulse-num tnum" }, String(s)),
      el("span", { class: "pulse-lbl" }, "Pulse"),
    ),
  );
}

export function fastingArcSvg(progressPct, isComplete, large = false) {
  const p = Math.max(2, Math.min(100, progressPct || 0));
  const r = 30;
  const circ = +(2 * Math.PI * r).toFixed(2);
  const offset = +(circ * (1 - p / 100)).toFixed(2);

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30) * (Math.PI / 180);
    const x1 = +(42 + 37.5 * Math.cos(angle)).toFixed(1);
    const y1 = +(42 + 37.5 * Math.sin(angle)).toFixed(1);
    const x2 = +(42 + 35 * Math.cos(angle)).toFixed(1);
    const y2 = +(42 + 35 * Math.sin(angle)).toFixed(1);
    return svgEl("line", {
      x1, y1, x2, y2,
      stroke: i % 3 === 0 ? "var(--muted)" : "var(--line-strong)",
      "stroke-width": i % 3 === 0 ? 1.5 : 1,
      "stroke-linecap": "round",
    });
  });

  return svgEl("svg", { viewBox: "0 0 84 84", class: large ? "fast-svg fast-svg-lg" : "fast-svg", "aria-hidden": "true" }, [
    ...ticks,
    svgEl("circle", { cx: 42, cy: 42, r, class: "ring-track", "stroke-width": 4, fill: "none" }),
    svgEl("circle", {
      cx: 42, cy: 42, r,
      class: "fast-arc-stroke",
      "data-fasting-arc": "1",
      "data-circumference": String(circ),
      "stroke-width": 4,
      "stroke-linecap": "round",
      fill: "none",
      stroke: isComplete ? "var(--sage)" : "var(--accent)",
      "stroke-dasharray": circ,
      "stroke-dashoffset": offset,
      transform: "rotate(-90 42 42)",
    }),
  ]);
}

export function weeklySpendChartEl(series, safeDaily, fmtMoney) {
  const limit = safeDaily > 0 ? safeDaily : 0;
  const maxVal = Math.max(limit * 1.25, ...series.map((d) => d.spent), 10);
  const W = 320;
  const H = 132;
  const padB = 22;
  const padT = 10;
  const plotH = H - padB - padT;
  const step = W / 7;
  const barW = 16;

  const readout = el("p", { class: "chart-readout muted tnum" },
    limit > 0 ? `Pace target ${fmtMoney(limit)}/day · Tap bar to inspect` : "Tap any day to inspect spend");

  const nodes = [];
  if (limit > 0) {
    const lineY = +(padT + plotH * (1 - limit / maxVal)).toFixed(1);
    nodes.push(svgEl("line", {
      x1: 6, y1: lineY, x2: W - 6, y2: lineY,
      class: "chart-ref-line",
      "stroke-dasharray": "3 4",
    }));
  }

  series.forEach((d, idx) => {
    const x = +(idx * step + (step - barW) / 2).toFixed(1);
    const barH = d.spent > 0 ? Math.max(4, +((d.spent / maxVal) * plotH).toFixed(1)) : 2;
    const y = +(padT + plotH - barH).toFixed(1);
    const isOver = limit > 0 && d.spent > limit * 1.05;
    const color = d.spent === 0 ? "var(--line-strong)" : isOver ? "var(--rose)" : "var(--ink)";

    const rect = svgEl("rect", {
      x, y, width: barW, height: barH, rx: 4,
      fill: color,
      class: "chart-bar",
      tabindex: "0",
      role: "button",
      "aria-label": `${d.date}: ${fmtMoney(d.spent)}`,
    });
    const showDetail = () => {
      const tag = limit > 0 ? (isOver ? "over pace" : "on pace") : "logged";
      readout.textContent = `${dayLabel(d.date)} (${d.date}): ${fmtMoney(d.spent)} (${tag})`;
    };
    rect.addEventListener("mouseenter", showDetail);
    rect.addEventListener("click", showDetail);
    rect.addEventListener("focus", showDetail);
    nodes.push(rect);

    const txt = svgEl("text", { x: +(idx * step + step / 2).toFixed(1), y: H - 5, "text-anchor": "middle", class: "chart-axis-text" });
    txt.textContent = dayLabel(d.date);
    nodes.push(txt);
  });

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg spend-chart", role: "img", "aria-label": "7-day spending chart" }, nodes);
  return el("div", { class: "chart-block" }, svg, readout);
}

export function weeklyNutritionChartEl(series, kcalTarget, proteinTarget) {
  const target = kcalTarget > 0 ? kcalTarget : 2000;
  const maxVal = Math.max(target * 1.2, ...series.map((d) => d.kcal), 500);
  const W = 320;
  const H = 132;
  const padB = 22;
  const padT = 12;
  const plotH = H - padB - padT;
  const step = W / 7;
  const barW = 16;

  const readout = el("p", { class: "chart-readout muted tnum" }, `Target ${target} kcal · ${proteinTarget || 0}g protein/day`);

  const nodes = [];
  if (target > 0) {
    const lineY = +(padT + plotH * (1 - target / maxVal)).toFixed(1);
    nodes.push(svgEl("line", {
      x1: 6, y1: lineY, x2: W - 6, y2: lineY,
      class: "chart-ref-line",
      "stroke-dasharray": "3 4",
    }));
  }

  series.forEach((d, idx) => {
    const cx = +(idx * step + step / 2).toFixed(1);
    const x = +(idx * step + (step - barW) / 2).toFixed(1);
    const barH = d.kcal > 0 ? Math.max(4, +((d.kcal / maxVal) * plotH).toFixed(1)) : 2;
    const y = +(padT + plotH - barH).toFixed(1);
    const overKcal = target > 0 && d.kcal > target * 1.12;
    const color = d.kcal === 0 ? "var(--line-strong)" : overKcal ? "var(--accent)" : "var(--ice)";

    const rect = svgEl("rect", {
      x, y, width: barW, height: barH, rx: 4,
      fill: color,
      class: "chart-bar",
      tabindex: "0",
      role: "button",
      "aria-label": `${d.date}: ${d.kcal} kcal, ${d.protein}g protein`,
    });
    const showDetail = () => {
      readout.textContent = `${dayLabel(d.date)}: ${d.kcal} kcal · ${Math.round(d.protein)}g protein · ${d.water_ml} ml water`;
    };
    rect.addEventListener("mouseenter", showDetail);
    rect.addEventListener("click", showDetail);
    rect.addEventListener("focus", showDetail);
    nodes.push(rect);

    if (proteinTarget > 0 && d.protein >= proteinTarget * 0.85) {
      nodes.push(svgEl("circle", { cx, cy: 5, r: 2.5, fill: "var(--lilac)" }));
    }

    const txt = svgEl("text", { x: cx, y: H - 5, "text-anchor": "middle", class: "chart-axis-text" });
    txt.textContent = dayLabel(d.date);
    nodes.push(txt);
  });

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg nutrition-chart", role: "img", "aria-label": "7-day calories and protein chart" }, nodes);
  return el("div", { class: "chart-block" }, svg, readout);
}

export function categoryBreakdownEl(categories, totalSpent, fmtMoney) {
  if (!categories.length || !(totalSpent > 0)) {
    return el("p", { class: "muted" }, "Log an expense this week to see category breakdown.");
  }

  const bar = el("div", { class: "stacked-bar" });
  const legend = el("div", { class: "cat-legend" });

  categories.forEach(([name, amount], idx) => {
    const sharePct = Math.max(1, Math.round((amount / totalSpent) * 100));
    const color = CAT_COLORS[idx % CAT_COLORS.length];
    bar.appendChild(el("span", {
      class: "stacked-seg",
      style: `width:${(amount / totalSpent) * 100}%;background:${color}`,
      title: `${name}: ${fmtMoney(amount)} (${sharePct}%)`,
    }));
    legend.appendChild(el("div", { class: "cat-item" },
      el("span", { class: "cat-dot", style: `background:${color}` }),
      el("span", { class: "cat-name" }, name),
      el("span", { class: "cat-val tnum" }, `${fmtMoney(amount)} · ${sharePct}%`),
    ));
  });

  return el("div", { class: "cat-wrap" }, bar, legend);
}

export function consistencyMatrixEl(series, targets) {
  const waterGoal = (targets.water_ml || 2000) * 0.8;
  const rows = [
    { label: "Spend", color: "var(--sage)", check: (d) => d.spent > 0 },
    { label: "Meals", color: "var(--lilac)", check: (d) => d.kcal > 0 },
    { label: "Water", color: "var(--ice)", check: (d) => d.water_ml >= waterGoal },
  ];

  return el("div", { class: "matrix-wrap" },
    el("div", { class: "matrix-head" },
      el("span", {}),
      series.map((d) => el("span", { class: "matrix-day" }, dayLabel(d.date).slice(0, 2))),
    ),
    rows.map((r) => el("div", { class: "matrix-row" },
      el("span", { class: "matrix-lbl" }, r.label),
      series.map((d) => {
        const hit = r.check(d);
        return el("span", {
          class: "matrix-dot" + (hit ? " hit" : ""),
          style: hit ? `background:${r.color};border-color:${r.color}` : "",
          title: `${d.date} ${r.label}: ${hit ? "Done" : "Not logged"}`,
        });
      }),
    )),
  );
}

export function exportShareCardPng(summary) {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 1120;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, 960, 1120);

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(64, 158); ctx.lineTo(896, 158);
  ctx.moveTo(64, 304); ctx.lineTo(896, 304);
  ctx.moveTo(64, 548); ctx.lineTo(896, 548);
  ctx.moveTo(480, 304); ctx.lineTo(480, 792);
  ctx.moveTo(64, 792); ctx.lineTo(896, 792);
  ctx.stroke();

  ctx.fillStyle = "#ff7a2f";
  ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("SMARTASSISTANT · WEEKLY SUMMARY", 64, 92);

  ctx.fillStyle = "#8b8b93";
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${summary.period.start} — ${summary.period.end}`, 64, 130);

  ctx.fillStyle = "#f5f3ee";
  ctx.font = "700 40px system-ui, -apple-system, sans-serif";
  ctx.fillText(String(summary.headline || "Weekly Review").slice(0, 42), 64, 246);

  const cells = [
    { x: 64, y: 360, title: "DAILY PULSE", value: `${summary.pulseScore}/100`, sub: `${summary.streak}d streak`, color: "#ff7a2f" },
    { x: 516, y: 360, title: "WEEKLY SPENT", value: summary.spentText, sub: `of ${summary.allowanceText}`, color: "#f5f3ee" },
    { x: 64, y: 604, title: "AVG PROTEIN", value: `${summary.avgProtein} g`, sub: `target ${summary.proteinTarget} g`, color: "#c084fc" },
    { x: 516, y: 604, title: "HYDRATION GOAL", value: `${summary.waterHit}/${summary.waterDays}`, sub: "days >= 80% target", color: "#60a5fa" },
  ];

  for (const c of cells) {
    ctx.fillStyle = "#8b8b93";
    ctx.font = "700 18px system-ui, -apple-system, sans-serif";
    ctx.fillText(c.title, c.x, c.y);

    ctx.fillStyle = c.color;
    ctx.font = "800 58px system-ui, -apple-system, sans-serif";
    ctx.fillText(c.value, c.x, c.y + 72);

    ctx.fillStyle = "#8b8b93";
    ctx.font = "500 22px system-ui, -apple-system, sans-serif";
    ctx.fillText(c.sub, c.x, c.y + 114);
  }

  ctx.fillStyle = "#ff7a2f";
  ctx.font = "700 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("NEXT WEEK ACTION", 64, 856);

  ctx.fillStyle = "#f5f3ee";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  const words = String(summary.topAction || "Keep logging daily to sharpen insights.").split(" ");
  let line = "";
  let lineY = 910;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > 820) {
      ctx.fillText(line, 64, lineY);
      line = w;
      lineY += 40;
      if (lineY > 1010) break;
    } else {
      line = test;
    }
  }
  if (line && lineY <= 1010) ctx.fillText(line, 64, lineY);

  ctx.fillStyle = "#636366";
  ctx.font = "500 19px system-ui, -apple-system, sans-serif";
  ctx.fillText("SmartAssistant on Anna OS", 64, 1068);

  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `smartassistant-pulse-${summary.period.end}.png`;
  a.click();
  return dataUrl;
}
