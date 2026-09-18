"use client";

import { Button } from "@heroui/react";
import {
  ArrowDown,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  Layers3,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const stages = [
  {
    number: "01",
    title: "Добавьте контекст",
    text: "CSV, Excel или обычный текст — всё начинается с ваших данных.",
  },
  {
    number: "02",
    title: "Увидьте главное",
    text: "Ключевой вывод и графики, которые помогают его понять.",
  },
  {
    number: "03",
    title: "Спросите глубже",
    text: "Ответы с опорой на источник. Без догадок за пределами отчёта.",
  },
];

export function DashboardShell() {
  const [showPlan, setShowPlan] = useState(false);
  return (
    <div className="page-shell">
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="DataTale — главная">
          <span className="brand-icon">
            <ChartNoAxesCombined size={21} aria-hidden="true" />
          </span>
          datatale<span className="brand-dot">.</span>
        </Link>
        <span className="status-badge">
          <span aria-hidden="true" />
          Основа проекта · v0.1
        </span>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <Sparkles size={15} aria-hidden="true" /> МЕНЬШЕ ТАБЛИЦ. БОЛЬШЕ
              СМЫСЛА.
            </p>
            <h1 id="hero-title">
              У ваших данных
              <br />
              есть <span>история.</span>
            </h1>
            <p className="hero-description">
              Превращайте сырые отчёты в ясные выводы, выразительные графики и
              ответы, которым можно доверять.
            </p>
            <Button
              size="lg"
              onPress={() => setShowPlan(!showPlan)}
              aria-expanded={showPlan}
              aria-controls="project-plan"
            >
              {showPlan ? "Скрыть план MVP" : "Посмотреть план MVP"}
              <ArrowDown size={17} aria-hidden="true" />
            </Button>
            <p className="foundation-note">
              Next.js + HeroUI готовы. Анализ данных — следующий этап.
            </p>
          </div>
          <article className="insight-preview" aria-labelledby="preview-title">
            <div className="preview-top">
              <span>
                <Sparkles size={15} aria-hidden="true" /> Главный инсайт
              </span>
              <span className="demo-label">Пример · не AI-анализ</span>
            </div>
            <h2 id="preview-title">
              На ревью — 8 задач.
              <br />
              Из двадцати.
            </h2>
            <p>
              В демонстрационном наборе 8 из 20 задач находятся на ревью. Это
              40% всей выборки — повод проверить, хватает ли команде времени на
              проверку.
            </p>
            <div className="preview-metric">
              <strong>
                40<span>%</span>
              </strong>
              <span>
                задач на ревью
                <br />
                <small>8 из 20 в примере</small>
              </span>
            </div>
            <div className="preview-footer">
              <Check size={15} aria-hidden="true" /> Вывод начинается с
              проверяемого факта
            </div>
          </article>
        </section>
        <section className="journey" aria-label="Запланированный сценарий">
          {stages.map((stage) => (
            <article key={stage.number}>
              <span className="stage-number">{stage.number}</span>
              <h2>{stage.title}</h2>
              <p>{stage.text}</p>
            </article>
          ))}
        </section>
        <section id="project-plan" className="project-plan" hidden={!showPlan}>
          <div>
            <Layers3 size={22} aria-hidden="true" />
            <h2>Следующий шаг — один законченный сценарий</h2>
          </div>
          <p>
            Загрузка → проверка данных → AI-инсайт и 2–3 графика → чат с
            источниками. Сначала рабочая вертикаль, затем полировка.
          </p>
          <p>
            Решения и альтернативы: <code>DECISIONS.md</code>. Порядок
            реализации: <code>docs/DELIVERY.md</code>.
          </p>
        </section>
      </main>
      <footer>
        <span>DataTale / From data to a point of view</span>
        <span>
          Основа для MVP <ArrowUpRight size={14} aria-hidden="true" />
        </span>
      </footer>
    </div>
  );
}
