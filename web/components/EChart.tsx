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
  const optRef = useRef(option);
  optRef.current = option;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption(optRef.current, true);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => { ro.disconnect(); chart.dispose(); };
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.getInstanceByDom(el);
    if (chart) chart.setOption(option, true);
  }, [option]);
  return <div ref={ref} style={{ height }} role="img" aria-label={ariaLabel} className="w-full" />;
}
