"use client";
import { Button, Modal } from "@heroui/react";
import { Expand, X } from "lucide-react";
import { useState } from "react";
import type { FinalReport } from "../model/schema";
import { ChartVisual } from "./chart-visual";

type ReportDashboardProps = { report: FinalReport };
export function ReportDashboard({ report }: ReportDashboardProps) {
  const [expanded, setExpanded] = useState<
    FinalReport["charts"][number] | undefined
  >();
  return (
    <section className="report-dashboard" aria-labelledby="report-title">
      <div className="report-hero">
        <p className="eyebrow">ПРОВЕРЕННЫЙ АНАЛИЗ</p>
        <h2 id="report-title">
          {report.hero.map((item) => item.text).join(" ")}
        </h2>
      </div>
      <div className="metric-grid">
        {report.metrics.map((metric) => (
          <article className="metric-card" key={metric.id}>
            <span>{metric.label}</span>
            <strong>
              {metric.value.toLocaleString("ru-RU", {
                maximumFractionDigits: 2,
              })}
            </strong>
            <small>{metric.unit ?? "по всем строкам"}</small>
          </article>
        ))}
      </div>
      {report.charts.length ? (
        <div className="chart-grid">
          {report.charts.map((chart) => (
            <article className="chart-card" key={chart.id}>
              <div className="chart-heading">
                <div>
                  <h3>{chart.title}</h3>
                  <p>{chart.rationale}</p>
                </div>
                <Button
                  isIconOnly
                  aria-label={`Развернуть ${chart.title}`}
                  onPress={() => setExpanded(chart)}
                >
                  <Expand />
                </Button>
              </div>
              <ChartVisual chart={chart} />
              <table>
                <caption className="sr-only">
                  Табличное представление {chart.title}
                </caption>
                <tbody>
                  {chart.points.map((point) => (
                    <tr key={point.label}>
                      <th>{point.label}</th>
                      <td>{point.value.toLocaleString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      ) : (
        <p className="no-chart" role="status">
          {report.noChartReason}
        </p>
      )}
      <section className="evidence">
        <h3>Основание вывода</h3>
        {report.evidence.map((item) => (
          <p key={item.id}>
            <strong>{item.label}</strong>
            {item.excerpt ? `: ${item.excerpt}` : ""}
          </p>
        ))}
      </section>
      {expanded && (
        <Modal.Root
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setExpanded(undefined);
          }}
        >
          <Modal.Backdrop>
            <Modal.Container size="lg">
              <Modal.Dialog>
                <Modal.Header>
                  <Modal.Heading>{expanded.title}</Modal.Heading>
                  <Modal.CloseTrigger aria-label="Закрыть">
                    <X />
                  </Modal.CloseTrigger>
                </Modal.Header>
                <Modal.Body>
                  <ChartVisual chart={expanded} />
                  <p>{expanded.rationale}</p>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal.Root>
      )}
    </section>
  );
}
