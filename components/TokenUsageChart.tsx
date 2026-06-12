"use client";

import { Line } from "@ant-design/plots";
import { Empty } from "antd";
import { useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import type { TokenDailyPoint } from "@/services/stats";

interface TokenUsageChartProps {
  data: TokenDailyPoint[];
}

const SERIES_META = [
  { field: "totalTokens" as const, label: "总消耗", color: "#3b82f6" },
  { field: "promptTokens" as const, label: "输入", color: "#22c55e" },
  { field: "completionTokens" as const, label: "输出", color: "#f59e0b" },
];

/** 格式化 Y 轴刻度 */
function formatAxisValue(value: number) {
  if (value >= 10000) return `${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}

/** 折线图展示最近 7 日 token 消耗趋势 */
export default function TokenUsageChart({ data }: TokenUsageChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const activeSeries = useMemo(
    () => SERIES_META.filter((item) => data.some((point) => point[item.field] > 0)),
    [data]
  );

  const chartData = useMemo(
    () =>
      data.flatMap((item) => {
        const label = item.date.slice(5);
        return activeSeries.map((series) => ({
          date: label,
          type: series.label,
          value: item[series.field],
        }));
      }),
    [activeSeries, data]
  );

  const hasData = chartData.some((item) => item.value > 0);

  const config = useMemo(
    () => ({
      data: chartData,
      xField: "date",
      yField: "value",
      colorField: "type",
      smooth: true,
      animation: false,
      height: 260,
      insetTop: 8,
      insetBottom: 4,
      marginLeft: 48,
      marginRight: 16,
      marginBottom: 28,
      legend: false,
      scale: {
        color: {
          domain: activeSeries.map((item) => item.label),
          range: activeSeries.map((item) => item.color),
        },
        y: {
          domainMin: 0,
          nice: true,
        },
      },
      axis: {
        x: {
          labelFill: isDark ? "#cbd5e1" : "#475569",
          lineStroke: isDark ? "#475569" : "#cbd5e1",
          tickStroke: isDark ? "#475569" : "#cbd5e1",
          labelFontSize: 12,
        },
        y: {
          labelFill: isDark ? "#cbd5e1" : "#475569",
          gridStroke: isDark ? "rgba(148, 163, 184, 0.18)" : "rgba(100, 116, 139, 0.16)",
          gridLineDash: [4, 4],
          labelFontSize: 12,
          labelFormatter: formatAxisValue,
        },
      },
      style: {
        lineWidth: 2.5,
      },
      point: {
        shapeField: "circle",
        sizeField: 4,
        style: {
          fill: isDark ? "#1e293b" : "#ffffff",
          lineWidth: 2,
        },
      },
      interaction: {
        tooltip: {
          shared: true,
          crosshairsLineDash: [4, 4],
        },
      },
    }),
    [activeSeries, chartData, isDark]
  );

  if (!hasData) {
    return (
      <div className="token-chart-card token-chart-card--empty">
        <div className="token-chart-header">
          <div>
            <div className="token-chart-title">近 7 日消耗趋势</div>
            <div className="token-chart-subtitle">按服务器本地日期统计</div>
          </div>
        </div>
        <div className="token-chart-empty">
          <Empty description="近 7 日暂无 token 消耗记录" />
        </div>
      </div>
    );
  }

  return (
    <div className="token-chart-card">
      <div className="token-chart-header">
        <div>
          <div className="token-chart-title">近 7 日消耗趋势</div>
          <div className="token-chart-subtitle">按服务器本地日期统计</div>
        </div>
        <div className="token-chart-legend">
          {activeSeries.map((item) => (
            <span className="token-chart-legend-item" key={item.label}>
              <span
                className="token-chart-legend-dot"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="token-chart-plot">
        <Line {...config} />
      </div>
    </div>
  );
}
