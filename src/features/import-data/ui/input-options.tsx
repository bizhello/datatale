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
    "getRootProps" | "getInputProps" | "isDragActive" | "open"
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
        <div className="input-card-content">
          <span className="input-icon">
            <Upload aria-hidden="true" />
          </span>
          <div className="input-card-copy">
            <h2>CSV или Excel</h2>
            <p>
              Перетащите файл сюда или выберите его. До 2 МБ, до 5 000 строк.
            </p>
            <small>XLS нужно сохранить как XLSX</small>
          </div>
        </div>
        <div className="input-card-action">
          <Button type="button" variant="secondary" onPress={dropzone.open}>
            <FileSpreadsheet /> Выбрать файл
          </Button>
        </div>
      </div>
      <Surface className="text-input" id="onboarding-text-input">
        <div className="input-card-content">
          <span className="input-icon">
            <FileText aria-hidden="true" />
          </span>
          <div className="input-card-copy">
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
          </div>
        </div>
        <div className="input-card-action text-actions">
          <Button variant="secondary" onPress={onAcceptText}>
            Проверить текст
          </Button>
        </div>
      </Surface>
    </div>
  );
}
