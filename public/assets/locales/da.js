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
MessageFormat.locale.da = function ( n ) {
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
    })({});I18n.translations = {"da":{"js":{"share":{"topic":"del et link til dette emne","post":"del et link til dette indl\u00e6g","close":"luk"},"edit":"rediger titel og kategori for dette emne","not_implemented":"Beklager, denne feature er ikke blevet implementeret endnu.","no_value":"Nej","yes_value":"Ja","of_value":"af","generic_error":"Beklager, der opstod en fejl.","log_in":"Log ind","age":"Alder","last_post":"Sidste indl\u00e6g","admin_title":"Admin","flags_title":"Flag","show_more":"vis mere","links":"Links","faq":"FAQ","you":"Dig","ok":"ok","or":"eller","now":"lige nu","suggested_topics":{"title":"Foresl\u00e5ede emner"},"bookmarks":{"not_logged_in":"Beklager, du skal v\u00e6re logget ind for at kunne bogm\u00e6rke indl\u00e6g.","created":"Du har bogm\u00e6rket dette indl\u00e6g.","not_bookmarked":"Du har l\u00e6st dette indl\u00e6g; klik for at bogm\u00e6rke det.","last_read":"Dette er det sidste indl\u00e6g, du har l\u00e6st."},"new_topics_inserted":"{{count}} nye emner.","show_new_topics":"Klik for at se.","preview":"forh\u00e5ndsvising","cancel":"annul\u00e9r","save":"Gem \u00e6ndringer","saving":"Gemmer\u2026","saved":"Gemt!","user_action_descriptions":{"6":"Svar"},"user":{"profile":"Profil","title":"Bruger","mute":"Mute","edit":"Redig\u00e9r indstillinger","download_archive":"download arkiv med alle mine indl\u00e6g","private_message":"Private beskeder","private_messages":"Beskeder","activity_stream":"Aktivitet","preferences":"Indstillinger","bio":"Om mig","change_password":"skift","invited_by":"Inviteret af","trust_level":"Tillidsniveau","external_links_in_new_tab":"\u00c5bn alle eksterne links i en ny fane","enable_quoting":"Tillad citerings-svar for markeret tekst","change_username":{"action":"skift","title":"Skift brugernavn","confirm":"Der kan v\u00e6re konsekvenser ved at skifte brugernavn. Er du sikker p\u00e5 at du vil skifte?","taken":"Beklager, det brugernavn er optaget.","error":"Der skete en fejl i forbindelse med skift af dit brugernavn.","invalid":"Det brugernavn er ugyldigt. Det m\u00e5 kun best\u00e5 af bogstaver og tal"},"change_email":{"action":"skift","title":"Skift e-mail-adresse","taken":"Beklager, den e-mail-adresse er optaget af en anden bruger.","error":"Der opstod en fejl i forbindelse med skift af din e-mail-adresse. M\u00e5ske er adressen allerede i brug?","success":"Vi har sendt en e-mail til din nye adresse. Klik p\u00e5 linket i mail\u2019en for at aktivere din nye e-mail-adresse."},"email":{"title":"E-mail","instructions":"Din e-mail-adresse vil aldrig blive vist offentligt.","ok":"Det ser fint ud. Vi e-mail\u2019er dig for at bekr\u00e6fte.","invalid":"Skriv venligst en gyldig e-mail-adresse.","authenticated":"Din e-mail er bekr\u00e6ftet af {{provider}}.","frequency":"Vi sender dig kun e-mail, hvis du ikke har v\u00e6ret p\u00e5 siden for nylig, og du ikke allerede har set de ting vi ville e-mail\u2019e dig om.."},"name":{"title":"Navn","instructions":"En l\u00e6ngere udgave af dit navn; beh\u00f8ver ikke at v\u00e6re unikt. Bruges som alternativ @navn match og vises kun p\u00e5 din profilside.","too_short":"Dit navn er for kort.","ok":"Dit navn ser fint ud."},"username":{"title":"Brugernavn","instructions":"Skal v\u00e6re unikt og uden mellemrum. Andre brugere kan referere til dig som @brugernavn.","short_instructions":"Andre brugere kan referere til dig som @{{username}}.","available":"Brugernavnet er tilg\u00e6ngeligt.","global_match":"E-mail-adressen matcher det registrerede brugernavn.","global_mismatch":"Allerede registreret. Pr\u00f8v {{suggestion}}?","not_available":"Ikke ledigt. Pr\u00f8v {{suggestion}}?","too_short":"Dit brugernavn er for kort.","too_long":"Dit brugernavn er for langt.","checking":"Checker om brugernavnet er ledigt\u2026","enter_email":"Brugernavn fundet. Skriv den tilh\u00f8rende e-mail-adresse."},"password_confirmation":{"title":"Kodeord igen"},"last_posted":"Sidste indl\u00e6g","last_emailed":"Sidste e-mail","last_seen":"Sidst set","created":"Oprettet","log_out":"Log ud","website":"Website","email_settings":"E-mail","email_digests":{"title":"N\u00e5r jeg ikke bes\u00f8ger sitet, send mig et e-mail-sammendrag af ny aktivitet","daily":"dagligt","weekly":"ugenligt","bi_weekly":"hver anden uge"},"email_direct":"Modtag e-mail, n\u00e5r nogen citerer dig, svarer p\u00e5 dine indl\u00e6g eller n\u00e6vner dit @brugernavn","email_private_messages":"Modtag e-mail, n\u00e5r nogen sender dig en privat besked","other_settings":"Andre","new_topic_duration":{"label":"Betragt emner som nye n\u00e5r","not_viewed":"Jeg ikke har set dem endnu","last_here":"de er blevet oprettet efter jeg var her sidst","after_n_days":{"one":"de er blevet oprettet inden for det sidste d\u00f8gn","other":"de er blevet oprettet inden for de sidste {{count}} d\u00f8gn"},"after_n_weeks":{"one":"de er blevet oprettet inden for den sidste uge","other":"de er blevet oprettet inden for de sidste {{count}} uger"}},"auto_track_topics":"F\u00f8lg automatisk emner jeg \u00e5bner","auto_track_options":{"never":"aldrig","always":"altid","after_n_seconds":{"one":"efter et sekund","other":"efter {{count}} sekunder"},"after_n_minutes":{"one":"efter et minut","other":"efter {{count}} minutter"}},"invited":{"title":"Invitationer","user":"Inviteret bruger","none":"{{username}} har ikke inviteret nogen brugere til dette site.","redeemed":"Brugte invitationer","redeemed_at":"Invitation brugt","pending":"Udest\u00e5ende invitationer","topics_entered":"Emner \u00e5bnet","posts_read_count":"Indl\u00e6g l\u00e6st","rescind":"Fjern invitation","rescinded":"Invitation fjernet","time_read":"L\u00e6se tid","days_visited":"Bes\u00f8gsdage","account_age_days":"Kontoens alder i dage"},"password":{"title":"Kodeord","too_short":"Dit kodeord er for kort.","ok":"Dit kodeord ser fint ud."},"ip_address":{"title":"Sidste IP-adresse"},"avatar":{"title":"Brugerbillede","instructions":"Vi bruger <a href='https://gravatar.com' target='_blank'>Gravatar</a> for brugerbilleder baseret p\u00e5 e-mail-adresse"},"filters":{"all":"Alle"},"stream":{"posted_by":"Skrevet af","sent_by":"Sendt af","private_message":"privat besked","the_topic":"emnet"}},"loading":"Indl\u00e6ser\u2026","close":"Luk","learn_more":"L\u00e6s mere\u2026","year":"\u00e5r","year_desc":"emner oprettet inden for de sidste 365 dage","month":"m\u00e5ned","month_desc":"emner oprettet inden for de sidste 30 dage","week":"uge","week_desc":"emner oprettet inden for de sidste 7 dage","first_post":"F\u00f8rste indl\u00e6g","mute":"Mute","unmute":"Unmute","best_of":{"title":"Topindl\u00e6g","description":"Der er <b>{{count}}</b> indl\u00e6g i dette emne. Det er mange! Vil du gerne spare lidt tid, ved kun at se de indl\u00e6g der har flest interaktioner og svar?","button":"Vis kun \u201cTopindl\u00e6g\u201d"},"private_message_info":{"title":"Privat samtale","invite":"Invit\u00e9r andre\u2026"},"email":"E-mail","username":"Brugernavn","last_seen":"Sidst set","created":"Oprettet","trust_level":"Tillidsniveau","create_account":{"title":"Opret konto","action":"Lav konto nu!","invite":"Har du ikke en konto endnu?","failed":"Noget gik galt. M\u00e5ske er e-mail-adressen allerede registreret \u2013 pr\u00f8v \u201cGlemt kodeord\u201d-linket"},"forgot_password":{"title":"Glemt kodeord","action":"Jeg har glemt mit kodeord","invite":"Skriv brugernavn eller e-mail-adresse, s\u00e5 sender vi dig en mail s\u00e5 du kan nulstille dit kodeord.","reset":"Nulstil kodeord","complete":"Du burde snart f\u00e5 en e-mail med en forklaring p\u00e5 hvordan du kan nulstille dit kodeord."},"login":{"title":"Log ind","username":"Brugernavn","password":"Kodeord","email_placeholder":"e-mail-adresse eller brugernavn","error":"Ukendt fejl","reset_password":"Nulstil kodeord","logging_in":"Logger ind\u2026","or":"Eller","authenticating":"Logger ind\u2026","awaiting_confirmation":"Din konto mangler at blive aktiveret. Brug \u201cGlemt kodeord\u201d linket for at f\u00e5 en ny aktiverings-mail.","awaiting_approval":"Din konto er ikke blevet godkendt af en moderator endnu. Du f\u00e5r en e-mail n\u00e5r den bliver godkendt.","not_activated":"Du kan ikke logge ind endnu. Vi har tidligere sendt en aktiverings-e-mail til dig p\u00e5 <b>{{sentTo}}</b>. F\u00f8lg venligst instruktionerne i den e-mail for at aktivere din konto.","resend_activation_email":"Klik her for at sende aktiverings-e-mail\u2019en igen.","sent_activation_email_again":"Vi har sendt endnu en aktiverings-e-mail til dig p\u00e5 <b>{{currentEmail}}</b>. Det kan tage nogen f\u00e5 minutter f\u00f8r den n\u00e5r frem; check ogs\u00e5 din spam-mappe.","google":{"title":"med Google","message":"Logger ind med Google (check at pop-op-blokering ikke er aktiv)"},"twitter":{"title":"med Twitter","message":"Logger ind med Twitter (check at pop-op-blokering ikke er aktiv)"},"facebook":{"title":"med Facebook","message":"Logger ind med Facebook (check at pop-op-blokering ikke er aktiv)"},"yahoo":{"title":"med Yahoo","message":"Logger ind med Yahoo (check at pop-op-blokering ikke er aktiv)"},"github":{"title":"med GitHub","message":"Logger ind med GitHub (check at pop-op-blokering ikke er aktiv)"},"persona":{"title":"med Persona","message":"Logger ind med Mozilla Persona (check at pop-op-blokering ikke er aktiv)"}},"composer":{"posting_not_on_topic":"Du svarer nu p\u00e5 emnet \"{{title}}\", men du ser i \u00f8jeblikket p\u00e5 et andet emne.","saving_draft_tip":"gemmer","saved_draft_tip":"gemt","saved_local_draft_tip":"gemt lokalt","similar_topics":"Dit emne minder om\u2026","drafts_offline":"kladder offline","min_length":{"need_more_for_title":"{{n}} tegn mangler for titlen","need_more_for_reply":"{{n}} tegn mangler for svaret"},"save_edit":"Gem \u00e6ndringer","reply_original":"Svar til det oprindelige emne","reply_here":"Svar her","reply":"Svar","cancel":"Annul\u00e9r","create_topic":"Opret emne","create_pm":"Opret privat besked","users_placeholder":"Tilf\u00f8j bruger","title_placeholder":"Skriv din titel her. Hvad handler diskussionen om i en kort s\u00e6tning?","reply_placeholder":"Skriv dit svar her. Brug Markdown eller BBCode til at formatere. Tr\u00e6k et billede ind for at uploade det.","view_new_post":"Se dit nye indl\u00e6g.","saving":"Gemmer\u2026","saved":"Gemt!","saved_draft":"Du har en kladde i gang. Klik hvorsomhelst i denne kasse for at fors\u00e6tte med redigering af den.","uploading":"Uploader\u2026","show_preview":"forh\u00e5ndsvisning &raquo;","hide_preview":"&laquo; skjul forh\u00e5ndsvisning","bold_title":"Fed","bold_text":"fed skrift","italic_title":"Kursiv","italic_text":"kursiv skrift","link_title":"Link","link_description":"skriv beskrivelse af linket her","link_dialog_title":"Inds\u00e6t link","link_optional_text":"evt. titel","quote_title":"Citatblok","quote_text":"Citatblok","code_title":"Programkode","code_text":"skriv programkode her","image_title":"Billede","image_description":"skriv billedets beskrivelse her","image_dialog_title":"Inds\u00e6t billede","image_optional_text":"evt. titel","image_hosting_hint":"Brug for <a href='http://www.google.com/search?q=free+image+hosting' target='_blank'>gratis billed hosting?</a>","olist_title":"Numereret liste","ulist_title":"Punktopstilling","list_item":"Listepunkt","heading_title":"Overskrift","heading_text":"Overskrift","hr_title":"Vandret streg","undo_title":"Fortryd","redo_title":"Gentag","help":"Markdown redigeringshj\u00e6lp"},"notifications":{"title":"notifikation ved @navns n\u00e6vnelse, svar til dine indl\u00e6g og emner, private beskeder, mv.","none":"Du har ikke nogen notifikationer lige nu.","more":"se \u00e6ndre notifikationer","mentioned":"<span title='mentioned' class='icon'>@</span> {{username}} {{link}}","quoted":"<i title='quoted' class='icon icon-quote-right'></i> {{username}} {{link}}","replied":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","posted":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","edited":"<i title='edited' class='icon icon-pencil'></i> {{username}} {{link}}","liked":"<i title='liked' class='icon icon-heart'></i> {{username}} {{link}}","private_message":"<i class='icon icon-lock' title='private message'></i> {{username}} har sendt dig en privat besked: {{link}}","invited_to_private_message":"{{username}} har inviteret dig til en privat samtale: {{link}}","invitee_accepted":"<i title='accepted your invitation' class='icon icon-signin'></i> {{username}} har accepteret din invitation","moved_post":"<i title='moved post' class='icon icon-arrow-right'></i> {{username}} flyttede indl\u00e6g til {{link}}"},"image_selector":{"title":"Inds\u00e6t billede","from_my_computer":"Fra min computer","from_the_web":"Fra nettet","add_image":"Inds\u00e6t billede","remote_tip":"skriv adressen p\u00e5 et billede i formen http://example.com/billede.jpg","local_tip":"klik for at v\u00e6lge et billede fra din computer.","upload":"Upload","uploading_image":"Uploader billede"},"search":{"title":"s\u00f8g efter emner, indl\u00e6g, brugere eller kategorier","placeholder":"skriv s\u00f8geord her","no_results":"Ingen resultater fundet.","searching":"S\u00f8ger\u2026"},"site_map":"g\u00e5 til en anden emneoversigt eller kategori","go_back":"g\u00e5 tilbage","current_user":"g\u00e5 til brugerside","favorite":{"title":"Favorit","help":"tilf\u00f8j dette emne til din favorit-liste"},"topics":{"none":{"favorited":"Du har ikke nogen favorit-emner endnu. For at g\u00f8re et emne til favorit, tryk p\u00e5\u00a0stjernen ved siden af emnets titel.","unread":"Du har ingen ul\u00e6ste emner.","new":"Du har ingen nye emner.","read":"Du har ikke l\u00e6st nogen emner endnu.","posted":"Du har ikke skrevet nogen indl\u00e6g endnu.","latest":"Der er ikke nogen popul\u00e6re emner. Det er s\u00f8rgeligt.","category":"Der er ingen emner i kategorien {{category}}."},"bottom":{"latest":"Der er ikke flere popul\u00e6re emner.","posted":"Der er ikke flere emner.","read":"Der er ikke flere l\u00e6ste emner.","new":"Der er ikke flere nye emner.","unread":"Der er ikke flere ul\u00e6ste emner.","favorited":"Der er ikke flere favorit-emner.","category":"Der er ikke flere emner i kategorien {{category}}."}},"topic":{"create_in":"Opret emne i kategorien {{categoryName}}","create":"Opret emne","create_long":"Opret et nyt emne i debatten","private_message":"Start en privat samtale","list":"Emner","new":"nye emner","title":"Emne","loading_more":"Indl\u00e6ser flere emner\u2026","loading":"Indl\u00e6ser emne\u2026","invalid_access":{"title":"Emnet er privat","description":"Beklager, du har ikke adgang til dette emne!"},"server_error":{"title":"Emnet kunne ikke indl\u00e6ses","description":"Beklager, vi kunne ikke indl\u00e6se det emne, muligvis grundet et problem med netv\u00e6rksforbindelsen. Pr\u00f8v venligst igen. Hvis problemet fort\u00e6stter, s\u00e5 skriv venligst til os."},"not_found":{"title":"Emnet findes ikke","description":"Beklager, vi kunne ikke finde det emne i databasen. M\u00e5ske er det blevet fjernet af moderator?"},"unread_posts":"der er {{unread}} indl\u00e6g du ikke har l\u00e6st i dette emne","new_posts":"der er kommet {{new_posts}} nye indl\u00e6g i dette emne siden du l\u00e6ste det sidst","likes":{"one":"der er en \u201cSynes godt om\u201d i dette emne","other":"der er {{count}} \u201cSynes godt om\u201d i dette emne"},"back_to_list":"Tilbage til emneoversigt","options":"Emneindstillinger","show_links":"vis links i dette emne","toggle_information":"vis detaljer om emnet","read_more_in_category":"Mere l\u00e6sestof? Se andre emner i {{catLink}} eller {{latestLink}}.","read_more":"Mere l\u00e6sestof? {{catLink}} else {{latestLink}}.","browse_all_categories":"Vis alle kategorier","view_latest_topics":"vis popul\u00e6re emner","suggest_create_topic":"Hvorfor ikke oprette et emne?","read_position_reset":"Din l\u00e6seposition er blevet nulstillet.","jump_reply_up":"hop til tidligere svar","jump_reply_down":"hop til senere svar","progress":{"title":"emnestatus","jump_top":"hop til f\u00f8rste indl\u00e6g","jump_bottom":"hop til sidste indl\u00e6g","total":"antal indl\u00e6g","current":"nuv\u00e6rende indl\u00e6g"},"notifications":{"title":"","reasons":{"3_2":"Du f\u00e5r notifikationer fordi du overv\u00e5ger dette emne.","3_1":"Du f\u00e5r notifikationer fordi du oprettede dette emne.","3":"Du f\u00e5r notifikationer fordi du overv\u00e5ger dette emne.","2_4":"Du f\u00e5r notifikationer fordi du har besvaret dette emne.","2_2":"Du f\u00e5r notifikationer fordi du f\u00f8lger dette emne.","2":"Du f\u00e5r notifikationer fordi du <a href=\"/users/{{username}}/preferences\">har l\u00e6st dette emne</a>.","1":"Du f\u00e5r kun notifikationer hvis nogen n\u00e6vner dit @navn eller svarer p\u00e5 dit indl\u00e6g.","1_2":"Du f\u00e5r kun notifikationer hvis nogen n\u00e6vner dit @navn eller svarer p\u00e5 dit indl\u00e6g.","0":"Du f\u00e5r ingen notifikationer for dette emne.","0_2":"Du f\u00e5r ingen notifikationer for dette emne."},"watching":{"title":"Overv\u00e5ger","description":"samme som F\u00f8lger, plus at du f\u00e5r besked om alle nye indl\u00e6g."},"tracking":{"title":"F\u00f8lger","description":"du f\u00e5r besked om ul\u00e6ste indl\u00e6g, @navns n\u00e6vnelse og svar til dine indl\u00e6g."},"regular":{"title":"Standard","description":"du f\u00e5r kun besked hvis nogen n\u00e6vner dit @navn eller svarer p\u00e5 dit indl\u00e6g."},"muted":{"title":"Stille!","description":"du f\u00e5r ikke besked om nogen h\u00e6ndelser i dette emne, og det vil ikke fremg\u00e5 af din liste over ul\u00e6ste emner."}},"actions":{"delete":"Slet emne","open":"\u00c5bn emne","close":"Luk emne","unpin":"Un-Pin Topic","pin":"Pin Topic","unarchive":"Unarchive Topic","archive":"Arkiv\u00e9r emne","invisible":"G\u00f8r usynlig","visible":"G\u00f8r synlig","reset_read":"Glem hvilke emner jeg har l\u00e6st","multi_select":"Select for Merge/Split","convert_to_topic":"Konvert\u00e9r til normalt emne"},"reply":{"title":"Svar","help":"begynd at skrive et svar til dette emne"},"clear_pin":{"title":"Clear pin","help":"Clear the pinned status of this topic so it no longer appears at the top of your topic list"},"share":{"title":"Del","help":"del et link til dette emne"},"inviting":"Inviterer\u2026","invite_private":{"title":"Invit\u00e9r til privat samtale","email_or_username":"Inviteret brugers e-mail eller brugernavn","email_or_username_placeholder":"e-mail-adresse eller brugernavn","action":"Invit\u00e9r","success":"Tak! Vi har inviteret den bruger til at deltage i din private samtale.","error":"Beklager, der skete en fejl, da vi fors\u00f8gte at invitere den bruger."},"invite_reply":{"title":"Invit\u00e9r venner til at svare","help":"send invitationer til dine venner, s\u00e5 de kan svare p\u00e5 dette indl\u00e6g med et enkelt klik","email":"Vi sender din ven en kort e-mail, som giver dem mulighed for at svare p\u00e5 dette emne med ved at klikke p\u00e5 et link.","email_placeholder":"e-mail-adresse","success":"Tak! Vi har sendt en invitation til <b>{{email}}</b>. Du f\u00e5r besked, n\u00e5r de bruger din invitation. Check invitations-fanen p\u00e5 din brugerside, for at f\u00f8lge med i hvem du har inviteret.","error":"Beklager, vi kunne ikke invitere den person. M\u00e5ske er de allerede brugere?"},"login_reply":"Log ind for at svare","filters":{"user":"Du ser kun endl\u00e6g fra specifikke brugere.","best_of":"Du ser kun \u201cTopindl\u00e6g\u201d.","cancel":"Se alle indl\u00e6g i emnet."},"move_selected":{"title":"Flyt valgte indl\u00e6g","topic_name":"Ny emnetitel:","error":"Sorry, there was an error moving those posts.","instructions":{"one":"Du laver nu et nyt emne med det valgte indl\u00e6g.","other":"Du laver nu et nyt emne med de <b>{{count}}</b> valgte indl\u00e6g."}},"multi_select":{"select":"v\u00e6lg","selected":"valgt ({{count}})","delete":"slet valgte","cancel":"glem valg","move":"flyt valgte","description":{"one":"Du har valgt <b>1</b> indl\u00e6g.","other":"Du har valgt <b>{{count}}</b> indl\u00e6g."}}},"post":{"reply":"Svar til {{link}} af {{replyAvatar}} {{username}}","reply_topic":"Svar til {{link}}","quote_reply":"cit\u00e9r svar","edit":"Redigerer {{link}} af {{replyAvatar}} {{username}}","post_number":"indl\u00e6g {{number}}","in_reply_to":"som svar til","reply_as_new_topic":"Svar som nyt emne","continue_discussion":"Forts\u00e6tter debatten fra {{postLink}}:","follow_quote":"g\u00e5 til det citerede indl\u00e6g","deleted_by_author":"(indl\u00e6g slettet af forfatter)","has_replies":{"one":"Svar","other":"Svar"},"errors":{"create":"Sorry, there was an error creating your post. Please try again.","edit":"Sorry, there was an error editing your post. Please try again.","upload":"Sorry, there was an error uploading that file. Please try again."},"abandon":"Er du sikker p\u00e5 at du vil droppe dit indl\u00e6g?","archetypes":{"save":"Gem indstillinger"},"controls":{"reply":"begynd at et svar p\u00e5 dette indl\u00e6g","like":"synes godt om dette indl\u00e6g","edit":"redig\u00e9r dette indl\u00e6g","flag":"g\u00f8r moderators opm\u00e6rksomh p\u00e5 dette indl\u00e6g","delete":"slet dette indl\u00e6g","undelete":"annul\u00e9r sletning","share":"del et link til dette indl\u00e6g","bookmark":"bogm\u00e6rk dette indl\u00e6g til din brugerside","more":"Mere"},"actions":{"flag":"Flag","clear_flags":{"one":"Fjern flag","other":"Fjern flags"},"it_too":"{{alsoName}} det ogs\u00e5","undo":"Fortryd {{alsoName}}","by_you_and_others":{"zero":"Du {{long_form}}","one":"Du og en anden {{long_form}}","other":"Du og {{count}} andre {{long_form}}"},"by_others":{"one":"En person {{long_form}}","other":"{{count}} personer {{long_form}}"}},"edits":{"one":"en \u00e6ndring","other":"{{count}} \u00e6ndringer","zero":"ingen \u00e6ndringer"},"delete":{"confirm":{"one":"Er du sikker p\u00e5 at du vil slette indl\u00e6gget?","other":"Er du sikker p\u00e5 at du vil slette alle de indl\u00e6g?"}}},"category":{"none":"(ingen kategori)","edit":"redig\u00e9r","edit_long":"Redig\u00e9r kategori","view":"Vis emner i kategori","delete":"Slet kategori","create":"Ny kategori","creation_error":"There has been an error during the creation of the category.","more_posts":"se alle {{posts}}\u2026","name":"Kategorinavn","description":"Beskrivelse","topic":"kategoriemne","badge_colors":"M\u00e6rkefarver","background_color":"Baggrundsfarve","foreground_color":"Tekstfarve","name_placeholder":"B\u00f8r v\u00e6re kort og kontant.","color_placeholder":"En web-farve","delete_confirm":"Er du sikker p\u00e5 at du vil slette den kategori?","list":"Kategoriliste","no_description":"Der er ingen beskrivelse for denne kategori.","change_in_category_topic":"bes\u00f8g kategoriemnet for at redigere beskrivelsen"},"flagging":{"title":"Why are you flagging this post?","action":"Flag Post","cant":"Sorry, you can't flag this post at this time.","custom_placeholder":"Why does this post require moderator attention? Let us know specifically what you are concerned about, and provide relevant links where possible.","custom_message":{"at_least":"enter at least {{n}} characters","more":"{{n}} to go...","left":"{{n}} remaining"}},"topic_summary":{"title":"Topic Summary","links_shown":"show all {{totalLinks}} links..."},"topic_statuses":{"locked":{"help":"emnet er l\u00e5st; det modtager ikke flere svar"},"pinned":{"help":"this topic is pinned; it will display at the top of its category"},"archived":{"help":"emnet er arkiveret; det er frosset og kan ikke \u00e6ndres"},"invisible":{"help":"emnet er usynligt; det vises ikke p\u00e5\u00a0lister og kan kun tilg\u00e5es med et direkte link"}},"posts":"Indl\u00e6g","posts_long":"{{number}} indl\u00e6g i dette emne","original_post":"Oprindeligt indl\u00e6g","views":"Visninger","replies":"Svar","views_long":"dette emne er blevet vist {{number}} gange","activity":"Aktivitet","likes":"Synes godt om","top_contributors":"Deltagere","category_title":"Kategori","history":"Historik","changed_by":"af {{author}}","categories_list":"Kategorioversigt","filters":{"latest":{"title":"Popul\u00e6re","help":"de mest popul\u00e6re nyere emner"},"favorited":{"title":"Favoritter","help":"emner du har markeret som favoritter"},"read":{"title":"L\u00e6ste","help":"emner du har l\u00e6st"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alle emner grupperet efter kategori"},"unread":{"title":{"zero":"Ul\u00e6st","one":"Ul\u00e6st (1)","other":"Ul\u00e6st ({{count}})"},"help":"emner du f\u00f8lger med i med ul\u00e6ste indl\u00e6g"},"new":{"title":{"zero":"Nye","one":"Ny (1)","other":"Nye ({{count}})"},"help":"nye emner siden dit sidste bes\u00f8g, og emner du f\u00f8lger med i med nye indl\u00e6g"},"posted":{"title":"Mine indl\u00e6g","help":"emner du har skrevet indl\u00e6g i"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"popul\u00e6re emner i kategorien {{categoryName}}"}},"type_to_filter":"type to filter...","admin":{"title":"Discourse Admin","dashboard":{"title":"Dashboard","version":"Installed version","up_to_date":"You are running the latest version of Discourse.","critical_available":"A critical update is available.","updates_available":"Updates are available.","please_upgrade":"Please upgrade!","latest_version":"Latest version","total_users":"Total Users","moderator_short":"mod","reports":{"today":"Today","yesterday":"Yesterday","last_7_days":"Last 7 Days","last_30_days":"Last 30 Days","all_time":"All Time","7_days_ago":"7 Days Ago","30_days_ago":"30 Days Ago"}},"commits":{"latest_changes":"Latest changes: please update often!","by":"by"},"flags":{"title":"Flags","old":"Old","active":"Active","clear":"Clear Flags","clear_title":"dismiss all flags on this post (will unhide hidden posts)","delete":"Delete Post","delete_title":"delete post (if its the first post delete topic)","flagged_by":"Flagged by","error":"Something went wrong"},"customize":{"title":"Customize","header":"Header","css":"Stylesheet","override_default":"Do not include standard style sheet","enabled":"Enabled?","preview":"preview","undo_preview":"undo preview","save":"Save","new":"New","new_style":"New Style","delete":"Delete","delete_confirm":"Delete this customization?"},"email":{"title":"Email","sent_at":"Sent At","email_type":"Email Type","to_address":"To Address","test_email_address":"email address to test","send_test":"send test email","sent_test":"sent!"},"impersonate":{"title":"Impersonate User","username_or_email":"Username or Email of User","help":"Use this tool to impersonate a user account for debugging purposes.","not_found":"That user can't be found.","invalid":"Sorry, you may not impersonate that user."},"users":{"title":"Users","create":"Add Admin User","last_emailed":"Last Emailed","not_found":"Sorry that username doesn't exist in our system.","new":"New","active":"Active","pending":"Pending","approved":"Approved?","approved_selected":{"one":"approve user","other":"approve users ({{count}})"}},"user":{"ban_failed":"Something went wrong banning this user {{error}}","unban_failed":"Something went wrong unbanning this user {{error}}","ban_duration":"How long would you like to ban the user for? (days)","delete_all_posts":"Delete all posts","ban":"Ban","unban":"Unban","banned":"Banned?","moderator":"Moderator?","admin":"Admin?","show_admin_profile":"Admin","refresh_browsers":"Force browser refresh","show_public_profile":"Show Public Profile","impersonate":"Impersonate","revoke_admin":"Revoke Admin","grant_admin":"Grant Admin","revoke_moderation":"Revoke Moderation","grant_moderation":"Grant Moderation","reputation":"Reputation","permissions":"Permissions","activity":"Activity","like_count":"Likes Received","private_topics_count":"Private Topics Count","posts_read_count":"Posts Read","post_count":"Posts Created","topics_entered":"Topics Entered","flags_given_count":"Flags Given","flags_received_count":"Flags Received","approve":"Approve","approved_by":"approved by","time_read":"Read Time"},"site_settings":{"show_overriden":"Only show overridden","title":"Settings","reset":"reset to default"}}}}};
I18n.locale = 'da';
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
