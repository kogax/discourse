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
MessageFormat.locale.sv = function ( n ) {
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
    })({});I18n.translations = {"sv":{"js":{"share":{"topic":"dela en l\u00e4nk till denna tr\u00e5d","post":"dela en l\u00e4nk till denna tr\u00e5d","close":"st\u00e4ng","twitter":"dela denna l\u00e4nk via Twitter","facebook":"dela denna l\u00e4nk via Facebook","google+":"dela denna l\u00e4nk via Google+"},"edit":"\u00e4ndra titel och kategori f\u00f6r denna tr\u00e5d","not_implemented":"Den funktionen har inte implementerats \u00e4n, tyv\u00e4rr!","no_value":"Nej","yes_value":"Ja","of_value":"av","generic_error":"Tyv\u00e4rr, ett fel har uppst\u00e5tt.","log_in":"Logga In","age":"\u00c5lder","last_post":"Sista inl\u00e4gget","admin_title":"Admin","flags_title":"Flaggningar","show_more":"visa mer","links":"L\u00e4nkar","faq":"FAQ","you":"Du","or":"eller","now":"just nu","suggested_topics":{"title":"F\u00f6reslagna Tr\u00e5dar"},"bookmarks":{"not_logged_in":"Tyv\u00e4rr m\u00e5ste du vara inloggad f\u00f6r att bokm\u00e4rka inl\u00e4gg.","created":"Du har bokm\u00e4rkt detta inl\u00e4gg.","not_bookmarked":"Du har l\u00e4st detta inl\u00e4gg; klicka f\u00f6r att bokm\u00e4rka det.","last_read":"Detta \u00e4r det sista inl\u00e4gget du l\u00e4st."},"new_topics_inserted":"{{count}} nya tr\u00e5dar.","show_new_topics":"Klicka f\u00f6r att visa.","preview":"f\u00f6rhandsgranska","cancel":"avbryt","save":"Spara \u00c4ndringar","saving":"Sparar...","saved":"Sparat!","user_action_descriptions":{"6":"Svar"},"user":{"profile":"Profil","title":"Anv\u00e4ndare","mute":"D\u00e4mpa","edit":"\u00c4ndra Inst\u00e4llningar","download_archive":"ladda ner ett arkiv med mina inl\u00e4gg","private_message":"Privata Meddelanden","private_messages":"Meddelanden","activity_stream":"Aktivitet","preferences":"Inst\u00e4llningar","bio":"Om mig","change_password":"byt","invited_by":"Inbjuden Av","trust_level":"P\u00e5litlighetsniv\u00e5","external_links_in_new_tab":"\u00d6ppna alla externa l\u00e4nkar i en ny flik","enable_quoting":"Aktivera citatsvar f\u00f6r markerad text","change_username":{"action":"byt","title":"Byt Anv\u00e4ndarnamn","confirm":"Det kan finnas konsekvenser till att byta ditt anv\u00e4ndarnamn. \u00c4r du helt s\u00e4ker p\u00e5 att du vill?","taken":"Tyv\u00e4rr det anv\u00e4ndarnamn \u00e4r taget.","error":"Det uppstod ett problem under bytet av ditt anv\u00e4ndarnamn.","invalid":"Det anv\u00e4ndarnamnet \u00e4r ogiltigt. Det f\u00e5r bara inneh\u00e5lla siffror och bokst\u00e4ver"},"change_email":{"action":"byt","title":"Byt E-post","taken":"Tyv\u00e4rr den adressen \u00e4r inte tillg\u00e4nglig.","error":"Det uppstod ett problem under bytet av din e-post. \u00c4r kanske adressen redan upptagen?","success":"Vi har skickat ett mail till den adressen. Var god f\u00f6lj bekr\u00e4ftelseinstruktionerna."},"email":{"title":"E-post","instructions":"Din e-postadress kommer aldrig att visas f\u00f6r allm\u00e4nheten.","ok":"Ser bra ut. Vi kommer maila dig f\u00f6r att bekr\u00e4fta.","invalid":"Vad god ange en giltig e-postadress.","authenticated":"Din e-post har verifierats av {{provider}}.","frequency":"Vi kommer bara maila dig om vi inte har sett dig nyligen och du inte redan sett det vi mailar dig om."},"name":{"title":"Namn","instructions":"Den l\u00e4ngre versionen av ditt namn; beh\u00f6ver inte vara unikt. Anv\u00e4nds som ett alternativt @namn och visas bara p\u00e5 din anv\u00e4ndarsida.","too_short":"Ditt namn \u00e4r f\u00f6r kort.","ok":"Ditt namn ser bra ut."},"username":{"title":"Anv\u00e4ndarnamn","instructions":"M\u00e5ste vara unikt, inga mellanrum. Personer kan omn\u00e4mna dig som @{{username}}.","short_instructions":"Personer kan omn\u00e4mna dig som @{{username}}.","available":"Ditt anv\u00e4ndarnamn \u00e4r tillg\u00e4ngligt.","global_match":"E-posten matchar det registrerade anv\u00e4ndarnamnet.","global_mismatch":"Redan registrerat. Prova {{suggestion}}?","not_available":"Inte tillg\u00e4ngligt. Prova {{suggestion}}?","too_short":"Ditt anv\u00e4ndarnamn \u00e4r f\u00f6r kort.","too_long":"Ditt anv\u00e4ndarnamn \u00e4r f\u00f6r l\u00e5ngt.","checking":"Kollar anv\u00e4ndarnamnets tillg\u00e4nglighet...","enter_email":"Anv\u00e4ndarnamn hittat. Ange matchande e-post."},"password_confirmation":{"title":"L\u00f6senord Igen"},"last_posted":"Senaste Inl\u00e4gg","last_emailed":"Senast Mailad","last_seen":"Senast Sedd","created":"Skapad Vid","log_out":"Logga Ut","website":"Webbplats","email_settings":"E-post","email_digests":{"title":"N\u00e4r jag inte bes\u00f6ker sidan, skicka mig ett sammandrag via mail om vad som \u00e4r nytt","daily":"dagligen","weekly":"veckovis","bi_weekly":"varannan vecka"},"email_direct":"Ta emot ett mail n\u00e4r n\u00e5gon citerar dig, svarar p\u00e5 dina inl\u00e4gg, eller n\u00e4mner ditt @anv\u00e4ndarnamn","email_private_messages":"Ta emot ett mail n\u00e4r n\u00e5gon skickar dig ett privat meddelande","other_settings":"\u00d6vrigt","new_topic_duration":{"label":"Betrakta tr\u00e5dar som nya n\u00e4r","not_viewed":"Jag inte har kollat p\u00e5 dem \u00e4n","last_here":"de postades efter jag var h\u00e4r sist","after_n_days":{"one":"de postades det senaste dygnet","other":"de postades inom de senaste {{count}} dagarna"},"after_n_weeks":{"one":"de postades den senaste veckan","other":"de postades inom de senaste {{count}} veckorna"}},"auto_track_topics":"F\u00f6lj automatiskt tr\u00e5dar jag bes\u00f6ker","auto_track_options":{"never":"aldrig","always":"alltid","after_n_seconds":{"one":"efter 1 sekund","other":"efter {{count}} sekunder"},"after_n_minutes":{"one":"efter 1 minut","other":"efter {{count}} minuter"}},"invited":{"title":"Inbjudningar","user":"Inbjuden Anv\u00e4ndare","none":"{{username}} har inte bjudit in n\u00e5gra anv\u00e4ndare till webbplatsen.","redeemed":"Inl\u00f6sta Inbjudnignar","redeemed_at":"Inl\u00f6st Vid","pending":"Avvaktande Inbjudningar","topics_entered":"Tr\u00e5dar Bes\u00f6kta","posts_read_count":"Inl\u00e4gg L\u00e4sta","rescind":"Ta Bort Inbjudan","rescinded":"Inbjudan borttagen","time_read":"L\u00e4stid","days_visited":"Dagar Bes\u00f6kta","account_age_days":"Konto\u00e5lder i dagar"},"password":{"title":"L\u00f6senord","too_short":"Ditt l\u00f6senord \u00e4r f\u00f6r kort.","ok":"Ditt l\u00f6senord ser bra ut."},"ip_address":{"title":"Senaste IP-adress"},"avatar":{"title":"Profilbild","instructions":"Vi anv\u00e4nder <a href='https://gravatar.com' target='_blank'>Gravatar</a> f\u00f6r profilbilder baserat p\u00e5 din e-post"},"filters":{"all":"Alla"},"stream":{"posted_by":"Postat av","sent_by":"Skickat av","private_message":"privat meddelande","the_topic":"tr\u00e5den"}},"loading":"Laddar...","close":"St\u00e4ng","learn_more":"l\u00e4r dig mer...","year":"\u00e5r","year_desc":"tr\u00e5dar postade i de senaste 365 dagarna","month":"m\u00e5nad","month_desc":"tr\u00e5dar postade i de senaste 30 dagarna","week":"vecka","week_desc":"tr\u00e5dar postade i de senaste 7 dagarna","first_post":"F\u00f6rsta inl\u00e4gget","mute":"D\u00e4mpa","unmute":"Avd\u00e4mpa","best_of":{"title":"B\u00e4st Av","enabled_description":"Just nu visar du \"B\u00e4st Av\"-l\u00e4get f\u00f6r denna tr\u00e5d.","description":"Det finns <b>{{count}}</b> inl\u00e4gg i den h\u00e4r tr\u00e5den. Det \u00e4r m\u00e5nga! Vill du spara tid genom att byta s\u00e5 du bara ser de inl\u00e4gg med flest interaktioner och svar?","enable":"Byt till \"B\u00e4st Av\"-l\u00e4get","disable":"Avbryt \"B\u00e4st Av\""},"private_message_info":{"title":"Privat Konversation","invite":"Bjud In Andra..."},"email":"E-post","username":"Anv\u00e4ndarnamn","last_seen":"Senast Sedd","created":"Skapad","trust_level":"P\u00e5litlighetsniv\u00e5","create_account":{"title":"Skapa Konto","action":"Skapa ett nu!","invite":"har du inget konto \u00e4n?","failed":"N\u00e5got gick fel, kanske \u00e4r denna e-post redan registrerad, f\u00f6rs\u00f6k gl\u00f6mt l\u00f6senordsl\u00e4nken"},"forgot_password":{"title":"Gl\u00f6mt L\u00f6senord","action":"Jag har gl\u00f6mt mitt l\u00f6senord","invite":"Skriv in ditt anv\u00e4ndarnamn eller e-postadress, s\u00e5 vi skickar dig ett mail om l\u00f6senords\u00e5terst\u00e4llning.","reset":"\u00c5terst\u00e4ll L\u00f6senord","complete":"Du borde f\u00e5 ett mail med instruktioner om hur du \u00e5terst\u00e4ller ditt l\u00f6senord inom kort."},"login":{"title":"Logga In","username":"Inloggning","password":"L\u00f6senord","email_placeholder":"e-postadress eller anv\u00e4ndarnamn","error":"Ok\u00e4nt fel","reset_password":"\u00c5terst\u00e4ll L\u00f6senord","logging_in":"Loggar In...","or":"Eller","authenticating":"Autentiserar...","awaiting_confirmation":"Ditt konto v\u00e4ntar p\u00e5 aktivering, anv\u00e4nd gl\u00f6mt l\u00f6senordsl\u00e4nken f\u00f6r att skicka ett nytt aktiveringsmail.","awaiting_approval":"Ditt konto har inte godk\u00e4nts av en moderator \u00e4n. Du kommer att f\u00e5 ett mail n\u00e4r det \u00e4r godk\u00e4nt.","not_activated":"Du kan inte logga in \u00e4n. Vi har tidigare skickat ett aktiveringsmail till dig via <b>{{sentTo}}</b>. Var god f\u00f6lj instruktionerna i det mailet f\u00f6r att aktivera ditt konto.","resend_activation_email":"Klicka h\u00e4r f\u00f6r att skicka aktiveringsmailet igen.","sent_activation_email_again":"Vi har skickat \u00e4nnu ett aktiveringsmail till dig via <b>{{currentEmail}}</b>. Det kan ta ett par minuter f\u00f6r det att komma fram; var noga med att kolla din skr\u00e4ppost.","google":{"title":"med Google","message":"Autentiserar med Google (kolla s\u00e5 att pop up-blockare inte \u00e4r aktiverade)"},"twitter":{"title":"med Twitter","message":"Autentiserar med Twitter (kolla s\u00e5 att pop up-blockare inte \u00e4r aktiverade)"},"facebook":{"title":"med Facebook","message":"Autentiserar med Facebook (kolla s\u00e5 att pop up-blockare inte \u00e4r aktiverade)"},"yahoo":{"title":"med Yahoo","message":"Autentiserar med Yahoo (kolla s\u00e5 att pop up-blockare inte \u00e4r aktiverade)"},"github":{"title":"med GitHub","message":"Autentiserar med GitHub (kolla s\u00e5 att pop up-blockare inte \u00e4r aktiverade)"},"persona":{"title":" med Persona","message":"Autentiserar med Mozilla Persona (kolla s\u00e5 att pop up-blockare inte \u00e4r aktiverade)"}},"composer":{"posting_not_on_topic":"Du svarar p\u00e5 tr\u00e5den \"{{title}}\", men du bes\u00f6ker just nu en annan tr\u00e5d.","saving_draft_tip":"sparar","saved_draft_tip":"sparat","saved_local_draft_tip":"sparat lokalt","similar_topics":"Din tr\u00e5d liknar...","drafts_offline":"utkast offline","min_length":{"need_more_for_title":"{{n}} tecken kvar f\u00f6r titeln","need_more_for_reply":"{{n}} tecken kvar f\u00f6r svaret"},"save_edit":"Spara \u00c4ndring","reply_original":"Svara p\u00e5 Ursprungstr\u00e5d","reply_here":"Svara H\u00e4r","reply":"Svara","cancel":"Avbryt","create_topic":"Skapa Tr\u00e5d","create_pm":"Skapa Privat Meddelande","users_placeholder":"L\u00e4gg till en anv\u00e4ndare","title_placeholder":"Skriv din titel h\u00e4r. Vad handlar denna diskussion om i en kort mening?","reply_placeholder":"Skriv ditt svar h\u00e4r. Anv\u00e4nd Markdown eller BBCode f\u00f6r formatering. Dra eller klista in en bild h\u00e4r f\u00f6r att ladda upp den.","view_new_post":"Visa ditt nya inl\u00e4gg.","saving":"Sparar...","saved":"Sparat!","saved_draft":"Du har ett p\u00e5g\u00e5ende inl\u00e4ggsutkast. Klicka n\u00e5gonstans i denna ruta f\u00f6r att forts\u00e4tta redigera.","uploading":"Laddar upp...","show_preview":"visa f\u00f6rhandsgranskning &raquo;","hide_preview":"&laquo; d\u00f6lj f\u00f6rhandsgranskning","bold_title":"Fet","bold_text":"fet text","italic_title":"Kursiv","italic_text":"kursiv text","link_title":"Hyperl\u00e4nk","link_description":"skriv en l\u00e4nkbeskrivning h\u00e4r","link_dialog_title":"Infoga Hyperl\u00e4nk","link_optional_text":"valfri titel","quote_title":"Citat","quote_text":"Citat","code_title":"Kodexempel","code_text":"skriv din kod h\u00e4r","image_title":"Bild","image_description":"skriv en bildbeskrivning h\u00e4r","image_dialog_title":"Infoga Bild","image_optional_text":"valfri titel","image_hosting_hint":"Beh\u00f6ver du <a href='http://www.google.com/search?q=free+image+hosting' target='_blank'>gratis bilduppladdning?</a>","olist_title":"Numrerad Lista","ulist_title":"Punktlista","list_item":"Listobjekt","heading_title":"Rubrik","heading_text":"Rubrik","hr_title":"Horisontell linje","undo_title":"\u00c5ngra","redo_title":"\u00c5terst\u00e4ll","help":"Markdown Redigeringshj\u00e4lp"},"notifications":{"title":"notifikationer med omn\u00e4mnanden av @namn, svar p\u00e5 dina inl\u00e4gg och tr\u00e5dar, privata meddelanden, etc","none":"Du har inte notifikationer just nu.","more":"visa \u00e4ldre notifikationer","mentioned":"<span title='omn\u00e4mnd' class='icon'>@</span> {{username}} {{link}}","quoted":"<i title='citerad' class='icon icon-quote-right'></i> {{username}} {{link}}","replied":"<i title='svarad' class='icon icon-reply'></i> {{username}} {{link}}","posted":"<i title='svarad' class='icon icon-reply'></i> {{username}} {{link}}","edited":"<i title='\u00e4ndrad' class='icon icon-pencil'></i> {{username}} {{link}}","liked":"<i title='gillad' class='icon icon-heart'></i> {{username}} {{link}}","private_message":"<i class='icon icon-envelope-alt' title='privat meddelande'></i> {{username}} skickade dig ett privat meddelande: {{link}}","invited_to_private_message":"{{username}} bj\u00f6d in dig till en privat konversation: {{link}}","invitee_accepted":"<i title='accepterade din inbjudan' class='icon icon-signin'></i> {{username}} accepterade din inbjudan","moved_post":"<i title='flyttade inl\u00e4gg' class='icon icon-arrow-right'></i> {{username}} flyttade inl\u00e4gg till {{link}}"},"image_selector":{"title":"Infoga Bild","from_my_computer":"Fr\u00e5n Min Enhet","from_the_web":"Fr\u00e5n Internet","add_image":"L\u00e4gg Till Bild","remote_tip":"skriv in en adress till en bild i formen http://exempel.se/bild.jpg","local_tip":"klicka f\u00f6r att v\u00e4lja en bild fr\u00e5n din enhet.","upload":"Ladda Upp","uploading_image":"Laddar upp bild"},"search":{"title":"s\u00f6k efter tr\u00e5dar, inl\u00e4gg, anv\u00e4ndare, eller kategorier","placeholder":"skriv din s\u00f6kterm h\u00e4r","no_results":"Inga resultat hittades.","searching":"S\u00f6ker ..."},"site_map":"g\u00e5 till en annan tr\u00e5dlista eller kategori","go_back":"g\u00e5 tillbaka","current_user":"g\u00e5 till din anv\u00e4ndarsida","favorite":{"title":"Favorit","help":{"star":"l\u00e4gg till denna tr\u00e5d i din favoritlista","unstar":"ta bort denna tr\u00e5d fr\u00e5n din favoritlista"}},"topics":{"none":{"favorited":"Du har inte favoritmarkerat n\u00e5gra tr\u00e5dar \u00e4n. F\u00f6r att favoritmarkera en tr\u00e5d, klicka eller tryck p\u00e5 stj\u00e4rnan brevid titeln.","unread":"Du har inga ol\u00e4sta tr\u00e5dar att l\u00e4sa.","new":"Du har inga nya tr\u00e5dar att l\u00e4sa.","read":"Du har inte l\u00e4st n\u00e5gra tr\u00e5dar \u00e4n.","posted":"Du har inte postat i n\u00e5gra tr\u00e5dar \u00e4n.","latest":"Det finns inga senaste tr\u00e5dar. Det \u00e4r lite sorgligt.","hot":"Det finns inga heta tr\u00e5dar.","category":"Det finns inga {{category}}-tr\u00e5dar."},"bottom":{"latest":"Det finns inga fler senaste tr\u00e5dar att l\u00e4sa.","hot":"Det finns inga fler heta tr\u00e5dar att l\u00e4sa.","posted":"Det finns inga fler postade tr\u00e5dar att l\u00e4sa","read":"Det finns inga fler l\u00e4sta tr\u00e5dar att l\u00e4sa.","new":"Det finns inga fler nya tr\u00e5dar att l\u00e4sa.","unread":"Det finns inga fler ol\u00e4sa tr\u00e5dar att l\u00e4sa.","favorited":"Det finns inga fler favoritmarkerade tr\u00e5dar att l\u00e4sa.","category":"Det finns inga fler {{category}}-tr\u00e5dar."}},"rank_details":{"toggle":"v\u00e4xla p\u00e5/av tr\u00e5dranksdetaljer","show":"visa tr\u00e5dranksdetaljer","title":"Tr\u00e5dranksdetaljer"},"topic":{"create_in":"Skapa {{categoryName}}-tr\u00e5d","create":"Skapa Tr\u00e5d","create_long":"Skapa en nytt Tr\u00e5d","private_message":"Starta en privat konversation","list":"Tr\u00e5dar","new":"ny tr\u00e5d","title":"Tr\u00e5d","loading_more":"Laddar fler Tr\u00e5dar...","loading":"Laddar tr\u00e5d...","invalid_access":{"title":"Tr\u00e5den \u00e4r privat","description":"Tyv\u00e4rr, du har inte beh\u00f6righet till den tr\u00e5den."},"server_error":{"title":"Tr\u00e5den misslyckades med att ladda","description":"Tyv\u00e4rr, vi kunde inte ladda den tr\u00e5den, troligen p.g.a. ett anslutningsproblem. Var go f\u00f6rs\u00f6k igen. Om problemet kvarst\u00e5r, l\u00e5t oss g\u00e4rna veta det!"},"not_found":{"title":"Tr\u00e5den hittades inte","description":"Tyv\u00e4rr, vi kunde inte hitta den tr\u00e5den. Kanske har den tagits bort av en moderator?"},"unread_posts":"du har {{unread}} gamla ol\u00e4sta inl\u00e4gg i den h\u00e4r tr\u00e5den","new_posts":"det finns {{new_posts}} nya inl\u00e4gg i den h\u00e4r tr\u00e5den sen du senaste l\u00e4ste det","likes":{"one":"det finns 1 gillning i den h\u00e4r tr\u00e5den","other":"det finns {{count}} gillningar i den h\u00e4r tr\u00e5den"},"back_to_list":"Tillbaka till Tr\u00e5dlistan","options":"Tr\u00e5dinst\u00e4llningar","show_links":"visa l\u00e4nkar som finns i den h\u00e4r tr\u00e5den","toggle_information":"sl\u00e5 p\u00e5/av tr\u00e5ddetaljer","read_more_in_category":"Vill du l\u00e4sa mer? Bl\u00e4ddra bland andra tr\u00e5dar i {{catLink}} eller {{latestLink}}.","read_more":"Vill du l\u00e4sa mer? {{catLink}} eller {{latestLink}}.","browse_all_categories":"Bl\u00e4ddra bland alla kategorier","view_latest_topics":"visa senaste tr\u00e5dar","suggest_create_topic":"Varf\u00f6r inte skapa en tr\u00e5d?","read_position_reset":"Din l\u00e4sposition har blivit \u00e5terst\u00e4lld.","jump_reply_up":"hoppa till tidigare svar","jump_reply_down":"hoppa till senare svar","deleted":"Tr\u00e5den har raderats","progress":{"title":"tr\u00e5dplacering","jump_top":"hoppa till f\u00f6rsta inl\u00e4gget","jump_bottom":"hoppa till sista inl\u00e4gget","total":"antal inl\u00e4gg","current":"nuvarande inl\u00e4gg"},"notifications":{"title":"","reasons":{"3_2":"Du kommer ta emot notifikationer f\u00f6r att du kollar in denna tr\u00e5d.","3_1":"Du kommer ta emot notifikationer f\u00f6r att du skapade denna tr\u00e5d.","3":"Du kommer ta emot notifikationer f\u00f6r att du kollar in denna tr\u00e5d.","2_4":"Du kommer ta emot notifikationer f\u00f6r att du postade ett svar till denna tr\u00e5d.","2_2":"Du kommer ta emot notifikationer f\u00f6r att du f\u00f6ljer denna tr\u00e5d.","2":"Du kommer ta emot notifikationer f\u00f6r att du <a href=\"/users/{{username}}/preferences\">l\u00e4ser denna tr\u00e5d</a>.","1":"Du kommer bara meddelandes om n\u00e5gon n\u00e4mner ditt @namn eller svara p\u00e5 dina inl\u00e4gg.","1_2":"Du kommer bara meddelandes om n\u00e5gon n\u00e4mner ditt @namn eller svara p\u00e5 dina inl\u00e4gg.","0":"Du ignorerar alla notifikationer f\u00f6r denna tr\u00e5d.","0_2":"Du ignorerar alla notifikationer f\u00f6r denna tr\u00e5d."},"watching":{"title":"Kollar","description":"samma som F\u00f6ljer, plus att du meddelas om alla nya inl\u00e4gg."},"tracking":{"title":"F\u00f6ljer","description":"du meddelas om omn\u00e4mnanden av @namn, och svar p\u00e5 dina inl\u00e4gg, plus att du ser antal ol\u00e4sta och nya inl\u00e4gg.."},"regular":{"title":"Vanlig","description":"du meddelas bara om n\u00e5gon n\u00e4mner ditt @namn eller svarar p\u00e5 ditt inl\u00e4gg."},"muted":{"title":"D\u00e4mpad","description":"du kommer inte meddelas om denna tr\u00e5d alls, och den kommer inte visas i din flik med ol\u00e4sta."}},"actions":{"delete":"Radera Tr\u00e5d","open":"\u00d6ppna Tr\u00e5d","close":"St\u00e4ng Tr\u00e5d","unpin":"Avn\u00e5la Tr\u00e5d","pin":"N\u00e5la Tr\u00e5d","unarchive":"Dearkivera Tr\u00e5d","archive":"Arkivera Tr\u00e5d","invisible":"G\u00f6r Osynlig","visible":"G\u00f6r Synlig","reset_read":"\u00c5terst\u00e4ll L\u00e4sdata","multi_select":"V\u00e4xla p\u00e5/av flervalsfunktion","convert_to_topic":"Konvertera till Vanlig Tr\u00e5d"},"reply":{"title":"Svara","help":"b\u00f6rja komponera ett svar till denna tr\u00e5d"},"clear_pin":{"title":"Rensa n\u00e5l","help":"Rensa den n\u00e5lade statusen fr\u00e5n denna tr\u00e5d s\u00e5 den inte l\u00e4ngre hamnar i toppen av din tr\u00e5dlista"},"share":{"title":"Dela","help":"dela en l\u00e4nk till denna tr\u00e5d"},"inviting":"Bjuder in...","invite_private":{"title":"Bjud in till Privat Konversation","email_or_username":"Den Inbjudnas E-post eller Anv\u00e4ndarnamn","email_or_username_placeholder":"e-postadress eller anv\u00e4ndarnamn","action":"Bjud In","success":"Tack! Vi har bjudit in den anv\u00e4ndaren att delta i denna privata konversation.","error":"Tyv\u00e4rr det uppstod ett fel under inbjudandet av den anv\u00e4ndaren."},"invite_reply":{"title":"Bjud in V\u00e4nner att Svara","help":"skicka inbjudningar till v\u00e4nner s\u00e5 de kan svara i den h\u00e4r tr\u00e5den med ett enda klick","email":"Vi skickar din v\u00e4n ett kort mail s\u00e5 de kan svara i den h\u00e4r tr\u00e5den genom att klicka p\u00e5 en l\u00e4nk.","email_placeholder":"e-postadress","success":"Tack! Vi har mailat ut ett inbjudan till <b>{{email}}</b>. Vi l\u00e5ter dig veta n\u00e4r de l\u00f6st in sin inbjudan. Kolla in fliken med Inbjudningar p\u00e5 din anv\u00e4ndarsida f\u00f6r att h\u00e5lla koll p\u00e5 vem du har bjudit in.","error":"Tyv\u00e4rr vi kunde inte bjudan in den personen. Kanske \u00e4r den redan en anv\u00e4ndare?"},"login_reply":"Logga In f\u00f6r att Svara","filters":{"user":"Du visar bara {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 inl\u00e4gg","other":"{{count}} inl\u00e4gg"},"by_n_users":{"one":"skapat av 1 specifik anv\u00e4ndare","other":"skapat av {{count}} specifika anv\u00e4ndare"},"best_of":"Du visar bara {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"1 b\u00e4sta inl\u00e4gg","other":"{{count}} b\u00e4sta inl\u00e4gg"},"of_n_posts":{"one":"av 1 i tr\u00e5den","other":"av {{count}} i tr\u00e5den"},"cancel":"Visa alla inl\u00e4gg i den h\u00e4r tr\u00e5den igen."},"move_selected":{"title":"Flytta Markerade Inl\u00e4gg","topic_name":"Nya Tr\u00e5dens Namn:","error":"Tyv\u00e4rr, det uppstod ett problem under flytten av de inl\u00e4ggen.","instructions":{"one":"Du h\u00e5ller p\u00e5 att skapa en ny tr\u00e5d och fylla den med inl\u00e4gget som du markerat.","other":"Du h\u00e5ller p\u00e5 att skapa en ny tr\u00e5d och fylla den med de <b>{{count}}</b> inl\u00e4gg som du markerat."}},"multi_select":{"select":"markera","selected":"markerade ({{count}})","delete":"radera markerade","cancel":"avbryt markering","move":"flytta markerade","description":{"one":"Du har markerat <b>1</b> inl\u00e4gg.","other":"Du har markerat <b>{{count}}</b> inl\u00e4gg."}}},"post":{"reply":"Svarar p\u00e5 {{link}} av {{replyAvatar}} {{username}}","reply_topic":"Svar p\u00e5 {{link}}","quote_reply":"citatsvar","edit":"\u00c4ndra {{link}} av {{replyAvatar}} {{username}}","post_number":"inl\u00e4gg {{number}}","in_reply_to":"som svar till","reply_as_new_topic":"Svara som ny Tr\u00e5d","continue_discussion":"Forts\u00e4tter diskussionen fr\u00e5n {{postLink}}:","follow_quote":"g\u00e5 till det citerade inl\u00e4gget","deleted_by_author":"(inl\u00e4gg borttaget av f\u00f6rfattaren)","has_replies":{"one":"Svara","other":"Svar"},"errors":{"create":"Tyv\u00e4rr, det uppstod ett fel under skapandet av ditt inl\u00e4gg. Var god f\u00f6rs\u00f6k igen.","edit":"Tyv\u00e4rr, det uppstod ett fel under \u00e4ndringen av ditt inl\u00e4gg. Var god f\u00f6rs\u00f6k igen.","upload":"Tyv\u00e4rr, det uppstod ett fel under uppladdandet av den filen. Vad god f\u00f6rs\u00f6k igen.","upload_too_large":"Tyv\u00e4rr, filen som du f\u00f6rs\u00f6ker ladda upp \u00e4r f\u00f6r stor (maxstorlek \u00e4r {{max_size_kb}}kb), var god \u00e4ndra storlek och f\u00f6rs\u00f6k igen.","upload_too_many_images":"Tyv\u00e4rr, du kan bara ladda upp en bild i taget.","only_images_are_supported":"Tyv\u00e4rr, du kan bara ladda upp bilder."},"abandon":"\u00c4r du s\u00e4ker p\u00e5 att du vill \u00f6verge ditt inl\u00e4gg?","archetypes":{"save":"Spara Inst\u00e4llningar"},"controls":{"reply":"b\u00f6rja komponera ett svar till detta inl\u00e4gg","like":"gilla detta inl\u00e4gg","edit":"\u00e4ndra detta inl\u00e4gg","flag":"flagga detta inl\u00e4gg f\u00f6r moderatorsuppm\u00e4rksamhet","delete":"radera detta inl\u00e4gg","undelete":"\u00e5terst\u00e4ll detta inl\u00e4gg","share":"dela en l\u00e4nk till detta inl\u00e4gg","bookmark":"bokm\u00e4rk detta inl\u00e4gg till din anv\u00e4ndarsida","more":"Mer"},"actions":{"flag":"Flaga","clear_flags":{"one":"Ta bort flagga","other":"Ta bort flaggningar"},"it_too":{"off_topic":"Flagga det ocks\u00e5","spam":"Flagga det ocks\u00e5","inappropriate":"Flagga det ocks\u00e5","custom_flag":"Flagga det ocks\u00e5","bookmark":"Bokm\u00e4rk det ocks\u00e5","like":"Gilla det ocks\u00e5","vote":"R\u00f6sta f\u00f6r det ocks\u00e5"},"undo":{"off_topic":"\u00c5ngra flaggning","spam":"\u00c5ngra flaggning","inappropriate":"\u00c5ngra flaggning","custom_flag":"\u00c5ngra flaggning","bookmark":"\u00c5ngra bokm\u00e4rkning","like":"\u00c5ngra gillning","vote":"\u00c5ngra r\u00f6stning"},"people":{"off_topic":"{{icons}} markerade detta som off-topic","spam":"{{icons}} markerade detta som spam","inappropriate":"{{icons}} markerade detta som ol\u00e4mpligt","custom_flag":"{{icons}} flaggade detta","bookmark":"{{icons}} bokm\u00e4rkte detta","like":"{{icons}} gillade detta","vote":"{{icons}} r\u00f6stade f\u00f6r detta"},"by_you":{"off_topic":"Du flaggade detta som off-topic","spam":"Du flaggade detta som spam","inappropriate":"Du flaggade detta som ol\u00e4mpligt","custom_flag":"Du flaggade detta f\u00f6r moderation","bookmark":"Du bokm\u00e4rkte detta inl\u00e4gg","like":"Du gillade detta","vote":"Du r\u00f6stade f\u00f6r detta inl\u00e4gg"},"by_you_and_others":{"off_topic":{"one":"Du och 1 annan flaggade detta som off-topic","other":"Du och {{count}} andra personer flaggade detta som off-topic"},"spam":{"one":"Du och 1 annan flaggade detta som spam","other":"Du och {{count}} andra personer flaggade detta som spam"},"inappropriate":{"one":"Du och 1 annan flaggade detta som ol\u00e4mpligt","other":"Du och {{count}} andra personer flaggade detta som ol\u00e4mpligt"},"custom_flag":{"one":"Du och 1 annan flaggade detta f\u00f6r moderation","other":"Du och {{count}} andra personer flaggade detta f\u00f6r moderation"},"bookmark":{"one":"Du och 1 annan bokm\u00e4rkte detta inl\u00e4gg","other":"Du och {{count}} andra personer bokm\u00e4rkte detta inl\u00e4gg"},"like":{"one":"Du och 1 annan gillade detta","other":"Du och {{count}} andra personer gillade detta"},"vote":{"one":"Du och 1 annan r\u00f6stade f\u00f6r detta inl\u00e4gg","other":"Du och {{count}} andra personer r\u00f6stade f\u00f6r detta inl\u00e4gg"}},"by_others":{"off_topic":{"one":"1 person flaggade detta som off-topic","other":"{{count}} personer flaggade detta som off-topic"},"spam":{"one":"1 person flaggade detta som spam","other":"{{count}} personer flaggade detta som spam"},"inappropriate":{"one":"1 person flaggade detta som ol\u00e4mpligt","other":"{{count}} personer flaggade detta som ol\u00e4mpligt"},"custom_flag":{"one":"1 person flaggade detta f\u00f6r moderation","other":"{{count}} personer flaggade detta f\u00f6r moderation"},"bookmark":{"one":"1 person bokm\u00e4rkte detta inl\u00e4gg","other":"{{count}} personer bokm\u00e4rkte detta inl\u00e4gg"},"like":{"one":"1 person gillade detta","other":"{{count}} personer gillade detta"},"vote":{"one":"1 person r\u00f6stade f\u00f6r detta inl\u00e4gg","other":"{{count}} personer r\u00f6stade f\u00f6r detta inl\u00e4gg"}}},"edits":{"one":"1 \u00e4ndring","other":"{{count}} \u00e4ndringar","zero":"inga \u00e4ndringar"},"delete":{"confirm":{"one":"\u00c4r du s\u00e4ker p\u00e5 att du vill radera detta inl\u00e4gg?","other":"\u00c4r du s\u00e4ker p\u00e5 att du vill radera alla dessa inl\u00e4gg?"}}},"category":{"none":"(ingen kategori)","edit":"\u00e4ndra","edit_long":"\u00c4ndra Kategori","view":"Visa Tr\u00e5dar i Kategori","delete":"Radera Kategori","create":"Skapa Kategori","creation_error":"Det uppstod ett fel n\u00e4r kategorin skulle skapas.","more_posts":"visa alla {{posts}}...","name":"Kategorinamn","description":"Beskrivning","topic":"Kategoristr\u00e5d","badge_colors":"Emblemsf\u00e4rg","background_color":"Bakgrundsf\u00e4rg","foreground_color":"F\u00f6rgrundsf\u00e4rg","name_placeholder":"Ska vara kort och koncist.","color_placeholder":"N\u00e5gon webbf\u00e4rg","delete_confirm":"\u00c4r du s\u00e4ker p\u00e5 att du vill radera den kategorin?","list":"Lista Kategorier","no_description":"Det finns ingen beskrivning f\u00f6r denna kategori.","change_in_category_topic":"bes\u00f6k kategorins tr\u00e5d f\u00f6r att \u00e4ndra beskrivning","hotness":"Hethet"},"flagging":{"title":"Varf\u00f6r flaggar du detta inl\u00e4gg?","action":"Flagga Inl\u00e4gg","cant":"Tyv\u00e4rr, du kan inte flagga detta inl\u00e4gg just nu.","custom_placeholder":"Varf\u00f6r kr\u00e4ver detta inl\u00e4gg en moderators uppm\u00e4rksamhet? L\u00e5t oss veta specifikt vad du \u00e4r orolig f\u00f6r, och ta med relevanta l\u00e4nkar om m\u00f6jligt.","custom_message":{"at_least":"skriv \u00e5tminstone {{n}} tecken","more":"{{n}} fler...","left":"{{n}} kvar"}},"topic_summary":{"title":"Tr\u00e5dsammanfattning","links_shown":"Visa alla {{totalLinks}} l\u00e4nkar..."},"topic_statuses":{"locked":{"help":"denna tr\u00e5d \u00e4r l\u00e5st; den accepterar inte l\u00e4ngre nya svar"},"pinned":{"help":"denna tr\u00e5d \u00e4r n\u00e5lad; den kommer att visas h\u00f6gst upp i sin kategori"},"archived":{"help":"denna tr\u00e5d \u00e4r arkiverad; den \u00e4r frusen och kan inte \u00e4ndras"},"invisible":{"help":"denna tr\u00e5d \u00e4r osynlig; den kommer inte att visas i tr\u00e5dlistor, och kan endast bes\u00f6kas via direktl\u00e4nkar"}},"posts":"Inl\u00e4gg","posts_long":"{{number}} inl\u00e4gg i den h\u00e4r tr\u00e5den","original_post":"Originalinl\u00e4gg","views":"Visningar","replies":"Svar","views_long":"denna tr\u00e5d har visats {{number}} g\u00e5nger","activity":"Aktivitet","likes":"Gillningar","top_contributors":"Deltagare","category_title":"Kategori","history":"Historik","changed_by":"av {{author}}","categories_list":"Kategorilista","filters":{"latest":{"title":"Senaste","help":"det popul\u00e4raste tr\u00e5darna nyligen"},"hot":{"title":"Hett","help":"ett urval av de hetaste tr\u00e5darna"},"favorited":{"title":"Favoriter","help":"tr\u00e5dar du favoritmarkerat"},"read":{"title":"L\u00e4sta","help":"tr\u00e5dar du har l\u00e4st, i den ordningen du senast l\u00e4ste dem"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alla tr\u00e5dar grupperade efter kategori"},"unread":{"title":{"zero":"Ol\u00e4sta","one":"Ol\u00e4sta (1)","other":"Ol\u00e4sta ({{count}})"},"help":"f\u00f6ljda tr\u00e5dar med ol\u00e4sta inl\u00e4gg"},"new":{"title":{"zero":"Nya","one":"Nya (1)","other":"Nya ({{count}})"},"help":"nya tr\u00e5dar sen ditt senaste bes\u00f6k"},"posted":{"title":"Mina Inl\u00e4gg","help":"tr\u00e5dar som du har postat i"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"senaste tr\u00e5darna i {{categoryName}}-kategorin"}},"browser_update":"Tyv\u00e4rr, <a href=\"http://www.discourse.org/faq/#browser\">din webbl\u00e4sare \u00e4r f\u00f6r gammal f\u00f6r att fungera p\u00e5 detta Discourse-forum</a>. Var god <a href=\"http://browsehappy.com\">uppgradera din webbl\u00e4sare</a>.","type_to_filter":"skriv f\u00f6r att filtrera...","admin":{"title":"Discourse Admin","moderator":"Moderator","dashboard":{"title":"\u00d6versiktspanel","version":"Version","up_to_date":"Du \u00e4r aktuell!","critical_available":"En kritisk uppdatering \u00e4r tillg\u00e4nglig.","updates_available":"Uppdateringar \u00e4r tillg\u00e4ngliga.","please_upgrade":"Var god uppgradera!","installed_version":"Installerad","latest_version":"Senaste","problems_found":"N\u00e5gra problem har hittas med din installation av Discourse:","moderators":"Moderatorer:","admins":"Administrat\u00f6rer:"},"reports":{"today":"Idag","yesterday":"Ig\u00e5r","last_7_days":"Senaste 7 Dagarna","last_30_days":"Senaste 30 Dagarna","all_time":"Fr\u00e5n B\u00f6rjan","7_days_ago":"7 Dagar Sedan","30_days_ago":"30 Dagar Sedan","all":"Alla","view_table":"Visa som Tabell","view_chart":"Visa som Stapeldiagram"},"commits":{"latest_changes":"Senaste \u00e4ndringarna: sn\u00e4lla uppdatera ofta!","by":"av"},"flags":{"title":"Flaggningar","old":"Gamla","active":"Aktiva","clear":"Rensa Flaggningar","clear_title":"rensa alla flaggningar av detta inl\u00e4gg (kommer visa g\u00f6mda inl\u00e4gg)","delete":"Radera Inl\u00e4gg","delete_title":"radera inl\u00e4gg (om det \u00e4r f\u00f6rsta inl\u00e4gget radera tr\u00e5d)","flagged_by":"Flaggad av","error":"N\u00e5gonting gick snett"},"api":{"title":"API"},"customize":{"title":"Anpassa","header":"Sidhuvud","css":"Stilmall","override_default":"Skriv \u00f6ver standard?","enabled":"Aktiverad?","preview":"f\u00f6rhandsgranska","undo_preview":"\u00e5ngra f\u00f6rhandsgranskning","save":"Spara","new":"Ny","new_style":"Ny Stil","delete":"Radera","delete_confirm":"Radera denna anpassning?"},"email":{"title":"E-postloggar","sent_at":"Skickat","email_type":"E-posttyp","to_address":"Till adress","test_email_address":"e-postadress att testa","send_test":"skicka testmail","sent_test":"skickat!"},"impersonate":{"title":"Imitera Anv\u00e4ndare","username_or_email":"Anv\u00e4ndare eller E-post f\u00f6r Anv\u00e4ndare","help":"Anv\u00e4nd detta verktyg f\u00f6r att imitera en anv\u00e4ndare i fels\u00f6kningssyfte.","not_found":"Den anv\u00e4ndaren kan inte hittas.","invalid":"Tyv\u00e4rr, du kan inte imitera den anv\u00e4ndaren."},"users":{"title":"Anv\u00e4ndare","create":"L\u00e4gg till Administrat\u00f6r","last_emailed":"Senast Mailad","not_found":"Tyv\u00e4rr den anv\u00e4ndaren existerar inte i v\u00e5rt system.","new":"Ny","active":"Aktiv","pending":"Avvaktande","approved":"Godk\u00e4nd?","approved_selected":{"one":"godk\u00e4nd anv\u00e4ndare","other":"godk\u00e4nd anv\u00e4ndare ({{count}})"}},"user":{"ban_failed":"N\u00e5gonting gick fel under avst\u00e4ngningen av denna anv\u00e4ndare {{error}}","unban_failed":"N\u00e5gonting gick fel under uppl\u00e5sningen av denna anv\u00e4ndare {{error}}","ban_duration":"Hur l\u00e4nge vill du st\u00e4nga av denna anv\u00e4ndare? (dagar)","delete_all_posts":"Radera alla inl\u00e4gg","ban":"St\u00e4ng av","unban":"L\u00e5s upp","banned":"Avst\u00e4ngd?","moderator":"Moderator?","admin":"Administrat\u00f6r?","show_admin_profile":"Administrat\u00f6r","refresh_browsers":"Tvinga webbl\u00e4saruppdatering","show_public_profile":"Visa Publik Profil","impersonate":"Imitera","revoke_admin":"\u00c5terkalla Administrat\u00f6r","grant_admin":"Bevilja Administrat\u00f6r","revoke_moderation":"\u00c5terkalla Moderering","grant_moderation":"Bevilja Moderering","reputation":"Rykte","permissions":"R\u00e4ttigheter","activity":"Aktivitet","like_count":"Gillningar Mottagna","private_topics_count":"Antal Privata Tr\u00e5dar","posts_read_count":"Inl\u00e4gg L\u00e4sta","post_count":"Inl\u00e4gg Skapade","topics_entered":"Tr\u00e5dar Bes\u00f6kta","flags_given_count":"Givna Flaggnignar","flags_received_count":"Mottagna Flaggningar","approve":"Godk\u00e4nn","approved_by":"godk\u00e4nd av","time_read":"L\u00e4stid"},"site_content":{"none":"V\u00e4lj typ av inneh\u00e5ll f\u00f6r att b\u00f6rja \u00e4ndra.","title":"Sidinneh\u00e5ll","edit":"\u00c4ndra sidinneh\u00e5ll"},"site_settings":{"show_overriden":"Visa bara \u00f6verskrivna","title":"Webbplatsinst\u00e4llningar","reset":"\u00e5terst\u00e4ll till standard"}}}}};
I18n.locale = 'sv';
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
