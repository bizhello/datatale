"use client";

import { ArrowUpRight, TrendingUp } from "lucide-react";

export function LiquidResultPreview() {
  return (
    <aside className="liquid-result-preview" aria-label="Пример результата">
      <div className="liquid-preview-glow" aria-hidden="true" />
      <div className="liquid-preview-heading">
        <span className="eyebrow">ПРИМЕР РЕЗУЛЬТАТА</span>
        <ArrowUpRight size={18} aria-hidden="true" />
      </div>
      <p className="liquid-preview-insight">
        Онлайн-канал растёт и ведёт общую выручку.
      </p>
      <div className="liquid-preview-footer">
        <div>
          <span>Выручка</span>
          <strong>274 000 ₽</strong>
        </div>
        <div className="liquid-mini-chart" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <TrendingUp size={16} />
        </div>
      </div>
      <p className="liquid-preview-note">
        Синтетические данные · без AI-запроса
      </p>
    </aside>
  );
}
