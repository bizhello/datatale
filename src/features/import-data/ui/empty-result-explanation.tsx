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
        Источник проверяется в браузере. AI выбирает ключевые выводы и
        подходящие графики. Для таблиц приложение рассчитывает значения по всем
        строкам, а для текста показывает точные цитаты из источника.
      </p>
    </aside>
  );
}
