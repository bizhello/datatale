import type { ImportAction, ImportState } from "./import-workspace-state";

export function importWorkspaceReducer(
  state: ImportState,
  action: ImportAction,
): ImportState {
  switch (action.type) {
    case "text":
      return { status: "empty", text: action.text };
    case "start":
      return {
        status: "loading",
        text: state.text,
        file: action.file,
        requestId: action.requestId,
        selectingSheet: action.selectingSheet,
      };
    case "ready":
      return action.requestId !== undefined &&
        state.status === "loading" &&
        state.requestId !== action.requestId
        ? state
        : action.state;
    case "error":
      return state.status === "loading" && state.requestId === action.requestId
        ? {
            status: "error",
            text: state.text,
            file: state.file,
            message: action.message,
            sheetNames: action.sheetNames,
          }
        : state;
    case "local-error":
      return { status: "error", text: state.text, message: action.message };
    case "file-error":
      return {
        status: "error",
        text: state.text,
        file: action.file,
        message: action.message,
      };
    case "empty":
      return { status: "empty", text: "" };
    case "cancel":
      return { status: "empty", text: state.text };
  }
}
