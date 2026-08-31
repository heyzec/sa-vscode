/**
 * This script is injected into the VSC panel and lives in the Webview context.
 * It simply relays messages between the VSC Extension context and the Frontend iframe context.
 */
//
import React, { useEffect, useState, useCallback } from "react";
import Messages, { MessageType, MessageTypeNames } from "../../utils/messages";
import { FRONTEND_ELEMENT_ID } from "../../constants";

// This function is provided by vscode extension.
// In the Webview context we cannot use import * as vscode from "vscode";
// @ts-expect-error: Cannot find name 'acquireVsCodeApi'.ts(2304)
const vscode = acquireVsCodeApi();

let frontendBaseUrl: string;

function relayToFrontend(document: Document, message: MessageType) {
  const iframe = document.getElementById(
    FRONTEND_ELEMENT_ID,
  ) as HTMLIFrameElement | null;
  iframe?.contentWindow?.postMessage(message, frontendBaseUrl);
}

function relayToExtension(message: MessageType) {
  vscode.postMessage(message);
}

function initialListener(event: MessageEvent) {
  const message: MessageType = event.data;
  if (
    message.type === MessageTypeNames.ExtensionPing &&
    event.origin === message.frontendOrigin
  ) {
    frontendBaseUrl = event.origin;

    relayToExtension(message);
    window.addEventListener("message", messageListener);
    return;
  }
}

function messageListener(event: MessageEvent) {
  const message: MessageType = event.data;
  if (event.origin.startsWith("vscode-webview://")) {
    relayToFrontend(document, message);
    return;
  }
  if (event.origin === frontendBaseUrl) {
    relayToExtension(message);
    return;
  }
}

const SourceAcademy: React.FC = () => {
  useEffect(() => {
    // TODO: Hacky way to update mcq panel, standard onClick handlers don't work
    const highlightSelection = (
      assessment: string,
      qid: number,
      choiceIdx: number,
    ) => {
      const inputs = document.querySelectorAll<HTMLInputElement>(
        `input[name="mcq-choice"][data-assessment="${assessment}"][data-qid="${qid}"]`,
      );
      inputs.forEach((input) => {
        const label = input.parentElement as HTMLElement | null;
        if (!label) return;
        if (parseInt(input.dataset.choice ?? "-1", 10) === choiceIdx) {
          label.style.backgroundColor = "#475569";
          label.style.border = "1px solid #94a3b8";
        } else {
          label.style.backgroundColor = "transparent";
          label.style.border = "1px solid transparent";
        }
      });
    };

    const handleChoiceChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target || target.name !== "mcq-choice") {
        return;
      }
      const choice = parseInt(target.dataset.choice ?? "-1", 10);
      const workspaceLocation = target.dataset.ws as any;
      const assessmentName = target.dataset.assessment ?? "";
      const questionId = parseInt(target.dataset.qid ?? "-1", 10);
      if (
        isNaN(choice) ||
        isNaN(questionId) ||
        !workspaceLocation ||
        assessmentName === ""
      ) {
        return;
      }

      highlightSelection(assessmentName, questionId, choice);

      console.log("[MCQPanel] choice selected", {
        workspaceLocation,
        assessmentName,
        questionId,
        choice,
      });
      // Persist answer for future sessions
      try {
        localStorage.setItem(
          `mcq_${assessmentName}_${questionId}`,
          String(choice),
        );
      } catch (err) {
        console.warn(
          "[Webview] Failed to save MCQ answer to localStorage",
          err,
        );
      }

      const message = Messages.McqAnswer(
        workspaceLocation as any,
        assessmentName,
        questionId,
        choice,
      );
      vscode.postMessage(message);
    };

    document.addEventListener("change", handleChoiceChange);

    // Upon mount, restore any saved answers and pre-select radios
    const restore = () => {
      document
        .querySelectorAll<HTMLInputElement>('input[name="mcq-choice"]')
        .forEach((el) => {
          const qid = el.dataset.qid;
          const assess = el.dataset.assessment;
          if (!qid || !assess) return;
          const stored = localStorage.getItem(`mcq_${assess}_${qid}`);
          if (stored !== null && stored === el.dataset.choice) {
            el.checked = true;
            // apply visual highlight on restore
            const label = el.parentElement as HTMLElement | null;
            if (label) {
              label.style.backgroundColor = "#475569";
              label.style.border = "1px solid #94a3b8";
            }
          }
        });
    };
    restore();

    return () => document.removeEventListener("change", handleChoiceChange);
  }, []);

  return <></>;
};
export default SourceAcademy;
