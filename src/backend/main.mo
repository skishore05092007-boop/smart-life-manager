import Map "mo:core/Map";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import List "mo:core/List";
import Array "mo:core/Array";

import TransactionApi "mixins/transaction-api";

actor {
  // Persistent note entry type with title and content
  type NoteEntry = {
    title : Text;
    content : Text;
  };

  // User preferences type
  type UserPreferences = {
    theme : Text;
    notifications : Bool;
  };

  // Stable state for transaction API — holds the OpenAI API key (optional)
  let transactionState = { var openAIKey : ?Text = null };

  // Persistent Map for user notes storage
  let notes = Map.empty<Text, NoteEntry>();

  // Persistent Map for user preferences storage
  let preferences = Map.empty<Text, UserPreferences>();

  include TransactionApi(transactionState);

  // Notes Management
  public shared ({ caller }) func saveNote(id : Text, title : Text, content : Text) : async () {
    let entry = {
      title;
      content;
    };
    notes.add(id, entry);
  };

  public query ({ caller }) func getNote(id : Text) : async NoteEntry {
    switch (notes.get(id)) {
      case (null) { Runtime.trap("Note not found") };
      case (?entry) { entry };
    };
  };

  public shared ({ caller }) func deleteNote(id : Text) : async () {
    if (not notes.containsKey(id)) {
      Runtime.trap("Note not found");
    };
    notes.remove(id);
  };

  public query ({ caller }) func searchNotes(searchTerm : Text) : async [NoteEntry] {
    let filtered = List.empty<NoteEntry>();

    notes.values().forEach(
      func(entry) {
        if (entry.title.contains(#text searchTerm) or entry.content.contains(#text searchTerm)) {
          filtered.add(entry);
        };
      }
    );

    filtered.toArray();
  };

  // User Preferences Management
  public shared ({ caller }) func savePreferences(userId : Text, theme : Text, notifications : Bool) : async () {
    let prefs = {
      theme;
      notifications;
    };
    preferences.add(userId, prefs);
  };

  public query ({ caller }) func getPreferences(userId : Text) : async UserPreferences {
    switch (preferences.get(userId)) {
      case (null) { Runtime.trap("Preferences not found") };
      case (?prefs) { prefs };
    };
  };

  // Get all notes by specific theme
  public query ({ caller }) func getNotesByTheme(theme : Text) : async [NoteEntry] {
    let filtered = List.empty<NoteEntry>();

    notes.values().forEach(
      func(entry) {
        switch (preferences.values().find(func(p) { p.theme == theme })) {
          case (null) {};
          case (?_) { filtered.add(entry) };
        };
      }
    );

    filtered.toArray();
  };

  // Update only part of preferences
  public shared ({ caller }) func updateNotifications(userId : Text, notifications : Bool) : async () {
    switch (preferences.get(userId)) {
      case (null) { Runtime.trap("Preferences not found") };
      case (?prefs) {
        let updatedPrefs = { prefs with notifications };
        preferences.add(userId, updatedPrefs);
      };
    };
  };

  // Get all notes sorted by title
  public query ({ caller }) func getAllNotesSorted() : async [NoteEntry] {
    let noteArray = notes.values().toArray();
    noteArray.sort(
      func(a, b) {
        Text.compare(a.title, b.title);
      }
    );
  };

  // Check if note exists
  public query ({ caller }) func noteExists(id : Text) : async Bool {
    notes.containsKey(id);
  };

  // Get notes by keyword (fallback)
  public query ({ caller }) func getNotesByKeyword(keyword : Text) : async [NoteEntry] {
    let filtered = List.empty<NoteEntry>();

    notes.values().forEach(
      func(entry) {
        if (entry.title.contains(#text keyword) or entry.content.contains(#text keyword)) {
          filtered.add(entry);
        };
      }
    );

    filtered.toArray();
  };
};
