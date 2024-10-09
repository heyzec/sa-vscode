import React, { useEffect } from "react";
import SourceAcademy from "./components/SourceAcademy";
import { MessageType, WebviewStartedMessage } from "../utils/messages";

function App() {
  // This function is provided by vscode extension
  // @ts-expect-error: Cannot find name 'acquireVsCodeApi'.ts(2304)
  const vscode = acquireVsCodeApi();

  useEffect(() => {
    const message: WebviewStartedMessage = {
      type: MessageType.WebviewStartedMessage,
    };
    vscode.postMessage(message);
  });

  return <SourceAcademy />;
}
export default App;
