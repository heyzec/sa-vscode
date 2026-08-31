import * as vscode from "vscode";
// Allow using JSX within this file by overriding our own createElement function
import React from "./FakeReact";
import ReactDOMServer from "react-dom/server";

import Messages, {
  MessageType,
  MessageTypeNames,
  sendToFrontend,
} from "./messages";
import { setWebviewContent } from "./webview";
import { Editor } from "./editor";
import { client } from "../extension";
import _ from "lodash";
import { treeDataProvider } from "../treeview";
import McqPanel from "../webview/components/McqPanel";
import { codeRemovePrepend, getNumPrependLines } from "./editorUtils";

/*
 * MessageHandler is a singleton class that handles messages from the frontend
 * and manages the state of the webview panels.
 * Design choice: Active panel, mcqPanel, and activeEditor are all stored in the same class.
 * Trade-off: Requires an instance of MessageHandler to be created and used instead of exporting
 * the activeEditor and active panel directly.
 */
export class MessageHandler {
  private messageQueue: MessageType[] = [];
  private handling = false;
  public panel: vscode.WebviewPanel | null = null;
  public mcqPanel: vscode.WebviewPanel | null = null;
  public activeEditor: Editor | null = null;

  async handleMessage(context: vscode.ExtensionContext, message: MessageType) {
    this.messageQueue.push(message);
    if (this.handling) {
      return;
    }
    this.handling = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      console.log(`${Date.now()} Beginning handleMessage: ${message.type}`);
      switch (message.type) {
        case MessageTypeNames.ExtensionPing:
          sendToFrontend(this.panel, Messages.ExtensionPong(null));
          break;
        case MessageTypeNames.McqQuestion: {
          if (this.mcqPanel === null) {
            this.mcqPanel = vscode.window.createWebviewPanel(
              "mcq-question-panel",
              `MCQ`,
              vscode.ViewColumn.One,
              { enableScripts: true, retainContextWhenHidden: true },
            );

            // Forward messages from the MCQ panel to the main panel
            this.mcqPanel.webview.onDidReceiveMessage((msg: MessageType) => {
              console.log("EXTENSION: Relay message from mcqPanel", msg);
              sendToFrontend(this.panel, msg);
            });

            this.mcqPanel.onDidDispose(() => {
              this.mcqPanel = null;
            });
          }
          this.mcqPanel.title = `MCQ`;
          this.mcqPanel.iconPath = vscode.Uri.joinPath(
            context.extensionUri,
            "assets",
            "icon.png",
          );
          let activePanel = await McqPanel({
            data: {
              assessmentName: message.assessmentName ?? "",
              questionId: message.questionId,
              choices: message.options,
              workspaceLocation: message.workspaceLocation ?? "assessment",
            },
          });
          setWebviewContent(
            this.mcqPanel,
            context,
            <div
              // @ts-ignore: Our FakeReact doesn't modify the style attribute
              style="width: 100%; height: calc(100vh - 10px)"
              id="mcq-panel"
            >
              {ReactDOMServer.renderToString(activePanel)}
            </div>,
          );
          this.mcqPanel.reveal(vscode.ViewColumn.One);

          break;
        }

        case MessageTypeNames.McqAnswer: {
          const workspaceLocation = message.workspaceLocation;
          const assessmentName = message.assessmentName;
          const questionId = message.questionId;
          const choiceIndex = message.choice;

          console.log(
            `MCQ Answer: ${assessmentName}, Question ID: ${questionId}, Choice Index: ${choiceIndex}`,
          );
          const msg = Messages.McqAnswer(
            workspaceLocation,
            assessmentName,
            questionId,
            choiceIndex,
          );
          sendToFrontend(this.panel, msg);
          break;
        }

        case MessageTypeNames.NewEditor:
          this.activeEditor = await Editor.create(
            message.workspaceLocation,
            message.assessmentName,
            message.questionId,
            message.prepend,
            message.initialCode,
            message.breakpoints
          );

          
          // Remove all breakpoints, then add the one included in the message
          // Need this to pass typechecks
          const editor = this.activeEditor
          if (editor !== null) {
            vscode.debug.removeBreakpoints(
              vscode.debug.breakpoints.filter(bp => 
                bp instanceof vscode.SourceBreakpoint 
                && bp.location.uri.toString() === editor.uri.toString()
              )
            );
            vscode.debug.addBreakpoints(this.activeEditor.breakpoints.map((s, index) => {
              if (s === "ace_breakpoint") {
                return new vscode.SourceBreakpoint(new vscode.Location(vscode.Uri.parse(editor.uri), new vscode.Position(index, 0)), true)
              }
            }).filter(x => x !== undefined));
          }


          this.activeEditor.uri;
          const info = context.globalState.get("info") ?? {};
          if (this.activeEditor.uri) {
            _.set(
              info,
              `["${this.activeEditor.uri}"].chapter`,
              message.chapter ?? 1,
            );
            const nPrependLines = getNumPrependLines(message.prepend);
            _.set(info, `["${this.activeEditor.uri}"].prepend`, nPrependLines);

            context.globalState.update("info", info);
            client.sendRequest("source/publishInfo", info);
          }

          this.panel?.reveal(vscode.ViewColumn.Two);
          console.log(
            `EXTENSION: NewEditor: activeEditor set to ${this.activeEditor.assessmentName}_${this.activeEditor.questionId}`,
          );

          this.activeEditor.onChange((editor: Editor) => {
            const workspaceLocation = editor.workspaceLocation;
            const code = editor.getText();
            if (!code) {
              return;
            }
            if (editor !== this.activeEditor) {
              console.log(
                `EXTENSION: Editor ${editor.assessmentName}_${editor.questionId} is no longer active, skipping onChange`,
              );
            }
            const message = Messages.Text(
              workspaceLocation,
              codeRemovePrepend(code),
            );
            console.log(`Sending message: ${JSON.stringify(message)}`);
            sendToFrontend(this.panel, message);
          });

          break;
        case MessageTypeNames.NotifyAssessmentsOverview:
          const { assessmentOverviews, courseId } = message;
          context.globalState.update(
            "assessmentOverviews",
            assessmentOverviews,
          );
          context.globalState.update("courseId", courseId);
          treeDataProvider.refresh();
          break;
        case MessageTypeNames.ResetEditor:
          if (this.activeEditor) {
            this.activeEditor.replace(message.initialCode);
            this.panel?.reveal(vscode.ViewColumn.Two);
          }
          break;
        case MessageTypeNames.LoginWithBrowser:
          let { route } = message;
          // TODO: Remove this hack! This should be changed in the frontend
          route = route.replace("saml_redirect", "saml_redirect_vscode");
          vscode.env.openExternal(vscode.Uri.parse(route));
      }
      console.log(`${Date.now()} Finish handleMessage: ${message.type}`);
    }

    this.handling = false;
  }

  static instance: MessageHandler | null = null;

  static getInstance() {
    if (!MessageHandler.instance) {
      MessageHandler.instance = new MessageHandler();
    }
    return MessageHandler.instance;
  }
}
