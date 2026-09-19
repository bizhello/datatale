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
  "#365edb",
  "#7d62d9",
  "#2b9a81",
  "#d66c3e",
  "#bc4f7d",
  "#bf941b",
] as const;
export function ChartVisual({ chart }: ChartVisualProps) {
  if (chart.kind === "donut")
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chart.points}
            dataKey="value"
            nameKey="label"
            outerRadius={100}
          >
            {chart.points.map((point, index) => (
              <Cell
                key={point.label}
                fill={colors[index % colors.length] ?? colors[0]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  if (chart.kind === "line")
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chart.points}>
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#365edb" />
        </LineChart>
      </ResponsiveContainer>
    );
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chart.points}>
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#365edb" />
      </BarChart>
    </ResponsiveContainer>
  );
}
