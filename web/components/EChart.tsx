"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart, ScatterChart, MapChart, HeatmapChart } from "echarts/charts";
import {
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  VisualMapComponent, ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, BarChart, ScatterChart, MapChart, HeatmapChart, TitleComponent,
  TooltipComponent, GridComponent, LegendComponent, VisualMapComponent, ToolboxComponent, CanvasRenderer]);

export default function EChart({ option, height = 420, ariaLabel }: {
  option: echarts.EChartsCoreOption; height?: number; ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let chart = echarts.getInstanceByDom(el);
    if (!chart) {
      chart = echarts.init(el);
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(el);
      (el as unknown as { __ro?: ResizeObserver }).__ro = ro;
    }
    chart.setOption(option, true);
  }, [option]);
  useEffect(() => () => {
    const el = ref.current;
    if (!el) return;
    (el as unknown as { __ro?: ResizeObserver }).__ro?.disconnect();
    echarts.getInstanceByDom(el)?.dispose();
  }, []);
  return <div ref={ref} style={{ height }} role="img" aria-label={ariaLabel} className="w-full" />;
}
