import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface NoteEntry {
    title: string;
    content: string;
}
export interface UserPreferences {
    theme: string;
    notifications: boolean;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface ParsedTransaction {
    displayMessage: string;
    transactionType: string;
    date: string;
    merchant: string;
    category: string;
    amount: number;
}
export type ParseResult = {
    __kind__: "ok";
    ok: ParsedTransaction;
} | {
    __kind__: "err";
    err: string;
};
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface backendInterface {
    deleteNote(id: string): Promise<void>;
    getAllNotesSorted(): Promise<Array<NoteEntry>>;
    getNote(id: string): Promise<NoteEntry>;
    getNotesByKeyword(keyword: string): Promise<Array<NoteEntry>>;
    getNotesByTheme(theme: string): Promise<Array<NoteEntry>>;
    getOpenAIKeyStatus(): Promise<{
        isSet: boolean;
    }>;
    getPreferences(userId: string): Promise<UserPreferences>;
    noteExists(id: string): Promise<boolean>;
    parseTransaction(text: string): Promise<ParseResult>;
    saveNote(id: string, title: string, content: string): Promise<void>;
    savePreferences(userId: string, theme: string, notifications: boolean): Promise<void>;
    searchNotes(searchTerm: string): Promise<Array<NoteEntry>>;
    setOpenAIKey(key: string): Promise<void>;
    updateNotifications(userId: string, notifications: boolean): Promise<void>;
}
