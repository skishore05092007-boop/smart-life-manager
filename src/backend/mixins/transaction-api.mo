import TransactionLib "../lib/transaction";
import HttpOutcall "mo:caffeineai-http-outcalls/outcall";

// Public API mixin for the transaction parsing domain.
// Receives shared state (openAIKey) from the actor.
mixin (state : { var openAIKey : ?Text }) {

  /// ICP HTTP outcall transform: strips response headers for determinism.
  public shared query func _transformResponse(input : HttpOutcall.TransformationInput) : async HttpOutcall.TransformationOutput {
    HttpOutcall.transform(input);
  };

  /// Parse raw voice or OCR text and return a structured transaction.
  /// Uses OpenAI (gpt-4o-mini) if a key is configured; otherwise falls back to
  /// local keyword-based parsing.
  public func parseTransaction(text : Text) : async TransactionLib.ParseResult {
    await TransactionLib.parseText(text, state.openAIKey, _transformResponse);
  };

  /// Store the OpenAI API key in stable canister state.
  public shared (_) func setOpenAIKey(key : Text) : async () {
    state.openAIKey := ?(key);
  };

  /// Returns whether an OpenAI API key has been configured.
  /// Never exposes the key itself.
  public query func getOpenAIKeyStatus() : async { isSet : Bool } {
    { isSet = state.openAIKey != null };
  };
};
