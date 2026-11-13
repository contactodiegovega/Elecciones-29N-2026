export const PALETTE = ["#14213d", "#0f766e", "#c2410c", "#7c3aed", "#b45309", "#0e7490", "#be123c", "#4d7c0f"];

export const axisX = {
  axisLine: { lineStyle: { color: "#e5e1d8" } },
  axisTick: { show: false },
  axisLabel: { color: "#57534e", fontSize: 11 },
  splitLine: { show: false },
};

export const axisY = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: "#57534e", fontSize: 11 },
  splitLine: { lineStyle: { color: "#f0ede6" } },
};

export const tooltipBase = {
  backgroundColor: "rgba(20,33,61,0.96)",
  borderWidth: 0,
  textStyle: { color: "#faf9f6", fontSize: 12 },
  padding: [8, 10],
  confine: true,
};

export const gridBase = { left: 8, right: 16, top: 36, bottom: 56, containLabel: true };

export const legendBase = {
  type: "scroll" as const,
  bottom: 0,
  textStyle: { color: "#57534e", fontSize: 11 },
  itemWidth: 12,
  itemHeight: 8,
};

export function chartTitle(text: string, subtext?: string) {
  return {
    text,
    subtext,
    left: 0,
    top: 0,
    textStyle: { fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600, color: "#14213d" },
    subtextStyle: { fontSize: 11, color: "#78716c" },
  };
}
