"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart, MapChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent,
  TitleComponent, ToolboxComponent, TooltipComponent, VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart, BarChart, ScatterChart, MapChart, HeatmapChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  VisualMapComponent, ToolboxComponent, DataZoomComponent, MarkLineComponent,
  CanvasRenderer,
]);

export type ChartEventHandlers = Record<string, (params: unknown) => void>;

export default function EChart({ option, height = 420, ariaLabel, onEvents, testId }: {
  option: echarts.EChartsCoreOption;
  height?: number;
  ariaLabel: string;
  onEvents?: ChartEventHandlers;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const handlersRef = useRef<ChartEventHandlers | undefined>(onEvents);

  useEffect(() => {
    handlersRef.current = onEvents;
  }, [onEvents]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let chart = echarts.getInstanceByDom(el);
    if (!chart) {
      chart = echarts.init(el, undefined, { renderer: "canvas" });
      chartRef.current = chart;
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(el);
      (el as unknown as { __ro?: ResizeObserver }).__ro = ro;
      const raf = requestAnimationFrame(() => chart?.resize());
      (el as unknown as { __raf?: number }).__raf = raf;
    }
    const events = ["click", "legendselectchanged", "datazoom"];
    for (const evt of events) {
      chart.off(evt);
      chart.on(evt, (params) => handlersRef.current?.[evt]?.(params));
    }
    return () => {
      chart?.off("click");
      chart?.off("legendselectchanged");
      chart?.off("datazoom");
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.getInstanceByDom(el);
    if (!chart) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.setOption(reducedMotion ? { ...option, animation: false } : option, { notMerge: true, lazyUpdate: false });
    chart.resize();
  }, [option]);

  useEffect(() => () => {
    const el = ref.current;
    if (!el) return;
    const raf = (el as unknown as { __raf?: number }).__raf;
    if (raf) cancelAnimationFrame(raf);
    (el as unknown as { __ro?: ResizeObserver }).__ro?.disconnect();
    echarts.getInstanceByDom(el)?.dispose();
  }, []);

  return (
    <div
      ref={ref}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
      className="w-full"
    />
  );
}
