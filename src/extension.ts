// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { setupTreeView } from "./treeview";
import { setupStatusBar } from "./statusbar/status";
import { registerAllCommands } from "./commands";
import { activateLspClient, deactivateLspClient } from "./lsp/client";
import { LanguageClient } from "vscode-languageclient/node";
import { canonicaliseLocation } from "./utils/misc";
import config from "./utils/config";

// TODO: Don't expose this object directly, create an interface via a wrapper class
export let client: LanguageClient;

export let SOURCE_ACADEMY_ICON_URI: vscode.Uri;

// Shared output channel for logging diagnostic messages
let outputChannel: vscode.OutputChannel;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Initialise output channel early so all parts can use it
  outputChannel = vscode.window.createOutputChannel("Source Academy");
  context.subscriptions.push(outputChannel);

  // Validate user-provided settings up-front
  try {
    new URL(config.frontendBaseUrl);
  } catch {
    vscode.window.showErrorMessage(
      "Source Academy: Invalid Frontend URL in settings (source-academy.frontendBaseUrl).",
    );
  }
  setupTreeView(context);
  registerAllCommands(context);

  context.subscriptions.push(setupStatusBar(context));

  try {
    client = activateLspClient(context);
  } catch (e: any) {
    vscode.window.showErrorMessage(
      "Source Academy: Failed to start language server – " + (e?.message ?? e),
    );
    outputChannel.appendLine(String(e?.stack ?? e));
    throw e; // rethrow so VS Code knows activation failed
  }

  // const info = {
  //   "file:///home/heyzec/.sourceacademy/playground_1.js": { chapter: 4 },
  // };
  const info = context.globalState.get("info") ?? {};

  try {
    client.sendRequest("source/publishInfo", info);
  } catch (e: any) {
    outputChannel.appendLine(
      "Error sending initial info to language server: " + String(e),
    );
  }

  SOURCE_ACADEMY_ICON_URI = vscode.Uri.joinPath(
    context.extensionUri,
    "assets",
    "icon.svg",
  );

  // TODO: Prompt the user to make this folder the default, and then set back to the config store.

  // Update user's workspace settings to associate .js to Source
  const workspaceFolder = canonicaliseLocation(config.workspaceFolder);
  if (
    vscode.workspace.workspaceFolders
      ?.map((wf) => wf.uri.fsPath)
      .includes(workspaceFolder)
  ) {
    const workspaceConfig = vscode.workspace.getConfiguration();
    workspaceConfig.update("files.associations", {
      "*.js": "source",
    });
  }

  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      const searchParams = new URLSearchParams(uri.query);

      const code = searchParams.get("code");
      // The following params are available conditionally based on provider
      const clientRequestId = searchParams.get("client-request-id"); // OAuth (NUS's IdP)
      const provider = searchParams.get("provider"); // SAML

      let route, url;
      if (clientRequestId) {
        // OAuth
        route = `/login/vscode_callback?code=${code}&client-request-id=${clientRequestId}`;
        url = null;
      } else if (provider) {
        // SAML
        route = null;
        // TODO: Let the frontend handle the contacting of backend, instead of us.
        // Then, remove backendBaseUrl from schema and altUrl from showPanel
        url = `${config.backendBaseUrl}/v2/auth/exchange?code=${code}&provider=${provider}`;
      }

      vscode.commands.executeCommand("source-academy.show-panel", route, url);
    },
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  deactivateLspClient();
}
