"use client";

import { useCallback, useRef, useState } from "react";

export type AccessPurpose = "analysis" | "chat";

export function useWorkspaceAccess() {
  const [purpose, setPurpose] = useState<AccessPurpose>();
  const resumeRef = useRef<(() => void) | null>(null);

  const requestAccess = useCallback(
    (nextPurpose: AccessPurpose, resume: () => void) => {
      resumeRef.current = resume;
      setPurpose(nextPurpose);
    },
    [],
  );

  const close = useCallback(() => {
    resumeRef.current = null;
    setPurpose(undefined);
  }, []);
  const unlocked = useCallback(() => {
    const resume = resumeRef.current;
    resumeRef.current = null;
    setPurpose(undefined);
    resume?.();
  }, []);

  return {
    purpose,
    requestAccess,
    modalProps: purpose
      ? { purpose, onClose: close, onUnlocked: unlocked }
      : null,
  };
}
