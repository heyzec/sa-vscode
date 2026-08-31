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
import { MessageHandler } from "./utils/messageHandler";
import { sendToFrontendWrapped } from "./commands/showPanel";
import Messages from "./utils/messages";

// TODO: Don't expose this object directly, create an interface via a wrapper class
export let client: LanguageClient;

export let SOURCE_ACADEMY_ICON_URI: vscode.Uri;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  setupTreeView(context);
  registerAllCommands(context);

  context.subscriptions.push(setupStatusBar(context));

  client = activateLspClient(context);

  // const info = {
  //   "file:///home/heyzec/.sourceacademy/playground_1.js": { chapter: 4 },
  // };
  const info = context.globalState.get("info") ?? {};

  client.sendRequest("source/publishInfo", info);

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

  const debugConfig = vscode.workspace.getConfiguration('debug');
  try {
    if (debugConfig.get("allowBreakpointsEverywhere") === false) {
      debugConfig.update("allowBreakpointsEverywhere", true, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('Successfully set "debug.allowBreakpointsEverywhere" to true in your user settings.');
    }

} catch (error) {
    // Handle potential errors, e.g., if settings can't be written.
    console.error(error);
    vscode.window.showErrorMessage([
      'Failed to set "debug.allowBreakpointsEverywhere" to true in your user settings.',
      'Please manually set this to true to be able to use the CSE Machine'
      ].join(" "));
}

  
  let messageHandler = MessageHandler.getInstance()
  // we use this map to track breakpoints
  // breakpoint instances are the same even when they are moved
  const m = new Map<vscode.SourceBreakpoint, number>()
  const handle_breakpoints = (breakpoint: vscode.Breakpoint, add: boolean) => {
    if (!(breakpoint instanceof vscode.SourceBreakpoint)) {
      return
    }
    const line = breakpoint.location.range.start.line
    const editor = messageHandler.activeEditor
    if (editor && editor.uri.toString() === breakpoint.location.uri.toString()) {
      // Check for change
      if (m.has(breakpoint) && add) {
        delete editor.breakpoints[m.get(breakpoint)!]
        editor.breakpoints[line] = "ace_breakpoint"
        m.set(breakpoint, line)
      }
      else {
        if (add) {
          m.set(breakpoint, line);
          editor.breakpoints[line] = "ace_breakpoint";
        }
        else {
          m.delete(breakpoint)
          delete editor.breakpoints[line];
        }
      }
    }
  }

  vscode.debug.onDidChangeBreakpoints((e: vscode.BreakpointsChangeEvent) => {
    e.added.map(b => handle_breakpoints(b, true))
    e.removed.map(b => handle_breakpoints(b, false))
    e.changed.map(b => handle_breakpoints(b, true))
    const editor = messageHandler.activeEditor;
    if (editor)
      sendToFrontendWrapped(Messages.SetEditorBreakpoints(editor.workspaceLocation, editor.breakpoints))
  })
}

// This method is called when your extension is deactivated
export function deactivate() {
  deactivateLspClient();
}
