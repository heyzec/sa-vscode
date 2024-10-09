import { Chapter } from "js-slang/dist/types";

export enum MessageType {
  WebviewStartedMessage = "WebviewStartedMessage",
  TextMessage = "TextMessage",
}

interface BaseMessage {
  type: MessageType;
}

export interface WebviewStartedMessage extends BaseMessage {}

export interface TextMessage extends BaseMessage {
  code: string;
}

export type Message = WebviewStartedMessage | TextMessage;
