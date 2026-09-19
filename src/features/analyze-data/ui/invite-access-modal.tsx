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

type InviteAccessModalProps = Readonly<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: () => void;
}>;

export function InviteAccessModal({
  isOpen,
  onOpenChange,
  onUnlocked,
}: InviteAccessModalProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
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
      onOpenChange(false);
      onUnlocked();
      return;
    }
    setStatus("error");
  };
  return (
    <Modal.Root isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Продолжить анализ</Modal.Heading>
              <Modal.CloseTrigger aria-label="Закрыть" />
            </Modal.Header>
            <Modal.Body>
              <p>
                Бесплатный анализ на сегодня уже использован. Введите код
                приглашения, чтобы продолжить.
              </p>
              <form noValidate onSubmit={submit}>
                <TextField
                  isInvalid={status === "error"}
                  value={code}
                  onChange={setCode}
                  isRequired
                >
                  <Label>Код приглашения</Label>
                  <Input autoComplete="off" />
                  {status === "error" && (
                    <ErrorMessage>
                      Код не принят. Проверьте его и повторите.
                    </ErrorMessage>
                  )}
                </TextField>
                <Button type="submit" isDisabled={status === "submitting"}>
                  {status === "submitting"
                    ? "Проверяем…"
                    : "Разблокировать анализ"}
                </Button>
              </form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
