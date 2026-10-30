import { useEffect, useRef } from "react";
import { compile } from "mathjs";
import type { Scene, SceneElement } from "@contracts/lesson";

interface Props { scene: Scene; previous?: Scene; stepKey: string; parameters: Record<string, number>; playing: boolean }
const INK = "#20221f";
const MUTED = "#92958c";
const ACCENT = "#ff5c35";
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function transitionElement(from: SceneElement | undefined, to: SceneElement, t: number): SceneElement {
  if (!from || from.type !== to.type) return to;
  const output = { ...to } as unknown as Record<string, unknown>;
  const source = from as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(output)) {
    if (typeof value === "number" && typeof source[key] === "number") output[key] = mix(source[key] as number, value, t);
    if (Array.isArray(value) && Array.isArray(source[key]) && value.length === (source[key] as unknown[]).length && value.every(v => typeof v === "number")) {
      output[key] = value.map((v, i) => mix((source[key] as number[])[i], v as number, t));
    }
  }
  if (to.type === "path" && from.type === "path" && to.points.length === from.points.length) output.points = to.points.map((p, i) => [mix(from.points[i][0], p[0], t), mix(from.points[i][1], p[1], t)]);
  return output as unknown as SceneElement;
}

export default function SceneCanvas({ scene, previous, stepKey, parameters, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ scene, previous, parameters, playing });
  stateRef.current = { scene, previous, parameters, playing };
  const progressRef = useRef(1);

  useEffect(() => { progressRef.current = 0; }, [stepKey]);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let width = 0, height = 0;
    let last = performance.now();
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

    const draw = (now: number) => {
      const dt = Math.min(50, now - last); last = now;
      progressRef.current = clamp(progressRef.current + dt / 850);
      const t = ease(progressRef.current);
      const current = stateRef.current;
      const from = current.previous;
      const vp = {
        xMin: from ? mix(from.viewport.xMin, current.scene.viewport.xMin, t) : current.scene.viewport.xMin,
        xMax: from ? mix(from.viewport.xMax, current.scene.viewport.xMax, t) : current.scene.viewport.xMax,
        yMin: from ? mix(from.viewport.yMin, current.scene.viewport.yMin, t) : current.scene.viewport.yMin,
        yMax: from ? mix(from.viewport.yMax, current.scene.viewport.yMax, t) : current.scene.viewport.yMax,
      };
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#f4f3ee"; ctx.fillRect(0, 0, width, height);
      const pad = { left: 56, right: 30, top: 48, bottom: 52 };
      const cw = Math.max(10, width - pad.left - pad.right), ch = Math.max(10, height - pad.top - pad.bottom);
      const px = (x: number) => pad.left + (x - vp.xMin) / (vp.xMax - vp.xMin) * cw;
      const py = (y: number) => pad.top + ch - (y - vp.yMin) / (vp.yMax - vp.yMin) * ch;
      const color = (el: SceneElement) => el.color || (el.type === "bar" && el.state === "active" ? ACCENT : INK);
      const line = (x1: number, y1: number, x2: number, y2: number) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
      const label = (text: string, x: number, y: number, fill = MUTED, align: CanvasTextAlign = "center", size = 12, mono = false) => {
        ctx.fillStyle = fill; ctx.textAlign = align; ctx.textBaseline = "middle";
        ctx.font = `${mono ? "500" : "550"} ${size}px ${mono ? "'Geist Mono Variable', monospace" : "'Geist Variable', sans-serif"}`;
        ctx.fillText(text, x, y);
      };

      const elements = current.scene.elements.map(el => transitionElement(from?.elements.find(old => old.id === el.id), el, t));
      for (const el of elements) {
        ctx.save(); ctx.globalAlpha = el.opacity ?? 1; ctx.strokeStyle = color(el); ctx.fillStyle = color(el); ctx.lineWidth = 1.7; ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (el.type === "axes") {
          ctx.strokeStyle = "#d9d8d1"; ctx.lineWidth = 1;
          if (el.grid !== false) {
            for (let x = Math.ceil(vp.xMin); x <= Math.floor(vp.xMax); x++) line(px(x), pad.top, px(x), pad.top + ch);
            for (let y = Math.ceil(vp.yMin); y <= Math.floor(vp.yMax); y++) line(pad.left, py(y), pad.left + cw, py(y));
          }
          ctx.strokeStyle = "#a8aaa1";
          if (vp.yMin <= 0 && vp.yMax >= 0) line(pad.left, py(0), pad.left + cw + 6, py(0));
          if (vp.xMin <= 0 && vp.xMax >= 0) line(px(0), pad.top - 6, px(0), pad.top + ch);
          const xTicks = Math.min(8, Math.floor(vp.xMax - vp.xMin));
          for (let i = 0; i <= xTicks; i++) { const x = vp.xMin + (vp.xMax - vp.xMin) * i / Math.max(1, xTicks); label(Number(x.toFixed(1)).toString(), px(x), pad.top + ch + 21, MUTED, "center", 10, true); }
          const yTicks = Math.min(6, Math.floor(vp.yMax - vp.yMin));
          for (let i = 0; i <= yTicks; i++) { const y = vp.yMin + (vp.yMax - vp.yMin) * i / Math.max(1, yTicks); label(Number(y.toFixed(1)).toString(), pad.left - 15, py(y), MUTED, "right", 10, true); }
          if (el.xLabel) label(el.xLabel, pad.left + cw, pad.top + ch + 37, INK, "right", 12);
          if (el.yLabel) label(el.yLabel, pad.left - 34, pad.top - 18, INK, "left", 12);
        } else if (el.type === "function") {
          try {
            const evaluator = compile(el.expression);
            const samples = el.samples || 260;
            ctx.strokeStyle = color(el); ctx.lineWidth = 2.4; if (el.dash) ctx.setLineDash(el.dash);
            ctx.beginPath(); let begun = false;
            const visible = Math.max(2, Math.floor(samples * t));
            for (let i = 0; i <= visible; i++) {
              const x = vp.xMin + (vp.xMax - vp.xMin) * i / samples;
              const result = evaluator.evaluate({ ...current.parameters, [el.variable || "x"]: x });
              const y = typeof result === "number" ? result : NaN;
              if (!Number.isFinite(y) || y < vp.yMin - 20 || y > vp.yMax + 20) { begun = false; continue; }
              if (!begun) { ctx.moveTo(px(x), py(y)); begun = true; } else ctx.lineTo(px(x), py(y));
            }
            ctx.stroke();
          } catch { label("Expressão inválida", width / 2, height / 2, ACCENT, "center", 13); }
        } else if (el.type === "point") {
          let pointX = el.x, pointY = el.y;
          try {
            if (el.xExpression) pointX = Number(compile(el.xExpression).evaluate({ ...current.parameters, x: el.x }));
            if (el.yExpression) pointY = Number(compile(el.yExpression).evaluate({ ...current.parameters, x: el.x }));
          } catch { pointX = el.x; pointY = el.y; }
          ctx.beginPath(); ctx.arc(px(pointX), py(pointY), (el.radius || 5) * (0.5 + t * 0.5), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#f4f3ee"; ctx.lineWidth = 2; ctx.stroke();
          if (el.label) label(el.label, px(pointX) + 12, py(pointY) - 17, color(el), "left", 12, true);
        } else if (el.type === "line") {
          if (el.dash) ctx.setLineDash(el.dash);
          line(px(el.from[0]), py(el.from[1]), px(mix(el.from[0], el.to[0], t)), py(mix(el.from[1], el.to[1], t)));
          if (el.label) label(el.label, (px(el.from[0]) + px(el.to[0])) / 2, (py(el.from[1]) + py(el.to[1])) / 2 - 14, color(el));
        } else if (el.type === "vector") {
          const x2 = el.x + el.dx * t, y2 = el.y + el.dy * t;
          ctx.lineWidth = 2.2; line(px(el.x), py(el.y), px(x2), py(y2));
          const angle = Math.atan2(py(y2) - py(el.y), px(x2) - px(el.x));
          ctx.beginPath(); ctx.moveTo(px(x2), py(y2)); ctx.lineTo(px(x2) - 10 * Math.cos(angle - .45), py(y2) - 10 * Math.sin(angle - .45)); ctx.lineTo(px(x2) - 10 * Math.cos(angle + .45), py(y2) - 10 * Math.sin(angle + .45)); ctx.closePath(); ctx.fill();
          if (el.label) label(el.label, px(x2) + 8, py(y2) - 12, color(el), "left", 12, true);
        } else if (el.type === "circle") {
          ctx.beginPath(); ctx.arc(px(el.x), py(el.y), Math.abs(px(el.x + el.radius) - px(el.x)) * t, 0, Math.PI * 2); el.fill ? ctx.fill() : ctx.stroke();
        } else if (el.type === "bar") {
          const barWidth = Math.abs(px(el.x + (el.width || .65)) - px(el.x));
          const x = px(el.x) - barWidth / 2, y = py(el.height * t), h = py(0) - y;
          ctx.fillStyle = el.state === "muted" ? "#deddd6" : el.state === "done" ? "#a9c6a0" : color(el);
          ctx.globalAlpha = el.state === "muted" ? .65 : 1;
          ctx.beginPath(); ctx.roundRect(x, y, barWidth, h, 4); ctx.fill();
          if (el.label) label(el.label, px(el.x), y - 15, el.state === "muted" ? MUTED : INK, "center", 12, true);
        } else if (el.type === "text") {
          let fontSize = el.size || 13;
          const maxWidth = Math.max(80, Math.min(cw - 12, 460));
          const wrap = (size: number) => {
            ctx.font = `500 ${size}px 'Geist Mono Variable', monospace`;
            const lines: string[] = []; let currentLine = "";
            for (const word of el.text.split(/\s+/)) {
              const candidate = currentLine ? `${currentLine} ${word}` : word;
              if (currentLine && ctx.measureText(candidate).width > maxWidth) { lines.push(currentLine); currentLine = word; }
              else currentLine = candidate;
            }
            if (currentLine) lines.push(currentLine); return lines;
          };
          let lines = wrap(fontSize);
          if (lines.length > 3) { fontSize = Math.max(8, fontSize - 3); lines = wrap(fontSize); }
          if (lines.length > 4) lines = [...lines.slice(0, 3), lines.slice(3).join(" ").slice(0, 52) + "…"];
          const align = el.align || "center";
          const rawX = px(el.x);
          const half = Math.min(maxWidth, cw) / 2;
          const textX = align === "center" ? clamp(rawX, pad.left + half, pad.left + cw - half) : clamp(rawX, pad.left, pad.left + cw);
          const baseY = clamp(py(el.y), pad.top + 8, pad.top + ch - lines.length * (fontSize + 3));
          lines.forEach((textLine, index) => label(textLine, textX, baseY + index * (fontSize + 4), color(el), align, fontSize, true));
        } else if (el.type === "path") {
          ctx.beginPath(); el.points.forEach((p, i) => i ? ctx.lineTo(px(p[0]), py(p[1])) : ctx.moveTo(px(p[0]), py(p[1]))); if (el.closed) ctx.closePath(); el.fill ? ctx.fill() : ctx.stroke();
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} role="img" aria-label={scene.caption || "Visualização interativa da lição"} />;
}
