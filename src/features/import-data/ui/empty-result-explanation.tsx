"use client";

export function EmptyResultExplanation() {
  return (
    <aside
      className="empty-result-explanation"
      aria-label="Как работает анализ"
    >
      <p className="eyebrow">ПОСЛЕ ПРОВЕРКИ ИСТОЧНИКА</p>
      <h2>Понятный отчёт из ваших данных.</h2>
      <p>
        Сначала источник проверяется в браузере. Затем AI предлагает структуру
        анализа, а расчёты и доказательства проверяются кодом.
      </p>
    </aside>
  );
}
