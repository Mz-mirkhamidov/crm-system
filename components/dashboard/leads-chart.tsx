"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, subDays } from "date-fns";

interface LeadsChartProps {
  data: { date: string; count: number }[];
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/90 backdrop-blur-sm border border-primary/20 rounded-xl px-4 py-3 shadow-xl">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-bold text-primary">{payload[0].value}</p>
        <p className="text-xs text-muted-foreground">yangi lid</p>
      </div>
    );
  }
  return null;
};

export function LeadsChart({ data }: LeadsChartProps) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const found = data.find((d) => d.date === dateStr);
    return { day: format(date, "dd.MM"), count: found?.count || 0 };
  });

  const total = last7Days.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...last7Days.map((d) => d.count), 1);

  return (
    <div className="relative bg-card border border-border rounded-2xl p-5 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Haftalik lidlar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Oxirgi 7 kun statistikasi</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{total}</p>
          <p className="text-xs text-muted-foreground">jami lid</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={last7Days} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(262, 83%, 62%)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(262, 83%, 62%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(225, 25%, 14%)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "hsl(215, 20%, 50%)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(215, 20%, 50%)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            domain={[0, max + 1]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(262, 83%, 62%)", strokeWidth: 1, strokeDasharray: "4 4" }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(262, 83%, 62%)"
            strokeWidth={2.5}
            fill="url(#leadsGrad)"
            dot={{ fill: "hsl(262, 83%, 62%)", r: 3.5, strokeWidth: 2, stroke: "hsl(225, 25%, 9%)" }}
            activeDot={{ r: 6, fill: "hsl(262, 83%, 62%)", stroke: "hsl(225, 25%, 9%)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Day markers */}
      <div className="flex justify-between mt-2 px-1">
        {last7Days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            {d.count > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
