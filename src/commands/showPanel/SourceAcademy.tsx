import { TextMessage } from "../../utils/messages";

const FRONTEND_ELEMENT_ID = "frontend";

export function handleTextUpdatedMessage(message: TextMessage) {
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

function SourceAcademy() {
  // style: height: Account for some unexplainable margin
  return `
    <div
      style="width: 100%; height: calc(100vh - 10px);"
    >
      <iframe
        id=${FRONTEND_ELEMENT_ID}
        src="http://localhost:8000/playground"
        width="100%"
        height="100%"
        frameborder="0"
        allowfullscreen
      ></iframe>
    </div>
  `;
}
export default SourceAcademy;
