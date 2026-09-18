import {
  Button,
  Description,
  Label,
  Surface,
  TextArea,
  TextField,
} from "@heroui/react";
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
      <Surface className="text-input">
        <span className="input-icon">
          <FileText aria-hidden="true" />
        </span>
        <h2>Или вставьте текст</h2>
        <TextField
          fullWidth
          name="source-text"
          value={text}
          onChange={onChangeText}
          variant="secondary"
        >
          <Label>Текст отчёта</Label>
          <TextArea
            id="source-text"
            placeholder="Вставьте короткий отчёт или заметки…"
          />
          <Description>
            {text.length.toLocaleString("ru-RU")} / 30 000
          </Description>
        </TextField>
        <div className="text-actions">
          <Button variant="secondary" onPress={onAcceptText}>
            Проверить текст
          </Button>
        </div>
      </Surface>
    </div>
  );
}
