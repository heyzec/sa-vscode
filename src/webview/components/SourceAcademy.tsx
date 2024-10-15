import React, { useEffect } from "react";
import { Message, MessageType, TextMessage } from "../../utils/messages";

const FRONTEND_ELEMENT_ID = "frontend";

function handleTextUpdatedMessage(message: TextMessage) {
  const iframe: HTMLIFrameElement = document.getElementById(
    FRONTEND_ELEMENT_ID,
  ) as HTMLIFrameElement;
  const contentWindow = iframe.contentWindow;
  if (!contentWindow) {
    return;
  }
  // TODO: Don't use '*'
  console.log("Posting message to frontend");
  contentWindow.postMessage(message.code, "*");
}

function messageListener(event: MessageEvent) {
  const message: Message = event.data;
  switch (message.type) {
    case MessageType.TextMessage:
      handleTextUpdatedMessage(message as TextMessage);
      break;
  }
}

function SourceAcademy() {
  useEffect(() => {
    window.addEventListener("message", messageListener);
    return () => {
      window.removeEventListener("message", messageListener);
    };
  }, []);

  return <></>;
}
export default SourceAcademy;
