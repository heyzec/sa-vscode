// TODO: Move this file to src/features/editor/editor.ts
import * as vscode from "vscode";

import config from "../utils/config";
import Messages, { VscWorkspaceLocation } from "./messages";
import path from "path";
import { sendToFrontendWrapped } from "../commands/showPanel";
import { canonicaliseLocation } from "./misc";
import { codeAddPrepend, codeRemovePrepend } from "./editorUtils";

/**
 * Represents a VS Code editor associated with a Source Academy question.
 * Abstracts low level calling of VS Code APIs.
 */
export class Editor {
  private editor: vscode.TextEditor;
  private onChangeCallback?: (editor: Editor) => void;

  // Data associated with TextEditor
  prepend: string;
  uri: string;

  // Metadata relating to this question
  workspaceLocation: VscWorkspaceLocation;
  assessmentName: string;
  questionId: number;

  private constructor(
    editor: vscode.TextEditor,
    prepend: string,
    uri: string,
    workspaceLocation: VscWorkspaceLocation,
    assessmentName: string,
    questionId: number,
  ) {
    this.editor = editor;
    this.prepend = prepend;
    this.uri = uri;
    this.workspaceLocation = workspaceLocation;
    this.assessmentName = assessmentName;
    this.questionId = questionId;
  }

  /** For debugging purposes */
  private log(text: string) {
    console.log(`${this.editor.document.fileName.split("/").at(-1)} ${text}`);
  }

  getText() {
    return this.editor.document.getText();
  }

  static getFilePath(assessmentName: string, questionId: number): string {
    const workspaceFolder = canonicaliseLocation(config.workspaceFolder);
    const filePath = path.join(
      workspaceFolder,
      `${assessmentName}_${questionId}.js`,
    );

    return filePath;
  }

  // TODO: This method is too loaded, it's not obvious it also shows the editor
  static async create(
    workspaceLocation: VscWorkspaceLocation,
    assessmentName: string,
    questionId: number,
    prepend: string = "",
    initialCode: string = "",
  ): Promise<Editor> {
    const workspaceFolder = canonicaliseLocation(config.workspaceFolder);
    const filePath = path.join(
      workspaceFolder,
      `${assessmentName}_${questionId}.js`,
    );
    const uri = vscode.Uri.file(filePath);

    const contents = codeAddPrepend(initialCode, prepend);

    await vscode.workspace.fs
      .readFile(vscode.Uri.file(filePath))
      .then((value) => value.toString())
      .then(
        (localCode) => {
          if (localCode !== contents) {
            vscode.window
              .showInformationMessage(
                [
                  "The local file differs from the version on the Source Academy servers.",
                  "Discard the local file and use the one on the server?",
                ].join(" "),
                { modal: true },
                "Yes",
              )
              .then(async (answer) => {
                // By default the code displayed is the local one
                if (answer === "Yes") {
                  await vscode.workspace.fs.writeFile(
                    uri,
                    new TextEncoder().encode(contents),
                  );
                } else if (answer === undefined) {
                  // Modal cancelled
                  const message = Messages.Text(
                    workspaceLocation,
                    codeRemovePrepend(localCode),
                  );
                  sendToFrontendWrapped(message);
                }
              });
          }
        },
        async () => {
          await vscode.workspace.fs.writeFile(
            uri,
            new TextEncoder().encode(contents),
          );
        },
      );

    const editor = await vscode.window.showTextDocument(uri, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });

    // Programmatically set the language
    vscode.languages.setTextDocumentLanguage(editor.document, "source");

    // Collapse the prepend section
    editor.selection = new vscode.Selection(
      editor.document.positionAt(0),
      editor.document.positionAt(1),
    );
    vscode.commands.executeCommand("editor.fold");

    // Create wrapper
    const self = new Editor(
      editor,
      prepend,
      uri.toString(),
      workspaceLocation,
      assessmentName,
      questionId,
    );

    // Register callback when contents changed
    vscode.workspace.onDidChangeTextDocument(
      (e: vscode.TextDocumentChangeEvent) => {
        if (!self.onChangeCallback) {
          return;
        }
        if (e.contentChanges.length === 0) {
          self.log(`EXTENSION: Editor's code did not change, ignoring`);
          return;
        }
        self.onChangeCallback(self);
      },
    );

    return self;
  }

  async replace(code: string) {
    const editor = this.editor;
    const contents = codeAddPrepend(code, this.prepend);

    // In some sense, simulate a select all and paste
    editor.edit((editBuilder) => {
      editBuilder.replace(
        new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length),
        ),
        contents,
      );
    });
  }

  onChange(
    callback: Exclude<typeof Editor.prototype.onChangeCallback, undefined>,
  ) {
    this.onChangeCallback = callback;
  }
}
