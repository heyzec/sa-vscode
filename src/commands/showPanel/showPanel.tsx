import * as vscode from "vscode";
import { MessageType, TextMessage } from "../../utils/messages";
import { LANGUAGES } from "../../utils/languages";
import { createElement } from "../../FakeReact";

const FRONTEND_ELEMENT_ID = "frontend";

export async function showPanel(context: vscode.ExtensionContext) {
  let language: string | undefined = context.workspaceState.get("language");
  if (!language) {
    language = LANGUAGES.SOURCE_1;
  }

  function sendEditorContents(editor?: vscode.TextEditor) {
    if (!editor) {
      editor = vscode.window.activeTextEditor;
    }
    if (!editor) {
      vscode.window.showErrorMessage("Please open an active editor!");
      return;
    }
    // Get text from active document and send it to Ace Editor in the frontend
    const text = editor.document.getText();
    const message: TextMessage = {
      type: MessageType.TextMessage,
      code: text,
    };
    handleTextUpdatedMessage(message);
    panel.webview.postMessage(message);
  }

  // Get a reference to the active editor (before the focus is switched to our newly created webview)
  const activeEditor = vscode.window.activeTextEditor;

  const panel = vscode.window.createWebviewPanel(
    "source-academy-panel",
    "Source Academy",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true, // Enable scripts in the webview
    },
  );

  panel.webview.onDidReceiveMessage(
    (_message) => {
      sendEditorContents(activeEditor);
      vscode.workspace.onDidChangeTextDocument(() => sendEditorContents());
    },
    undefined,
    context.subscriptions,
  );

  setWebviewContent(
    panel,
    <body>
      <div id="root"></div>
      {/* @ts-expect-error */}
      <div style={"width: 100%; height: calc(100vh - 10px);"}>
        <iframe
          id={FRONTEND_ELEMENT_ID}
          src="http://localhost:8000/playground"
          width="100%"
          height="100%"
          // @ts-expect-error
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>
    </body>,
  );
}

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

function setWebviewContent(panel: vscode.WebviewPanel, bodyHtml: JSX.Element) {
  const fullhtml = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${panel.title}</title>
    </head>
      ${bodyHtml}
  </html>`;
  panel.webview.html = fullhtml;
}
