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
MessageFormat.locale.cs = function (n) {
  if (n == 1) {
    return 'one';
  }
  if (n == 2 || n == 3 || n == 4) {
    return 'few';
  }
  return 'other';
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
    })({});I18n.translations = {"cs":{"js":{"share":{"topic":"sd\u00edlet odkaz na toto t\u00e9ma","post":"sd\u00edlet odkaz na tento p\u0159\u00edsp\u011bvek","close":"zav\u0159\u00edt","twitter":"sd\u00edlet odkaz na Twitteru","facebook":"sd\u00edlet odkaz na Facebooku","google+":"sd\u00edlet odkaz na Google+","email":"odeslat odkaz emailem"},"edit":"upravit n\u00e1zev a kategorii p\u0159\u00edsp\u011bvku","not_implemented":"Tato fi\u010dura je\u0161t\u011b nen\u00ed implementovan\u00e1","no_value":"Ne","yes_value":"Ano","of_value":"z","generic_error":"Bohu\u017eel nastala chyba.","log_in":"P\u0159ihl\u00e1sit se","age":"V\u011bk","last_post":"Posledn\u00ed p\u0159\u00edsp\u011bvek","admin_title":"Administr\u00e1tor","flags_title":"Nahl\u00e1\u0161en\u00ed","show_more":"zobrazit v\u00edce","links":"Odkazy","faq":"FAQ","you":"Vy","or":"nebo","now":"pr\u00e1v\u011b te\u010f","read_more":"\u010d\u00edst d\u00e1le","in_n_seconds":{"one":"za 1 sekundu","few":"za {{count}} sekundy","other":"za {{count}} sekund"},"in_n_minutes":{"one":"za 1 minutu","few":"za {{count}} minuty","other":"za {{count}} minut"},"in_n_hours":{"one":"za 1 hodinu","few":"za {{count}} hodiny","other":"za {{count}} hodin"},"in_n_days":{"one":"za 1 den","few":"za {{count}} dny","other":"za {{count}} dn\u00ed"},"suggested_topics":{"title":"Doporu\u010den\u00e1 t\u00e9mata"},"bookmarks":{"not_logged_in":"Pro p\u0159id\u00e1n\u00ed z\u00e1lo\u017eky se mus\u00edte p\u0159ihl\u00e1sit.","created":"Z\u00e1lo\u017eka byla p\u0159id\u00e1na.","not_bookmarked":"Tento p\u0159\u00edsp\u011bvek jste ji\u017e \u010detli. Klikn\u011bte pro p\u0159id\u00e1n\u00ed z\u00e1lo\u017eky.","last_read":"Tohle je posledn\u00ed ji\u017e p\u0159e\u010dten\u00fd p\u0159\u00edsp\u011bvek."},"new_topics_inserted":"{{count}} nov\u00fdch t\u00e9mat.","show_new_topics":"Klikn\u011bte pro zobrazen\u00ed.","preview":"n\u00e1hled","cancel":"zru\u0161it","save":"Ulo\u017eit zm\u011bny","saving":"Ukl\u00e1d\u00e1m...","saved":"Ulo\u017eeno!","choose_topic":{"none_found":"\u017d\u00e1dn\u00e1 t\u00e9mata nenalezena.","title":{"search":"Hledat t\u00e9ma podle n\u00e1zvu, URL nebo ID:","placeholder":"sem napi\u0161te n\u00e1zev t\u00e9matu"}},"user_action":{"user_posted_topic":"<a href='{{userUrl}}'>{{user}}</a> zaslal <a href='{{topicUrl}}'>t\u00e9ma</a>","you_posted_topic":"<a href='{{userUrl}}'>Vy</a> jste zaslal <a href='{{topicUrl}}'>t\u00e9ma</a>","user_replied_to_post":"<a href='{{userUrl}}'>{{user}}</a> odpov\u011bd\u011bl na p\u0159\u00edsp\u011bvek <a href='{{postUrl}}'>{{post_number}}</a>","you_replied_to_post":"<a href='{{userUrl}}'>Vy</a> jste odpov\u011bd\u011bl na p\u0159\u00edsp\u011bvek <a href='{{postUrl}}'>{{post_number}}</a>","user_replied_to_topic":"<a href='{{userUrl}}'>{{user}}</a> p\u0159isp\u011bl do <a href='{{topicUrl}}'>t\u00e9matu</a>","you_replied_to_topic":"<a href='{{userUrl}}'>Vy</a> jste p\u0159isp\u011bl do <a href='{{topicUrl}}'>t\u00e9matu</a>","user_mentioned_user":"<a href='{{user1Url}}'>{{user}}</a> zm\u00ednil u\u017eivatele <a href='{{user2Url}}'>{{another_user}}</a>","user_mentioned_you":"<a href='{{user1Url}}'>{{user}}</a> zm\u00ednil <a href='{{user2Url}}'>v\u00e1s</a>","you_mentioned_user":"<a href='{{user1Url}}'>Vy</a> jste zn\u00ednil u\u017eivatele <a href='{{user2Url}}'>{{user}}</a>","posted_by_user":"Odesl\u00e1no u\u017eivatel <a href='{{userUrl}}'>{{user}}</a>","posted_by_you":"Odesl\u00e1no <a href='{{userUrl}}'>v\u00e1mi</a>","sent_by_user":"Posl\u00e1no u\u017eivatelem <a href='{{userUrl}}'>{{user}}</a>","sent_by_you":"Posl\u00e1no <a href='{{userUrl}}'>v\u00e1mi</a>"},"user_action_groups":{"1":"Rozdan\u00fdch 'l\u00edb\u00ed se'","2":"Obdr\u017een\u00fdch 'l\u00edb\u00ed se'","3":"Z\u00e1lo\u017eky","4":"T\u00e9mata","5":"Odpov\u011bdi","6":"Odezvy ostatn\u00edch","7":"Zm\u00ed\u0148ky","9":"Citace","10":"Obl\u00edben\u00e9","11":"Editace","12":"Odeslan\u00e9 zpr\u00e1vy","13":"P\u0159ijat\u00e9 zpr\u00e1vy"},"user":{"profile":"Profil","title":"U\u017eivatel","mute":"Ignorovat","edit":"Upravit nastaven\u00ed","download_archive":"st\u00e1hnout archiv m\u00fdch p\u0159\u00edsp\u011bvk\u016f","private_message":"Soukrom\u00e1 zpr\u00e1va","private_messages":"Zpr\u00e1vy","activity_stream":"Aktivita","preferences":"Nastaven\u00ed","bio":"O mn\u011b","invited_by":"Pozn\u00e1nka od","trust_level":"V\u011brohodnost","external_links_in_new_tab":"Otev\u00edrat v\u0161echny extern\u00ed odkazy do nov\u00e9 z\u00e1lo\u017eky","enable_quoting":"Povolit odpov\u011b\u010f s citac\u00ed z ozna\u010den\u00e9ho textu","moderator":"{{user}} je moder\u00e1tor","admin":"{{user}} je administr\u00e1tor","change_password":{"action":"zm\u011bnit","success":"(email odesl\u00e1n)","in_progress":"(odes\u00edl\u00e1m)","error":"(chyba)"},"change_username":{"action":"zm\u011bnit u\u017eivatelsk\u00e9 jm\u00e9no","title":"Zm\u011bnit u\u017eivatelsk\u00e9 jm\u00e9no","confirm":"Zm\u011bna u\u017eivatelsk\u00e9ho jm\u00e9na m\u016f\u017ee m\u00edt v\u00e1\u017en\u00e9 n\u00e1sledky. Opravdu to chcete ud\u011blat?","taken":"Toto u\u017eivatelsk\u00e9 jm\u00e9no je ji\u017e zabran\u00e9.","error":"Nastala chyba p\u0159i zm\u011bn\u011b u\u017eivatelsk\u00e9ho jm\u00e9na.","invalid":"U\u017eivatelsk\u00e9 jm\u00e9no je neplatn\u00e9. Mus\u00ed obsahovat pouze p\u00edsmena a \u010d\u00edslice."},"change_email":{"action":"zm\u011bnit emailovou adresu","title":"Zm\u011bnit emailovou adresu","taken":"Tato emailov\u00e1 adresa nen\u00ed k dispozici.","error":"Nastala chyba p\u0159i zm\u011bn\u011b emailov\u00e9 adresy. Nen\u00ed tato adresa ji\u017e pou\u017e\u00edvan\u00e1?","success":"Na zadanou adresu jsme zaslali email. N\u00e1sledujte, pros\u00edm, instrukce v tomto emailu."},"email":{"title":"Emailov\u00e1 adresa","instructions":"Va\u0161e emailov\u00e1 adresa nikdy nebude ve\u0159ejn\u011b zobrazena.","ok":"To vypad\u00e1 dob\u0159e. Za\u0161leme v\u00e1m email s potvrzen\u00edm.","invalid":"Pros\u00edm zadejte platnou emailovou adresu.","authenticated":"Va\u0161e emailov\u00e1 adresa byla autorizov\u00e1na p\u0159es slu\u017ebu {{provider}}.","frequency":"Budeme v\u00e1s informovat emailem pouze pokud jste se na na\u0161em webu dlouho neuk\u00e1zali a pokud jste obsah, o kter\u00e9m v\u00e1s chceme informovat, doposud nevid\u011bli."},"name":{"title":"Jm\u00e9no","instructions":"Del\u0161\u00ed verze va\u0161eho jm\u00e9na. Nemus\u00ed b\u00fdt unik\u00e1tn\u00ed.","too_short":"Va\u0161e jm\u00e9no je p\u0159\u00edli\u0161 kr\u00e1tk\u00e9.","ok":"Va\u0161e jm\u00e9no vypad\u00e1 dob\u0159e"},"username":{"title":"U\u017eivatelsk\u00e9 jm\u00e9no","instructions":"Mus\u00ed b\u00fdt unik\u00e1tn\u00ed a bez mezer. Ostatn\u00ed v\u00e1s mohou zm\u00ednit jako @username.","short_instructions":"Ostatn\u00ed v\u00e1s mohou zm\u00ednit jako @{{username}}.","available":"Toto u\u017eivatelsk\u00e9 jm\u00e9no je voln\u00e9.","global_match":"Emailov\u00e1 adresa odpov\u00edd\u00e1 registrovan\u00e9ho u\u017eivatelsk\u00e9mu jm\u00e9nu.","global_mismatch":"ji\u017e zaregistrov\u00e1no. Co t\u0159eba {{suggestion}}?","not_available":"Nen\u00ed k dispozici. Co t\u0159eba {{suggestion}}?","too_short":"Va\u0161e u\u017eivatelsk\u00e9 jm\u00e9no je p\u0159\u00edli\u0161 kr\u00e1tk\u00e9.","too_long":"Va\u0161e u\u017eivatelsk\u00e9 jm\u00e9no je p\u0159\u00edli\u0161 dlouh\u00e9.","checking":"Zji\u0161\u0165uji, zda je u\u017eivatelsk\u00e9 jm\u00e9no voln\u00e9...","enter_email":"U\u017eivatelsk\u00e9 jm\u00e9no nalezeno. Zadejte odpov\u00eddaj\u00edc\u00ed emailovou adresu."},"password_confirmation":{"title":"Heslo znovu"},"last_posted":"Posledn\u00ed p\u0159\u00edsp\u011bvek","last_emailed":"Naposledy zasl\u00e1n email","last_seen":"Naposledy vid\u011bn","created":"\u00da\u010det vytvo\u0159en","log_out":"Odhl\u00e1sit","website":"Web","email_settings":"Emailov\u00e1 adresa","email_digests":{"title":"Chci dost\u00e1vat emailem souhrn novinek","daily":"denn\u011b","weekly":"t\u00fddn\u011b","bi_weekly":"jednou za 14 dn\u00ed"},"email_direct":"Chci dostat email kdy\u017e n\u011bkdo bude mluvit p\u0159\u00edmo se mnou","email_private_messages":"Chci dostat email kdy\u017e mi n\u011bkdo za\u0161le soukromou zpr\u00e1vu","other_settings":"Ostatn\u00ed","new_topic_duration":{"label":"Pova\u017eovat t\u00e9mata za nov\u00e1, pokud","not_viewed":"dosud jsem je nevid\u011bl","last_here":"byly zasl\u00e1ny od m\u00e9 posledn\u00ed n\u00e1v\u0161t\u011bvy","after_n_days":{"one":"byly zasl\u00e1ny v posledn\u00edm dni","few":"byly zasl\u00e1ny v posledn\u00edch {{count}} dnech","other":"byly zasl\u00e1ny v posledn\u00edch {{count}} dnech"},"after_n_weeks":{"one":"byly zasl\u00e1ny v posledn\u00edm t\u00fddnu","few":"byly zasl\u00e1ny v posledn\u00edch {{count}} t\u00fddnech","other":"byly zasl\u00e1ny v posledn\u00edch {{count}} t\u00fddnech"}},"auto_track_topics":"Automaticky sledovat t\u00e9mata, kter\u00e1 nav\u0161t\u00edv\u00edm","auto_track_options":{"never":"nikdy","always":"v\u017edy","after_n_seconds":{"one":"po 1 vte\u0159in\u011b","few":"po {{count}} vte\u0159in\u00e1ch","other":"po {{count}} vte\u0159in\u00e1ch"},"after_n_minutes":{"one":"po 1 minut\u011b","few":"po {{count}} minut\u00e1ch","other":"po {{count}} minut\u00e1ch"}},"invited":{"title":"Pozv\u00e1nky","user":"Pozvan\u00fd u\u017eivatel","none":"{{username}} nepozval na tento web \u017e\u00e1dn\u00e9 u\u017eivatele.","redeemed":"Uplatn\u011bn\u00e9 pozv\u00e1nky","redeemed_at":"Uplatn\u011bno","pending":"Nevy\u0159\u00edzen\u00e9 pozv\u00e1nky","topics_entered":"Zobrazeno t\u00e9mat","posts_read_count":"P\u0159e\u010dteno p\u0159\u00edsp\u011bvk\u016f","rescind":"Odstranit pozv\u00e1nku","rescinded":"Pozv\u00e1nka odstran\u011bna","time_read":"\u010cas \u010dten\u00ed","days_visited":"P\u0159\u00edtomen dn\u016f","account_age_days":"St\u00e1\u0159\u00ed \u00fa\u010dtu ve dnech"},"password":{"title":"Heslo","too_short":"Va\u0161e heslo je p\u0159\u00edli\u0161 kr\u00e1tk\u00e9.","ok":"Va\u0161e heslo je v po\u0159\u00e1dku."},"ip_address":{"title":"Posledn\u00ed IP adresa"},"avatar":{"title":"Avatar","instructions":"Pou\u017e\u00edv\u00e1me slu\u017ebu <a href='https://gravatar.com' target='_blank'>Gravatar</a> pro zobrazen\u00ed avataru podle va\u0161\u00ed emailov\u00e9 adresy"},"filters":{"all":"V\u0161e"},"stream":{"posted_by":"Zaslal","sent_by":"Odeslal","private_message":"soukrom\u00e1 zpr\u00e1va","the_topic":"t\u00e9ma"}},"loading":"Na\u010d\u00edt\u00e1m...","close":"Zav\u0159\u00edt","learn_more":"v\u00edce informac\u00ed...","year":"rok","year_desc":"t\u00e9mata za posledn\u00edch 365 dn\u00ed","month":"m\u011bs\u00edc","month_desc":"t\u00e9mata za posledn\u00edch 30 dn\u00ed","week":"t\u00fdden","week_desc":"t\u00e9mata za posledn\u00edch 7 dn\u00ed","first_post":"Prvn\u00ed p\u0159\u00edsp\u011bvek","mute":"Ignorovat","unmute":"Zru\u0161it ignorov\u00e1n\u00ed","best_of":{"title":"Nejlep\u0161\u00ed p\u0159\u00edsp\u011bvky","enabled_description":"Pr\u00e1v\u011b m\u00e1te zobrazeny \"nejlep\u0161\u00ed p\u0159\u00edsp\u011bvky\" tohoto t\u00e9matu.","description":"V tomto t\u00e9matu je <b>{{count}}</b> p\u0159\u00edsp\u011bvk\u016f. A to u\u017e je hodn\u011b! Nechcete u\u0161et\u0159it \u010das p\u0159i \u010dten\u00ed t\u00edm, \u017ee zobraz\u00edte pouze p\u0159\u00edsp\u011bvky, kter\u00e9 maj\u00ed nejv\u00edce interakc\u00ed a odpov\u011bd\u00ed?","enable":"P\u0159epnout na \"nejlep\u0161\u00ed p\u0159\u00edsp\u011bvky\"","disable":"P\u0159epnout na norm\u00e1ln\u00ed zobrazen\u00ed"},"private_message_info":{"title":"Soukrom\u00e9 konverzace","invite":"pozvat \u00fa\u010dastn\u00edka"},"email":"Emailov\u00e1 adresa","username":"U\u017eivatelsk\u00e9 jm\u00e9no","last_seen":"Naposledy vid\u011bn","created":"\u00da\u010det vytvo\u0159en","trust_level":"V\u011brohodnost","create_account":{"title":"Vytvo\u0159it \u00fa\u010det","action":"Vytvo\u0159it!","invite":"Nem\u00e1te je\u0161t\u011b \u00fa\u010det?","failed":"N\u011bco se nepovedlo, mo\u017en\u00e1 je tato e-mailov\u00e1 adresa ji\u017e pou\u017eita. Zkuste pou\u017e\u00edt formul\u00e1\u0159 pro obnoven\u00ed hesla."},"forgot_password":{"title":"Zapomenut\u00e9 heslo","action":"Zapomn\u011bl jsem sv\u00e9 heslo","invite":"Vlo\u017ete svoje u\u017eivatelsk\u00e9 jm\u00e9no nebo e-mailovou adresu a my v\u00e1m za\u0161leme postup pro obnoven\u00ed hesla.","reset":"Obnovit heslo","complete":"M\u011bli byste obdr\u017eet email s instrukcemi jak obnovit va\u0161e heslo."},"login":{"title":"P\u0159ihl\u00e1sit se","username":"Login","password":"Heslo","email_placeholder":"emailov\u00e1 adresa nebo u\u017eivatelsk\u00e9 jm\u00e9no","error":"Nezn\u00e1m\u00e1 chyba","reset_password":"Resetovat heslo","logging_in":"P\u0159ihla\u0161uji...","or":"Nebo","authenticating":"Autorizuji...","awaiting_confirmation":"V\u00e1\u0161 \u00fa\u010det nyn\u00ed \u010dek\u00e1 na aktivaci, pou\u017eijte odkaz pro zapomen\u00e9 heslo, jestli chcete, abychom v\u00e1m zaslali dal\u0161\u00ed aktiva\u010dn\u00ed email.","awaiting_approval":"V\u00e1\u0161 \u00fa\u010det zat\u00edm nebyl schv\u00e1len moder\u00e1torem. A\u017e se tak stane, budeme v\u00e1s informovat emailem.","not_activated":"Je\u0161t\u011b se nem\u016f\u017eete p\u0159ihl\u00e1sit. Zaslali jsme v\u00e1m aktiva\u010dn\u00ed email v <b>{{sentTo}}</b>. Pros\u00edm n\u00e1sledujte instrukce v tomto emailu, abychom mohli v\u00e1\u0161 \u00fa\u010det aktivovat.","resend_activation_email":"Klikn\u011bte sem pro zasl\u00e1n\u00ed aktiva\u010dn\u00edho emailu.","sent_activation_email_again":"Zaslali jsme v\u00e1m dal\u0161\u00ed aktiva\u010dn\u00ed email na <b>{{currentEmail}}</b>. M\u016f\u017ee trvat n\u011bkolik minut, ne\u017e v\u00e1m doraz\u00ed. Zkontrolujte tak\u00e9 va\u0161i slo\u017eku s nevy\u017e\u00e1danou po\u0161lou.","google":{"title":"p\u0159es Google","message":"Autorizuji p\u0159es Google (ujist\u011bte se, \u017ee nem\u00e1te zablokovan\u00e1 popup okna)"},"twitter":{"title":"p\u0159es Twitter","message":"Autorizuji p\u0159es Twitter (ujist\u011bte se, \u017ee nem\u00e1te zablokovan\u00e1 popup okna)"},"facebook":{"title":"p\u0159es Facebook","message":"Autorizuji p\u0159es Facebook (ujist\u011bte se, \u017ee nem\u00e1te zablokovan\u00e1 popup okna)"},"yahoo":{"title":"p\u0159es Yahoo","message":"Autorizuji p\u0159es Yahoo (ujist\u011bte se, \u017ee nem\u00e1te zablokovan\u00e1 popup okna)"},"github":{"title":"p\u0159es GitHub","message":"Autorizuji p\u0159es GitHub (ujist\u011bte se, \u017ee nem\u00e1te zablokovan\u00e1 popup okna)"},"persona":{"title":"p\u0159es Persona","message":"Autorizuji p\u0159es Mozilla Persona (ujist\u011bte se, \u017ee nem\u00e1te zablokovan\u00e1 popup okna)"}},"composer":{"posting_not_on_topic":"Rozepsali jste odpov\u011b\u010f na t\u00e9ma \"{{title}}\", ale nyn\u00ed m\u00e1te otev\u0159en\u00e9 jin\u00e9 t\u00e9ma.","saving_draft_tip":"ukl\u00e1d\u00e1m","saved_draft_tip":"ulo\u017eeno","saved_local_draft_tip":"ulo\u017eeno lok\u00e1ln\u011b","similar_topics":"Podobn\u00e1 t\u00e9mata","drafts_offline":"koncepty offline","min_length":{"need_more_for_title":"je\u0161t\u011b {{n}} znak\u016f nadpisu t\u00e9matu","need_more_for_reply":"je\u0161t\u011b {{n}} znak\u016f textu odpov\u011bdi"},"save_edit":"Ulo\u017eit zm\u011bnu","reply_original":"Odpov\u011bd\u011bt na p\u016fvodn\u00ed t\u00e9ma","reply_here":"Odpov\u011bd\u011bt sem","reply":"Odpov\u011bd\u011bt","cancel":"Zru\u0161it","create_topic":"Vytvo\u0159it t\u00e9ma","create_pm":"Vytvo\u0159it soukromou zpr\u00e1vu","users_placeholder":"P\u0159idat u\u017eivatele","title_placeholder":"Sem napi\u0161te n\u00e1zev. O \u010dem je tato diskuze v jedn\u00e9 kr\u00e1tk\u00e9 v\u011bt\u011b","reply_placeholder":"Sem napi\u0161te svou odpov\u011b\u010f. Pro form\u00e1tov\u00e1n\u00ed pou\u017eijte Markdown nebo BBCode. M\u016f\u017eete sem p\u0159et\u00e1hnout nebo vlo\u017eit obr\u00e1zek a bude vlo\u017een do p\u0159\u00edsp\u011bvku.","view_new_post":"Zobrazit v\u00e1\u0161 nov\u00fd p\u0159\u00edsp\u011bvek.","saving":"Ukl\u00e1d\u00e1m...","saved":"Ulo\u017eeno!","saved_draft":"M\u00e1te rozepsan\u00fd p\u0159\u00edsp\u011bvek. Klikn\u011bte sem pro pokra\u010dov\u00e1n\u00ed v \u00faprav\u00e1ch.","uploading":"Nahr\u00e1v\u00e1m...","show_preview":"zobrazit n\u00e1hled &raquo;","hide_preview":"&laquo; skr\u00fdt n\u00e1hled","quote_post_title":"Citovat cel\u00fd p\u0159\u00edsp\u011bvek","bold_title":"Tu\u010dn\u011b","bold_text":"tu\u010dn\u00fd text","italic_title":"Kurz\u00edva","italic_text":"text kurz\u00edvou","link_title":"Odkazy","link_description":"sem vlo\u017ete popis odkazu","link_dialog_title":"Vlo\u017eit odkaz","link_optional_text":"voliteln\u00fd popis","quote_title":"Blokov\u00e1 citace","quote_text":"Blokov\u00e1 citace","code_title":"Uk\u00e1zka k\u00f3du","code_text":"sem vlo\u017ete k\u00f3d","image_title":"Obr\u00e1zek","image_description":"sem vlo\u017eek popis obr\u00e1zku","image_dialog_title":"Vlo\u017eit obr\u00e1zek","image_optional_text":"voliteln\u00fd popis","image_hosting_hint":"Pot\u0159ebujete <a href='http://www.google.com/search?q=free+image+hosting' target='_blank'>hosting obr\u00e1zk\u016f zdarma?</a>","olist_title":"\u010c\u00edslovan\u00fd seznam","ulist_title":"Odr\u00e1\u017ekov\u00fd seznam","list_item":"Polo\u017eka seznam","heading_title":"Nadpis","heading_text":"Nadpis","hr_title":"Horizont\u00e1ln\u00ed odd\u011blova\u010d","undo_title":"Zp\u011bt","redo_title":"Opakovat","help":"N\u00e1pov\u011bda pro Markdown","toggler":"zobrazit nebo skr\u00fdt editor p\u0159\u00edsp\u011bvku","admin_options_title":"Voliteln\u00e9 administra\u010dn\u00ed nastaven\u00ed t\u00e9matu","auto_close_label":"Automaticky zav\u0159\u00edt t\u00e9ma za:","auto_close_units":"dn\u00ed"},"notifications":{"title":"ozn\u00e1men\u00ed o zm\u00ednk\u00e1ch pomoc\u00ed @name, odpov\u011bdi na va\u0161e p\u0159\u00edsp\u011bvky a t\u00e9mata, soukrom\u00e9 zpr\u00e1vy, atd.","none":"V tuto chv\u00edli nem\u00e1te \u017e\u00e1dn\u00e1 ozn\u00e1men\u00ed.","more":"zobrazit star\u0161\u00ed ozn\u00e1men\u00ed","mentioned":"<span title='mentioned' class='icon'>@</span> {{username}} {{link}}","quoted":"<i title='quoted' class='icon icon-quote-right'></i> {{username}} {{link}}","replied":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","posted":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","edited":"<i title='edited' class='icon icon-pencil'></i> {{username}} {{link}}","liked":"<i title='liked' class='icon icon-heart'></i> {{username}} {{link}}","private_message":"<i class='icon icon-envelope-alt' title='soukrom\u00e1 zpr\u00e1va'></i> {{username}} v\u00e1m zaslal soukromou zpr\u00e1vu: {{link}}","invited_to_private_message":"{{username}} v\u00e1s pozval do soukrom\u00e9 konverzace: {{link}}","invitee_accepted":"<i title='p\u0159ijet\u00ed pozv\u00e1nky' class='icon icon-signin'></i> {{username}} p\u0159ijal va\u0161i pozv\u00e1nku","moved_post":"<i title='p\u0159esunut\u00fd p\u0159\u00edsp\u011bvek' class='icon icon-arrow-right'></i> {{username}} p\u0159esunul p\u0159\u00edsp\u011bvek do {{link}}","total_flagged":"celkem nahl\u00e1\u0161eno p\u0159\u00edsp\u011bvk\u016f"},"image_selector":{"title":"Vlo\u017eit obr\u00e1zek","from_my_computer":"Z m\u00e9ho za\u0159\u00edzen\u00ed","from_the_web":"Z webu","add_image":"P\u0159idat obr\u00e1zek","remote_title":"obr\u00e1zek ze vzd\u00e1len\u00e9ho \u00falo\u017eist\u011b","remote_tip":"zadejte adresu obr\u00e1zku ve form\u00e1tu http://example.com/image.jpg","local_title":"obr\u00e1zek z lok\u00e1ln\u00edho \u00falo\u017ei\u0161t\u011b","local_tip":"klikn\u011bte sem pro v\u00fdb\u011br obr\u00e1zku z va\u0161eho za\u0159\u00edzen\u00ed","upload":"Nahr\u00e1t","uploading_image":"Nahr\u00e1v\u00e1m obr\u00e1zek"},"search":{"title":"hled\u00e1n\u00ed t\u00e9mat, p\u0159\u00edsp\u011bvk\u016f, u\u017eivatel\u016f a kategori\u00ed","placeholder":"sem zadejte hledan\u00fd v\u00fdraz","no_results":"Nenalezeny \u017e\u00e1dn\u00e9 v\u00fdsledky.","searching":"Hled\u00e1m ..."},"site_map":"j\u00edt na jin\u00fd seznam t\u00e9mat nebo kategorii","go_back":"j\u00edt zp\u011bt","current_user":"j\u00edt na va\u0161i u\u017eivatelskou str\u00e1nku","favorite":{"title":"Obl\u00edben\u00e9","help":{"star":"p\u0159idat toto t\u00e9ma do obl\u00edben\u00fdch","unstar":"odebrat toto t\u00e9ma z obl\u00edben\u00fdch"}},"topics":{"none":{"favorited":"Zat\u00edm nem\u00e1te \u017e\u00e1dn\u00e1 obl\u00edben\u00e1 t\u00e9mata. Pro p\u0159id\u00e1n\u00ed t\u00e9matu do obl\u00edben\u00fdch, klikn\u011bte na hv\u011bzdi\u010dku vedle n\u00e1zvu t\u00e9matu.","unread":"Nem\u00e1te \u017e\u00e1dn\u00e1 nep\u0159e\u010dten\u00e1 t\u00e9mata.","new":"Nem\u00e1te \u017e\u00e1dn\u00e1 nov\u00e1 t\u00e9mata ke \u010dten\u00ed.","read":"Zat\u00edm jste ne\u010detli \u017e\u00e1dn\u00e1 t\u00e9mata.","posted":"Zat\u00edm jste nep\u0159isp\u011bli do \u017e\u00e1dn\u00e9ho t\u00e9matu.","latest":"Nejsou tu \u017e\u00e1dn\u00e1 t\u00e9mata z posledn\u00ed doby. To je docela smutn\u00e9.","hot":"Nejsou tu \u017e\u00e1dn\u00e1 popul\u00e1rn\u00ed t\u00e9mata.","category":"V kategorii {{category}} nejsou \u017e\u00e1dn\u00e1 t\u00e9mata."},"bottom":{"latest":"Nejsou tu \u017e\u00e1dn\u00e1 dal\u0161\u00ed t\u00e9mata z posledn\u00ed doby k p\u0159e\u010dten\u00ed.","hot":"Nejsou tu \u017e\u00e1dn\u00e1 dal\u0161\u00ed popul\u00e1rn\u00ed t\u00e9mata k p\u0159e\u010dten\u00ed.","posted":"Nejsou tu \u017e\u00e1dn\u00e1 dal\u0161\u00ed zaslan\u00e1 t\u00e9mata k p\u0159e\u010dten\u00ed.","read":"Nejsou tu \u017e\u00e1dn\u00e1 dal\u0161\u00ed p\u0159e\u010dten\u00e1 t\u00e9mata.","new":"Nejsou tu \u017e\u00e1dn\u00e1 dal\u0161\u00ed nov\u00e1 t\u00e9mata k p\u0159e\u010dten\u00ed.","unread":"Nejsou tu \u017e\u00e1dn\u00e1 dal\u0161\u00ed nep\u0159e\u010dten\u00e1 t\u00e9mata.","favorited":"Nejsou tu \u017e\u00e1dn\u00e1 dal\u0161\u00ed obl\u00edben\u00e1 t\u00e9mata k p\u0159e\u010dten\u00ed.","category":"V kategorii {{category}} nejsou \u017e\u00e1dn\u00e1 dal\u0161\u00ed t\u00e9mata."}},"rank_details":{"toggle":"zobrazit/skr\u00fdt detaily bodov\u00e1n\u00ed","show":"zobrazit detaily bodov\u00e1n\u00ed t\u00e9matu","title":"Detaily bodov\u00e1n\u00ed t\u00e9matu"},"topic":{"create_in":"Nov\u00e9 t\u00e9ma v kategorii {{categoryName}}","create":"Nov\u00e9 t\u00e9ma","create_long":"Vytvo\u0159it nov\u00e9 t\u00e9ma","private_message":"Vytvo\u0159it soukromou konverzaci","list":"T\u00e9mata","new":"nov\u00e9 t\u00e9ma","title":"T\u00e9ma","loading_more":"Nahr\u00e1v\u00e1m v\u00edce t\u00e9mat...","loading":"Nahr\u00e1v\u00e1m t\u00e9ma...","invalid_access":{"title":"T\u00e9ma je soukrom\u00e9","description":"Bohu\u017eel nem\u00e1te p\u0159\u00edstup k tomuto t\u00e9matu."},"server_error":{"title":"T\u00e9ma se nepoda\u0159ilo na\u010d\u00edst","description":"Bohu\u017eel nen\u00ed mo\u017en\u00e9 na\u010d\u00edst toto t\u00e9ma, m\u016f\u017ee to b\u00fdt zp\u016fsobeno probl\u00e9mem s va\u0161\u00edm p\u0159ipojen\u00edm. Pros\u00edm, zkuste str\u00e1nku na\u010d\u00edst znovu. Pokud bude probl\u00e9m p\u0159etrv\u00e1vat, dejte n\u00e1m v\u011bd\u011bt."},"not_found":{"title":"T\u00e9ma nenalezeno","description":"Bohu\u017eel se n\u00e1m nepovedlo naj\u00edt toto t\u00e9ma. Nebylo odstran\u011bno moder\u00e1torem?"},"unread_posts":"m\u00e1te {{unread}} nep\u0159e\u010dten\u00fdch p\u0159\u00edsp\u011bvk\u016f v tomto t\u00e9matu","new_posts":"je zde {{new_posts}} nov\u00fdch p\u0159\u00edsp\u011bvk\u016f od doby, kdy jste toto t\u00e9ma naposledy \u010detli","likes":{"one":"je zde 1x 'l\u00edb\u00ed' v tomto t\u00e9matu","few":"je zde {{count}}x 'l\u00edb\u00ed' v tomto t\u00e9matu","other":"je zde {{count}}x 'l\u00edb\u00ed' v tomto t\u00e9matu"},"back_to_list":"Zp\u00e1tky na seznam t\u00e9mat","options":"Mo\u017enosti","show_links":"zobrazit odkazy v tomto t\u00e9matu","toggle_information":"zobrazit/skr\u00fdt detaily t\u00e9matu","read_more_in_category":"Chcete si p\u0159e\u010d\u00edst dal\u0161\u00ed informace? Projd\u011bte si t\u00e9mata v {{catLink}} nebo {{latestLink}}.","read_more":"Chcete si p\u0159e\u010d\u00edst dal\u0161\u00ed informace? {{catLink}} nebo {{latestLink}}.","browse_all_categories":"Proch\u00e1zet v\u0161echny kategorie","view_latest_topics":"zobrazit popul\u00e1rn\u00ed t\u00e9mata","suggest_create_topic":"Co takhle zalo\u017eit nov\u00e9 t\u00e9ma?","read_position_reset":"Va\u0161e pozice \u010dten\u00ed byla zresetov\u00e1na.","jump_reply_up":"p\u0159ej\u00edt na p\u0159edchoz\u00ed odpov\u011b\u010f","jump_reply_down":"p\u0159ej\u00edt na n\u00e1sleduj\u00edc\u00ed odpov\u011b\u010f","deleted":"T\u00e9ma bylo smaz\u00e1no","auto_close_notice":"Toto t\u00e9ma se automaticky zav\u0159e %{timeLeft}.","auto_close_title":"Nastaven\u00ed automatick\u00e9ho zav\u00edr\u00e1n\u00ed","auto_close_save":"Ulo\u017eit","auto_close_cancel":"Zru\u0161it","auto_close_remove":"Nezav\u00edrat t\u00e9ma automaticky","progress":{"title":"pozice v t\u00e9matu","jump_top":"p\u0159ej\u00edt na prvn\u00ed p\u0159\u00edsp\u011bvek","jump_bottom":"p\u0159ej\u00edt na posledn\u00ed p\u0159\u00edsp\u011bvek","total":"celkem p\u0159\u00edsp\u011bvk\u016f","current":"aktu\u00e1ln\u00ed p\u0159\u00edsp\u011bvek"},"notifications":{"title":"","reasons":{"3_2":"Budete dost\u00e1vat ozn\u00e1men\u00ed, proto\u017ee hl\u00edd\u00e1te toto t\u00e9ma.","3_1":"Budete dost\u00e1vat ozn\u00e1men\u00ed, proto\u017ee jste autorem totoho t\u00e9matu.","3":"Budete dost\u00e1vat ozn\u00e1men\u00ed, proto\u017ee hl\u00edd\u00e1te toto t\u00e9ma.","2_4":"Budete dost\u00e1vat ozn\u00e1men\u00ed, proto\u017ee jste zaslal odpov\u011b\u010f do tohoto t\u00e9matu.","2_2":"Budete dost\u00e1vat ozn\u00e1men\u00ed, proto\u017ee sledujete toto t\u00e9ma.","2":"Budete dost\u00e1vat ozn\u00e1men\u00ed, proto\u017ee <a href=\"/users/{{username}}/preferences\">jste \u010detli toto t\u00e9ma</a>.","1":"Dostanete ozn\u00e1men\u00ed, jestli\u017ee v\u00e1s n\u011bkdo zm\u00edn\u00ed pomoc\u00ed @name nebo odpov\u00ed na v\u00e1\u0161 p\u0159\u00edsp\u011bvek.","1_2":"Dostanete ozn\u00e1men\u00ed, jestli\u017ee v\u00e1s n\u011bkdo zm\u00edn\u00ed pomoc\u00ed @name nebo odpov\u00ed na v\u00e1\u0161 p\u0159\u00edsp\u011bvek.","0":"Ignorujete v\u0161echna ozn\u00e1men\u00ed z tohoto t\u00e9matu.","0_2":"Ignorujete v\u0161echna ozn\u00e1men\u00ed z tohoto t\u00e9matu."},"watching":{"title":"Hl\u00edd\u00e1n\u00ed","description":"stejn\u00e9 jako 'Sledov\u00e1n\u00ed' a nav\u00edc dostanete upozorn\u011bn\u00ed o v\u0161ech nov\u00fdch p\u0159\u00edsp\u011bvc\u00edch."},"tracking":{"title":"Sledov\u00e1n\u00ed","description":"dostanete ozn\u00e1men\u00ed o nep\u0159e\u010dten\u00fdch p\u0159\u00edsp\u011bvc\u00edch, zm\u00ednk\u00e1ch p\u0159es @name a odpov\u011bd\u00edch na v\u00e1\u0161 p\u0159\u00edsp\u011bvek."},"regular":{"title":"Norm\u00e1ln\u00ed","description":"dostanete ozn\u00e1men\u00ed, jestli\u017ee v\u00e1s n\u011bkdo zm\u00edn\u00ed pomoc\u00ed @name nebo odpov\u00ed na v\u00e1\u0161 p\u0159\u00edsp\u011bvek."},"muted":{"title":"Zti\u0161en\u00ed","description":"nebudete v\u016fbec dost\u00e1vat ozn\u00e1men\u00ed o tomto t\u00e9matu a nebude se zobrazovat v seznamu nep\u0159e\u010dten\u00fdch t\u00e9mat."}},"actions":{"delete":"Odstranit t\u00e9ma","open":"Otev\u0159\u00edt t\u00e9ma","close":"Zav\u0159\u00edt t\u00e9ma","auto_close":"Automaticky zav\u0159\u00edt","unpin":"Odstranit p\u0159ipevn\u011bn\u00ed","pin":"P\u0159ipevnit t\u00e9ma","unarchive":"Navr\u00e1tit z archivu","archive":"Archivovat t\u00e9ma","invisible":"Zneviditelnit","visible":"Zviditelnit","reset_read":"Resetovat data o p\u0159e\u010dten\u00ed","multi_select":"Zapnout/vypnout multi-v\u00fdb\u011br","convert_to_topic":"P\u0159ev\u00e9st na b\u011b\u017en\u00e9 t\u00e9ma"},"reply":{"title":"Odpov\u011bd\u011bt","help":"za\u010dn\u011bte ps\u00e1t odpov\u011b\u010f na toto t\u00e9ma"},"clear_pin":{"title":"Odstranit p\u0159ipevn\u011bn\u00ed","help":"Odebere p\u0159ipevn\u011bn\u00ed tohoto t\u00e9matu, tak\u017ee se ji\u017e nebude zobrazovat na vrcholu seznamu t\u00e9mat"},"share":{"title":"Sd\u00edlet","help":"sd\u00edlet odkaz na toto t\u00e9ma"},"inviting":"Odes\u00edl\u00e1m pozv\u00e1nku...","invite_private":{"title":"Pozvat do soukrom\u00e9 konverzace","email_or_username":"Email nebo u\u017eivatelsk\u00e9 jm\u00e9no pozvan\u00e9ho","email_or_username_placeholder":"emailov\u00e1 adresa nebo u\u017eivatelsk\u00e9 jm\u00e9no","action":"Pozvat","success":"D\u011bkujeme! Pozvali jste dan\u00e9ho u\u017eivatele, aby se \u00fa\u010dastnil t\u00e9to soukrom\u00e9 konverzace.","error":"Bohu\u017eel nastala chyba p\u0159i odes\u00edl\u00e1n\u00ed pozv\u00e1nky."},"invite_reply":{"title":"Pozvat p\u0159\u00e1tele k odpov\u011bdi","action":"Odeslat pozv\u00e1nku","help":"odeslat pozv\u00e1nku p\u0159\u00e1tel\u016fm, aby mohli na toto t\u00e9ma odpov\u011bd\u011bt jedn\u00edm kliknut\u00edm","email":"Ode\u0161leme va\u0161emu p\u0159\u00edteli kr\u00e1tk\u00fd email s odkazem na mo\u017enost p\u0159\u00edmo odpov\u011bd\u011bt na toto t\u00e9ma.","email_placeholder":"emailov\u00e1 adresa","success":"D\u00edky! Odeslali jsme pozv\u00e1nku na <b>{{email}}</b>. D\u00e1me v\u00e1m v\u011bd\u011bt, a\u017e bude pozv\u00e1nka vyzvednuta. Na z\u00e1lo\u017ece pozv\u00e1nek na va\u0161\u00ed u\u017eivatelsk\u00e9 str\u00e1nce m\u016f\u017eete sledovat koho jste pozvali.","error":"Bohu\u017eel se nepoda\u0159ilo pozvat tuto osobu. Nen\u00ed ji\u017e registrovan\u00fdm u\u017eivatelem?"},"login_reply":"P\u0159ihla\u0161te se, chcete-li odpov\u011bd\u011bt","filters":{"user":"{{n_posts}} {{by_n_users}}.","n_posts":{"one":"Je zobrazen pouze 1 p\u0159\u00edsp\u011bvek","few":"Jsou zobrazeny pouze {{count}} p\u0159\u00edsp\u011bvky","other":"Je zobrazeno pouze {{count}} p\u0159\u00edsp\u011bvk\u016f"},"by_n_users":{"one":"od 1 vybran\u00e9ho u\u017eivatele","few":"od {{count}} vybran\u00e9ho u\u017eivatele","other":"od {{count}} vybran\u00fdch u\u017eivatel\u016f"},"best_of":"{{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"Je zobrazen 1 nejlep\u0161\u00ed p\u0159\u00edsp\u011bvek","few":"Jsou zobrazeny {{count}} nejlep\u0161\u00ed p\u0159\u00edsp\u011bvky","other":"Je zobrazeno {{count}} nejlep\u0161\u00edch p\u0159\u00edsp\u011bvk\u016f"},"of_n_posts":{"one":"z celkem 1 p\u0159\u00edsp\u011bvku v t\u00e9matu","few":"z celkem {{count}} p\u0159\u00edsp\u011bvk\u016f v t\u00e9matu","other":"z celkem {{count}} p\u0159\u00edsp\u011bvk\u016f v t\u00e9matu"},"cancel":"Zobraz\u00ed znovu v\u0161echny p\u0159\u00edsp\u011bvky v tomto t\u00e9matu."},"split_topic":{"title":"Rozd\u011blit t\u00e9ma","action":"rozd\u011blit t\u00e9ma","topic_name":"N\u00e1zev nov\u00e9ho t\u00e9matu:","error":"Bohu\u017eel nastala chyba p\u0159i rozd\u011blov\u00e1n\u00ed t\u00e9matu.","instructions":{"one":"Chyst\u00e1te se vytvo\u0159it nov\u00e9 t\u00e9ma a naplnit ho p\u0159\u00edsp\u011bvkem, kter\u00fd jste ozna\u010dili.","few":"Chystate se vytvo\u0159it not\u00e9 t\u00e9ma a naplnit ho <b>{{count}}</b> p\u0159\u00edsp\u011bvky, kter\u00e9 jste ozna\u010dili.","other":"Chystate se vytvo\u0159it not\u00e9 t\u00e9ma a naplnit ho <b>{{count}}</b> p\u0159\u00edsp\u011bvky, kter\u00e9 jste ozna\u010dili."}},"merge_topic":{"title":"Slou\u010dit t\u00e9ma","action":"slou\u010dit t\u00e9ma","error":"Bohu\u017eel nastala chyba p\u0159i slu\u010dov\u00e1n\u00ed t\u00e9matu.","instructions":{"one":"Pros\u00edm, vyberte t\u00e9ma, do kter\u00e9ho chcete p\u0159\u00edsp\u011bvek p\u0159esunout.","few":"Pros\u00edm, vyberte t\u00e9ma, do kter\u00e9ho chcete tyto <b>{{count}}</b> p\u0159\u00edsp\u011bvky p\u0159esunout.","other":"Pros\u00edm, vyberte t\u00e9ma, do kter\u00e9ho chcete t\u011bchto <b>{{count}}</b> p\u0159\u00edsp\u011bvk\u016f p\u0159esunout."}},"multi_select":{"select":"ozna\u010dit","selected":"ozna\u010deno ({{count}})","delete":"odstranit ozna\u010den\u00e9","cancel":"zru\u0161it ozna\u010dov\u00e1n\u00ed","description":{"one":"M\u00e1te ozna\u010den <b>1</b> p\u0159\u00edsp\u011bvek.","few":"M\u00e1te ozna\u010deny <b>{{count}}</b> p\u0159\u00edsp\u011bvky.","other":"M\u00e1te ozna\u010deno <b>{{count}}</b> p\u0159\u00edsp\u011bvk\u016f."}}},"post":{"reply":"Odpov\u00edd\u00e1te na {{link}} od {{replyAvatar}} {{username}}","reply_topic":"Odpov\u011b\u010f na {{link}}","quote_reply":"odpov\u011b\u010f s citac\u00ed","edit":"Editujete {{link}} od u\u017eivatele {{replyAvatar}} {{username}}","post_number":"p\u0159\u00edsp\u011bvek \u010d. {{number}}","in_reply_to":"v odpov\u011bdi na","reply_as_new_topic":"Odpov\u011bd\u011bt jako nov\u00e9 t\u00e9ma","continue_discussion":"Pokra\u010duj\u00edc\u00ed diskuze z {{postLink}}:","follow_quote":"p\u0159ej\u00edt na citovan\u00fd p\u0159\u00edsp\u011bvek","deleted_by_author":"(p\u0159\u00edsp\u011bvek odstran\u011bn autorem)","expand_collapse":"rozbalit/sbalit","has_replies":{"one":"Odpov\u011b\u010f","few":"Odpov\u011bdi","other":"Odpov\u011bdi"},"errors":{"create":"Bohu\u017eel nastala chyba p\u0159i vytv\u00e1\u0159en\u00ed p\u0159\u00edsp\u011bvku. Pros\u00edm zkuste to znovu.","edit":"Bohu\u017eel nastala chyba p\u0159i editaci p\u0159\u00edsp\u011bvku. Pros\u00edm zkuste to znovu.","upload":"Bohu\u017eel nastala chyba p\u0159i nahr\u00e1v\u00e1n\u00ed p\u0159\u00edsp\u011bvku. Pros\u00edm zkuste to znovu.","upload_too_large":"Soubor, kter\u00fd se sna\u017e\u00edte nahr\u00e1t je bohu\u017eel p\u0159\u00edli\u0161 velk\u00fd (maxim\u00e1ln\u00ed velikost je {{max_size_kb}}kb). Pros\u00edm zmen\u0161ete ho zkuste to znovu.","upload_too_many_images":"Bohu\u017eel, najednou sm\u00edte nahr\u00e1t pouze jeden obr\u00e1zek.","only_images_are_supported":"Bohu\u017eel, sm\u00edte nahr\u00e1vat pouze obr\u00e1zky."},"abandon":"Opravdu chcete opustit v\u00e1\u0161 p\u0159\u00edsp\u011bvek?","archetypes":{"save":"Ulo\u017eit nastaven\u00ed"},"controls":{"reply":"otev\u0159e okno pro seps\u00e1n\u00ed odpov\u011bdi na tento p\u0159\u00edsp\u011bvek","like":"to se mi l\u00edb\u00ed","edit":"upravit p\u0159\u00edsp\u011bvek","flag":"nahl\u00e1sit p\u0159\u00edsp\u011bvek moder\u00e1torovi","delete":"smazat p\u0159\u00edsp\u011bvek","undelete":"obnovit p\u0159\u00edsp\u011bvek","share":"sd\u00edlet odkaz na tento p\u0159\u00edsp\u011bvek","bookmark":"p\u0159idat z\u00e1lo\u017eku na tento p\u0159\u00edsp\u011bvek na va\u0161i u\u017eivatelskou str\u00e1nku","more":"V\u00edce"},"actions":{"flag":"Nahl\u00e1sit","clear_flags":{"one":"Odebrat nahl\u00e1\u0161en\u00ed","few":"Odebrat nahl\u00e1\u0161en\u00ed","other":"Odebrat nahl\u00e1\u0161en\u00ed"},"it_too":{"off_topic":"Tak\u00e9 nahl\u00e1sit","spam":"Tak\u00e9 nahl\u00e1sit","inappropriate":"Tak\u00e9 nahl\u00e1sit","custom_flag":"Tak\u00e9 nahl\u00e1sit","bookmark":"Tak\u00e9 p\u0159idat do z\u00e1lo\u017eek","like":"To se mi tak\u00e9 l\u00edb\u00ed","vote":"Hlasovat tak\u00e9"},"undo":{"off_topic":"Zru\u0161it nahl\u00e1\u0161en\u00ed","spam":"Zru\u0161it nahl\u00e1\u0161en\u00ed","inappropriate":"Zru\u0161it nahl\u00e1\u0161en\u00ed","bookmark":"Odebrat ze z\u00e1lo\u017eek","like":"U\u017e se mi to nel\u00edb\u00ed","vote":"Zru\u0161it hlas"},"people":{"off_topic":"{{icons}} ozna\u010dili tento p\u0159\u00edsp\u011bvek jako off-topic","spam":"{{icons}} ozna\u010dili tento p\u0159\u00edsp\u011bvek jako spam","inappropriate":"{{icons}} ozna\u010dili tento p\u0159\u00edsp\u011bvek jako nevhodn\u00fd","notify_moderators":"{{icons}} nahl\u00e1sili tento p\u0159\u00edsp\u011bvek","notify_moderators_with_url":"{{icons}} <a href='{{postUrl}}'>nahl\u00e1sili tento p\u0159\u00edsp\u011bvek</a>","notify_user":"{{icons}} zah\u00e1jili soukromou konverzaci","notify_user_with_url":"{{icons}} zah\u00e1jijli a <a href='{{postUrl}}'>soukromou konverzaci</a>","bookmark":"{{icons}} si p\u0159idali p\u0159\u00edsp\u011bvek do z\u00e1lo\u017eek","like":"{{icons}} se l\u00edb\u00ed tento p\u0159\u00edsp\u011bvek","vote":"{{icons}} hlasovali pro tento p\u0159\u00edsp\u011bvek"},"by_you":{"off_topic":"Ozna\u010dili jste tento p\u0159\u00edsp\u011bvek jako off-topic","spam":"Ozna\u010dili jste tento p\u0159\u00edsp\u011bvek jako spam","inappropriate":"Ozna\u010dili jste tento p\u0159\u00edsp\u011bvek jako nevhodn\u00fd","notify_moderators":"Nahl\u00e1sili jste tento p\u0159\u00edsp\u011bvek","notify_user":"Zah\u00e1jili jste soukromou konverzaci s t\u00edmto u\u017eivatelem","bookmark":"P\u0159idali jste si tento p\u0159\u00edsp\u011bvek do z\u00e1lo\u017eek","like":"Toto se v\u00e1m l\u00edb\u00ed","vote":"Hlasovali jste pro tento p\u0159\u00edsp\u011bvek"},"by_you_and_others":{"off_topic":{"one":"Vy a 1 dal\u0161\u00ed \u010dlov\u011bk jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako off-topic","few":"Vy a {{count}} dal\u0161\u00ed lid\u00e9 jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako off-topic","other":"Vy a {{count}} dal\u0161\u00edch lid\u00ed jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako off-topic"},"spam":{"one":"Vy a 1 dal\u0161\u00ed \u010dlov\u011bk jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako spam","few":"Vy a {{count}} dal\u0161\u00ed lid\u00e9 jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako spam","other":"Vy a {{count}} dal\u0161\u00edch lid\u00ed jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako spam"},"inappropriate":{"one":"Vy a 1 dal\u0161\u00ed \u010dlov\u011bk jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako nevhodn\u00fd","few":"Vy a {{count}} dal\u0161\u00ed lid\u00e9 jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako nevhodn\u00fd","other":"Vy a {{count}} dal\u0161\u00edch lid\u00ed jste ozna\u010dili tento p\u0159\u00edsp\u011bvek jako nevhodn\u00fd"},"notify_moderators":{"one":"Vy a 1 dal\u0161\u00ed \u010dlov\u011bk jste nahl\u00e1sili tento p\u0159\u00edsp\u011bvek","few":"Vy a {{count}} dal\u0161\u00ed lid\u00e9 jste nahl\u00e1sili tento p\u0159\u00edsp\u011bvek","other":"Vy a {{count}} dal\u0161\u00edch lid\u00ed jste nahl\u00e1sili tento p\u0159\u00edsp\u011bvek"},"notify_user":{"one":"Vy a 1 dal\u0161\u00ed \u010dlov\u011bk jste zah\u00e1jili soukromou konverzaci s t\u00edmto u\u017eivatelem","few":"Vy a {{count}} dal\u0161\u00ed lid\u00e9 jste zah\u00e1jili soukromou konverzaci s t\u00edmto u\u017eivatelem","other":"Vy a {{count}} dal\u0161\u00edch lid\u00ed jste zah\u00e1jili soukromou konverzaci s t\u00edmto u\u017eivatelem"},"bookmark":{"one":"Vy a 1 dal\u0161\u00ed \u010dlov\u011bk jste si p\u0159idali tento p\u0159\u00edsp\u011bvek do z\u00e1lo\u017eek","few":"Vy a {{count}} dal\u0161\u00ed lid\u00e9 jste si p\u0159idali tento p\u0159\u00edsp\u011bvek do z\u00e1lo\u017eek","other":"Vy a {{count}} dal\u0161\u00edch lid\u00ed si p\u0159idali tento p\u0159\u00edsp\u011bvek do z\u00e1lo\u017eek"},"like":{"one":"V\u00e1m a 1 dal\u0161\u00edmu \u010dlov\u011bku se tento p\u0159\u00edsp\u011bvek l\u00edb\u00ed","few":"V\u00e1m a {{count}} dal\u0161\u00edm lidem se tento p\u0159\u00edsp\u011bvek l\u00edb\u00ed","other":"V\u00e1m a {{count}} dal\u0161\u00edm lidem se tento p\u0159\u00edsp\u011bvek l\u00edb\u00ed"},"vote":{"one":"Vy a 1 dal\u0161\u00ed \u010dlov\u011bk jste hlasovali pro tento p\u0159\u00edsp\u011bvek","few":"Vy a {{count}} dal\u0161\u00ed lid\u00e9 jste hlasovali pro tento p\u0159\u00edsp\u011bvek","other":"Vy a {{count}} dal\u0161\u00edch lid\u00ed jste hlasovali pro tento p\u0159\u00edsp\u011bvek"}},"by_others":{"off_topic":{"one":"1 \u010dlov\u011bk ozna\u010dil tento p\u0159\u00edsp\u011bvek jako off-topic","few":"{{count}} lid\u00e9 ozna\u010dili tento p\u0159\u00edsp\u011bvek jako off-topic","other":"{{count}} lid\u00ed ozna\u010dilo tento p\u0159\u00edsp\u011bvek jako off-topic"},"spam":{"one":"1 \u010dlov\u011bk ozna\u010dil tento p\u0159\u00edsp\u011bvek jako spam","few":"{{count}} lid\u00e9 ozna\u010dili tento p\u0159\u00edsp\u011bvek jako spam","other":"{{count}} lid\u00ed ozna\u010dilo tento p\u0159\u00edsp\u011bvek jako spam"},"inappropriate":{"one":"1 \u010dlov\u011bk ozna\u010dil tento p\u0159\u00edsp\u011bvek jako nevhodn\u00fd","few":"{{count}} lid\u00e9 ozna\u010dili tento p\u0159\u00edsp\u011bvek jako nevhodn\u00fd","other":"{{count}} lid\u00ed ozna\u010dilo tento p\u0159\u00edsp\u011bvek jako nevhodn\u00fd"},"notify_moderators":{"one":"1 \u010dlov\u011bk nahl\u00e1sil tento p\u0159\u00edsp\u011bvek","few":"{{count}} lid\u00e9 nahl\u00e1sili tento p\u0159\u00edsp\u011bvek","other":"{{count}} lid\u00ed nahl\u00e1silo tento p\u0159\u00edsp\u011bvek"},"notify_user":{"one":"1 \u010dlov\u011bk zah\u00e1jil soukromou konverzaci s t\u00edmto u\u017eivatelem","few":"{{count}} lid\u00e9 zah\u00e1jili soukromou konverzaci s t\u00edmto u\u017eivatelem","other":"{{count}} lid\u00ed zah\u00e1jilo soukromou konverzaci s t\u00edmto u\u017eivatelem"},"bookmark":{"one":"1 \u010dlov\u011bk si p\u0159idal tento p\u0159\u00edsp\u011bvek do z\u00e1lo\u017eek","few":"{{count}} lid\u00e9 si p\u0159idali tento p\u0159\u00edsp\u011bvek do z\u00e1lo\u017eek","other":"{{count}} lid\u00ed si p\u0159idalo tento p\u0159\u00edsp\u011bvek do z\u00e1lo\u017eek"},"like":{"one":"1 \u010dlov\u011bku se tento p\u0159\u00edsp\u011bvek l\u00edb\u00ed","few":"{{count}} lidem se tento p\u0159\u00edsp\u011bvek l\u00edb\u00ed","other":"{{count}} lidem se tento p\u0159\u00edsp\u011bvek l\u00edb\u00ed"},"vote":{"one":"1 \u010dlov\u011bk hlasoval pro tento p\u0159\u00edsp\u011bvek","few":"{{count}} lid\u00e9 hlasovali pro tento p\u0159\u00edsp\u011bvek","other":"{{count}} lid\u00ed hlasovalo pro tento p\u0159\u00edsp\u011bvek"}}},"edits":{"one":"1 \u00faprava","few":"{{count}} \u00fapravy","other":"{{count}} \u00faprav","zero":"\u017e\u00e1dn\u00e9 \u00fapravy"},"delete":{"confirm":{"one":"Opravdu chcete odstranit tento p\u0159\u00edsp\u011bvek?","few":"Opravdu chcete odstranit v\u0161echny tyto p\u0159\u00edsp\u011bvky?","other":"Opravdu chcete odstranit v\u0161echny tyto p\u0159\u00edsp\u011bvky?"}}},"category":{"none":"(bez kategorie)","edit":"upravit","edit_long":"Upravit kategorii","edit_uncategorized":"Upravit nekategorizovan\u00e9","view":"Zobrazit t\u00e9mata v kategorii","general":"Obecn\u00e9","settings":"Nastaven\u00ed","delete":"Smazat kategorii","create":"Nov\u00e1 kategorie","save":"Ulo\u017eit kategorii","creation_error":"B\u011bhem vytv\u00e1\u0159en\u00ed nov\u00e9 kategorie nastala chyba.","save_error":"B\u011bhem ukl\u00e1d\u00e1n\u00ed kategorie nastala chyba.","more_posts":"zobrazit v\u0161echny {{posts}}...","name":"N\u00e1zev kategorie","description":"Popis","topic":"t\u00e9ma kategorie","badge_colors":"Barvy \u0161t\u00edtku","background_color":"Barva pozad\u00ed","foreground_color":"Barva textu","name_placeholder":"M\u011bl by b\u00fdt kr\u00e1tk\u00fd a v\u00fdsti\u017en\u00fd.","color_placeholder":"Jak\u00e1koliv webov\u00e1 barva","delete_confirm":"Opravdu chcete odstranit tuto kategorii?","delete_error":"Nastala chyba p\u0159i odstra\u0148ov\u00e1n\u00ed kategorie.","list":"Seznam kategori\u00ed","no_description":"K t\u00e9to kategorii zat\u00edm nen\u00ed \u017e\u00e1dn\u00fd popis.","change_in_category_topic":"nav\u0161tivte t\u00e9ma kategorie pro editaci jej\u00edho popisu","hotness":"Popularita","already_used":"Tato barva je ji\u017e pou\u017eita jinou kategori\u00ed","is_secure":"Zabezpe\u010den\u00e1 kategorie?","add_group":"P\u0159idat skupinu","security":"Bezpe\u010dnost","allowed_groups":"Povolen\u00e9 skupiny:","auto_close_label":"Automaticky zav\u00edrat t\u00e9mata po:"},"flagging":{"title":"Pro\u010d chcete nahl\u00e1sit tento p\u0159\u00edsp\u011bvek?","action":"Nahl\u00e1sit p\u0159\u00edsp\u011bvek","notify_action":"Ozn\u00e1mit","cant":"Bohu\u017eel nyn\u00ed nem\u016f\u017eete tento p\u0159\u00edsp\u011bvek nahl\u00e1sit.","custom_placeholder_notify_user":"Pro\u010d chcete s t\u00edmto u\u017eivatele mluvit p\u0159\u00edmo a soukrom\u011b? Bu\u010fte konstruktivn\u00ed, konkr\u00e9tn\u00ed a hlavn\u011b vst\u0159\u00edcn\u00ed.","custom_placeholder_notify_moderators":"Pro\u010d p\u0159\u00edsp\u011bvek vy\u017eaduje pozornost moder\u00e1tora? Dejte n\u00e1m v\u011bd\u011bt, co konkr\u00e9tn\u011b v\u00e1s znepokojuje, a poskytn\u011bte relevantn\u00ed odkazy, je-li to mo\u017en\u00e9.","custom_message":{"at_least":"zadejte alespo\u0148 {{n}} znak\u016f","more":"je\u0161t\u011b {{n}}...","left":"{{n}} zb\u00fdv\u00e1"}},"topic_summary":{"title":"Souhrn t\u00e9matu","links_shown":"zobrazit v\u0161ech {{totalLinks}} odkaz\u016f...","clicks":"po\u010det kliknut\u00ed","topic_link":"odkaz na t\u00e9ma"},"topic_statuses":{"locked":{"help":"toto t\u00e9ma je uzav\u0159en\u00e9; dal\u0161\u00ed odpov\u011bdi nebudou p\u0159ij\u00edm\u00e1ny"},"pinned":{"help":"toto t\u00e9ma je p\u0159ipevn\u011bn\u00e9; bude se zobrazovat na vrcholu seznamu ve sv\u00e9 kategorii"},"archived":{"help":"toto t\u00e9ma je archivov\u00e1no; je zmra\u017eeno a nelze ho ji\u017e m\u011bnit"},"invisible":{"help":"toto t\u00e9ma je neviditeln\u00e9; nebude se zobrazovat v seznamu t\u00e9mat a lze ho nav\u0161t\u00edvit pouze p\u0159es p\u0159\u00edm\u00fd odkaz"}},"posts":"P\u0159\u00edsp\u011bvky","posts_long":"{{number}} p\u0159\u00edsp\u011bvk\u016f v tomto t\u00e9matu","original_post":"P\u016fvodn\u00ed p\u0159\u00edsp\u011bvek","views":"Zobrazen\u00ed","replies":"Odpov\u011bdi","views_long":"toto t\u00e9ma bylo zobrazeno {{number}}kr\u00e1t","activity":"Aktivita","likes":"L\u00edb\u00ed se","top_contributors":"\u00da\u010dastn\u00edci","category_title":"Kategorie","history":"Historie","changed_by":"od u\u017eivatele {{author}}","categories_list":"Seznam kategori\u00ed","filters":{"latest":{"title":"Aktu\u00e1ln\u00ed","help":"nejaktu\u00e1ln\u011bj\u0161\u00ed t\u00e9mata"},"hot":{"title":"Popul\u00e1rn\u00ed","help":"popul\u00e1rn\u00ed t\u00e9mata z posledn\u00ed doby"},"favorited":{"title":"Obl\u00edben\u00e1","help":"t\u00e9mata, kter\u00e1 jste ozna\u010dili jako obl\u00edben\u00e1"},"read":{"title":"P\u0159e\u010dten\u00e1","help":"t\u00e9mata, kter\u00e1 jste si p\u0159e\u010detli"},"categories":{"title":"Kategorie","title_in":"Kategorie - {{categoryName}}","help":"v\u0161echny t\u00e9mata seskupen\u00e1 podle kategorie"},"unread":{"title":{"zero":"Nep\u0159e\u010dten\u00e1","one":"Nep\u0159e\u010dten\u00e1 (1)","few":"Nep\u0159e\u010dten\u00e1 ({{count}})","other":"Nep\u0159e\u010dten\u00e1 ({{count}})"},"help":"sledovan\u00e1 t\u00e9mata s nep\u0159e\u010dten\u00fdmi p\u0159\u00edsp\u011bvky"},"new":{"title":{"zero":"Nov\u00e1","one":"Nov\u00e1 (1)","few":"Nov\u00e1 ({{count}})","other":"Nov\u00e1 ({{count}})"},"help":"nov\u00e1 t\u00e9mata od va\u0161\u00ed posledn\u00ed n\u00e1v\u0161t\u011bvy a nov\u00e9 p\u0159\u00edsp\u011bvky v t\u00e9matech, kter\u00e1 sledujete"},"posted":{"title":"M\u00e9 p\u0159\u00edsp\u011bvky","help":"t\u00e9mata, do kter\u00fdch jste p\u0159isp\u011bli"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","few":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"popul\u00e1rn\u00ed t\u00e9mata v kategorii {{categoryName}}"}},"browser_update":"Bohu\u017eel, <a href=\"http://www.discourse.org/faq/#browser\">v\u00e1\u0161 prohl\u00ed\u017ee\u010d je p\u0159\u00edli\u0161 star\u00fd, aby na n\u011bm Discourse mohl fungovat</a>. Pros\u00edm <a href=\"http://browsehappy.com\">aktualizujte sv\u016fj prohl\u00ed\u017ee\u010d</a>.","type_to_filter":"zadejte text pro filtrov\u00e1n\u00ed...","admin":{"title":"Discourse Administrace","moderator":"Moder\u00e1tor","dashboard":{"title":"Administr\u00e1torsk\u00fd rozcestn\u00edk","version":"Verze Discourse","up_to_date":"Pou\u017e\u00edv\u00e1te nejnov\u011bj\u0161\u00ed verzi Discourse.","critical_available":"Je k dispozici d\u016fle\u017eit\u00e1 aktualizace.","updates_available":"Jsou k dispozici aktualizace.","please_upgrade":"Pros\u00edm aktualizujte!","installed_version":"Nainstalov\u00e1no","latest_version":"Posledn\u00ed verze","problems_found":"Byly nalezeny probl\u00e9my s va\u0161\u00ed instalac\u00ed syst\u00e9mu Discourse:","last_checked":"Naposledy zkontrolov\u00e1no","refresh_problems":"Obnovit","no_problems":"Nenalezeny \u017e\u00e1dn\u00e9 probl\u00e9my.","moderators":"Moder\u00e1to\u0159i:","admins":"Administr\u00e1to\u0159i:","private_messages_short":"SZ","private_messages_title":"Soukrom\u00e9 zpr\u00e1vy","reports":{"today":"Dnes","yesterday":"V\u010dera","last_7_days":"Posledn\u00edch 7 dn\u00ed","last_30_days":"Posledn\u00edch 30 dn\u00ed","all_time":"Za celou dobu","7_days_ago":"P\u0159ed 7 dny","30_days_ago":"P\u0159ed 30 dny","all":"V\u0161echny","view_table":"Zobrazit jako tabulku","view_chart":"Zobrazit jako sloupcov\u00fd graf"}},"commits":{"latest_changes":"Posledn\u00ed zm\u011bny: pros\u00edm aktualizujte \u010dasto!","by":"od"},"flags":{"title":"Nahl\u00e1\u0161en\u00ed","old":"Star\u00e9","active":"Aktivn\u00ed","clear":"Vynulovat nahl\u00e1\u0161en\u00ed","clear_title":"zru\u0161it v\u0161echna nahl\u00e1\u0161en\u00ed na tomto p\u0159\u00edsp\u011bvku (zviditeln\u00ed p\u0159\u00edsp\u011bvek, byl-li skryt\u00fd)","delete":"Odstranit p\u0159\u00edsp\u011bvek","delete_title":"odstranit p\u0159\u00edsp\u011bvek (sma\u017ee cel\u00e9 t\u00e9ma, je-li to prvn\u00ed p\u0159\u00edsp\u011bvek v t\u00e9matu)","flagged_by":"Nahl\u00e1sil","error":"N\u011bco se pokazilo","view_message":"zobrazit zpr\u00e1vu"},"groups":{"title":"Skupiny","edit":"Editovat Skupiny","selector_placeholder":"p\u0159idat u\u017eivatele","name_placeholder":"N\u00e1zev skupiny, bez mezer, stejn\u00e1 pravidla jako pro u\u017eivatelsk\u00e1 jm\u00e9na"},"api":{"title":"API","long_title":"API Informace","key":"Kl\u00ed\u010d","generate":"Vygenerovat API kl\u00ed\u010d","regenerate":"Znovu-vygenerovat API kl\u00ed\u010d","info_html":"V\u00e1\u0161 API kl\u00ed\u010d umo\u017en\u00ed vytv\u00e1\u0159et a aktualizovat t\u00e9mata pomoc\u00ed JSONov\u00fdch vol\u00e1n\u00ed.","note_html":"Uchovejte tento kl\u00ed\u010d <strong>v bezpe\u010d\u00ed</strong>, ka\u017ed\u00fd, kdo m\u00e1 tento kl\u00ed\u010d, m\u016f\u017ee libovoln\u011b vytv\u00e1\u0159et p\u0159\u00edsp\u011bvky na f\u00f3ru i za ostatn\u00ed u\u017eivatele."},"customize":{"title":"P\u0159izp\u016fsoben\u00ed","long_title":"P\u0159izp\u016fsoben\u00ed webu","header":"Hlavi\u010dka","css":"Stylesheet","override_default":"P\u0159et\u00ed\u017eit v\u00fdchoz\u00ed?","enabled":"Zapnut\u00fd?","preview":"n\u00e1hled","undo_preview":"zru\u0161it n\u00e1hled","save":"Ulo\u017eit","new":"Nov\u00fd","new_style":"Nov\u00fd styl","delete":"Smazat","delete_confirm":"Smazat toto p\u0159izp\u016fsoben\u00ed?","about":"P\u0159izp\u016fsoben\u00ed webu v\u00e1m umo\u017en\u00ed si nastavit vlastn\u00ed CSS stylesheet a vlastn\u00ed nadpisy na webu. Vyberte si z nab\u00eddky nebo vlo\u017ete vlastn\u00ed p\u0159izp\u016fsoben\u00ed a m\u016f\u017eete za\u010d\u00edt editovat."},"email":{"title":"Z\u00e1znamy o emailech","sent_at":"Odesl\u00e1no","email_type":"Typ emailu","to_address":"Komu","test_email_address":"testovac\u00ed emailov\u00e1 adresa","send_test":"odeslat testovac\u00ed email","sent_test":"odesl\u00e1no!"},"impersonate":{"title":"Vyd\u00e1vat se za u\u017eivatele","username_or_email":"U\u017eivatelsk\u00e9 jm\u00e9no nebo emailov\u00e1 adresa","help":"Pou\u017eijte tento n\u00e1stroj k p\u0159ihl\u00e1\u0161en\u00ed za jin\u00e9ho u\u017eivatele pro lad\u00edc\u00ed a v\u00fdvojov\u00e9 pot\u0159eby.","not_found":"Tento u\u017eivatel nebyl nalezen.","invalid":"Bohu\u017eel za tohoto u\u017eivatele se nem\u016f\u017eete vyd\u00e1vat."},"users":{"title":"U\u017eivatel\u00e9","create":"P\u0159idat administr\u00e1tora","last_emailed":"Email naposledy zasl\u00e1n","not_found":"Bohu\u017eel u\u017eivatel s t\u00edmto jm\u00e9nem nen\u00ed v na\u0161em syst\u00e9mu.","new":"Nov\u00fd","active":"Aktivn\u00ed","pending":"\u010cek\u00e1 na schv\u00e1len\u00ed","approved":"Schv\u00e1len?","approved_selected":{"one":"schv\u00e1lit u\u017eivatele","few":"schv\u00e1lit u\u017eivatele ({{count}})","other":"schv\u00e1lit u\u017eivatele ({{count}})"},"titles":{"active":"Aktivn\u00ed u\u017eivatel\u00e9","new":"Nov\u00ed u\u017eivatel\u00e9","pending":"U\u017eivatel\u00e9 \u010dekaj\u00edc\u00ed na schv\u00e1len\u00ed","newuser":"U\u017eivatel\u00e9 s v\u011brohodnost\u00ed 0 (Nov\u00fd u\u017eivatel)","basic":"U\u017eivatel\u00e9 s v\u011brohodnost\u00ed 1 (Z\u00e1kladn\u00ed u\u017eivatel)","regular":"U\u017eivatel\u00e9 s v\u011brohodnost\u00ed 2 (Pravideln\u00fd u\u017eivatel)","leader":"U\u017eivatel\u00e9 s v\u011brohodnost\u00ed 3 (Vedouc\u00ed)","elder":"U\u017eivatel\u00e9 s v\u011brohodnost\u00ed 4 (Star\u0161\u00ed)","admins":"Admininstr\u00e1to\u0159i","moderators":"Moder\u00e1to\u0159i"}},"user":{"ban_failed":"Nastala chyba p\u0159i zakazov\u00e1n\u00ed u\u017eivatele {{error}}","unban_failed":"Nastala chyba p\u0159i povolov\u00e1n\u00ed u\u017eivatele {{error}}","ban_duration":"Jak dlouho m\u00e1 z\u00e1kaz platit? (dny)","delete_all_posts":"Smazat v\u0161echny p\u0159\u00edsp\u011bvky","ban":"Zak\u00e1zat","unban":"Povolit","banned":"Zak\u00e1z\u00e1n?","moderator":"Moder\u00e1tor?","admin":"Administr\u00e1tor?","show_admin_profile":"Administrace","refresh_browsers":"Vynutit obnoven\u00ed prohl\u00ed\u017ee\u010de","show_public_profile":"Zobrazit ve\u0159ejn\u00fd profil","impersonate":"Vyd\u00e1vat se za u\u017eivatele","revoke_admin":"Odebrat administr\u00e1torsk\u00e1 pr\u00e1va","grant_admin":"Ud\u011blit administr\u00e1torsk\u00e1 pr\u00e1va","revoke_moderation":"Odebrat moder\u00e1torsk\u00e1 pr\u00e1va","grant_moderation":"Ud\u011blit moder\u00e1torsk\u00e1 pr\u00e1va","reputation":"Reputace","permissions":"Povolen\u00ed","activity":"Aktivita","like_count":"Obdr\u017eel 'l\u00edb\u00ed'","private_topics_count":"Po\u010det soukrom\u00e1ch t\u00e9mat","posts_read_count":"P\u0159e\u010dteno p\u0159\u00edsp\u011bvk\u016f","post_count":"Vytvo\u0159eno p\u0159\u00edsp\u011bvk\u016f","topics_entered":"Zobrazil t\u00e9mat","flags_given_count":"Ud\u011bleno nahl\u00e1\u0161en\u00ed","flags_received_count":"P\u0159ijato nahl\u00e1\u0161en\u00ed","approve":"Schv\u00e1lit","approved_by":"schv\u00e1lil","time_read":"\u010cas \u010dten\u00ed","delete":"Smazat u\u017eivatele","delete_forbidden":"U\u017eivatele nelze odstranit, proto\u017ee m\u00e1 na f\u00f3ru zve\u0159ejn\u011bn\u00e9 p\u0159\u00edsp\u011bvky. Nejprve sma\u017ete v\u0161echny jeho p\u0159\u00edsp\u011bvky.","delete_confirm":"Jste si jist\u00ed, \u017ee chce permanentn\u011b smazat tohoto u\u017eivatele z f\u00f3ra? Tato akce je nevratn\u00e1!","deleted":"U\u017eivatel byl smaz\u00e1n.","delete_failed":"Nastala chyba p\u0159i odstra\u0148ov\u00e1n\u00ed u\u017eivatele. Ujist\u011bte se, \u017ee jsou v\u0161echny p\u0159\u00edsp\u011bvky tohoto u\u017eivatele smazan\u00e9, ne\u017e budete u\u017eivatele mazat.","send_activation_email":"Odeslat aktiva\u010dn\u00ed email","activation_email_sent":"Aktiva\u010dn\u00ed email byl odesl\u00e1n.","send_activation_email_failed":"Nastal probl\u00e9m p\u0159i odes\u00edl\u00e1n\u00ed aktiva\u010dn\u00edho emailu.","activate":"Aktivovat \u00fa\u010det","activate_failed":"Nasstal probl\u00e9m p\u0159i aktivov\u00e1n\u00ed tohoto u\u017eivatele.","deactivate_account":"Deaktivovat \u00fa\u010det","deactivate_failed":"Nastal probl\u00e9m p\u0159i deaktivov\u00e1n\u00ed tohoto u\u017eivatele."},"site_content":{"none":"Zvolte typ obsahu a m\u016f\u017eete za\u010d\u00edt editovat.","title":"Obsah webu","edit":"Editovat obsah webu"},"site_settings":{"show_overriden":"Zobrazit pouze zm\u011bn\u011bn\u00e1 nastaven\u00ed","title":"Nastaven\u00ed webu","reset":"vr\u00e1tit do p\u016fvodn\u00edho nastaven\u00ed"}}}}};
I18n.locale = 'cs';
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

I18n.pluralizationRules['cs'] = function (n) {
  if (n == 0) return ["zero", "none", "other"];
  if (n == 1) return "one";
  if (n >= 2 && n <= 4) return "few";
  return "other";
}
;
