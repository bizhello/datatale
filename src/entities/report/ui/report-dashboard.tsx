"use client";
import { Button, Modal, Tooltip } from "@heroui/react";
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
                <Tooltip delay={0}>
                  <Button
                    isIconOnly
                    aria-label={`Развернуть ${chart.title}`}
                    onPress={() => setExpanded(chart)}
                  >
                    <Expand aria-hidden="true" />
                  </Button>
                  <Tooltip.Content>Развернуть диаграмму</Tooltip.Content>
                </Tooltip>
              </div>
              <div className="chart-visual">
                <ChartVisual chart={chart} />
              </div>
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
      {report.recommendations.length > 0 && (
        <section
          className="recommendations"
          aria-labelledby="recommendations-title"
        >
          <p className="eyebrow">СЛЕДУЮЩИЙ ШАГ</p>
          <h3 id="recommendations-title">Рекомендации</h3>
          {report.recommendations.map((item) => (
            <article
              key={`${item.text}-${item.factIds[0] ?? item.evidenceIds[0] ?? "grounded"}`}
            >
              <strong>Действие</strong>
              <p className="recommendation-copy">{item.text}</p>
            </article>
          ))}
        </section>
      )}
      {expanded && (
        <Modal.Root
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setExpanded(undefined);
          }}
        >
          <Modal.Backdrop>
            <Modal.Container className="chart-modal" size="lg">
              <Modal.Dialog>
                <Modal.Header>
                  <Modal.Heading>{expanded.title}</Modal.Heading>
                  <Modal.CloseTrigger aria-label="Закрыть">
                    <X />
                  </Modal.CloseTrigger>
                </Modal.Header>
                <Modal.Body>
                  <div className="chart-modal-visual">
                    <ChartVisual chart={expanded} />
                  </div>
                  <p>{expanded.rationale}</p>
                  <p>
                    {expanded.unit
                      ? `Единицы: ${expanded.unit}`
                      : "Единицы: значение источника"}
                  </p>
                  <section
                    className="chart-modal-evidence"
                    aria-labelledby="chart-modal-evidence-title"
                  >
                    <h3 id="chart-modal-evidence-title">Основание графика</h3>
                    <ul>
                      {expanded.evidenceIds.map((evidenceId) => {
                        const evidence = report.evidence.find(
                          (item) => item.id === evidenceId,
                        );
                        return evidence ? (
                          <li key={evidence.id}>
                            <strong>{evidence.label}</strong>
                            {evidence.excerpt ? `: ${evidence.excerpt}` : ""}
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </section>
                  <table className="chart-table">
                    <caption>Данные диаграммы {expanded.title}</caption>
                    <tbody>
                      {expanded.points.map((point) => (
                        <tr key={point.label}>
                          <th>{point.label}</th>
                          <td>
                            {point.value.toLocaleString("ru-RU", {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal.Root>
      )}
    </section>
  );
}
