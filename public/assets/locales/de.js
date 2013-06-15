// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(searchElement /*, fromIndex */) {
    "use strict";

    if (this === void 0 || this === null) {
      throw new TypeError();
    }

    var t = Object(this);
    var len = t.length >>> 0;

    if (len === 0) {
      return -1;
    }

    var n = 0;
    if (arguments.length > 0) {
      n = Number(arguments[1]);
      if (n !== n) { // shortcut for verifying if it's NaN
        n = 0;
      } else if (n !== 0 && n !== (Infinity) && n !== -(Infinity)) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }
    }

    if (n >= len) {
      return -1;
    }

    var k = n >= 0
          ? n
          : Math.max(len - Math.abs(n), 0);

    for (; k < len; k++) {
      if (k in t && t[k] === searchElement) {
        return k;
      }
    }

    return -1;
  };
}

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default handling of translation fallbacks to false
I18n.fallbacks = false;

// Set default separator
I18n.defaultSeparator = ".";

// Set current locale to null
I18n.locale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.fallbackRules = {
};

I18n.pluralizationRules = {
  en: function (n) {
    return n == 0 ? ["zero", "none", "other"] : n == 1 ? "one" : "other";
  }
};

I18n.getFallbacks = function(locale) {
  if (locale === I18n.defaultLocale) {
    return [];
  } else if (!I18n.fallbackRules[locale]) {
    var rules = []
      , components = locale.split("-");

    for (var l = 1; l < components.length; l++) {
      rules.push(components.slice(0, l).join("-"));
    }

    rules.push(I18n.defaultLocale);

    I18n.fallbackRules[locale] = rules;
  }

  return I18n.fallbackRules[locale];
}

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  var options = options || {}
    , lookupInitialScope = scope
    , translations = this.prepareOptions(I18n.translations)
    , locale = options.locale || I18n.currentLocale()
    , messages = translations[locale] || {}
    , options = this.prepareOptions(options)
    , currentScope
  ;

  if (typeof(scope) == "object") {
    scope = scope.join(this.defaultSeparator);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.defaultSeparator + scope;
  }

  scope = scope.split(this.defaultSeparator);

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (!messages) {
    if (I18n.fallbacks) {
      var fallbacks = this.getFallbacks(locale);
      for (var fallback = 0; fallback < fallbacks.length; fallbacks++) {
        messages = I18n.lookup(lookupInitialScope, this.prepareOptions({locale: fallbacks[fallback]}, options));
        if (messages) {
          break;
        }
      }
    }

    if (!messages && this.isValidNode(options, "defaultValue")) {
        messages = options.defaultValue;
    }
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {}
    , opts
    , count = arguments.length
  ;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);
  var matches = message.match(this.PLACEHOLDER)
    , placeholder
    , value
    , name
  ;

  if (!matches) {
    return message;
  }

  for (var i = 0; placeholder = matches[i]; i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    value = options[name];

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    regex = new RegExp(placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}"));
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  var translation = this.lookup(scope, options);

  try {
    if (typeof(translation) == "object") {
      if (typeof(options.count) == "number") {
        return this.pluralize(options.count, scope, options);
      } else {
        return translation;
      }
    } else {
      return this.interpolate(translation, options);
    }
  } catch(err) {
    return this.missingTranslation(scope);
  }
};

I18n.localize = function(scope, value) {
  switch (scope) {
    case "currency":
      return this.toCurrency(value);
    case "number":
      scope = this.lookup("number.format");
      return this.toNumber(value, scope);
    case "percentage":
      return this.toPercentage(value);
    default:
      if (scope.match(/^(date|time)/)) {
        return this.toTime(scope, value);
      } else {
        return value.toString();
      }
  }
};

I18n.parseDate = function(date) {
  var matches, convertedDate;

  // we have a date, so just return it.
  if (typeof(date) == "object") {
    return date;
  };

  // it matches the following formats:
  //   yyyy-mm-dd
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ssZ
  //   yyyy-mm-dd[ T]hh:mm::ss+0000
  //
  matches = date.toString().match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?(Z|\+0000)?/);

  if (matches) {
    for (var i = 1; i <= 6; i++) {
      matches[i] = parseInt(matches[i], 10) || 0;
    }

    // month starts on 0
    matches[2] -= 1;

    if (matches[7]) {
      convertedDate = new Date(Date.UTC(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]));
    } else {
      convertedDate = new Date(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]);
    }
  } else if (typeof(date) == "number") {
    // UNIX timestamp
    convertedDate = new Date();
    convertedDate.setTime(date);
  } else if (date.match(/\d+ \d+:\d+:\d+ [+-]\d+ \d+/)) {
    // a valid javascript format with timezone info
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date))
  } else {
    // an arbitrary javascript string
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  }

  return convertedDate;
};

I18n.toTime = function(scope, d) {
  var date = this.parseDate(d)
    , format = this.lookup(scope)
  ;

  if (date.toString().match(/invalid/i)) {
    return date.toString();
  }

  if (!format) {
    return date.toString();
  }

  return this.strftime(date, format);
};

I18n.strftime = function(date, format) {
  var options = this.lookup("date");

  if (!options) {
    return date.toString();
  }

  options.meridian = options.meridian || ["AM", "PM"];

  var weekDay = date.getDay()
    , day = date.getDate()
    , year = date.getFullYear()
    , month = date.getMonth() + 1
    , hour = date.getHours()
    , hour12 = hour
    , meridian = hour > 11 ? 1 : 0
    , secs = date.getSeconds()
    , mins = date.getMinutes()
    , offset = date.getTimezoneOffset()
    , absOffsetHours = Math.floor(Math.abs(offset / 60))
    , absOffsetMinutes = Math.abs(offset) - (absOffsetHours * 60)
    , timezoneoffset = (offset > 0 ? "-" : "+") + (absOffsetHours.toString().length < 2 ? "0" + absOffsetHours : absOffsetHours) + (absOffsetMinutes.toString().length < 2 ? "0" + absOffsetMinutes : absOffsetMinutes)
  ;

  if (hour12 > 12) {
    hour12 = hour12 - 12;
  } else if (hour12 === 0) {
    hour12 = 12;
  }

  var padding = function(n) {
    var s = "0" + n.toString();
    return s.substr(s.length - 2);
  };

  var f = format;
  f = f.replace("%a", options.abbr_day_names[weekDay]);
  f = f.replace("%A", options.day_names[weekDay]);
  f = f.replace("%b", options.abbr_month_names[month]);
  f = f.replace("%B", options.month_names[month]);
  f = f.replace("%d", padding(day));
  f = f.replace("%e", day);
  f = f.replace("%-d", day);
  f = f.replace("%H", padding(hour));
  f = f.replace("%-H", hour);
  f = f.replace("%I", padding(hour12));
  f = f.replace("%-I", hour12);
  f = f.replace("%m", padding(month));
  f = f.replace("%-m", month);
  f = f.replace("%M", padding(mins));
  f = f.replace("%-M", mins);
  f = f.replace("%p", options.meridian[meridian]);
  f = f.replace("%S", padding(secs));
  f = f.replace("%-S", secs);
  f = f.replace("%w", weekDay);
  f = f.replace("%y", padding(year));
  f = f.replace("%-y", padding(year).replace(/^0+/, ""));
  f = f.replace("%Y", year);
  f = f.replace("%z", timezoneoffset);

  return f;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ",", strip_insignificant_zeros: false}
  );

  var negative = number < 0
    , string = Math.abs(number).toFixed(options.precision).toString()
    , parts = string.split(".")
    , precision
    , buffer = []
    , formattedNumber
  ;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length -3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
        separator: new RegExp(options.separator.replace(/\./, "\\.") + "$")
      , zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "")
    ;
  }

  return formattedNumber;
};

I18n.toCurrency = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.currency.format"),
    this.lookup("number.format"),
    {unit: "$", precision: 2, format: "%u%n", delimiter: ",", separator: "."}
  );

  number = this.toNumber(number, options);
  number = options.format
    .replace("%u", options.unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024
    , size = number
    , iterations = 0
    , unit
    , precision
  ;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", {count: size});
    precision = 0;
  } else {
    unit = this.t("number.human.storage_units.units." + [null, "kb", "mb", "gb", "tb"][iterations]);
    precision = (size - Math.floor(size) === 0) ? 0 : 1;
  }

  options = this.prepareOptions(
    options,
    {precision: precision, format: "%n%u", delimiter: ""}
  );

  number = this.toNumber(size, options);
  number = options.format
    .replace("%u", unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toPercentage = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.percentage.format"),
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ""}
  );

  number = this.toNumber(number, options);
  return number + "%";
};

I18n.pluralizer = function(locale) {
  pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(count, scope, options) {
  var translation;

  try {
    translation = this.lookup(scope, options);
  } catch (error) {}

  if (!translation) {
    return this.missingTranslation(scope);
  }

  var message;
  options = this.prepareOptions(options);
  options.count = count.toString();

  pluralizer = this.pluralizer(this.currentLocale());
  key = pluralizer(Math.abs(count));
  keys = ((typeof key == "object") && (key instanceof Array)) ? key : [key];

  message = this.findAndTranslateValidNode(keys, translation);
  if (message == null) message = this.missingTranslation(scope, keys[0]);

  return this.interpolate(message, options);
};

I18n.missingTranslation = function() {
  var message = '[missing "' + this.currentLocale()
    , count = arguments.length
  ;

  for (var i = 0; i < count; i++) {
    message += "." + arguments[i];
  }

  message += '" translation]';

  return message;
};

I18n.currentLocale = function() {
  return (I18n.locale || I18n.defaultLocale);
};

// shortcuts
I18n.t = I18n.translate;
I18n.l = I18n.localize;
I18n.p = I18n.pluralize;


MessageFormat = {locale: {}};
MessageFormat.locale.de = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

I18n.messageFormat = (function(formats){
      var f = formats;
      return function(key, options) {
        var fn = f[key];
        if(fn){
          try {
            return fn(options);
          } catch(err) {
            return err.message;
          }
        } else {
          return 'Missing Key: ' + key
        }
        return f[key](options);
      };
    })({"topic.read_more_MF" : function(){ return "Invalid Format: Plural Function not found for locale: de";}});I18n.translations = {"de":{"js":{"dates":{"short_date_no_year":"D MMM","short_date":"D. MMM YYYY","long_date":"D. MMMM YYYY, H:mm","tiny":{"half_a_minute":"< 1Min","less_than_x_seconds":{"one":"< 1s","other":"< %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"< 1Min","other":"< %{count}Min"},"x_minutes":{"one":"1Min","other":"%{count}Min"},"about_x_hours":{"one":"1Std","other":"%{count}Std"},"x_days":{"one":"1T","other":"%{count}T"},"about_x_months":{"one":"1Mon","other":"%{count}Mon"},"x_months":{"one":"1Mon","other":"%{count}Mon"},"about_x_years":{"one":"1J","other":"%{count}J"},"over_x_years":{"one":"> 1J","other":"> %{count}J"},"almost_x_years":{"one":"1J","other":"%{count}J"}},"medium":{"x_minutes":{"one":"1 Minute","other":"%{count} Minuten"},"x_hours":{"one":"1 Stunde","other":"%{count} Stunden"},"x_days":{"one":"1 Tag","other":"%{count} Tage"}},"medium_with_ago":{"x_minutes":{"one":"vor einer Minute","other":"vor %{count} Minuten"},"x_hours":{"one":"vor eienr Stunde","other":"vor %{count} Stunden"},"x_days":{"one":"vor einem Tag","other":"vor %{count} Tagen"}}},"share":{"topic":"Teile einen Link zu diesem Thema","post":"Teile einen Link zu diesem Beitrag","close":"Schlie\u00dfen","twitter":"Teile diesen Link auf Twitter","facebook":"Teile diesen Link auf Facebook","google+":"Teile diesen Link auf Google+","email":"Link per Mail versenden"},"edit":"editiere den Titel und die Kategorie dieses Themas","not_implemented":"Entschuldigung, diese Funktion wurde noch nicht implementiert.","no_value":"Nein","yes_value":"Ja","of_value":"von","generic_error":"Entschuldigung, ein Fehler ist aufgetreten.","log_in":"Anmelden","age":"Alter","last_post":"Letzter Beitrag","admin_title":"Administration","flags_title":"Meldungen","show_more":"zeige mehr","links":"Links","faq":"FAQ","you":"Du","or":"oder","now":"gerade eben","read_more":"weiterlesen","in_n_seconds":{"one":"in einer Sekunde","other":"in {{count}} Sekunden"},"in_n_minutes":{"one":"in einer Minute","other":"in {{count}} Minuten"},"in_n_hours":{"one":"in einer Stunde","other":"in {{count}} Stunden"},"in_n_days":{"one":"in einem Tag","other":"in {{count}} Tagen"},"suggested_topics":{"title":"Vorgeschlagene Themen"},"bookmarks":{"not_logged_in":"Entschuldige, man muss angemeldet sein, um Lesezeichen zu setzen.","created":"Ein Lesezeichen zu diesem Beitrag wurde gesetzt.","not_bookmarked":"Du hast diesen Beitrag gelesen; klicke, um ein Lesezeichen zu setzen.","last_read":"Dies ist der letzte Beitrag, den Du gelesen hast."},"new_topics_inserted":"{{count}} neue Themen.","show_new_topics":"Hier klicken zum Anzeigen.","preview":"Vorschau","cancel":"Abbrechen","save":"\u00c4nderungen speichern","saving":"Wird gespeichert...","saved":"Gespeichert!","choose_topic":{"none_found":"Keine Themen gefunden.","title":{"search":"Suche Thema anhand Name, URL oder ID:","placeholder":"Titel des Themas hier hinschreiben"}},"user_action":{"user_posted_topic":"<a href='{{userUrl}}'>{{user}}</a> hast auf <a href='{{topicUrl}}'>das Thema</a> geantwortet","you_posted_topic":"<a href='{{userUrl}}'>Du</a> hast auf <a href='{{topicUrl}}'>das Thema</a> geantwortet","user_replied_to_post":"<a href='{{userUrl}}'>{{user}}</a> hat auf <a href='{{postUrl}}'>{{post_number}}</a> geantwortet","you_replied_to_post":"<a href='{{userUrl}}'>Du</a> hast auf <a href='{{postUrl}}'>{{post_number}}</a> geantwortet","user_replied_to_topic":"<a href='{{userUrl}}'>{{user}}</a> hat auf <a href='{{topicUrl}}'>das Thema</a> geantwortet","you_replied_to_topic":"<a href='{{userUrl}}'>Du</a> hast auf <a href='{{topicUrl}}'>das Thema</a> geantwortet","user_mentioned_user":"<a href='{{user1Url}}'>{{user}}</a> hat <a href='{{user2Url}}'>{{another_user}}</a> erw\u00e4hnt","user_mentioned_you":"<a href='{{user1Url}}'>{{user}}</a> hat <a href='{{user2Url}}'>dich</a> erw\u00e4hnt","you_mentioned_user":"<a href='{{user1Url}}'>Du</a> hat <a href='{{user2Url}}'>{{user}}</a> erw\u00e4hnt","posted_by_user":"Geschrieben von <a href='{{userUrl}}'>{{user}}</a>","posted_by_you":"Geschrieben von <a href='{{userUrl}}'>dir</a>","sent_by_user":"Gesendet von <a href='{{userUrl}}'>{{user}}</a>","sent_by_you":"Gesendet von <a href='{{userUrl}}'>dir</a>"},"user_action_groups":{"1":"\u201eGef\u00e4llt mir\u201c erhalten","2":"\u201eGef\u00e4llt mir\u201c gegeben","3":"Lesezeichen","4":"Themen","5":"R\u00fcckmeldungen","6":"Antworten","7":"Erw\u00e4hnungen","9":"Zitate","10":"Favoriten","11":"Bearbeitungen","12":"Gesendet","13":"Eing\u00e4nge"},"user":{"profile":"Profil","title":"Benutzer","mute":"Ignorieren","edit":"Einstellungen \u00e4ndern","download_archive":"Archiv meiner Beitr\u00e4ge herunterladen","private_message":"Private Nachricht","private_messages":"Nachrichten","activity_stream":"Aktivit\u00e4t","preferences":"Einstellungen","bio":"\u00dcber mich","invited_by":"Eingeladen von","trust_level":"Stufe","external_links_in_new_tab":"\u00d6ffne alle externen Links in neuen Tabs","enable_quoting":"Markierten Text bei Antwort zitieren","moderator":"{{user}} ist Moderator","admin":"{{user}} ist Admin","change_password":{"action":"\u00e4ndern","success":"(Mail gesendet)","in_progress":"(sende Mail)","error":"(Fehler)"},"change_username":{"action":"\u00e4ndern","title":"Benutzername \u00e4ndern","confirm":"Den Benutzernamen zu \u00e4ndern kann Konsequenzen nach sich ziehen. Bist Du sicher, dass du fortfahren willst?","taken":"Entschuldige, der Benutzername ist schon vergeben.","error":"Beim \u00c4ndern des Benutzernamens ist ein Fehler aufgetreten.","invalid":"Dieser Benutzername ist ung\u00fcltig, sie d\u00fcrfen nur aus Zahlen und Buchstaben bestehen."},"change_email":{"action":"\u00e4ndern","title":"Mailadresse \u00e4ndern","taken":"Entschuldige, diese Mailadresse ist nicht verf\u00fcgbar.","error":"Beim \u00e4ndern der Mailadresse ist ein Fehler aufgetreten. M\u00f6glicherweise wird diese Adresse schon benutzt.","success":"Eine Best\u00e4tigungsmail wurde an diese Adresse verschickt. Bitte folge den darin enthaltenen Anweisungen."},"email":{"title":"Mail","instructions":"Deine Mailadresse wird niemals \u00f6ffentlich angezeigt.","ok":"In Ordnung. Wir schicken eine Mail zur Best\u00e4tigung.","invalid":"Bitte gib eine g\u00fcltige Mailadresse ein.","authenticated":"Dein Mailadresse wurde von {{provider}} authentisiert.","frequency":"Wir mailen nur, falls Du l\u00e4ngere Zeit nicht hier gewesen bist und wir etwas Neues f\u00fcr Dich haben."},"name":{"title":"Realname","instructions":"Dieser Name muss nicht eindeutig sein, wird nur auf deiner Profilseite angezeigt und erm\u00f6glicht alternative @Namens-Erw\u00e4hnungen.","too_short":"Name zu kurz.","ok":"Der Name ist in Ordnung."},"username":{"title":"Benutzername","instructions":"Muss eindeutig sein, keine Leerzeichen. Andere k\u00f6nnen Dich mit @{{username}} erw\u00e4hnen.","short_instructions":"Andere k\u00f6nnen Dich mit @{{username}} erw\u00e4hnen.","available":"Dein Benutzername ist verf\u00fcgbar.","global_match":"Die Mailadresse passt zum registrierten Benutzernamen.","global_mismatch":"Schon registriert. Wie w\u00e4re es mit {{suggestion}}?","not_available":"Nicht verf\u00fcgbar. Wie w\u00e4re es mit {{suggestion}}?","too_short":"Der Benutzername ist zu kurz.","too_long":"Der Benutzername ist zu lang.","checking":"Pr\u00fcfe Verf\u00fcgbarkeit des Benutzernamens...","enter_email":"Benutzername gefunden. Gib die zugeh\u00f6rige Mailadresse ein."},"password_confirmation":{"title":"Passwort wiederholen"},"last_posted":"Letzter Beitrag","last_emailed":"Letzte Mail","last_seen":"Zuletzt gesehen","created":"Mitglied seit","log_out":"Abmelden","website":"Webseite","email_settings":"Mail","email_digests":{"title":"Schicke eine Mail mit Neuigkeiten, wenn ich die Seite l\u00e4nger nicht besuche","daily":"t\u00e4glich","weekly":"w\u00f6chentlich","bi_weekly":"all zwei Wochen"},"email_direct":"Schicke eine Mail, wenn jemand mich zitiert, auf meine Beitr\u00e4ge antwortet oder meinen @Namen erw\u00e4hnt.","email_private_messages":"Schicke eine Mail, wenn jemand mir eine private Nachricht sendet.","other_settings":"Sonstiges","new_topic_duration":{"label":"Betrachte Themen als neu, wenn","not_viewed":"ich sie noch nicht gelesen habe","last_here":"sie seit meiner letzten Anmeldung erstellt wurden","after_n_days":{"one":"sie gestern erstellt wurden","other":"sie in den letzten {{count}} Tagen erstellt wurden"},"after_n_weeks":{"one":"sie letzte Woche erstellt wurden","other":"they die letzten {{count}} Wochen erstellt wurden"}},"auto_track_topics":"Automatisch Themen folgen, die ich erstellt habe","auto_track_options":{"never":"niemals","always":"immer","after_n_seconds":{"one":"nach 1 Sekunde","other":"nach {{count}} Sekunden"},"after_n_minutes":{"one":"nach 1 Minute","other":"nach {{count}} Minuten"}},"invited":{"title":"Einladungen","user":"Eingeladene Benutzer","none":"{{username}} hat keine Nutzer eingeladen.","redeemed":"Angenommene Einladungen","redeemed_at":"Angenommen vor","pending":"Offene Einladungen","topics_entered":"Beigesteuerte Themen","posts_read_count":"Gelesene Beitr\u00e4ge","rescind":"Einladung zur\u00fccknehmen","rescinded":"Einladung zur\u00fcckgenommen","time_read":"Lesezeit","days_visited":"Tage der Anwesenheit","account_age_days":"Alter des Nutzerkontos in Tagen"},"password":{"title":"Passwort","too_short":"Dein Passwort ist zu kurz.","ok":"Dein Passwort ist in Ordnung."},"ip_address":{"title":"Letzte IP-Adresse"},"avatar":{"title":"Avatar","instructions":"Wir nutzen <a href='https://gravatar.com' target='_blank'>Gravatar</a> zur Darstellung von Avataren basierend auf deiner Mailadresse:"},"filters":{"all":"Alle"},"stream":{"posted_by":"Gepostet von","sent_by":"Gesendet von","private_message":"Private Nachricht","the_topic":"Das Thema"}},"loading":"L\u00e4dt...","close":"Schlie\u00dfen","learn_more":"Erfahre mehr...","year":"Jahr(e)","year_desc":"Beigesteuerte Themen der letzten 365 Tage","month":"Monat(e)","month_desc":"Beigesteuerte Themen der letzten 30 Tage","week":"Woche(n)","week_desc":"Beigesteuerte Themen der letzten 7 Tage","first_post":"Erster Beitrag","mute":"Ignorieren","unmute":"Wieder beachten","best_of":{"title":"Top Beitr\u00e4ge","enabled_description":"Du siehst gerade die Top Beitr\u00e4ge dieses Themas.","description":"Es gibt <b>{{count}}</b> Beitr\u00e4ge zu diesem Thema. Das sind eine Menge! M\u00f6chtest Du Zeit sparen und nur die Beitr\u00e4ge mit den meisten Antworten und Nutzerreaktionen betrachten?","enable":"Nur die Top Beitr\u00e4ge anzeigen","disable":"Alle Beitr\u00e4ge anzeigen"},"private_message_info":{"title":"Privates Gespr\u00e4ch","invite":"Andere einladen..."},"email":"Mail","username":"Benutzername","last_seen":"Zuletzt gesehen","created":"Erstellt","trust_level":"Stufe","create_account":{"title":"Konto erstellen","action":"Jetzt erstellen!","invite":"Hast Du schon ein Benutzerkonto?","failed":"Etwas ist schief gelaufen, vielleicht gibt es die Mailadresse schon. Versuche den \"Passwort vergessen\"-Link."},"forgot_password":{"title":"Passwort vergessen","action":"Ich habe mein Passwort vergessen","invite":"Gib deinen Nutzernamen ein und wir schicken Dir eine Mail zum Zur\u00fccksetzen des Passworts.","reset":"Passwort zur\u00fccksetzen","complete":"Du solltest bald eine Mail mit Instruktionen zum Zur\u00fccksetzen des Passworts erhalten."},"login":{"title":"Anmelden","username":"Login","password":"Passwort","email_placeholder":"Mailadresse oder Benutzername","error":"Unbekannter Fehler","reset_password":"Passwort zur\u00fccksetzen","logging_in":"Anmeldung l\u00e4uft...","or":"oder","authenticating":"Authentisiere...","awaiting_confirmation":"Dein Konto ist noch nicht aktiviert. Benutze den \"Passwort vergesse\"-Link um eine neue Aktivierungsmail zu erhalten.","awaiting_approval":"Dein Konto wurde noch nicht von einem Moderator bewilligt. Du bekommst eine Mail, sobald das geschehen ist.","not_activated":"Du kannst Dich noch nicht anmelden. Wir haben Dir k\u00fcrzlich eine Aktivierungsmail an <b>{{sentTo}}</b> geschickt. Bitte folge den Anweisungen darin, um dein Konto zu aktivieren.","resend_activation_email":"Klick hier, um ein neue Aktivierungsmail zu erhalten.","sent_activation_email_again":"Wir haben noch eine Aktivierungsmail an <b>{{currentEmail}}</b> verschickt. Es kann einige Minuten dauern, bis sie ankommt. Im Zweifel schaue auch im Spam-Ordner nach.","google":{"title":"Mit Google","message":"Authentisierung via Google (stelle sicher, dass der Popup-Blocker deaktiviert ist)"},"twitter":{"title":"Mit Twitter","message":"Authentisierung via Twitter (stelle sicher, dass der Popup-Blocker deaktiviert ist)"},"facebook":{"title":"Mit Facebook","message":"Authentisierung via Facebook (stelle sicher, dass der Popup-Blocker deaktiviert ist)"},"cas":{"title":"Mit CAS","message":"Authentisierung via CAS (stelle sicher, dass der Popup-Blocker deaktiviert ist)"},"yahoo":{"title":"Mit Yahoo","message":"Authentisierung via Yahoo (stelle sicher, dass der Popup-Blocker deaktiviert ist)"},"github":{"title":"Mit GitHub","message":"Authentisierung via GitHub (stelle sicher, dass der Popup-Blocker deaktiviert ist)"},"persona":{"title":"Mit Persona","message":"Authentisierung via Mozilla Persona (stelle sicher, dass der Popup-Blocker deaktiviert ist)"}},"composer":{"posting_not_on_topic":"Du antwortest auf das Thema \"{{title}}\", betrachtest gerade aber ein anderes Thema.","saving_draft_tip":"speichert","saved_draft_tip":"gespeichert","saved_local_draft_tip":"lokal gespeichert","similar_topics":"Dein Thema \u00e4hnelt...","drafts_offline":"Entw\u00fcrfe offline","min_length":{"need_more_for_title":"{{n}} fehlen im Titel noch","need_more_for_reply":"{{n}} fehlen in der Antwort noch"},"error":{"title_missing":"Der Title fehlt.","title_too_short":"Title muss mindestens {{min}} Zeichen lang sein.","title_too_long":"Title weniger als {{max}} Zeichen lang sein.","post_missing":"Der Beitrag fehlt.","post_length":"Der Beitrag muss mindestens {{min}} Zeichen lang sein.","category_missing":"Du musst eine Kategorie ausw\u00e4hlen."},"save_edit":"\u00c4nderungen speichern","reply_original":"Auf das Originalthema antworten","reply_here":"Hier antworten","reply":"Antworten","cancel":"Abbrechen","create_topic":"Thema erstellen","create_pm":"Private Nachricht erstellen","users_placeholder":"Nutzer hinzuf\u00fcgen","title_placeholder":"Gib hier den Titel ein. In einem Satz: Worum geht es?","reply_placeholder":"Gib hier deine Antwort ein. Benutze Markdown oder BBCode zur Textformatierung. Um ein Bild einzuf\u00fcgen ziehe es hierhin oder f\u00fcge es per Tastenkombination ein.","view_new_post":"Betrachte deinen neuen Beitrag.","saving":"Speichert...","saved":"Gespeichert!","saved_draft":"Du hast angefangen, einen Beitrag zu schreiben. Klick irgendwo, um fortzufahren.","uploading":"Hochladen...","show_preview":"Vorschau einblenden &raquo;","hide_preview":"&laquo; Vorschau ausblenden","quote_post_title":"Beitrag zitieren","bold_title":"Fett","bold_text":"fetter Text","italic_title":"Kursiv","italic_text":"kursiver Text","link_title":"Link","link_description":"Gib hier eine Beschreibung zum Link ein","link_dialog_title":"Link einf\u00fcgen","link_optional_text":"optionaler Titel","quote_title":"Zitat","quote_text":"Zitat","code_title":"Code","code_text":"Gib hier den Code ein","image_title":"Bild","image_description":"Gib hier eine Bildbeschreibung ein","image_dialog_title":"Bild einf\u00fcgen","image_optional_text":"optionaler Titel","image_hosting_hint":"Ben\u00f6tigst Du <a href='http://www.google.com/search?q=kostenlos+bilder+hosten' target='_blank'>kostenlosen Dienst f\u00fcr Bilder?</a>","olist_title":"Nummerierte Liste","ulist_title":"Aufz\u00e4hlung","list_item":"Listeneintrag","heading_title":"\u00dcberschrift","heading_text":"\u00dcberschrift","hr_title":"Horizontale Linie","undo_title":"R\u00fcckg\u00e4ngig machen","redo_title":"Wiederherstellen","help":"Hilfe zu Markdown","toggler":"Verstecke oder Zeige den Editor","admin_options_title":"Optionale Admin Einstellungen f\u00fcr das Thema","auto_close_label":"Schlisse das Thema automatisch nach:","auto_close_units":"Tage"},"notifications":{"title":"Benachrichtigung \u00fcber @Name-Erw\u00e4hnungen, Antworten auf deine Themen und Beitr\u00e4ge, Private Nachrichten, etc.","none":"Du hast aktuell keine Benachrichtiungen.","more":"Zeige fr\u00fchere Benachrichtigungen","mentioned":"<span title='mentioned' class='icon'>@</span> {{username}} {{link}}","quoted":"<i title='quoted' class='icon icon-quote-right'></i> {{username}} {{link}}","replied":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","posted":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","edited":"<i title='edited' class='icon icon-pencil'></i> {{username}} {{link}}","liked":"<i title='liked' class='icon icon-heart'></i> {{username}} {{link}}","private_message":"<i class='icon icon-envelope-alt' title='private message'></i> {{username}} hat Dir eine private Nachricht geschickt: {{link}}","invited_to_private_message":"<i class='icon icon-envelope-alt' title='private message'></i> {{username}} hat sich zu einem privaten Gespr\u00e4ch eingeladen: {{link}}","invitee_accepted":"<i title='accepted your invitation' class='icon icon-signin'></i> {{username}} hat deine Einladung akzeptiert","moved_post":"<i title='moved post' class='icon icon-arrow-right'></i> {{username}} hat einen Beitrag nach {{link}} verschoben","total_flagged":"total markierte Eintr\u00e4ge"},"image_selector":{"title":"Bild einf\u00fcgen","from_my_computer":"von meinem Ger\u00e4t","from_the_web":"aus dem Web","add_image":"Bild hinzuf\u00fcgen","remote_title":"Entferntes Bild","remote_tip":"Gib die Adresse eines Bildes wie folgt ein: http://example.com/image.jpg","local_title":"Lokales Bild","local_tip":"Klicke hier, um ein Bild von deinem Ger\u00e4t zu w\u00e4hlen.","upload":"Hochladen","uploading_image":"Bild wird hochgeladen"},"search":{"title":"Such nach Themen, Beitr\u00e4gen, Nutzern oder Kategorien","placeholder":"Gib hier deine Suchbegriffe ein","no_results":"Nichts gefunden.","searching":"Suche ...","prefer":{"user":"Die Suche bevorzugt Resultate von @{{username}}","category":"Die Suche bevorzugt Resultate in der Kategorie {{category}}"}},"site_map":"Gehe zu einer anderen Themen\u00fcbersicht oder Kategorie","go_back":"Zur\u00fcck","current_user":"Gehe zu deinem Nutzerprofil","favorite":{"title":"Favoriten","help":{"star":"F\u00fcge dieses Thema deinen Favoriten hinzu","unstar":"Entferne dieses Thema aus deinen Favoriten"}},"topics":{"none":{"favorited":"Du hast noch keine Themen favorisierst. Um ein Thema zu favorisieren, klicke auf den Stern neben dem Titel.","unread":"Du hast alle Themen gelesen.","new":"Es gibt f\u00fcr dich keine neuen Themen.","read":"Du hast bislang keine Themen gelesen.","posted":"Du hast bislang keine Beitr\u00e4ge erstellt.","latest":"Es gibt keine Themen. Wie traurig.","hot":"Es gibt keine beliebten Themen.","category":"Es gibt keine Themen der Kategorie {{category}}."},"bottom":{"latest":"Das waren die aktuellen Themen.","hot":"Das waren alle beliebten Themen.","posted":"Das waren alle Themen.","read":"Das waren alle gelesenen Themen.","new":"Das waren alle neuen Themen.","unread":"Das waren alle ungelesen Themen.","favorited":"Das waren alle favorisierten Themen.","category":"Das waren alle Themen der Kategorie {{category}}."}},"rank_details":{"toggle":"Themadetails","show":"zeige Themadetails","title":"Themadetails"},"topic":{"create_in":"Neues Thema in {{categoryName}}","create":"Neues Thema","create_long":"Neues Thema beginnen","private_message":"Beginne ein privates Gespr\u00e4ch","list":"Themen","new":"Neues Thema","title":"Thema","loading_more":"Lade weitere Themen...","loading":"Lade Thema...","invalid_access":{"title":"Privates Thema","description":"Entschuldige, du hast keinen Zugriff auf dieses Thema."},"server_error":{"title":"Thema konnte nicht geladen werden","description":"Entschuldige, wir konnten das Thema nicht laden, wahrscheinlich aufgrund eines Verbindungsproblems. Bitte versuche es noch mal. Wenn das Problem bestehen bleibt, lass es uns wissen."},"not_found":{"title":"Thema nicht gefunden","description":"Entschuldige, wir konnten das Thema nicht finden. M\u00f6glicherweise wurde es von einem Moderator entfernt."},"unread_posts":"Du hast {{unread}} ungelesene Beitr\u00e4ge zu diesem Thema","new_posts":"Es gibt {{new_posts}} neue Beitr\u00e4ge zu diesem Thema seit Du es das letzte mal gelesen hast","likes":{"one":"Es gibt ein \u201eGef\u00e4llt mir\u201c in diesem Thema","other":"Es gibt {{count}} \u201eGef\u00e4llt mir\u201c in diesem Thema"},"back_to_list":"Zur\u00fcck zur Themen\u00fcbersicht","options":"Themenoptionen","show_links":"Zeige Links in diesem Thema","toggle_information":"Themendetails ein-/ausblenden","read_more_in_category":"M\u00f6chtest Du mehr lesen? Finde andere Themen in {{catLink}} oder {{latestLink}}.","read_more":"M\u00f6chtest Du mehr lesen? {{catLink}} oder {{latestLink}}.","browse_all_categories":"Zeige alle Kategorien","view_latest_topics":"zeige aktuelle Themen","suggest_create_topic":"Fang ein neues Thema an!","read_position_reset":"Deine Leseposition wurde zur\u00fcckgesetzt.","jump_reply_up":"Springe zur vorigen Antwort","jump_reply_down":"Springe zur folgenden Antwort","deleted":"Das Thema wurde gel\u00f6scht","auto_close_notice":"Dieses Thema wird in %{timeLeft} automatisch geschlossen.","auto_close_title":"Automatisches Schliessen","auto_close_save":"Speichern","auto_close_cancel":"Abbrechen","auto_close_remove":"Dieses Thema nicht automatisch schlie\u00dfen","progress":{"title":"Themenfortschritt","jump_top":"Springe zum ersten Beitrag","jump_bottom":"Springe zum letzten Beitrag","total":"Anzahl der Beitr\u00e4ge","current":"Aktueller Beitrag"},"notifications":{"title":"","reasons":{"3_2":"Du wirst Benachrichtigungen erhalten, da Du dieses Thema beobachtest.","3_1":"Du wirst Benachrichtigungen erhalten, da Du dieses Thema erstellt hast.","3":"Du wirst Benachrichtigungen erhalten, da Du dieses Thema beobachtest.","2_4":"Du wirst Benachrichtigungen erhalten, da Du auf dieses Thema geantwortet hast.","2_2":"Du wirst Benachrichtigungen erhalten, da Du dieses Thema verfolgst.","2":"Du wirst Benachrichtigungen erhalten, da Du <a href=\"/users/{{username}}/preferences\">dieses Thema beobachtest</a>.","1":"Du wirst nur benachrichtigt, wenn jemand deinen @Namen erw\u00e4hnt oder auf einen deiner Beitr\u00e4ge antwortet.","1_2":"Du wirst nur benachrichtigt, wenn jemand deinen @Namen erw\u00e4hnt oder auf einen deiner Beitr\u00e4ge antwortet.","0":"Du ignorierst alle Benachrichtigungen dieses Themas.","0_2":"Du ignorierst alle Benachrichtigungen dieses Themas."},"watching":{"title":"Beobachten","description":"Wie 'Verfolgen', zuz\u00fcglich Benachrichtigungen \u00fcber neue Beitr\u00e4ge."},"tracking":{"title":"Verfolgen","description":"Du wirst \u00fcber ungelesene Beitr\u00e4ge, Erw\u00e4hnungen deines @Namens oder Antworten auf deine Beitr\u00e4ge benachrichtigt."},"regular":{"title":"Normal","description":"Du wirst nur dann benachrichtigt, wenn jemand deinen @Namen erw\u00e4hnt oder auf deine Beitr\u00e4ge antwortet."},"muted":{"title":"Ignorieren","description":"Du erh\u00e4ltst keine Benachrichtigungen im Zusammenhang mit diesem Thema und es wird nicht in deiner Liste ungelesener Themen auftauchen."}},"actions":{"delete":"Thema l\u00f6schen","open":"Thema \u00f6ffnen","close":"Thema schlie\u00dfen","auto_close":"Automatisch schlie\u00dfen","unpin":"Pin entfernen","pin":"Pin setzen","unarchive":"Aus dem Archiv holen","archive":"Thema archivieren","invisible":"Unsichtbar machen","visible":"Sichtbar machen","reset_read":"Ungelesen machen","multi_select":"Mehrfachauswahl umschalten","convert_to_topic":"Zu normalem Thema machen"},"reply":{"title":"Antworten","help":"Eine Antwort zu diesem Thema abgeben"},"clear_pin":{"title":"Pin entfernen","help":"Den Pin dieses Themas entfernen, so dass es nicht l\u00e4nger am Anfang der Themenliste steht."},"share":{"title":"Teilen","help":"Teile einen Link zu diesem Thema"},"inviting":"Einladung verschicken...","invite_private":{"title":"Zu privatem Gespr\u00e4ch einladen","email_or_username":"Einzuladender Nutzer","email_or_username_placeholder":"Mailadresse oder Benutzername","action":"Einladen","success":"Danke! Wir haben den Benutzer eingeladen, an diesem privaten Gespr\u00e4ch teilzunehmen.","error":"Entschuldige, es gab einen Fehler beim Einladen des Benutzers."},"invite_reply":{"title":"Freunde zum Gespr\u00e4ch einladen","action":"Einladung senden","help":"Sendet Freunden eine Einladung, so dass mit einem Klick auf dieses Thema antworten k\u00f6nnen.","email":"Wir schicken deiner Freundin / deinem Freund eine kurze Mail, die es mit einem Klick erlaubt, auf dieses Thema zu antworten.","email_placeholder":"Mailadresse","success":"Danke! Wir haben deine Einladung an <b>{{email}}</b> verschickt. Wir lassen Dich wissen, sobald die Einladung eingel\u00f6st wird. In deinem Nutzerprofil kannst Du alle deine Einladungen \u00fcberwachen.","error":"Entschuldige, wir konnten diese Person nicht einladen. Vielleicht ist sie schon ein Nutzer?"},"login_reply":"Anmelden, um zu antworten","filters":{"user":"Du betrachtest nur {{n_posts}} {{by_n_users}}.","n_posts":{"one":"einen Beitrag","other":"{{count}} Beitr\u00e4ge"},"by_n_users":{"one":"von einem Benutzer","other":"von {{count}} Benutzern"},"best_of":"Du betrachtest {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"den besten Beitrag","other":"{{count}} besten Beitr\u00e4ge"},"of_n_posts":{"one":"von einem Thema","other":"von {{count}} Themen"},"cancel":"Zeige wieder alle Beitr\u00e4ge zu diesem Thema."},"split_topic":{"title":"Ausgew\u00e4hlte Beitr\u00e4ge verschieben","action":"Thema aufteilen","topic_name":"Neues Thema:","error":"Entschuldige, es gab einen Fehler beim Verschieben der Beitr\u00e4ge.","instructions":{"one":"Du bist dabei, ein neues Thema zu erstellen und den ausgew\u00e4hlten Beitrag dorthin zu verschieben.","other":"Du bist dabei, ein neues Thema zu erstellen und die <b>{{count}}</b> ausgew\u00e4hlten Beitr\u00e4ge dorthin zu verschieben."}},"merge_topic":{"title":"Themes zusammenf\u00fchren","action":"Themes zusammenf\u00fchren\"","error":"Beim Zusammenf\u00fchren der Themen ist ein Fehler passiert.","instructions":{"one":"Bitte w\u00e4hle das Thema in welches du den Beitrag verschieben m\u00f6chtest.","other":"Bitte w\u00e4hle das Thema in welches du die <b>{{count}}</b> Beitr\u00e4ge verschieben m\u00f6chtest."}},"multi_select":{"select":"Ausgew\u00e4hlt","selected":"Ausgew\u00e4hlt ({{count}})","delete":"Auswahl l\u00f6schen","cancel":"Auswahl aufheben","description":{"one":"Du hast <b>1</b> Beitrag ausgew\u00e4hlt.","other":"Du hast <b>{{count}}</b> Beitr\u00e4ge ausgew\u00e4hlt."}}},"post":{"reply":"Auf {{link}} von {{replyAvatar}} {{username}} antworten","reply_topic":"Auf {{link}} antworten","quote_reply":"Antwort zitieren","edit":"Editing {{link}} von {{replyAvatar}} {{username}}","post_number":"Beitrag {{number}}","in_reply_to":"Antwort auf","reply_as_new_topic":"Mit Themenwechsel antworten","continue_discussion":"Fortsetzung des Gespr\u00e4chs {{postLink}}:","follow_quote":"Springe zu zitiertem Beitrag","deleted_by_author":"(Beitrag vom Autor entfernt)","expand_collapse":"mehr/weniger","has_replies":{"one":"Antwort","other":"Antworten"},"errors":{"create":"Entschuldige, es gab einen Fehler beim Anlegen des Beitrags. Bitte versuche es noch einmal.","edit":"Entschuldige, es gab einen Fehler beim Bearbeiten des Beitrags. Bitte versuche es noch einmal.","upload":"Entschuldige, es gab einen Fehler beim Hochladen der Datei. Bitte versuche es noch einmal.","upload_too_large":"Entschuldige, die Datei die du hochladen wolltest ist zu gro\u00df (Maximalgr\u00f6\u00dfe {{max_size_kb}}kb), bitte reduziere die Dateigr\u00f6\u00dfe und versuche es nochmal.","upload_too_many_images":"Entschuldige, du kannst nur ein Bild gleichzeitig hochladen.","only_images_are_supported":"Entschuldige, du kannst nur Bilder hochladen."},"abandon":"Willst Du diesen Beitrag wirklich verwerfen?","archetypes":{"save":"Speicheroptionen"},"controls":{"reply":"Fange eine Antwort auf diesen Beitrag an","like":"Dieser Beitrag gef\u00e4llt mir","edit":"Diesen Beitrag bearbeiten","flag":"Diesen Beitrag den Moderatoren melden","delete":"Diesen Beitrag l\u00f6schen","undelete":"Diesen Beitrag wiederherstellen","share":"Link zu diesem Beitrag teilen","bookmark":"Lesezeichen zu diesem Beitrag auf meiner Nutzerseite setzen","more":"Mehr"},"actions":{"flag":"Melden","clear_flags":{"one":"Meldung annullieren","other":"Meldungen annullieren"},"it_too":{"off_topic":"Melde es auch","spam":"Melde es auch","inappropriate":"Melde es auch","custom_flag":"Melde es auch","bookmark":"Lesezeichen auch setzen","like":"Gef\u00e4llt mir auch","vote":"Stimme auch daf\u00fcr"},"undo":{"off_topic":"Meldung widerrufen","spam":"Meldung widerrufen\"","inappropriate":"Meldung widerrufen","bookmark":"Lesezeichen entfernen","like":"Gef\u00e4llt mir nicht mehr","vote":"Stimme wiederrufen"},"people":{"off_topic":"{{icons}} haben es als am Thema vorbei gemeldet","spam":"{{icons}} haben es als Werbung gemeldet","inappropriate":"{{icons}} haben es als Unangemessen gemeldet","notify_moderators":"{{icons}} haben es den Moderatoren gemeldet","notify_moderators_with_url":"{{icons}} <a href='{{postUrl}}'>haben es den Moderatoren gemeldet</a>","notify_user":"{{icons}} haben eine private Nachricht gesendet","notify_user_with_url":"{{icons}} haben eine  <a href='{{postUrl}}'>private Nachricht</a> gesendet","bookmark":"{{icons}} haben dies als Lesezeichen","like":"{{icons}} gef\u00e4llt dies","vote":"{{icons}} haben daf\u00fcr gestimmt"},"by_you":{"off_topic":"Du hast das als am Thema vorbei gemeldet","spam":"Du hast das als Werbung gemeldet","inappropriate":"Du hast das als Unangemessen gemeldet","notify_moderators":"Du hast dies den Moderatoren gemeldet","notify_user":"Du hast diesem Benutzer eine private Nachricht gesendet","bookmark":"Du hast bei diesem Beitrag ein Lesezeichen gesetzt","like":"Gef\u00e4llt dir","vote":"Du hast daf\u00fcr gestimmt"},"by_you_and_others":{"off_topic":{"one":"Du und eine weitere Person haben das als am Thema vorbei gemeldet","other":"Du und {{count}} weitere Personen haben das als am Thema vorbei gemeldet\""},"spam":{"one":"Du und eine weitere Person haben das als Werbung gemeldet","other":"Du und {{count}} weitere Personen haben das als Werbung gemeldet"},"inappropriate":{"one":"Du und eine weitere Person haben das als Unangemessen gemeldet","other":"Du und {{count}} weitere Personen haben das als Unangemessen gemeldet"},"notify_moderators":{"one":"Du und eine weitere Person haben dies den Moderatoren gemeldet","other":"Du und {{count}} weitere Personen haben dies den Moderatoren gemeldet"},"notify_user":{"one":"Du und eine weitere Person haben diesem Benutzer eine private Nachricht gesendet","other":"Du und {{count}} weitere Personen haben diesem Benutzer eine private Nachricht gesendet"},"bookmark":{"one":"Du und eine weitere Person haben bei diesen Beitrag ein Lesezeichen gesetzt","other":"Du und {{count}} weitere Personen haben bei diesen Beitrag ein Lesezeichen gesetzt"},"like":{"one":"Dir und einer weitere Person gef\u00e4llt dieser Beitrag","other":"Dir und {{count}} weitere Personen haben gef\u00e4llt dieser Beitrag"},"vote":{"one":"Du und eine weitere Person haben f\u00fcr diesen Beitrag gestimmt","other":"Du und {{count}} weitere Personen haben f\u00fcr diesen Beitrag gestimmt"}},"by_others":{"off_topic":{"one":"Eine Person hat das als am Thema vorbei gemeldet","other":"{{count}} Personen haben das als am Thema vorbei gemeldet"},"spam":{"one":"Eine Person hat das als Werbung gemeldet","other":"{{count}} Personen haben das als Werbung gemeldet"},"inappropriate":{"one":"Eine Person hat das als Unangemessen gemeldet","other":"{{count}} Personen haben das als Unangemessen gemeldet"},"notify_moderators":{"one":"Eine Person hat dies den Moderatoren gemeldet","other":"{{count}} Personen haben dies den Moderatoren gemeldet"},"notify_user":{"one":"Eine Person hat diesem Benutzer eine private Nachricht gesendet","other":"{{count}} Personen haben diesem Benutzer eine private Nachricht gesendet"},"bookmark":{"one":"Eine Person hat bei diesen Beitrag ein Lesezeichen gesetzt","other":"{{count}} Personen haben bei diesen Beitrag ein Lesezeichen gesetzt"},"like":{"one":"Einer Person gef\u00e4llt dies","other":"{{count}} Personen gef\u00e4llt dies"},"vote":{"one":"Eine Person hat f\u00fcr den Beitrag gestimmt","other":"{{count}} Personen haben f\u00fcr den Beitrag gestimmt"}}},"edits":{"one":"1 Bearbeitung","other":"{{count}} Bearbeitungen","zero":"Keine Bearbeitungen"},"delete":{"confirm":{"one":"Bist Du sicher, dass Du diesen Beitrag l\u00f6schen willst?","other":"Bist Du sicher, dass Du all diesen Beitr\u00e4ge l\u00f6schen willst?"}}},"category":{"none":"(keine Kategorie)","edit":"Bearbeiten","edit_long":"Kategorie bearbeiten","edit_uncategorized":"Unkategorisierte bearbeiten","view":"Zeige Themen dieser Kategorie","general":"Generell","settings":"Einstellungen","delete":"Kategorie l\u00f6schen","create":"Neue Kategorie","save":"Kategorie speichern","creation_error":"Beim Erzeugen der Kategorie ist ein Fehler aufgetreten.","save_error":"Beim Speichern der Kategorie ist ein Fehler aufgetreten.","more_posts":"Zeige alle {{posts}}...","name":"Name der Kategorie","description":"Beschreibung","topic":"Kategorie des Themas","badge_colors":"Plakettenfarben","background_color":"Hintergrundfarbe","foreground_color":"Vordergrundfarbe","name_placeholder":"Sollte kurz und knapp sein.","color_placeholder":"Irgendeine Webfarbe","delete_confirm":"Bist Du sicher, dass Du diese Kategorie l\u00f6schen willst?","delete_error":"Beim L\u00f6schen der Kategorie ist ein Fehler aufgetreten.","list":"Kategorien auflisten","no_description":"Es gibt keine Beschreibung zu dieser Kategorie.","change_in_category_topic":"Besuche die Themen dieser Kategorie um einen Eindruck f\u00fcr eine gute Beschreibung zu gewinnen.","hotness":"Beliebtheit","already_used":"Diese Farbe wird bereits f\u00fcr eine andere Kategorie verwendet","is_secure":"Sichere Kategorie?","add_group":"Gruppe hinzuf\u00fcgen","security":"Sicherheit","allowed_groups":"Erlaubte Gruppen:","auto_close_label":"Thema automatisch schlie\u00dfen nach:"},"flagging":{"title":"Aus welchem Grund meldest Du diesen Beitrag?","action":"Beitrag melden","take_action":"Reagieren","notify_action":"Melden","cant":"Entschuldige, Du kannst diesen Beitrag augenblicklich nicht melden.","custom_placeholder_notify_user":"Weshalb erfordert der Beitrag, dass du den Benutzer direkt und privat kontaktieren m\u00f6chtest? Sei spezifisch, konstruktiv und immer freundlich.","custom_placeholder_notify_moderators":"Warum soll ein Moderator sich diesen Beitrag ansehen? Bitte lass uns wissen, was genau Dich beunruhigt, und wenn m\u00f6glich daf\u00fcr relevante Links.","custom_message":{"at_least":"Gib mindestens {{n}} Zeichen ein","more":"{{n}} weitere...","left":"{{n}} \u00fcbrig"}},"topic_summary":{"title":"Zusammenfassung des Themas","links_shown":"Zeige alle {{totalLinks}} Links...","clicks":"Klicks","topic_link":"Themen Links"},"topic_statuses":{"locked":{"help":"Dieses Thema ist geschlossen; Antworten werde nicht l\u00e4nger angenommen"},"pinned":{"help":"Dieses Thema ist angepinnt; es wird immer am Anfang seiner Kategorie auftauchen"},"archived":{"help":"Dieses Thema ist archiviert; es ist eingefroren und kann nicht mehr ge\u00e4ndert werden"},"invisible":{"help":"Dieses Thema ist unsichtbar; es wird in keiner Themenliste angezeigt und kann nur \u00fcber den Link betrachtet werden"}},"posts":"Beitr\u00e4ge","posts_long":"{{number}} Beitr\u00e4ge zu diesem Thema","original_post":"Originaler Beitrag","views":"Aufrufe","replies":"Antworten","views_long":"Dieses Thema wurde {{number}} aufgerufen","activity":"Aktivit\u00e4t","likes":"Gef\u00e4llt mir","top_contributors":"Teilnehmer","category_title":"Kategorie","history":"Verlauf","changed_by":"durch {{author}}","categories_list":"Liste der Kategorien","filters":{"latest":{"title":"Aktuell","help":"Die zuletzt ge\u00e4nderten Themen"},"hot":{"title":"Beliebt","help":"Auswahl der beliebten Themen"},"favorited":{"title":"Favorisiert","help":"Themen, die Du als Favoriten markiert hast"},"read":{"title":"Gelesen","help":"Themen, die Du gelesen hast"},"categories":{"title":"Kategorien","title_in":"Kategorie - {{categoryName}}","help":"Alle Themen, gruppiert nach Kategorie"},"unread":{"title":{"zero":"Ungelesen","one":"Ungelesen (1)","other":"Ungelesen ({{count}})"},"help":"Verfolgte Themen mit ungelesenen Beitr\u00e4gen"},"new":{"title":{"zero":"Neu","one":"Neu (1)","other":"Neu ({{count}})"},"help":"Neue Themen seit deinem letzten Besuch"},"posted":{"title":"Deine Beitr\u00e4ge","help":"Themen zu denen Du beigetragen hast"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"Aktuelle Themen in der Kategorie {{categoryName}}"}},"browser_update":"<a href=\"http://www.discourse.org/faq/#browser\">Dein Webbrowser ist leider zu alt um dieses Forum zu besuchen</a>. Bitte <a href=\"http://browsehappy.com\">installiere einen neueren Browser</a>.","type_to_filter":"Tippe etwas ein, um zu filtern...","admin":{"title":"Discourse Administrator","moderator":"Moderator","dashboard":{"title":"\u00dcbersicht","version":"Version","up_to_date":"Discourse ist aktuell.","critical_available":"Ein kritisches Update ist verf\u00fcgbar.","updates_available":"Updates sind verf\u00fcgbar.","please_upgrade":"Bitte updaten!","installed_version":"Installiert","latest_version":"J\u00fcngste","problems_found":"Es gibt Probleme mit deiner Discourse-Installation:","last_checked":"Zuletzt gepr\u00fcft","refresh_problems":"Neu Laden","no_problems":"Keine Probleme gefunden.","moderators":"Moderatoren:","admins":"Administratoren:","blocked":"Gesperrt:","private_messages_short":"PNs","private_messages_title":"Private Nachrichten","reports":{"today":"Heute","yesterday":"Gestern","last_7_days":"Die letzten 7 Tage","last_30_days":"Die letzten 30 Tage","all_time":"Bis heute","7_days_ago":"Vor 7 Tagen","30_days_ago":"Vor 30 Tagen","all":"Alle","view_table":"Als Tabelle anzeigen","view_chart":"Als Balkendiagramm anzeigen"}},"commits":{"latest_changes":"Letzte \u00c4nderungen: bitte h\u00e4ufig updaten!","by":"durch"},"flags":{"title":"Meldungen","old":"Alt","active":"Aktiv","clear":"Meldungen annullieren","clear_title":"Verwerfe alle Meldungen \u00fcber diesen Beitrag (blendet verstecke Beitr\u00e4ge ein)","delete":"Beitrag l\u00f6schen","delete_title":"Beitrag l\u00f6schen (l\u00f6scht Thema, wenn es der erste Beitrag ist)","flagged_by":"Gemeldet von","error":"Etwas ist schief gelaufen","view_message":"Nachricht zeigen","no_results":"Es gibt keine Meldungen."},"groups":{"title":"Gruppen","edit":"Gruppen bearbeiten","selector_placeholder":"Benutzer hinzuf\u00fcgen","name_placeholder":"Gruppenname, keine Leerzeichen, gleiche Regel wie beim Benutzernamen"},"api":{"title":"API","long_title":"API Information","key":"Schl\u00fcssel","generate":"API Schl\u00fcssel generieren","regenerate":"API Schl\u00fcssel neu generieren","info_html":"Dein API Schl\u00fcssel erlaubt Dir das Erstellen und Bearbeiten von Themen via JSON aufrufen.","note_html":"Behalte deinen <strong>Schl\u00fcssel</strong> geheim, jeder Benutzer mit diesem Schl\u00fcssel kann beliebige Beitr\u00e4ge unter jedem Benutzer im Forum erstellen."},"customize":{"title":"Personalisieren","long_title":"Seite personalisieren","header":"Header","css":"Stylesheet","override_default":"Standard \u00fcberschreiben?","enabled":"Aktiviert?","preview":"Vorschau","undo_preview":"Vorschau r\u00fcckg\u00e4ngig machen","save":"Speichern","new":"Neu","new_style":"Neuer Stil","delete":"L\u00f6schen","delete_confirm":"Diese Anpassung l\u00f6schen?","about":"Seite personalisieren erlaubt dir das Anpassen der Stilvorlagen und des Kopfbereich der Seite. W\u00e4hle oder f\u00fcge eine Anpassung hinzu um mit dem Editieren zu beginnen."},"email":{"title":"Mailprotokoll","settings":"Einstellungen","logs":"Protokolle","sent_at":"Gesendet am","email_type":"Mailtyp","to_address":"Empf\u00e4nger","test_email_address":"Mailadresse zum Testen","send_test":"Testmail senden","sent_test":"Gesendet!","delivery_method":"Versandmethode","preview_digest":"Vorschau der \u00dcbersicht","refresh":"Aktualisieren","format":"Format","html":"html","text":"text","last_seen_user":"Letzer Benutzer:"},"impersonate":{"title":"Aus Nutzersicht betrachten","username_or_email":"Benutzername oder Mailadresse des Nutzers","help":"Benutze dieses Werkzeug, um zur Fehlersuche in die Rolle eines Nutzers zu schl\u00fcpfen.","not_found":"Der Nutzer wurde nicht gefunden.","invalid":"Entschuldige, du kannst nicht in die Rolle dieses Nutzers schl\u00fcpfen."},"users":{"title":"Benutzer","create":"Administrator hinzuf\u00fcgen","last_emailed":"Letzte Mail","not_found":"Entschuldige, dieser Benutzername existiert im System nicht.","new":"Neu","active":"Aktiv","pending":"Unerledigt","approved":"Zugelassen?","approved_selected":{"one":"Benutzer zulassen","other":"Benutzer zulassen ({{count}})"},"titles":{"active":"Aktive Benutzer","new":"Neue Benutzer","pending":"Nicht freigeschaltete Benutzer","newuser":"Benutzer mit Vertrauensstufe 0 (Frischling)'","basic":"Benutzer mit Vertrauensstufe 1 (Anf\u00e4nger)","regular":"Benutzer mit Vertrauensstufe 2 (Stammnutzer)","leader":"Benutzer mit Vertrauensstufe 3 (Anf\u00fchrer)","elder":"Benutzer mit Vertrauensstufe 4 (\u00c4ltester)","admins":"Admin Benutzer","moderators":"Moderatoren","blocked":"Gesperrte Benutzer"}},"user":{"ban_failed":"Beim Sperren dieses Benutzers ist etwas schief gegangen {{error}}","unban_failed":"Beim Entsperren dieses Benutzers ist etwas schief gegangen {{error}}","ban_duration":"Wie lange soll dieser Benutzer gesperrt werden? (Tage)","delete_all_posts":"L\u00f6sche alle Beitr\u00e4ge","ban":"Sperren","unban":"Entsperren","banned":"Gesperrt?","moderator":"Moderator?","admin":"Administrator?","blocked":"Gesperrt?","show_admin_profile":"Administration","refresh_browsers":"Erzwinge Browser-Refresh","show_public_profile":"Zeige \u00f6ffentliches Profil","impersonate":"Nutzersicht","revoke_admin":"Administrationsrechte entziehen","grant_admin":"Administrationsrechte vergeben","revoke_moderation":"Moderationsrechte entziehen","grant_moderation":"Moderationsrechte vergeben","unblock":"Entsperren","block":"Sperren","reputation":"Reputation","permissions":"Rechte","activity":"Aktivit\u00e4t","like_count":"Erhaltene \u201eGef\u00e4llt mir\u201c","private_topics_count":"Zahl privater Themen","posts_read_count":"Gelesene Beitr\u00e4ge","post_count":"Erstelle Beitr\u00e4ge","topics_entered":"Beigesteuerte Themen","flags_given_count":"Gemachte Meldungen","flags_received_count":"Erhaltene Meldungen","approve":"Genehmigen","approved_by":"genehmigt von","approve_success":"Benutser freigeschalten und Mail mit den Anweisungen zur Aktivierung gesendet.","approve_bulk_success":"Erfolg! Alle ausgew\u00e4hlten Benutzer wurden freigeschalten und benachrichtigt.","time_read":"Lesezeit","delete":"Benutzer l\u00f6schen","delete_forbidden":"Der Benutzer kann nicht gel\u00f6scht werden, da er noch Beitr\u00e4ge hat. L\u00f6sche zuerst seine Betr\u00e4ge.","delete_confirm":"Bist du SICHER das du diesen Benutzer permanent von der Seite entfernen m\u00f6chtest? Diese Aktion kann nicht r\u00fcckg\u00e4ngig gemacht werden!","deleted":"Der Benutzer wurde gel\u00f6scht.","delete_failed":"Beim L\u00f6schen des Benutzers ist ein Fehler aufgetreten. Stelle sicher, dass dieser Benutzer keine Beitr\u00e4ge mehr hat.","send_activation_email":"Aktivierungsmail senden","activation_email_sent":"Die Aktivierungsmail wurde versendet.","send_activation_email_failed":"Beim Sender der Mail ist ein Fehler aufgetreten.","activate":"Benutzer aktivieren","activate_failed":"Beim Aktivieren des Benutzers ist ein Fehler aufgetreten.","deactivate_account":"Benutzer deaktivieren","deactivate_failed":"Beim Deaktivieren des Benutzers ist ein Fehler aufgetreten.","unblock_failed":"Beim Entsperren des Benutzers ist ein Fehler aufgetreten.","block_failed":"Beim Sperren des Benutzers ist ein Fehler aufgetreten.","block_explanation":"Ein gesperrter Benutzer kann keine Themen erstellen oder Beitr\u00e4ge ver\u00f6ffentlichen."},"site_content":{"none":"W\u00e4hle einen Inhaltstyp um mit dem Bearbeiten zu beginnen.","title":"Inhalt","edit":"Seiteninhalt bearbeiten"},"site_settings":{"show_overriden":"Zeige nur ge\u00e4nderte Einstellungen","title":"Einstellungen","reset":"Zur\u00fccksetzen"}}}}};
I18n.locale = 'de';
// moment.js
// version : 2.0.0
// author : Tim Wood
// license : MIT
// momentjs.com

(function (undefined) {

    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = "2.0.0",
        round = Math.round, i,
        // internal storage for language config files
        languages = {},

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(\d*)?\.?(\d+)\:(\d+)\:(\d+)\.?(\d{3})?/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|SS?S?|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LT|LL?L?L?|l{1,4})/g,

        // parsing tokens
        parseMultipleFormatChunker = /([0-9a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+)/gi,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/i, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO seperator)
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123

        // preliminary iso regex
        // 0000-00-00 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000
        isoRegex = /^\s*\d{4}-\d\d-\d\d((T| )(\d\d(:\d\d(:\d\d(\.\d\d?\d?)?)?)?)?([\+\-]\d\d:?\d\d)?)?/,
        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.S', /(T| )\d\d:\d\d:\d\d\.\d{1,3}/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker "+10:00" > ["10", "00"] or "-1530" > ["-15", "30"]
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds' : 1,
            'Seconds' : 1e3,
            'Minutes' : 6e4,
            'Hours' : 36e5,
            'Days' : 864e5,
            'Months' : 2592e6,
            'Years' : 31536e6
        },

        unitAliases = {
            ms : 'millisecond',
            s : 'second',
            m : 'minute',
            h : 'hour',
            d : 'day',
            w : 'week',
            M : 'month',
            y : 'year'
        },

        // format function strings
        formatFunctions = {},

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M    : function () {
                return this.month() + 1;
            },
            MMM  : function (format) {
                return this.lang().monthsShort(this, format);
            },
            MMMM : function (format) {
                return this.lang().months(this, format);
            },
            D    : function () {
                return this.date();
            },
            DDD  : function () {
                return this.dayOfYear();
            },
            d    : function () {
                return this.day();
            },
            dd   : function (format) {
                return this.lang().weekdaysMin(this, format);
            },
            ddd  : function (format) {
                return this.lang().weekdaysShort(this, format);
            },
            dddd : function (format) {
                return this.lang().weekdays(this, format);
            },
            w    : function () {
                return this.week();
            },
            W    : function () {
                return this.isoWeek();
            },
            YY   : function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY : function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY : function () {
                return leftZeroFill(this.year(), 5);
            },
            gg   : function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg : function () {
                return this.weekYear();
            },
            ggggg : function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG   : function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG : function () {
                return this.isoWeekYear();
            },
            GGGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e : function () {
                return this.weekday();
            },
            E : function () {
                return this.isoWeekday();
            },
            a    : function () {
                return this.lang().meridiem(this.hours(), this.minutes(), true);
            },
            A    : function () {
                return this.lang().meridiem(this.hours(), this.minutes(), false);
            },
            H    : function () {
                return this.hours();
            },
            h    : function () {
                return this.hours() % 12 || 12;
            },
            m    : function () {
                return this.minutes();
            },
            s    : function () {
                return this.seconds();
            },
            S    : function () {
                return ~~(this.milliseconds() / 100);
            },
            SS   : function () {
                return leftZeroFill(~~(this.milliseconds() / 10), 2);
            },
            SSS  : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z    : function () {
                var a = -this.zone(),
                    b = "+";
                if (a < 0) {
                    a = -a;
                    b = "-";
                }
                return b + leftZeroFill(~~(a / 60), 2) + ":" + leftZeroFill(~~a % 60, 2);
            },
            ZZ   : function () {
                var a = -this.zone(),
                    b = "+";
                if (a < 0) {
                    a = -a;
                    b = "-";
                }
                return b + leftZeroFill(~~(10 * a / 6), 4);
            },
            z : function () {
                return this.zoneAbbr();
            },
            zz : function () {
                return this.zoneName();
            },
            X    : function () {
                return this.unix();
            }
        };

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.lang().ordinal(func.call(this, a), period);
        };
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    /************************************
        Constructors
    ************************************/

    function Language() {

    }

    // Moment prototype object
    function Moment(config) {
        extend(this, config);
    }

    // Duration Constructor
    function Duration(duration) {
        var data = this._data = {},
            years = duration.years || duration.year || duration.y || 0,
            months = duration.months || duration.month || duration.M || 0,
            weeks = duration.weeks || duration.week || duration.w || 0,
            days = duration.days || duration.day || duration.d || 0,
            hours = duration.hours || duration.hour || duration.h || 0,
            minutes = duration.minutes || duration.minute || duration.m || 0,
            seconds = duration.seconds || duration.second || duration.s || 0,
            milliseconds = duration.milliseconds || duration.millisecond || duration.ms || 0;

        // representation for dateAddRemove
        this._milliseconds = milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = months +
            years * 12;

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;
        seconds += absRound(milliseconds / 1000);

        data.seconds = seconds % 60;
        minutes += absRound(seconds / 60);

        data.minutes = minutes % 60;
        hours += absRound(minutes / 60);

        data.hours = hours % 24;
        days += absRound(hours / 24);

        days += weeks * 7;
        data.days = days % 30;

        months += absRound(days / 30);

        data.months = months % 12;
        years += absRound(months / 12);

        data.years = years;
    }


    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (b.hasOwnProperty(i)) {
                a[i] = b[i];
            }
        }
        return a;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength) {
        var output = number + '';
        while (output.length < targetLength) {
            output = '0' + output;
        }
        return output;
    }

    // helper function for _.addTime and _.subtractTime
    function addOrSubtractDurationFromMoment(mom, duration, isAdding, ignoreUpdateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months,
            minutes,
            hours,
            currentDate;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        // store the minutes and hours so we can restore them
        if (days || months) {
            minutes = mom.minute();
            hours = mom.hour();
        }
        if (days) {
            mom.date(mom.date() + days * isAdding);
        }
        if (months) {
            currentDate = mom.date();
            mom.date(1)
                .month(mom.month() + months * isAdding)
                .date(Math.min(currentDate, mom.daysInMonth()));
        }
        if (milliseconds && !ignoreUpdateOffset) {
            moment.updateOffset(mom);
        }
        // restore the minutes and hours after possibly changing dst
        if (days || months) {
            mom.minute(minutes);
            mom.hour(hours);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if (~~array1[i] !== ~~array2[i]) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        return units ? unitAliases[units] || units.toLowerCase().replace(/(.)s$/, '$1') : units;
    }


    /************************************
        Languages
    ************************************/


    Language.prototype = {
        set : function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
        },

        _months : "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
        months : function (m) {
            return this._months[m.month()];
        },

        _monthsShort : "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),
        monthsShort : function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse : function (monthName) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                if (!this._monthsParse[i]) {
                    mom = moment([2000, i]);
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays : "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
        weekdays : function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort : "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
        weekdaysShort : function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin : "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
        weekdaysMin : function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse : function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat : {
            LT : "h:mm A",
            L : "MM/DD/YYYY",
            LL : "MMMM D YYYY",
            LLL : "MMMM D YYYY LT",
            LLLL : "dddd, MMMM D YYYY LT"
        },
        longDateFormat : function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM : function (input) {
            return ((input + '').toLowerCase()[0] === 'p');
        },

        _meridiemParse : /[ap]\.?m?\.?/i,
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },

        _calendar : {
            sameDay : '[Today at] LT',
            nextDay : '[Tomorrow at] LT',
            nextWeek : 'dddd [at] LT',
            lastDay : '[Yesterday at] LT',
            lastWeek : '[Last] dddd [at] LT',
            sameElse : 'L'
        },
        calendar : function (key, mom) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom) : output;
        },

        _relativeTime : {
            future : "in %s",
            past : "%s ago",
            s : "a few seconds",
            m : "a minute",
            mm : "%d minutes",
            h : "an hour",
            hh : "%d hours",
            d : "a day",
            dd : "%d days",
            M : "a month",
            MM : "%d months",
            y : "a year",
            yy : "%d years"
        },
        relativeTime : function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },
        pastFuture : function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal : function (number) {
            return this._ordinal.replace("%d", number);
        },
        _ordinal : "%d",

        preparse : function (string) {
            return string;
        },

        postformat : function (string) {
            return string;
        },

        week : function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },
        _week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        }
    };

    // Loads a language definition into the `languages` cache.  The function
    // takes a key and optionally values.  If not in the browser and no values
    // are provided, it will load the language file module.  As a convenience,
    // this function also returns the language values.
    function loadLang(key, values) {
        values.abbr = key;
        if (!languages[key]) {
            languages[key] = new Language();
        }
        languages[key].set(values);
        return languages[key];
    }

    // Determines which language definition to use and returns it.
    //
    // With no parameters, it will return the global language.  If you
    // pass in a language key, such as 'en', it will return the
    // definition for 'en', so long as 'en' has already been loaded using
    // moment.lang.
    function getLangDefinition(key) {
        if (!key) {
            return moment.fn._lang;
        }
        if (!languages[key] && hasModule) {
            require('./lang/' + key);
        }
        return languages[key];
    }


    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[.*\]/)) {
            return input.replace(/^\[|\]$/g, "");
        }
        return input.replace(/\\/g, "");
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = "";
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return m.lang().longDateFormat(input) || input;
        }

        while (i-- && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
        }

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        switch (token) {
        case 'DDDD':
            return parseTokenThreeDigits;
        case 'YYYY':
            return parseTokenFourDigits;
        case 'YYYYY':
            return parseTokenSixDigits;
        case 'S':
        case 'SS':
        case 'SSS':
        case 'DDD':
            return parseTokenOneToThreeDigits;
        case 'MMM':
        case 'MMMM':
        case 'dd':
        case 'ddd':
        case 'dddd':
            return parseTokenWord;
        case 'a':
        case 'A':
            return getLangDefinition(config._l)._meridiemParse;
        case 'X':
            return parseTokenTimestampMs;
        case 'Z':
        case 'ZZ':
            return parseTokenTimezone;
        case 'T':
            return parseTokenT;
        case 'MM':
        case 'DD':
        case 'YY':
        case 'HH':
        case 'hh':
        case 'mm':
        case 'ss':
        case 'M':
        case 'D':
        case 'd':
        case 'H':
        case 'h':
        case 'm':
        case 's':
            return parseTokenOneOrTwoDigits;
        default :
            return new RegExp(token.replace('\\', ''));
        }
    }

    function timezoneMinutesFromString(string) {
        var tzchunk = (parseTokenTimezone.exec(string) || [])[0],
            parts = (tzchunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + ~~parts[2];

        return parts[0] === '+' ? -minutes : minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, b,
            datePartArray = config._a;

        switch (token) {
        // MONTH
        case 'M' : // fall through to MM
        case 'MM' :
            datePartArray[1] = (input == null) ? 0 : ~~input - 1;
            break;
        case 'MMM' : // fall through to MMMM
        case 'MMMM' :
            a = getLangDefinition(config._l).monthsParse(input);
            // if we didn't find a month name, mark the date as invalid.
            if (a != null) {
                datePartArray[1] = a;
            } else {
                config._isValid = false;
            }
            break;
        // DAY OF MONTH
        case 'D' : // fall through to DDDD
        case 'DD' : // fall through to DDDD
        case 'DDD' : // fall through to DDDD
        case 'DDDD' :
            if (input != null) {
                datePartArray[2] = ~~input;
            }
            break;
        // YEAR
        case 'YY' :
            datePartArray[0] = ~~input + (~~input > 68 ? 1900 : 2000);
            break;
        case 'YYYY' :
        case 'YYYYY' :
            datePartArray[0] = ~~input;
            break;
        // AM / PM
        case 'a' : // fall through to A
        case 'A' :
            config._isPm = getLangDefinition(config._l).isPM(input);
            break;
        // 24 HOUR
        case 'H' : // fall through to hh
        case 'HH' : // fall through to hh
        case 'h' : // fall through to hh
        case 'hh' :
            datePartArray[3] = ~~input;
            break;
        // MINUTE
        case 'm' : // fall through to mm
        case 'mm' :
            datePartArray[4] = ~~input;
            break;
        // SECOND
        case 's' : // fall through to ss
        case 'ss' :
            datePartArray[5] = ~~input;
            break;
        // MILLISECOND
        case 'S' :
        case 'SS' :
        case 'SSS' :
            datePartArray[6] = ~~ (('0.' + input) * 1000);
            break;
        // UNIX TIMESTAMP WITH MS
        case 'X':
            config._d = new Date(parseFloat(input) * 1000);
            break;
        // TIMEZONE
        case 'Z' : // fall through to ZZ
        case 'ZZ' :
            config._useUTC = true;
            config._tzm = timezoneMinutesFromString(input);
            break;
        }

        // if the input is null, the date is not valid
        if (input == null) {
            config._isValid = false;
        }
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromArray(config) {
        var i, date, input = [];

        if (config._d) {
            return;
        }

        for (i = 0; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // add the offsets to the time to be parsed so that we can have a clean array for checking isValid
        input[3] += ~~((config._tzm || 0) / 60);
        input[4] += ~~((config._tzm || 0) % 60);

        date = new Date(0);

        if (config._useUTC) {
            date.setUTCFullYear(input[0], input[1], input[2]);
            date.setUTCHours(input[3], input[4], input[5], input[6]);
        } else {
            date.setFullYear(input[0], input[1], input[2]);
            date.setHours(input[3], input[4], input[5], input[6]);
        }

        config._d = date;
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {
        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var tokens = config._f.match(formattingTokens),
            string = config._i,
            i, parsedInput;

        config._a = [];

        for (i = 0; i < tokens.length; i++) {
            parsedInput = (getParseRegexForToken(tokens[i], config).exec(string) || [])[0];
            if (parsedInput) {
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
            }
            // don't parse if its not a known token
            if (formatTokenFunctions[tokens[i]]) {
                addTimeToArrayFromToken(tokens[i], parsedInput, config);
            }
        }

        // add remaining unparsed input to the string
        if (string) {
            config._il = string;
        }

        // handle am pm
        if (config._isPm && config._a[3] < 12) {
            config._a[3] += 12;
        }
        // if is 12 am, change hours to 0
        if (config._isPm === false && config._a[3] === 12) {
            config._a[3] = 0;
        }
        // return
        dateFromArray(config);
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            tempMoment,
            bestMoment,

            scoreToBeat = 99,
            i,
            currentScore;

        for (i = 0; i < config._f.length; i++) {
            tempConfig = extend({}, config);
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);
            tempMoment = new Moment(tempConfig);

            currentScore = compareArrays(tempConfig._a, tempMoment.toArray());

            // if there is any input that was not parsed
            // add a penalty for that format
            if (tempMoment._il) {
                currentScore += tempMoment._il.length;
            }

            if (currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempMoment;
            }
        }

        extend(config, bestMoment);
    }

    // date from iso format
    function makeDateFromString(config) {
        var i,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            // match[2] should be "T" or undefined
            config._f = 'YYYY-MM-DD' + (match[2] || " ");
            for (i = 0; i < 4; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (parseTokenTimezone.exec(string)) {
                config._f += " Z";
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._d = new Date(string);
        }
    }

    function makeDateFromInput(config) {
        var input = config._i,
            matched = aspNetJsonRegex.exec(input);

        if (input === undefined) {
            config._d = new Date();
        } else if (matched) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = input.slice(0);
            dateFromArray(config);
        } else {
            config._d = input instanceof Date ? new Date(+input) : new Date(input);
        }
    }


    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, lang) {
        return lang.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(milliseconds, withoutSuffix, lang) {
        var seconds = round(Math.abs(milliseconds) / 1000),
            minutes = round(seconds / 60),
            hours = round(minutes / 60),
            days = round(hours / 24),
            years = round(days / 365),
            args = seconds < 45 && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < 45 && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < 22 && ['hh', hours] ||
                days === 1 && ['d'] ||
                days <= 25 && ['dd', days] ||
                days <= 45 && ['M'] ||
                days < 345 && ['MM', round(days / 30)] ||
                years === 1 && ['y'] || ['yy', years];
        args[2] = withoutSuffix;
        args[3] = milliseconds > 0;
        args[4] = lang;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add('d', daysToDayOfWeek);
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }


    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f;

        if (input === null || input === '') {
            return null;
        }

        if (typeof input === 'string') {
            config._i = input = getLangDefinition().preparse(input);
        }

        if (moment.isMoment(input)) {
            config = extend({}, input);
            config._d = new Date(+input._d);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        return new Moment(config);
    }

    moment = function (input, format, lang) {
        return makeMoment({
            _i : input,
            _f : format,
            _l : lang,
            _isUTC : false
        });
    };

    // creating with utc
    moment.utc = function (input, format, lang) {
        return makeMoment({
            _useUTC : true,
            _isUTC : true,
            _l : lang,
            _i : input,
            _f : format
        });
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var isDuration = moment.isDuration(input),
            isNumber = (typeof input === 'number'),
            duration = (isDuration ? input._data : (isNumber ? {} : input)),
            matched = aspNetTimeSpanJsonRegex.exec(input),
            sign,
            ret;

        if (isNumber) {
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (matched) {
            sign = (matched[1] === "-") ? -1 : 1;
            duration = {
                y: 0,
                d: ~~matched[2] * sign,
                h: ~~matched[3] * sign,
                m: ~~matched[4] * sign,
                s: ~~matched[5] * sign,
                ms: ~~matched[6] * sign
            };
        }

        ret = new Duration(duration);

        if (isDuration && input.hasOwnProperty('_lang')) {
            ret._lang = input._lang;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () {};

    // This function will load languages and then set the global language.  If
    // no arguments are passed in, it will simply return the current global
    // language key.
    moment.lang = function (key, values) {
        var i;

        if (!key) {
            return moment.fn._lang._abbr;
        }
        if (values) {
            loadLang(key, values);
        } else if (!languages[key]) {
            getLangDefinition(key);
        }
        moment.duration.fn._lang = moment.fn._lang = getLangDefinition(key);
    };

    // returns language data
    moment.langData = function (key) {
        if (key && key._lang && key._lang._abbr) {
            key = key._lang._abbr;
        }
        return getLangDefinition(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment;
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };


    /************************************
        Moment Prototype
    ************************************/


    moment.fn = Moment.prototype = {

        clone : function () {
            return moment(this);
        },

        valueOf : function () {
            return +this._d + ((this._offset || 0) * 60000);
        },

        unix : function () {
            return Math.floor(+this / 1000);
        },

        toString : function () {
            return this.format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
        },

        toDate : function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString : function () {
            return formatMoment(moment(this).utc(), 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        },

        toArray : function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid : function () {
            if (this._isValid == null) {
                if (this._a) {
                    this._isValid = !compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray());
                } else {
                    this._isValid = !isNaN(this._d.getTime());
                }
            }
            return !!this._isValid;
        },

        utc : function () {
            return this.zone(0);
        },

        local : function () {
            this.zone(0);
            this._isUTC = false;
            return this;
        },

        format : function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.lang().postformat(output);
        },

        add : function (input, val) {
            var dur;
            // switch args to support add('s', 1) and add(1, 's')
            if (typeof input === 'string') {
                dur = moment.duration(+val, input);
            } else {
                dur = moment.duration(input, val);
            }
            addOrSubtractDurationFromMoment(this, dur, 1);
            return this;
        },

        subtract : function (input, val) {
            var dur;
            // switch args to support subtract('s', 1) and subtract(1, 's')
            if (typeof input === 'string') {
                dur = moment.duration(+val, input);
            } else {
                dur = moment.duration(input, val);
            }
            addOrSubtractDurationFromMoment(this, dur, -1);
            return this;
        },

        diff : function (input, units, asFloat) {
            var that = this._isUTC ? moment(input).zone(this._offset || 0) : moment(input).local(),
                zoneDiff = (this.zone() - that.zone()) * 6e4,
                diff, output;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month') {
                diff = (this.daysInMonth() + that.daysInMonth()) * 432e5; // 24 * 60 * 60 * 1000 / 2
                output = ((this.year() - that.year()) * 12) + (this.month() - that.month());
                output += ((this - moment(this).startOf('month')) - (that - moment(that).startOf('month'))) / diff;
                if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = (this - that) - zoneDiff;
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? diff / 864e5 : // 1000 * 60 * 60 * 24
                    units === 'week' ? diff / 6048e5 : // 1000 * 60 * 60 * 24 * 7
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from : function (time, withoutSuffix) {
            return moment.duration(this.diff(time)).lang(this.lang()._abbr).humanize(!withoutSuffix);
        },

        fromNow : function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar : function () {
            var diff = this.diff(moment().startOf('day'), 'days', true),
                format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.lang().calendar(format, this));
        },

        isLeapYear : function () {
            var year = this.year();
            return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        },

        isDST : function () {
            return (this.zone() < this.clone().month(0).zone() ||
                this.zone() < this.clone().month(5).zone());
        },

        day : function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                if (typeof input === 'string') {
                    input = this.lang().weekdaysParse(input);
                    if (typeof input !== 'number') {
                        return this;
                    }
                }
                return this.add({ d : input - day });
            } else {
                return day;
            }
        },

        month : function (input) {
            var utc = this._isUTC ? 'UTC' : '';
            if (input != null) {
                if (typeof input === 'string') {
                    input = this.lang().monthsParse(input);
                    if (typeof input !== 'number') {
                        return this;
                    }
                }
                this._d['set' + utc + 'Month'](input);
                moment.updateOffset(this);
                return this;
            } else {
                return this._d['get' + utc + 'Month']();
            }
        },

        startOf: function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
            case 'year':
                this.month(0);
                /* falls through */
            case 'month':
                this.date(1);
                /* falls through */
            case 'week':
            case 'day':
                this.hours(0);
                /* falls through */
            case 'hour':
                this.minutes(0);
                /* falls through */
            case 'minute':
                this.seconds(0);
                /* falls through */
            case 'second':
                this.milliseconds(0);
                /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            }

            return this;
        },

        endOf: function (units) {
            return this.startOf(units).add(units, 1).subtract('ms', 1);
        },

        isAfter: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) > +moment(input).startOf(units);
        },

        isBefore: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) < +moment(input).startOf(units);
        },

        isSame: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) === +moment(input).startOf(units);
        },

        min: function (other) {
            other = moment.apply(null, arguments);
            return other < this ? this : other;
        },

        max: function (other) {
            other = moment.apply(null, arguments);
            return other > this ? this : other;
        },

        zone : function (input) {
            var offset = this._offset || 0;
            if (input != null) {
                if (typeof input === "string") {
                    input = timezoneMinutesFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                this._offset = input;
                this._isUTC = true;
                if (offset !== input) {
                    addOrSubtractDurationFromMoment(this, moment.duration(offset - input, 'm'), 1, true);
                }
            } else {
                return this._isUTC ? offset : this._d.getTimezoneOffset();
            }
            return this;
        },

        zoneAbbr : function () {
            return this._isUTC ? "UTC" : "";
        },

        zoneName : function () {
            return this._isUTC ? "Coordinated Universal Time" : "";
        },

        daysInMonth : function () {
            return moment.utc([this.year(), this.month() + 1, 0]).date();
        },

        dayOfYear : function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add("d", (input - dayOfYear));
        },

        weekYear : function (input) {
            var year = weekOfYear(this, this.lang()._week.dow, this.lang()._week.doy).year;
            return input == null ? year : this.add("y", (input - year));
        },

        isoWeekYear : function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add("y", (input - year));
        },

        week : function (input) {
            var week = this.lang().week(this);
            return input == null ? week : this.add("d", (input - week) * 7);
        },

        isoWeek : function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add("d", (input - week) * 7);
        },

        weekday : function (input) {
            var weekday = (this._d.getDay() + 7 - this.lang()._week.dow) % 7;
            return input == null ? weekday : this.add("d", input - weekday);
        },

        isoWeekday : function (input) {
            // iso weeks start on monday, which is 1, so we subtract 1 (and add
            // 7 for negative mod to work).
            var weekday = (this._d.getDay() + 6) % 7;
            return input == null ? weekday : this.add("d", input - weekday);
        },

        // If passed a language key, it will set the language for this
        // instance.  Otherwise, it will return the language configuration
        // variables for this instance.
        lang : function (key) {
            if (key === undefined) {
                return this._lang;
            } else {
                this._lang = getLangDefinition(key);
                return this;
            }
        }
    };

    // helper for adding shortcuts
    function makeGetterAndSetter(name, key) {
        moment.fn[name] = moment.fn[name + 's'] = function (input) {
            var utc = this._isUTC ? 'UTC' : '';
            if (input != null) {
                this._d['set' + utc + key](input);
                moment.updateOffset(this);
                return this;
            } else {
                return this._d['get' + utc + key]();
            }
        };
    }

    // loop through and add shortcuts (Month, Date, Hours, Minutes, Seconds, Milliseconds)
    for (i = 0; i < proxyGettersAndSetters.length; i ++) {
        makeGetterAndSetter(proxyGettersAndSetters[i].toLowerCase().replace(/s$/, ''), proxyGettersAndSetters[i]);
    }

    // add shortcut for year (uses different syntax than the getter/setter 'year' == 'FullYear')
    makeGetterAndSetter('year', 'FullYear');

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    /************************************
        Duration Prototype
    ************************************/


    moment.duration.fn = Duration.prototype = {
        weeks : function () {
            return absRound(this.days() / 7);
        },

        valueOf : function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              ~~(this._months / 12) * 31536e6;
        },

        humanize : function (withSuffix) {
            var difference = +this,
                output = relativeTime(difference, !withSuffix, this.lang());

            if (withSuffix) {
                output = this.lang().pastFuture(difference, output);
            }

            return this.lang().postformat(output);
        },

        add : function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            return this;
        },

        subtract : function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            return this;
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as : function (units) {
            units = normalizeUnits(units);
            return this['as' + units.charAt(0).toUpperCase() + units.slice(1) + 's']();
        },

        lang : moment.fn.lang
    };

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    function makeDurationAsGetter(name, factor) {
        moment.duration.fn['as' + name] = function () {
            return +this / factor;
        };
    }

    for (i in unitMillisecondFactors) {
        if (unitMillisecondFactors.hasOwnProperty(i)) {
            makeDurationAsGetter(i, unitMillisecondFactors[i]);
            makeDurationGetter(i.toLowerCase());
        }
    }

    makeDurationAsGetter('Weeks', 6048e5);
    moment.duration.fn.asMonths = function () {
        return (+this - this.years() * 31536e6) / 2592e6 + this.years() * 12;
    };


    /************************************
        Default Lang
    ************************************/


    // Set default language, other languages will inherit from English.
    moment.lang('en', {
        ordinal : function (number) {
            var b = number % 10,
                output = (~~ (number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });


    /************************************
        Exposing Moment
    ************************************/


    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    }
    /*global ender:false */
    if (typeof ender === 'undefined') {
        // here, `this` means `window` in the browser, or `global` on the server
        // add `moment` as a global object via a string identifier,
        // for Closure Compiler "advanced" mode
        this['moment'] = moment;
    }
    /*global define:false */
    if (typeof define === "function" && define.amd) {
        define("moment", [], function () {
            return moment;
        });
    }
}).call(this);
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
