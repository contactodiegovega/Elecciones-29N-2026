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
    // A lazily revealed map can mount inside a zero-width/hidden container.
    // ECharts 6 cannot invert a zero-sized geographic transform. Start at a
    // nonzero size and let ResizeObserver apply the real dimensions when shown.
    const chart = echarts.init(el, undefined, {
      renderer: "canvas", width: Math.max(1, el.clientWidth), height: Math.max(1, el.clientHeight),
    });
    chartRef.current = chart;
    const resize = () => {
      if (!chart.isDisposed() && el.clientWidth > 0 && el.clientHeight > 0) {
        chart.resize({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const raf = requestAnimationFrame(resize);
    const events = ["click", "legendselectchanged", "datazoom"];
    for (const evt of events) {
      chart.off(evt);
      chart.on(evt, (params) => handlersRef.current?.[evt]?.(params));
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      chartRef.current = null;
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed()) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.setOption(reducedMotion ? { ...option, animation: false } : option, { notMerge: true, lazyUpdate: false });
    const el = ref.current;
    if (el && el.clientWidth > 0 && el.clientHeight > 0) {
      chart.resize({ width: el.clientWidth, height: el.clientHeight });
    }
  }, [option]);

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
