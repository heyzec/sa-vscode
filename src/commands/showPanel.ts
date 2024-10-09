import * as vscode from "vscode";
import { MessageType, TextMessage } from "../utils/messages";
import { LANGUAGES, languageToChapter } from "../utils/languages";

export async function showPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "stepper",
    "Stepper",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true, // Enable scripts in the webview
    },
  );
  panel.webview.html = getWebviewContent(context, panel);

  let language: string | undefined = context.workspaceState.get("language");
  if (!language) {
    language = LANGUAGES.SOURCE_1;
  }

  function sendEditorContents() {
    const editor = vscode.window.activeTextEditor;
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
    panel.webview.postMessage(message);
  }
  panel.webview.onDidReceiveMessage(
    (_message) => {
      vscode.workspace.onDidChangeTextDocument(sendEditorContents);
      sendEditorContents();
    },
    undefined,
    context.subscriptions,
  );
}

function getNonce(): string {
  let text: string = "";
  const possible: string =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
) {
  // Use a nonce to whitelist which scripts can be run
  const nonce = getNonce();

  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "out", "webview.js"),
  );

  // <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src *; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cat Coding</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
    </body>
  </html>`;
}
