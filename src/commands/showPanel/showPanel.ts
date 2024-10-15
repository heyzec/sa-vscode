import * as vscode from "vscode";
import { MessageType, TextMessage } from "../../utils/messages";
import { LANGUAGES } from "../../utils/languages";
import SourceAcademy, { handleTextUpdatedMessage } from "./SourceAcademy";

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
  panel.webview.html = getWebviewContent(context, panel);

  panel.webview.onDidReceiveMessage(
    (_message) => {
      sendEditorContents(activeEditor);
      vscode.workspace.onDidChangeTextDocument(() => sendEditorContents());
    },
    undefined,
    context.subscriptions,
  );
}


function getWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cat Coding</title>
    </head>
    <body>
      <div id="root"></div>
      ${SourceAcademy()}
    </body>
  </html>`;
}
