import * as vscode from "vscode";
import { getNonce } from "./nonce";

/**
 * Convenience function to set html content of a webview panel via JSX
 */
export function setWebviewContent(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  bodyHtml: JSX.Element,
) {
  // Use a nonce to whitelist which scripts can be run
  const nonce = getNonce();

  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "out", "webview.js"),
  );

  let fullhtml = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cat Coding</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      ${bodyHtml}
    </body>
  </html>`;
  panel.webview.html = fullhtml;
}
