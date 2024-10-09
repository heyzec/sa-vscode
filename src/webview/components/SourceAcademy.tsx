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

  return (
    <>
      <div
        style={{
          width: "100%",
          // Account for some unexplainable margin
          height: "calc(100vh - 10px)",
        }}
      >
        <iframe
          id={FRONTEND_ELEMENT_ID}
          src="http://localhost:8000/playground"
          width="100%"
          height="100%"
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>
    </>
  );
}
export default SourceAcademy;
