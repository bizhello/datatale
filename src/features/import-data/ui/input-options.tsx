import { Button } from "@heroui/react";
import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import type { DropzoneState } from "react-dropzone";

type InputOptionsProps = {
  text: string;
  onChangeText: (text: string) => void;
  onAcceptText: () => void;
  dropzone: Pick<
    DropzoneState,
    "getRootProps" | "getInputProps" | "isDragActive"
  >;
};

export function InputOptions({
  text,
  onChangeText,
  onAcceptText,
  dropzone,
}: InputOptionsProps) {
  return (
    <div className="input-grid">
      <div
        {...dropzone.getRootProps({
          className: `dropzone ${dropzone.isDragActive ? "dropzone-active" : ""}`,
        })}
      >
        <input
          {...dropzone.getInputProps()}
          aria-label="Выбрать CSV или XLSX файл"
        />
        <span className="input-icon">
          <Upload aria-hidden="true" />
        </span>
        <h2>CSV или Excel</h2>
        <p>Перетащите файл сюда или выберите его. До 2 МБ, до 5 000 строк.</p>
        <Button variant="secondary">
          <FileSpreadsheet /> Выбрать файл
        </Button>
        <small>XLS нужно сохранить как XLSX</small>
      </div>
      <div className="text-input">
        <span className="input-icon">
          <FileText aria-hidden="true" />
        </span>
        <h2>Или вставьте текст</h2>
        <label htmlFor="source-text">Текст отчёта</label>
        <textarea
          id="source-text"
          value={text}
          onChange={(event) => onChangeText(event.target.value)}
          placeholder="Вставьте короткий отчёт или заметки…"
        />
        <div>
          <span>{text.length.toLocaleString("ru-RU")} / 30 000</span>
          <Button variant="secondary" onPress={onAcceptText}>
            Проверить текст
          </Button>
        </div>
      </div>
    </div>
  );
}
