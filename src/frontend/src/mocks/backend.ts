import type { backendInterface } from "../backend";

export const mockBackend: backendInterface = {
  deleteNote: async (_id: string) => undefined,
  getAllNotesSorted: async () => [
    { title: "Sample Note", content: "Sample content for testing." },
  ],
  getNote: async (_id: string) => ({
    title: "Sample Note",
    content: "Sample content for testing.",
  }),
  getNotesByKeyword: async (_keyword: string) => [],
  getNotesByTheme: async (_theme: string) => [],
  getPreferences: async (_userId: string) => ({
    theme: "dark",
    notifications: false,
  }),
  noteExists: async (_id: string) => false,
  _transformResponse: async (_input) => ({
    status: BigInt(200),
    body: new Uint8Array(),
    headers: [],
  }),
  parseTransaction: async (_text: string) => ({
    __kind__: "err" as const,
    err: "mock",
  }),
  setOpenAIKey: async (_key: string) => undefined,
  getOpenAIKeyStatus: async () => ({ isSet: false }),
  saveNote: async (_id: string, _title: string, _content: string) => undefined,
  savePreferences: async (
    _userId: string,
    _theme: string,
    _notifications: boolean
  ) => undefined,
  searchNotes: async (_searchTerm: string) => [],
  updateNotifications: async (_userId: string, _notifications: boolean) =>
    undefined,
};
