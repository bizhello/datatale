"use client";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FinalReport } from "../model/schema";

type ChartVisualProps = { chart: FinalReport["charts"][number] };
const colors = [
  "var(--chart-primary)",
  "var(--chart-secondary)",
  "var(--chart-positive)",
  "var(--chart-warm)",
  "var(--chart-pink)",
  "var(--chart-gold)",
] as const;
export function ChartVisual({ chart }: ChartVisualProps) {
  if (chart.kind === "donut")
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chart.points}
            dataKey="value"
            nameKey="label"
            innerRadius="52%"
            outerRadius="82%"
            paddingAngle={2}
          >
            {chart.points.map((point, index) => (
              <Cell
                key={point.label}
                fill={colors[index % colors.length] ?? colors[0]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => Number(value).toLocaleString("ru-RU")}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  if (chart.kind === "line")
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.points}>
          <XAxis dataKey="label" tick={{ fill: "var(--muted)" }} />
          <YAxis tick={{ fill: "var(--muted)" }} />
          <Tooltip
            formatter={(value) => Number(value).toLocaleString("ru-RU")}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-primary)"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart.points}>
        <XAxis dataKey="label" tick={{ fill: "var(--muted)" }} />
        <YAxis tick={{ fill: "var(--muted)" }} />
        <Tooltip formatter={(value) => Number(value).toLocaleString("ru-RU")} />
        <Bar dataKey="value" fill="var(--chart-primary)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
