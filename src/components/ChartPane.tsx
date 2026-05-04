/**
 * [INPUT]: { series, events?, axisOverrides?, height? } — 系列、可选事件、可选轴覆盖、高度
 * [OUTPUT]: 一个 lightweight-charts pane（多 series 叠加 + 双 y 轴 [可手动覆盖] + 十字线 +
 *           可选 event markers + hover tooltip + 主题对齐 Clinical Dark）
 * [POS]: 位于 /components，被 EditablePane 引用。Charts Workspace 的最小可视化单元。
 *
 * [PROTOCOL]:
 * 1. 仅渲染传入的 series / events / axisOverrides，不发起 API 请求（pure presentational）。
 * 2. ResizeObserver 处理父容器宽度变化，chart instance 在 unmount 时正确释放。
 * 3. lightweight-charts v5：addSeries(LineSeries, {priceScaleId}) 区分 left/right 轴。
 * 4. 双 y 轴策略：
 *    - 用户在 axisOverrides 显式指定的 series → 直接走指定轴（手动 > 自动）
 *    - 剩下未指定的 series → 按 log10 量级聚类自动分轴（gap >= 1.0 触发分轴）
 * 5. events markers：用 v5 createSeriesMarkers plugin attach 到第一个 series。
 * 6. hover tooltip：subscribeCrosshairMove 监听十字线移动，在该日期附近的 events
 *    渲染成 absolute 定位的 DOM tooltip（marker 没有 text 时弥补可读性）。
 */
"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { ChartSeries, ChartEvent } from "@/types/api";
import { PRICE_LINE_COLOR_HEX, type PriceLine } from "@/lib/workspace-state";
import {
  CLINICAL_DARK_CHART_OPTIONS,
  getLineSeriesOptions,
} from "@/lib/chart-theme";

interface ChartPaneProps {
  series: ChartSeries[];
  events?: ChartEvent[];
  // 用户自定义 marker（标注政策日 / 买卖点 / 重要事件），会与 events 合并渲染到图表上
  customMarkers?: { id: string; ts: string; label: string; severity: ChartEvent["severity"] }[];
  axisOverrides?: Record<string, "left" | "right">;
  height?: number;
  // Ratio Mode：所有 series 除以第一个 series 的同 ts 值，看跨 series 比率
  ratioMode?: boolean;
  // 可选 visible range（YYYY-MM-DD 字符串）：开启 per-pane timeRange 时由父组件计算后传入；
  // chart.timeScale().setVisibleRange 把图 zoom 到该子区间，fetch 区间不变
  visibleStart?: string;
  visibleEnd?: string;
  // 价格线（横向 priceLine）— 标支撑/阻力位
  priceLines?: PriceLine[];
}

// 把 customMarker 转成 ChartEvent shape，复用 markers / tooltip 渲染路径
function customMarkersToEvents(
  markers: { id: string; ts: string; label: string; severity: ChartEvent["severity"] }[],
): ChartEvent[] {
  return markers.map((m) => ({
    ts: m.ts.slice(0, 10) + "T00:00:00Z",
    model: "custom",
    type: "user_marker",
    severity: m.severity,
    label: m.label,
    from_state: null,
    to_state: null,
    rule_id: null,
    payload: null,
  }));
}

// 把 series 列表转换成 ratio mode 数据：
// - 第一个 series（base）所有点变成 1.0
// - 其他 series 按 ts (slice 0,10) 对齐查 base value，相除；找不到 base 时 value 设 null
function applyRatioMode(seriesList: ChartSeries[]): ChartSeries[] {
  // review-driven defense：单 series 走 ratio mode 会把唯一线变成 y=1 水平线
  // 用户体验割裂；少于 2 条 series 直接返回原值不变换
  if (seriesList.length < 2) return seriesList;
  const base = seriesList[0]!;
  const baseLookup = new Map<string, number>();
  for (const p of base.points) {
    if (
      p.value !== null &&
      Number.isFinite(p.value) &&
      (p.value as number) !== 0
    ) {
      const date = p.ts.slice(0, 10);
      baseLookup.set(date, p.value as number);
    }
  }
  return seriesList.map((s, idx) => {
    if (idx === 0) {
      return {
        ...s,
        points: s.points.map((p) => ({
          ...p,
          value: p.value === null ? null : 1,
        })),
      };
    }
    return {
      ...s,
      points: s.points.map((p) => {
        const date = p.ts.slice(0, 10);
        const baseV = baseLookup.get(date);
        if (
          p.value === null ||
          baseV === undefined ||
          !Number.isFinite(p.value)
        ) {
          return { ...p, value: null };
        }
        return { ...p, value: (p.value as number) / baseV };
      }),
    };
  });
}

// 把 series 按数据量级聚类成 left/right 两组
// 已在 axisOverrides 中明确指定的 symbol 优先走 override；剩余 symbol 走自动聚类
function clusterAxes(
  series: ChartSeries[],
  overrides: Record<string, "left" | "right"> = {},
): Map<string, "left" | "right"> {
  const result = new Map<string, "left" | "right">();

  // Step 1: apply overrides
  const remaining: ChartSeries[] = [];
  for (const s of series) {
    const ov = overrides[s.symbol];
    if (ov === "left" || ov === "right") {
      result.set(s.symbol, ov);
    } else {
      remaining.push(s);
    }
  }

  if (remaining.length === 0) return result;
  if (remaining.length === 1) {
    result.set(remaining[0]!.symbol, "right");
    return result;
  }

  // Step 2: 自动聚类 remaining
  const items = remaining.map((s) => {
    const values = s.points
      .map((p) => p.value)
      .filter(
        (v): v is number => v !== null && Number.isFinite(v) && v !== 0,
      )
      .map(Math.abs);
    if (values.length === 0) return { symbol: s.symbol, magnitude: 0 };
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)] ?? 1;
    return { symbol: s.symbol, magnitude: Math.log10(median) };
  });

  const sorted = [...items].sort((a, b) => a.magnitude - b.magnitude);
  let maxGap = 0;
  let splitIdx = -1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.magnitude - sorted[i - 1]!.magnitude;
    if (gap > maxGap) {
      maxGap = gap;
      splitIdx = i;
    }
  }

  // 数量级差 < 1.0（10x）→ 单轴
  if (maxGap < 1.0 || splitIdx < 0) {
    remaining.forEach((s) => result.set(s.symbol, "right"));
    return result;
  }

  sorted.forEach((item, i) => {
    result.set(item.symbol, i < splitIdx ? "left" : "right");
  });
  return result;
}

function severityColor(severity: ChartEvent["severity"]): string {
  switch (severity) {
    case "critical":
      return "#ef4444";
    case "warning":
      return "#eab308";
    case "info":
    default:
      return "#3b82f6";
  }
}

// 给每个事件生成简短文本标签（marker 上 always-visible）
// 设计：1-4 字符，让用户不 hover 也能看出"这是什么"
function eventLabelText(e: ChartEvent): string {
  switch (e.type) {
    case "hard_stop":
      return "STOP";
    case "risk_light_change": {
      // R/Y/G 三色字符标记（red→yellow → "R→Y"）
      const f = (e.from_state ?? "").charAt(0).toUpperCase();
      const t = (e.to_state ?? "").charAt(0).toUpperCase();
      return f && t ? `${f}→${t}` : "灯号";
    }
    case "macro_state_change":
      return e.to_state ? `→${e.to_state}` : "状态";
    case "gate_closed":
      return "闸";
    case "gate_opened":
      return "开";
    case "equity_regime_change":
      // BULL/BEAR/LATE_CYCLE/EARLY_RECOVERY/TRANSITION → 取前 2 字符
      return e.to_state ? e.to_state.slice(0, 4) : "体制";
    case "btc_pattern_triggered":
      return e.to_state ?? "BTC";
    case "alert":
      return "⚠";
    case "rule_triggered":
      return "•";
    default:
      return "";
  }
}

function eventsToMarkers(events: ChartEvent[]): SeriesMarker<Time>[] {
  // 防御：events 来自 API，ts 字段理论上是 ISO 字符串但实际可能为 null/undefined/数字
  // M7+：当 markers 数量 < 50 时给每个 marker 加 text label（不 hover 也能看懂）；
  // 超过 50 条会重叠成噪音，自动隐藏 text 仅留 shape+color
  const filtered = events.filter(
    (e) => typeof e?.ts === "string" && e.ts.length >= 10,
  );
  const showText = filtered.length < 50;
  return filtered.map((e) => ({
      time: e.ts.slice(0, 10) as Time,
      position: e.severity === "critical" ? "aboveBar" : "belowBar",
      color: severityColor(e.severity),
      shape:
        e.severity === "critical"
          ? "arrowDown"
          : e.severity === "warning"
            ? "circle"
            : "circle",
      size: e.severity === "critical" ? 1.5 : 0.8,
      text: showText ? eventLabelText(e) : undefined,
    }));
}

function timeToYmd(t: Time | undefined): string | null {
  if (!t) return null;
  if (typeof t === "string") return t.slice(0, 10);
  // BusinessDay
  if (typeof t === "object" && "year" in t && "month" in t && "day" in t) {
    const m = String(t.month).padStart(2, "0");
    const d = String(t.day).padStart(2, "0");
    return `${t.year}-${m}-${d}`;
  }
  // UTCTimestamp (number, seconds)
  if (typeof t === "number") {
    return new Date(t * 1000).toISOString().slice(0, 10);
  }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTooltipHtml(date: string, events: ChartEvent[]): string {
  const rows = events
    .slice(0, 6) // 最多显示 6 条避免溢出
    .map((e) => {
      const color = severityColor(e.severity);
      const arrow =
        e.from_state && e.to_state
          ? `<span style="color:#63636e">${escapeHtml(e.from_state)} → ${escapeHtml(e.to_state)}</span>`
          : "";
      return `
        <div style="display:flex;align-items:flex-start;gap:6px;padding:2px 0;">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-top:5px;flex-shrink:0;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;color:#e4e4e7;line-height:1.3;">${escapeHtml(e.label)}</div>
            ${arrow ? `<div style="font-size:10px;line-height:1.3;">${arrow}</div>` : ""}
            <div style="font-size:9px;color:#63636e;text-transform:uppercase;letter-spacing:0.5px;">
              ${escapeHtml(e.model)} · ${escapeHtml(e.type)}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
  const more =
    events.length > 6
      ? `<div style="font-size:10px;color:#63636e;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;">+${events.length - 6} more</div>`
      : "";
  return `
    <div style="font-size:10px;color:#a1a1aa;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(date)}</div>
    ${rows}${more}
  `;
}

export function ChartPane({
  series: rawSeries,
  events,
  customMarkers,
  axisOverrides,
  height = 300,
  ratioMode = false,
  visibleStart,
  visibleEnd,
  priceLines,
}: ChartPaneProps) {
  // Ratio mode 在装载前预处理（保持 prop 不可变 + 避免下游 useEffect 误判）
  const series = ratioMode ? applyRatioMode(rawSeries) : rawSeries;
  // 把用户自定义 markers 跟模型事件合并（前端无差别渲染）
  // review-driven：useMemo 避免每次 render 都建新数组触发 markers 反复重建
  const allEvents: ChartEvent[] = useMemo(
    () => [
      ...(events ?? []),
      ...(customMarkers && customMarkers.length > 0
        ? customMarkersToEvents(customMarkers)
        : []),
    ],
    [events, customMarkers],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLineRefs = useRef<IPriceLine[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<ChartEvent[]>([]);

  // 1. 创建 chart 实例（一次）
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CLINICAL_DARK_CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    // 创建 hover tooltip 容器（绝对定位在 chart container 内）
    const tooltip = document.createElement("div");
    tooltip.style.cssText =
      "position:absolute;display:none;z-index:20;pointer-events:none;background:#19191c;border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:8px 10px;min-width:180px;max-width:280px;box-shadow:0 8px 24px rgba(0,0,0,0.4);";
    containerRef.current.style.position = "relative";
    containerRef.current.appendChild(tooltip);
    tooltipRef.current = tooltip;

    const handleCrosshair = (param: MouseEventParams) => {
      const tip = tooltipRef.current;
      const evs = eventsRef.current;
      if (!tip) return;
      if (
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0 ||
        evs.length === 0
      ) {
        tip.style.display = "none";
        return;
      }
      const ymd = timeToYmd(param.time);
      if (!ymd) {
        tip.style.display = "none";
        return;
      }
      const matching = evs.filter(
        (e) => typeof e?.ts === "string" && e.ts.slice(0, 10) === ymd,
      );
      if (matching.length === 0) {
        tip.style.display = "none";
        return;
      }
      tip.innerHTML = buildTooltipHtml(ymd, matching);
      // 智能定位：避免溢出右边/下边
      const containerW = containerRef.current?.clientWidth ?? 0;
      const containerH = containerRef.current?.clientHeight ?? 0;
      const tipW = tip.offsetWidth || 200;
      const tipH = tip.offsetHeight || 100;
      let left = param.point.x + 16;
      let top = param.point.y + 12;
      if (left + tipW > containerW) left = param.point.x - tipW - 12;
      if (top + tipH > containerH) top = param.point.y - tipH - 8;
      tip.style.left = `${Math.max(0, left)}px`;
      tip.style.top = `${Math.max(0, top)}px`;
      tip.style.display = "block";
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = [];
      markersPluginRef.current = null;
      tooltip.remove();
      tooltipRef.current = null;
    };
  }, [height]);

  // 2. 数据装载/更新
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // 移除旧 series + markers
    seriesRefs.current.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {
        // chart already disposed — ignore
      }
    });
    seriesRefs.current = [];
    markersPluginRef.current = null;

    // 双 y 轴聚类（含 overrides）
    const axisMap = clusterAxes(series, axisOverrides ?? {});
    const usedLeft = Array.from(axisMap.values()).some((v) => v === "left");
    chart.applyOptions({
      leftPriceScale: { visible: usedLeft },
      rightPriceScale: { visible: true },
    });

    series.forEach((s, idx) => {
      const priceScaleId = axisMap.get(s.symbol) ?? "right";
      const lineSeries = chart.addSeries(LineSeries, {
        ...getLineSeriesOptions(idx),
        priceScaleId,
      });

      const data = s.points
        .filter((p) => p.value !== null && Number.isFinite(p.value))
        .map((p) => ({
          time: p.ts.slice(0, 10) as `${number}-${number}-${number}`,
          value: p.value as number,
        }))
        .sort((a, b) => a.time.localeCompare(b.time));

      const dedup: typeof data = [];
      for (const point of data) {
        const last = dedup.length > 0 ? dedup[dedup.length - 1] : undefined;
        if (last && last.time === point.time) {
          dedup[dedup.length - 1] = point;
        } else {
          dedup.push(point);
        }
      }

      lineSeries.setData(dedup);
      seriesRefs.current.push(lineSeries);
    });

    if (series.length > 0) {
      // M7 修复「BTC-USD 偶发显示为水平线」bug：
      // removeSeries() + addSeries() 流程中，lightweight-charts 内部 priceScale
      // viewport 在 axis 分组变化时（如新加入一个量级远大/远小的 series 触发分轴）
      // 可能保留旧 bounds，导致新 series 数据被压成水平线。
      // 显式 applyOptions({autoScale:true}) 强制 priceScale 重新按当前数据 fit。
      for (const scaleId of ["left", "right"] as const) {
        try {
          chart.priceScale(scaleId).applyOptions({ autoScale: true });
        } catch {
          // priceScale 不可用时安全 ignore
        }
      }
      // 如果父组件指定了 visible range（per-pane timeRange override），
      // 用 setVisibleRange zoom 到子区间；否则 fitContent 显示全部 fetch 的数据
      if (visibleStart && visibleEnd) {
        try {
          chart.timeScale().setVisibleRange({
            from: visibleStart as Time,
            to: visibleEnd as Time,
          });
        } catch {
          chart.timeScale().fitContent();
        }
      } else {
        chart.timeScale().fitContent();
      }
    }
  }, [series, axisOverrides, visibleStart, visibleEnd]);

  // 3. events markers + 同步给 hover tooltip 用的 ref（含用户 customMarkers）
  useEffect(() => {
    eventsRef.current = allEvents;
    const chart = chartRef.current;
    const firstSeries = seriesRefs.current[0];
    if (!chart || !firstSeries) return;

    const markers = allEvents.length > 0 ? eventsToMarkers(allEvents) : [];

    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers(markers);
    } else if (markers.length > 0) {
      markersPluginRef.current = createSeriesMarkers(firstSeries, markers);
    }
  }, [allEvents, series]);

  // 4. priceLines（横向支撑/阻力位）— attach 到第一个 series
  useEffect(() => {
    const firstSeries = seriesRefs.current[0];
    if (!firstSeries) {
      priceLineRefs.current = [];
      return;
    }
    // 移除旧 priceLines（用 createPriceLine 返回的 IPriceLine ref 调 removePriceLine）
    priceLineRefs.current.forEach((pl) => {
      try {
        firstSeries.removePriceLine(pl);
      } catch {
        // already disposed — ignore
      }
    });
    priceLineRefs.current = [];

    if (!priceLines || priceLines.length === 0) return;

    for (const line of priceLines) {
      try {
        const ref = firstSeries.createPriceLine({
          price: line.value,
          color: PRICE_LINE_COLOR_HEX[line.color],
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: line.label,
        });
        priceLineRefs.current.push(ref);
      } catch {
        // ignore individual line failures
      }
    }
  }, [priceLines, series]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-card)]"
    />
  );
}
