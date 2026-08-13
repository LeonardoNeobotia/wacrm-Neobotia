"use client";

import React, { useState, Fragment } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, MessageSquare, Smile, Frown, Meh } from "lucide-react";
import { cn } from "@/lib/utils";

interface SentimentStats {
  positive: number;
  neutral: number;
  negative: number;
}

interface WordCount {
  text: string;
  value: number;
}

interface ClientMessage {
  id: string;
  text: string;
  sentiment: string;
  created_at: string;
  sender_type: string;
}

interface ClientData {
  contact: {
    id: string;
    name: string;
    phone: string;
  };
  conversation_id: string;
  stats: SentimentStats;
  recent_messages: ClientMessage[];
}

interface SentimentDashboardProps {
  stats: SentimentStats;
  wordCloud: WordCount[];
  clients: ClientData[];
}

const COLORS = {
  positive: "hsl(var(--chart-2))", // typically teal/green
  neutral: "hsl(var(--chart-1))", // typically blue/gray
  negative: "hsl(var(--chart-5))", // typically red/rose
};

export default function SentimentDashboard({
  stats,
  wordCloud,
  clients,
}: SentimentDashboardProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  const totalMessages = stats.positive + stats.neutral + stats.negative;

  const pieData = [
    { name: "Positivos", value: stats.positive, color: COLORS.positive },
    { name: "Neutros", value: stats.neutral, color: COLORS.neutral },
    { name: "Negativos", value: stats.negative, color: COLORS.negative },
  ].filter((d) => d.value > 0);

  // Normalize word cloud sizes
  const maxWordVal = Math.max(...wordCloud.map((w) => w.value), 1);
  const minWordVal = Math.min(...wordCloud.map((w) => w.value), 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-t-4 border-t-emerald-500 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Positivos</CardTitle>
            <Smile className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.positive}</div>
            <p className="text-xs text-muted-foreground">
              Mensajes con sentimiento positivo
            </p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-slate-400 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Neutros</CardTitle>
            <Meh className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.neutral}</div>
            <p className="text-xs text-muted-foreground">
              Mensajes informativos o neutros
            </p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-rose-500 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Negativos</CardTitle>
            <Frown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.negative}</div>
            <p className="text-xs text-muted-foreground">
              Mensajes con quejas o enojo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Distribución de Sentimientos</CardTitle>
            <CardDescription>
              Proporción global de estados de ánimo.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {totalMessages > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No hay suficientes datos.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Nube de Palabras</CardTitle>
            <CardDescription>
              Términos más frecuentes en los mensajes de tus clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center overflow-hidden">
            {wordCloud.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-4 p-4">
                {wordCloud.map((word, i) => {
                  // Calculate font size between 14px and 40px
                  const size = 14 + ((word.value - minWordVal) / (maxWordVal - minWordVal)) * 26;
                  // Alternate some colors for visual flair
                  const opacity = 0.5 + ((word.value - minWordVal) / (maxWordVal - minWordVal)) * 0.5;
                  return (
                    <span
                      key={i}
                      style={{
                        fontSize: `${Math.round(size)}px`,
                        opacity: opacity,
                        transition: "all 0.3s ease",
                      }}
                      className="font-bold text-primary hover:scale-110 cursor-default"
                      title={`${word.text} (${word.value} veces)`}
                    >
                      {word.text}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground">
                No hay suficientes palabras para analizar.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Historial por Cliente</CardTitle>
          <CardDescription>
            Revisa los sentimientos de las interacciones recientes cliente por
            cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Cliente</TableHead>
                  <TableHead>Progresión de Sentimientos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">
                      No hay mensajes analizados todavía.
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((c) => {
                    const isExpanded = expandedRows.has(c.contact.id);
                    const total =
                      c.stats.positive + c.stats.neutral + c.stats.negative;
                    const posPct = (c.stats.positive / total) * 100;
                    const neuPct = (c.stats.neutral / total) * 100;
                    const negPct = (c.stats.negative / total) * 100;

                    return (
                      <Fragment key={c.contact.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleRow(c.contact.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>
                                {c.contact.name || "Cliente Desconocido"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {c.contact.phone}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 w-full max-w-md">
                              <div className="flex text-[10px] text-muted-foreground justify-between">
                                <span>{total} mensajes</span>
                                <span>
                                  {c.stats.positive} 😊 | {c.stats.neutral} 😐 |{" "}
                                  {c.stats.negative} 😡
                                </span>
                              </div>
                              <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="bg-emerald-500"
                                  style={{ width: `${posPct}%` }}
                                  title={`Positivos: ${c.stats.positive}`}
                                />
                                <div
                                  className="bg-slate-400"
                                  style={{ width: `${neuPct}%` }}
                                  title={`Neutros: ${c.stats.neutral}`}
                                />
                                <div
                                  className="bg-rose-500"
                                  style={{ width: `${negPct}%` }}
                                  title={`Negativos: ${c.stats.negative}`}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(c.contact.id);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Chat View */}
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={3} className="p-0 border-b">
                              <div className="p-4 bg-background border-y shadow-inner max-h-[400px] overflow-y-auto">
                                <div className="flex flex-col space-y-4 max-w-3xl mx-auto py-2">
                                  {c.recent_messages
                                    .slice()
                                    .reverse()
                                    .map((msg) => {
                                      const isAgent =
                                        msg.sender_type === "agent" ||
                                        msg.sender_type === "bot";
                                      
                                      let emoji = "😐";
                                      let colorClass = "text-slate-400";
                                      if (msg.sentiment === "positive") {
                                        emoji = "😊";
                                        colorClass = "text-emerald-500";
                                      } else if (msg.sentiment === "negative") {
                                        emoji = "😡";
                                        colorClass = "text-rose-500";
                                      }

                                      return (
                                        <div
                                          key={msg.id}
                                          className={cn(
                                            "flex flex-col max-w-[80%]",
                                            isAgent
                                              ? "self-end items-end"
                                              : "self-start items-start"
                                          )}
                                        >
                                          <div
                                            className={cn(
                                              "relative rounded-2xl px-4 py-2 text-sm shadow-sm",
                                              isAgent
                                                ? "rounded-br-sm bg-primary text-primary-foreground"
                                                : "rounded-bl-sm bg-muted text-foreground border"
                                            )}
                                          >
                                            <p className="whitespace-pre-wrap break-words">
                                              {msg.text || "[Mensaje multimedia]"}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground px-1">
                                            <span>
                                              {msg.created_at
                                                ? format(
                                                    new Date(msg.created_at),
                                                    "HH:mm"
                                                  )
                                                : ""}
                                            </span>
                                            {!isAgent && msg.sentiment && (
                                              <span
                                                className={cn("font-bold ml-1 flex items-center gap-1", colorClass)}
                                                title={msg.sentiment}
                                              >
                                                {emoji}
                                              </span>
                                            )}
                                            {isAgent && (
                                              <span className="opacity-70 ml-1">
                                                {msg.sender_type === 'bot' ? '🤖 Bot' : '👨‍💻 Agente'}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
