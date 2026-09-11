// Transaction domain types for AI-powered voice/receipt parsing
module {
  /// Result of parsing a voice or OCR text snippet
  public type ParsedTransaction = {
    merchant : Text;
    amount : Float;
    category : Text;        // Food | Transport | Shopping | Entertainment | Health | Other
    transactionType : Text; // EXPENSE | INCOME
    date : Text;            // YYYY-MM-DD
    displayMessage : Text;
  };

  /// Public result type returned by parseTransaction
  public type ParseResult = {
    #ok : ParsedTransaction;
    #err : Text;
  };
};
