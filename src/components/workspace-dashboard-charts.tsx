"use client";

import { useEffect, useState } from "react";

type RechartsModule = typeof import("recharts");

type TaskActivityPoint = {
  label: string;
  created: number;
  completed: number;
};

type TaskDistributionPoint = {
  label: string;
  value: number;
};

export function TaskActivityChart({ data }: { data: TaskActivityPoint[] }) {
  const [charts, setCharts] = useState<RechartsModule | null>(null);

  useEffect(() => {
    import("recharts").then((module) => setCharts(module));
  }, []);

  if (!charts) {
    return <div className="h-[290px] w-full animate-pulse rounded-lg bg-muted/30" />;
  }

  const { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } = charts;

  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} fontSize={11} />
          <Tooltip
            content={({ active, label, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }
              const point = payload[0]?.payload as TaskActivityPoint | undefined;

              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                  <div className="mb-1 text-xs text-muted-foreground">{label}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-6">
                      <span>Created</span>
                      <span className="font-semibold">{point?.created ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <span>Completed</span>
                      <span className="font-semibold">{point?.completed ?? 0}</span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: "12px" }}
            payload={[
              { value: "Created", type: "circle", id: "created", color: "#f59e0b" },
              { value: "Completed", type: "circle", id: "completed", color: "#10b981" },
            ]}
          />
          <Area type="monotone" dataKey="created" stroke="none" fill="#f59e0b" fillOpacity={0.08} isAnimationActive={false} legendType="none" />
          <Area type="monotone" dataKey="completed" stroke="none" fill="#10b981" fillOpacity={0.08} isAnimationActive={false} legendType="none" />
          <Line type="monotone" dataKey="created" name="Created" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaskDistributionChart({ data }: { data: TaskDistributionPoint[] }) {
  const [charts, setCharts] = useState<RechartsModule | null>(null);

  useEffect(() => {
    import("recharts").then((module) => setCharts(module));
  }, []);

  if (!charts) {
    return <div className="h-[290px] w-full animate-pulse rounded-lg bg-muted/30" />;
  }

  const { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } = charts;

  const barColorByLabel: Record<string, string> = {
    "To Do": "#3b82f6",
    "In Progress": "#f59e0b",
    Done: "#10b981",
  };

  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} fontSize={11} />
          <YAxis
            type="category"
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={72}
            fontSize={11}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const point = payload[0]?.payload as TaskDistributionPoint | undefined;
              const value = payload[0]?.value as number | undefined;

              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                  <div className="flex min-w-28 items-center justify-between gap-6 text-xs">
                    <span className="text-muted-foreground">{point?.label ?? ""}</span>
                    <span className="font-semibold">{value ?? 0}</span>
                  </div>
                </div>
              );
            }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 6, 6]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={barColorByLabel[entry.label] ?? "#9ca3af"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
