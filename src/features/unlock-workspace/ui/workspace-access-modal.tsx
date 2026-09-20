"use client";

import {
  Button,
  ErrorMessage,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { AccessPurpose } from "../model/use-workspace-access";

type WorkspaceAccessModalProps = Readonly<{
  purpose: AccessPurpose;
  onClose: () => void;
  onUnlocked: () => void;
}>;

const purposeCopy: Record<
  AccessPurpose,
  { heading: string; lead: string; action: string }
> = {
  analysis: {
    heading: "Продолжить анализ",
    lead: "Вы использовали 5 бесплатных анализов за сегодня.",
    action: "Продолжить анализ",
  },
  chat: {
    heading: "Продолжить диалог",
    lead: "Вы использовали 5 бесплатных вопросов за сегодня.",
    action: "Продолжить диалог",
  },
};

export function WorkspaceAccessModal({
  purpose,
  onClose,
  onUnlocked,
}: WorkspaceAccessModalProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const copy = purposeCopy[purpose];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => undefined);
    if (response?.ok) {
      setCode("");
      setStatus("idle");
      onUnlocked();
      return;
    }
    setStatus("error");
  };

  return (
    <Modal.Root isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{copy.heading}</Modal.Heading>
              <Modal.CloseTrigger aria-label="Закрыть" />
            </Modal.Header>
            <Modal.Body>
              <p className="access-modal-copy">
                {copy.lead} Код доступа на сегодня повышает лимиты до 20
                анализов и 20 вопросов по всем вашим отчётам.
              </p>
              <form className="access-modal-form" noValidate onSubmit={submit}>
                <TextField
                  isInvalid={status === "error"}
                  value={code}
                  onChange={setCode}
                  isRequired
                >
                  <Label>Код доступа</Label>
                  <Input autoComplete="off" fullWidth variant="secondary" />
                  {status === "error" && (
                    <ErrorMessage>
                      Код не принят. Проверьте код на сегодня и повторите.
                    </ErrorMessage>
                  )}
                </TextField>
                <Button
                  type="submit"
                  isDisabled={status === "submitting" || !code.trim()}
                >
                  {status === "submitting" ? "Проверяем…" : copy.action}
                </Button>
              </form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
