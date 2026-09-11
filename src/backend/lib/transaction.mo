import HttpOutcall "mo:caffeineai-http-outcalls/outcall";
import Types "../types/transaction";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Char "mo:core/Char";
import Time "mo:core/Time";

// Domain logic for AI-powered transaction parsing.
// Uses HTTP outcalls to call the OpenAI API (if key is set) with a structured
// prompt, then falls back to local keyword-based parsing when no key is present.
module {
  public type ParsedTransaction = Types.ParsedTransaction;
  public type ParseResult = Types.ParseResult;
  public type Transform = HttpOutcall.Transform;

  // ── Text helpers ───────────────────────────────────────────────────────────

  func toLower(t : Text) : Text {
    var result = "";
    for (c in t.chars()) {
      let code = c.toNat32();
      if (code >= 65 and code <= 90) {
        result #= Char.fromNat32(code + 32).toText();
      } else {
        result #= c.toText();
      };
    };
    result;
  };

  func containsAny(haystack : Text, needles : [Text]) : Bool {
    let lower = toLower(haystack);
    var found = false;
    for (n in needles.values()) {
      if (lower.contains(#text n)) found := true;
    };
    found;
  };

  // Parse a decimal number string like "200" or "200.5" → Float
  // Returns null if not parseable.
  // Parse a decimal number string like "200" or "200.5" → Float
  // Returns null if not parseable.
  func parseFloat(s : Text) : ?Float {
    var parts = s.split(#char '.');
    let intPartOpt = parts.next();
    let fracPartOpt = parts.next();
    let intPart = switch (intPartOpt) {
      case null return null;
      case (?p) p;
    };
    switch (Nat.fromText(intPart)) {
      case null return null;
      case (?intVal) {
        let base : Float = intVal.toInt().toFloat();
        switch (fracPartOpt) {
          case null ?base;
          case (?frac) {
            switch (Nat.fromText(frac)) {
              case null ?base;
              case (?fracVal) {
                let divisor : Float = (10 ** frac.size()).toInt().toFloat();
                ?(base + fracVal.toInt().toFloat() / divisor);
              };
            };
          };
        };
      };
    };
  };

  func currentDate() : Text {
    let now = Time.now(); // nanoseconds
    let seconds : Int = now / 1_000_000_000;
    let baseSeconds : Int = 1_704_067_200; // 2024-01-01
    let diff = seconds - baseSeconds;
    let daysSinceBase : Nat = (if (diff >= 0) diff else 0).toNat();
    let year : Nat = 2024 + daysSinceBase / 365;
    let dayOfYear : Nat = daysSinceBase % 365;
    let monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var remaining = dayOfYear;
    var month : Nat = 1;
    for (days in monthDays.values()) {
      if (remaining >= days and month < 12) {
        remaining -= days;
        month += 1;
      };
    };
    let day : Nat = remaining + 1;
    let pad = func(n : Nat) : Text {
      if (n < 10) "0" # n.toText() else n.toText();
    };
    year.toText() # "-" # pad(month) # "-" # pad(day);
  };

  // ── Local fallback parser ──────────────────────────────────────────────

  func extractAmount(text : Text) : ?Float {
    // Try ₹-prefix: collect digits/dot after the ₹ character (U+20B9, code 8377)
    var numStr = "";
    var capturing = false;
    for (c in text.chars()) {
      let code = c.toNat32();
      if (code == 8377) {
        capturing := true; // ₹
      } else if (capturing) {
        if ((code >= 48 and code <= 57) or code == 46) {
          numStr #= c.toText();
        } else if (numStr.size() > 0) {
          capturing := false;
        };
      };
    };
    // Try "Rs" / "INR" word-token prefix
    if (numStr.size() == 0) {
      var takeNext = false;
      for (word in text.split(#char ' ')) {
        let wl = toLower(word);
        if (wl == "rs" or wl == "rs." or wl == "inr" or wl == "rs,") {
          takeNext := true;
        } else if (takeNext) {
          var clean = "";
          for (ch in word.chars()) {
            let code = ch.toNat32();
            if ((code >= 48 and code <= 57) or code == 46) clean #= ch.toText();
          };
          if (clean.size() > 0) { numStr := clean; takeNext := false };
        };
      };
    };
    // Try spoken numbers: e.g. "two hundred", "five thousand"
    if (numStr.size() == 0) {
      let wordNums : [(Text, Float)] = [
        ("one", 1.0), ("two", 2.0), ("three", 3.0), ("four", 4.0),
        ("five", 5.0), ("six", 6.0), ("seven", 7.0), ("eight", 8.0),
        ("nine", 9.0), ("ten", 10.0), ("twenty", 20.0), ("thirty", 30.0),
        ("forty", 40.0), ("fifty", 50.0), ("sixty", 60.0), ("seventy", 70.0),
        ("eighty", 80.0), ("ninety", 90.0), ("hundred", 100.0),
        ("thousand", 1000.0), ("lakh", 100000.0),
      ];
      var base : Float = 0.0;
      var multiplier : Float = 1.0;
      for (word in toLower(text).split(#char ' ')) {
        switch (parseFloat(word)) {
          case (?n) { base := n };
          case null {
            for ((w, v) in wordNums.values()) {
              if (word == w) {
                if (v >= 100.0 and base > 0.0) multiplier := v
                else if (v < 100.0) base := v;
              };
            };
          };
        };
      };
      if (base > 0.0) return ?(base * multiplier);
      return null;
    };
    parseFloat(numStr);
  };

  func detectCategory(text : Text) : Text {
    let t = toLower(text);
    if (containsAny(t, ["zomato", "swiggy", "food", "restaurant", "chai", "lunch", "dinner", "breakfast", "cafe", "coffee", "meal"])) return "Food";
    if (containsAny(t, ["uber", "ola", "rapido", "petrol", "bus", "metro", "travel", "transport", "cab", "train", "flight", "ticket"])) return "Travel";
    if (containsAny(t, ["amazon", "flipkart", "myntra", "shopping", "shop", "buy", "purchase", "order"])) return "Shopping";
    if (containsAny(t, ["netflix", "spotify", "youtube", "entertainment", "movie", "cinema", "game"])) return "Entertainment";
    if (containsAny(t, ["hospital", "pharmacy", "medicine", "doctor", "health", "gym", "clinic"])) return "Health";
    if (containsAny(t, ["sip", "small cap", "nippon", "invest", "mutual fund", "stock", "nifty", "equity"])) return "Investment";
    if (containsAny(t, ["salary", "income", "earned", "received", "credited", "refund", "cashback"])) return "Income";
    "Other";
  };

  func detectType(text : Text) : Text {
    let t = toLower(text);
    if (containsAny(t, ["salary", "income", "earned", "received", "credited", "refund", "cashback", "got"])) return "INCOME";
    "EXPENSE";
  };

  func extractMerchant(text : Text) : Text {
    let t = toLower(text);
    let knownMerchants = [
      "zomato", "swiggy", "uber", "ola", "rapido", "amazon", "flipkart",
      "myntra", "netflix", "spotify", "paytm", "phonepe", "gpay", "airtel",
      "jio", "dominos", "kfc", "mcd",
    ];
    for (m in knownMerchants.values()) {
      if (t.contains(#text m)) return m;
    };
    // First capitalised word as fallback
    for (word in text.split(#char ' ')) {
      if (word.size() > 2) {
        let firstChar = switch (word.chars().next()) {
          case (?c) c;
          case null ' ';
        };
        let code = firstChar.toNat32();
        if (code >= 65 and code <= 90) return word; // A-Z
      };
    };
    "Unknown";
  };

  func localParse(text : Text) : ParseResult {
    switch (extractAmount(text)) {
      case null { #err("Could not extract amount from: " # text) };
      case (?amount) {
        let category = detectCategory(text);
        let txType = detectType(text);
        let merchant = extractMerchant(text);
        let date = currentDate();
        let msg = (if (txType == "INCOME") "Received" else "Added") # " Rs." # amount.toText() # " for " # category;
        #ok { merchant; amount; category; transactionType = txType; date; displayMessage = msg };
      };
    };
  };

  // ── OpenAI request/response ─────────────────────────────────────────────

  func escapeJson(t : Text) : Text {
    var out = "";
    for (c in t.chars()) {
      let code = c.toNat32();
      if (code == 34) out #= "\\\""      // double-quote
      else if (code == 92) out #= "\\\\" // backslash
      else if (code == 10) out #= "\\n"  // newline
      else if (code == 13) out #= "\\r"  // carriage return
      else if (code == 9) out #= "\\t"   // tab
      else out #= c.toText();
    };
    out;
  };

  /// Minimal JSON field extractor for a flat object.
  /// Handles quoted string values and bare numeric values.
  func extractJsonField(json : Text, field : Text) : ?Text {
    let needle = "\"" # field # "\"";
    // Find field in json by splitting on the key
    var parts = json.split(#text needle);
    ignore parts.next(); // skip before
    let after = switch (parts.next()) {
      case null return null;
      case (?a) a;
    };
    // Walk chars: seek ':', then collect value
    var state = 0; // 0=seek_colon, 1=seek_value_start, 2=in_string, 3=in_number
    var result = "";
    var escape = false;
    for (c in after.chars()) {
      let code = c.toNat32();
      switch (state) {
        case 0 { if (code == 58) state := 1 }; // ':'
        case 1 {
          if (code == 34) {
            state := 2; // opening '"'
          } else if ((code >= 48 and code <= 57) or code == 45) {
            result #= c.toText(); state := 3; // digit or '-'
          } else if (code != 32 and code != 10 and code != 13 and code != 9) {
            return null;
          };
        };
        case 2 {
          if (escape) { result #= c.toText(); escape := false }
          else if (code == 92) { escape := true }  // backslash
          else if (code == 34) { return ?result }   // closing quote
          else { result #= c.toText() };
        };
        case 3 {
          if ((code >= 48 and code <= 57) or code == 46) { result #= c.toText() }
          else { return ?result };
        };
        case _ {};
      };
    };
    if (result.size() > 0) ?result else null;
  };

  func parseOpenAIResponse(responseBody : Text, date : Text) : ParseResult {
    // OpenAI response: {"choices":[{"message":{"content":"<JSON>"}}]}
    let json = switch (extractJsonField(responseBody, "content")) {
      case null return #err("No content field in OpenAI response");
      case (?c) c;
    };
    let merchant = switch (extractJsonField(json, "merchant")) { case (?v) v; case null "Unknown" };
    let amountStr = switch (extractJsonField(json, "amount")) { case (?v) v; case null "0" };
    let category = switch (extractJsonField(json, "category")) { case (?v) v; case null "Other" };
    let txType = switch (extractJsonField(json, "transactionType")) { case (?v) v; case null "EXPENSE" };
    let txDate = switch (extractJsonField(json, "date")) { case (?v) v; case null date };
    let displayMessage = switch (extractJsonField(json, "displayMessage")) { case (?v) v; case null "Transaction logged" };
    let amount = switch (parseFloat(amountStr)) { case (?n) n; case null 0.0 };
    #ok { merchant; amount; category; transactionType = txType; date = txDate; displayMessage };
  };

  func buildRequestBody(text : Text, date : Text) : Text {
    let systemPrompt = "You are a financial transaction parser. Parse the input and return ONLY a JSON object with these exact fields: merchant (string), amount (number, no currency symbol), category (exactly one of: Food, Travel, Shopping, Entertainment, Health, Investment, Income, Other), transactionType (exactly EXPENSE or INCOME), date (YYYY-MM-DD, use today: " # date # "), displayMessage (e.g. Added Rs.200 for Food). If input starts with [RECEIPT_IMAGE] treat it as receipt OCR. Return ONLY valid JSON, no markdown.";
    "{\"model\":\"gpt-4o-mini\",\"messages\":[{\"role\":\"system\",\"content\":\"" # escapeJson(systemPrompt) # "\"},{\"role\":\"user\",\"content\":\"" # escapeJson(text) # "\"}],\"temperature\":0.1,\"max_tokens\":200}";
  };

  // ── Public entry point ──────────────────────────────────────────────────

  /// Parse text using OpenAI (if key provided) or local fallback.
  /// `transform` must be a shared query function from the calling actor (required by ICP HTTP outcalls).
  public func parseText(text : Text, openAIKey : ?Text, transform : Transform) : async ParseResult {
    let date = currentDate();
    switch (openAIKey) {
      case null { localParse(text) };
      case (?key) {
        let headers : [HttpOutcall.Header] = [
          { name = "Content-Type"; value = "application/json" },
          { name = "Authorization"; value = "Bearer " # key },
        ];
        try {
          let responseText = await HttpOutcall.httpPostRequest(
            "https://api.openai.com/v1/chat/completions",
            headers,
            buildRequestBody(text, date),
            transform,
          );
          parseOpenAIResponse(responseText, date);
        } catch (_) {
          localParse(text);
        };
      };
    };
  };
};
