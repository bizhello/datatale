import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAccessModal } from "./workspace-access-modal";

afterEach(() => vi.unstubAllGlobals());

describe("WorkspaceAccessModal", () => {
  it("keeps work paused after an invalid code", async () => {
    const onUnlocked = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ code: "invalid-code" }, { status: 401 }),
      ),
    );
    render(
      <WorkspaceAccessModal
        purpose="chat"
        onClose={vi.fn()}
        onUnlocked={onUnlocked}
      />,
    );

    fireEvent.change(screen.getByLabelText("Код доступа"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Продолжить диалог" }));

    expect(
      await screen.findByText(
        "Код не принят. Проверьте код на сегодня и повторите.",
      ),
    ).toBeVisible();
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it("resumes the pending action only after successful unlock", async () => {
    const onUnlocked = vi.fn();
    const fetch = vi.fn(async () => Response.json({ unlocked: true }));
    vi.stubGlobal("fetch", fetch);
    render(
      <WorkspaceAccessModal
        purpose="analysis"
        onClose={vi.fn()}
        onUnlocked={onUnlocked}
      />,
    );

    expect(screen.getByText(/5 бесплатных анализов/)).toBeVisible();
    expect(screen.getByText(/20 анализов и 20 вопросов/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Код доступа"), {
      target: { value: "DT-20260920-example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Продолжить анализ" }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/access",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "DT-20260920-example" }),
      }),
    );
  });
});
