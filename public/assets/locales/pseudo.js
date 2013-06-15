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
MessageFormat.locale.pseudo = function ( n ) {
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
    })({});I18n.translations = {"pseudo":{"js":{"share":{"topic":"[[ \u0161\u0125\u00e1\u0159\u00e9 \u00e1 \u0142\u00ed\u0273\u01e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]","post":"[[ \u0161\u0125\u00e1\u0159\u00e9 \u00e1 \u0142\u00ed\u0273\u01e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","close":"[[ \u010d\u0142\u00f3\u0161\u00e9 ]]","twitter":"[[ \u0161\u0125\u00e1\u0159\u00e9 \u0165\u0125\u00ed\u0161 \u0142\u00ed\u0273\u01e9 \u00f3\u0273 \u0164\u0175\u00ed\u0165\u0165\u00e9\u0159 ]]","facebook":"[[ \u0161\u0125\u00e1\u0159\u00e9 \u0165\u0125\u00ed\u0161 \u0142\u00ed\u0273\u01e9 \u00f3\u0273 \u0191\u00e1\u010d\u00e9\u0180\u00f3\u00f3\u01e9 ]]","google+":"[[ \u0161\u0125\u00e1\u0159\u00e9 \u0165\u0125\u00ed\u0161 \u0142\u00ed\u0273\u01e9 \u00f3\u0273 \u01e6\u00f3\u00f3\u01e7\u0142\u00e9+ ]]","email":"[[ \u0161\u00e9\u0273\u010f \u0165\u0125\u00ed\u0161 \u0142\u00ed\u0273\u01e9 \u00ed\u0273 \u00e1\u0273 \u00e9\u0271\u00e1\u00ed\u0142 ]]"},"edit":"[[ \u00e9\u010f\u00ed\u0165 \u0165\u0125\u00e9 \u0165\u00ed\u0165\u0142\u00e9 \u00e1\u0273\u010f \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd \u00f3\u0192 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]","not_implemented":"[[ \u0164\u0125\u00e1\u0165 \u0192\u00e9\u00e1\u0165\u016f\u0159\u00e9 \u0125\u00e1\u0161\u0273'\u0165 \u0180\u00e9\u00e9\u0273 \u00ed\u0271\u01bf\u0142\u00e9\u0271\u00e9\u0273\u0165\u00e9\u010f \u00fd\u00e9\u0165, \u0161\u00f3\u0159\u0159\u00fd! ]]","no_value":"[[ \u040d\u00f3 ]]","yes_value":"[[ \u00dd\u00e9\u0161 ]]","of_value":"[[ \u00f3\u0192 ]]","generic_error":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u0125\u00e1\u0161 \u00f3\u010d\u010d\u016f\u0159\u0159\u00e9\u010f. ]]","log_in":"[[ \u0141\u00f3\u01e7 \u00cd\u0273 ]]","age":"[[ \u00c1\u01e7\u00e9 ]]","last_post":"[[ \u0141\u00e1\u0161\u0165 \u01bf\u00f3\u0161\u0165 ]]","admin_title":"[[ \u00c1\u010f\u0271\u00ed\u0273 ]]","flags_title":"[[ \u0191\u0142\u00e1\u01e7\u0161 ]]","show_more":"[[ \u0161\u0125\u00f3\u0175 \u0271\u00f3\u0159\u00e9 ]]","links":"[[ \u0141\u00ed\u0273\u01e9\u0161 ]]","faq":"[[ \u0191\u00c1\u01a2 ]]","you":"[[ \u00dd\u00f3\u016f ]]","or":"[[ \u00f3\u0159 ]]","now":"[[ \u02b2\u016f\u0161\u0165 \u0273\u00f3\u0175 ]]","read_more":"[[ \u0159\u00e9\u00e1\u010f \u0271\u00f3\u0159\u00e9 ]]","suggested_topics":{"title":"[[ \u0160\u016f\u01e7\u01e7\u00e9\u0161\u0165\u00e9\u010f \u0164\u00f3\u01bf\u00ed\u010d\u0161 ]]"},"bookmarks":{"not_logged_in":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u00fd\u00f3\u016f \u0271\u016f\u0161\u0165 \u0180\u00e9 \u0142\u00f3\u01e7\u01e7\u00e9\u010f \u00ed\u0273 \u0165\u00f3 \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9 \u01bf\u00f3\u0161\u0165\u0161. ]]","created":"[[ \u00dd\u00f3\u016f'\u03bd\u00e9 \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165. ]]","not_bookmarked":"[[ \u00dd\u00f3\u016f'\u03bd\u00e9 \u0159\u00e9\u00e1\u010f \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165; \u010d\u0142\u00ed\u010d\u01e9 \u0165\u00f3 \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9 \u00ed\u0165. ]]","last_read":"[[ \u0164\u0125\u00ed\u0161 \u00ed\u0161 \u0165\u0125\u00e9 \u0142\u00e1\u0161\u0165 \u01bf\u00f3\u0161\u0165 \u00fd\u00f3\u016f'\u03bd\u00e9 \u0159\u00e9\u00e1\u010f. ]]"},"new_topics_inserted":"[[ {{count}} \u0273\u00e9\u0175 \u0165\u00f3\u01bf\u00ed\u010d\u0161. ]]","show_new_topics":"[[ \u010c\u0142\u00ed\u010d\u01e9 \u0165\u00f3 \u0161\u0125\u00f3\u0175. ]]","preview":"[[ \u01bf\u0159\u00e9\u03bd\u00ed\u00e9\u0175 ]]","cancel":"[[ \u010d\u00e1\u0273\u010d\u00e9\u0142 ]]","save":"[[ \u0160\u00e1\u03bd\u00e9 \u010c\u0125\u00e1\u0273\u01e7\u00e9\u0161 ]]","saving":"[[ \u0160\u00e1\u03bd\u00ed\u0273\u01e7... ]]","saved":"[[ \u0160\u00e1\u03bd\u00e9\u010f! ]]","user_action":{"user_posted_topic":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>{{user}}</\u00e1> \u01bf\u00f3\u0161\u0165\u00e9\u010f <\u00e1 \u0125\u0159\u00e9\u0192='{{topicUrl}}'>\u0165\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d</\u00e1> ]]","you_posted_topic":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>\u00dd\u00f3\u016f</\u00e1> \u01bf\u00f3\u0161\u0165\u00e9\u010f <\u00e1 \u0125\u0159\u00e9\u0192='{{topicUrl}}'>\u0165\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d</\u00e1> ]]","user_replied_to_post":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>{{user}}</\u00e1> \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u010f \u0165\u00f3 <\u00e1 \u0125\u0159\u00e9\u0192='{{postUrl}}'>{{post_number}}</\u00e1> ]]","you_replied_to_post":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>\u00dd\u00f3\u016f</\u00e1> \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u010f \u0165\u00f3 <\u00e1 \u0125\u0159\u00e9\u0192='{{postUrl}}'>{{post_number}}</\u00e1> ]]","user_replied_to_topic":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>{{user}}</\u00e1> \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u010f \u0165\u00f3 <\u00e1 \u0125\u0159\u00e9\u0192='{{topicUrl}}'>\u0165\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d</\u00e1> ]]","you_replied_to_topic":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>\u00dd\u00f3\u016f</\u00e1> \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u010f \u0165\u00f3 <\u00e1 \u0125\u0159\u00e9\u0192='{{topicUrl}}'>\u0165\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d</\u00e1> ]]","user_mentioned_user":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{user1Url}}'>{{user}}</\u00e1> \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u00e9\u010f <\u00e1 \u0125\u0159\u00e9\u0192='{{user2Url}}'>{{another_user}}</\u00e1> ]]","user_mentioned_you":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{user1Url}}'>{{user}}</\u00e1> \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u00e9\u010f <\u00e1 \u0125\u0159\u00e9\u0192='{{user2Url}}'>\u00fd\u00f3\u016f</\u00e1> ]]","you_mentioned_user":"[[ <\u00e1 \u0125\u0159\u00e9\u0192='{{user1Url}}'>\u00dd\u00f3\u016f</\u00e1> \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u00e9\u010f <\u00e1 \u0125\u0159\u00e9\u0192='{{user2Url}}'>{{user}}</\u00e1> ]]","posted_by_user":"[[ \u0420\u00f3\u0161\u0165\u00e9\u010f \u0180\u00fd <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>{{user}}</\u00e1> ]]","posted_by_you":"[[ \u0420\u00f3\u0161\u0165\u00e9\u010f \u0180\u00fd <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>\u00fd\u00f3\u016f</\u00e1> ]]","sent_by_user":"[[ \u0160\u00e9\u0273\u0165 \u0180\u00fd <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>{{user}}</\u00e1> ]]","sent_by_you":"[[ \u0160\u00e9\u0273\u0165 \u0180\u00fd <\u00e1 \u0125\u0159\u00e9\u0192='{{userUrl}}'>\u00fd\u00f3\u016f</\u00e1> ]]"},"user_action_groups":{"1":"[[ \u0141\u00ed\u01e9\u00e9\u0161 \u01e6\u00ed\u03bd\u00e9\u0273 ]]","2":"[[ \u0141\u00ed\u01e9\u00e9\u0161 \u0158\u00e9\u010d\u00e9\u00ed\u03bd\u00e9\u010f ]]","3":"[[ \u0181\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9\u0161 ]]","4":"[[ \u0164\u00f3\u01bf\u00ed\u010d\u0161 ]]","5":"[[ \u0158\u00e9\u01bf\u0142\u00ed\u00e9\u0161 ]]","6":"[[ \u0158\u00e9\u0161\u01bf\u00f3\u0273\u0161\u00e9\u0161 ]]","7":"[[ \u03fa\u00e9\u0273\u0165\u00ed\u00f3\u0273\u0161 ]]","9":"[[ \u01a2\u016f\u00f3\u0165\u00e9\u0161 ]]","10":"[[ \u0191\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9\u0161 ]]","11":"[[ \u00c9\u010f\u00ed\u0165\u0161 ]]","12":"[[ \u0160\u00e9\u0273\u0165 \u00cd\u0165\u00e9\u0271\u0161 ]]","13":"[[ \u00cd\u0273\u0180\u00f3\u0445 ]]"},"user":{"profile":"[[ \u0420\u0159\u00f3\u0192\u00ed\u0142\u00e9 ]]","title":"[[ \u016e\u0161\u00e9\u0159 ]]","mute":"[[ \u03fa\u016f\u0165\u00e9 ]]","edit":"[[ \u00c9\u010f\u00ed\u0165 \u0420\u0159\u00e9\u0192\u00e9\u0159\u00e9\u0273\u010d\u00e9\u0161 ]]","download_archive":"[[ \u010f\u00f3\u0175\u0273\u0142\u00f3\u00e1\u010f \u00e1\u0159\u010d\u0125\u00ed\u03bd\u00e9 \u00f3\u0192 \u0271\u00fd \u01bf\u00f3\u0161\u0165\u0161 ]]","private_message":"[[ \u0420\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u03fa\u00e9\u0161\u0161\u00e1\u01e7\u00e9 ]]","private_messages":"[[ \u03fa\u00e9\u0161\u0161\u00e1\u01e7\u00e9\u0161 ]]","activity_stream":"[[ \u00c1\u010d\u0165\u00ed\u03bd\u00ed\u0165\u00fd ]]","preferences":"[[ \u0420\u0159\u00e9\u0192\u00e9\u0159\u00e9\u0273\u010d\u00e9\u0161 ]]","bio":"[[ \u00c1\u0180\u00f3\u016f\u0165 \u0271\u00e9 ]]","invited_by":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9\u010f \u0181\u00fd ]]","trust_level":"[[ \u0164\u0159\u016f\u0161\u0165 \u0141\u00e9\u03bd\u00e9\u0142 ]]","external_links_in_new_tab":"[[ \u00d3\u01bf\u00e9\u0273 \u00e1\u0142\u0142 \u00e9\u0445\u0165\u00e9\u0159\u0273\u00e1\u0142 \u0142\u00ed\u0273\u01e9\u0161 \u00ed\u0273 \u00e1 \u0273\u00e9\u0175 \u0165\u00e1\u0180 ]]","enable_quoting":"[[ \u00c9\u0273\u00e1\u0180\u0142\u00e9 \u01a3\u016f\u00f3\u0165\u00e9 \u0159\u00e9\u01bf\u0142\u00fd \u0192\u00f3\u0159 \u0125\u00ed\u01e7\u0125\u0142\u00ed\u01e7\u0125\u0165\u00e9\u010f \u0165\u00e9\u0445\u0165 ]]","moderator":"[[ {{user}} \u00ed\u0161 \u00e1 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159 ]]","admin":"[[ {{user}} \u00ed\u0161 \u00e1\u0273 \u00e1\u010f\u0271\u00ed\u0273 ]]","change_password":{"action":"[[ \u010d\u0125\u00e1\u0273\u01e7\u00e9 ]]","success":"[[ (\u00e9\u0271\u00e1\u00ed\u0142 \u0161\u00e9\u0273\u0165) ]]","in_progress":"[[ (\u0161\u00e9\u0273\u010f\u00ed\u0273\u01e7 \u00e9\u0271\u00e1\u00ed\u0142) ]]","error":"[[ (\u00e9\u0159\u0159\u00f3\u0159) ]]"},"change_username":{"action":"[[ \u010d\u0125\u00e1\u0273\u01e7\u00e9 ]]","title":"[[ \u010c\u0125\u00e1\u0273\u01e7\u00e9 \u016e\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 ]]","confirm":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u010d\u00f3\u016f\u0142\u010f \u0180\u00e9 \u010d\u00f3\u0273\u0161\u00e9\u01a3\u016f\u00e9\u0273\u010d\u00e9\u0161 \u0165\u00f3 \u010d\u0125\u00e1\u0273\u01e7\u00ed\u0273\u01e7 \u00fd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9. \u00c1\u0159\u00e9 \u00fd\u00f3\u016f \u00e1\u0180\u0161\u00f3\u0142\u016f\u0165\u00e9\u0142\u00fd \u0161\u016f\u0159\u00e9 \u00fd\u00f3\u016f \u0175\u00e1\u0273\u0165 \u0165\u00f3? ]]","taken":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e1\u0165 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u00ed\u0161 \u0165\u00e1\u01e9\u00e9\u0273. ]]","error":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u010d\u0125\u00e1\u0273\u01e7\u00ed\u0273\u01e7 \u00fd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9. ]]","invalid":"[[ \u0164\u0125\u00e1\u0165 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u00ed\u0161 \u00ed\u0273\u03bd\u00e1\u0142\u00ed\u010f. \u00cd\u0165 \u0271\u016f\u0161\u0165 \u00f3\u0273\u0142\u00fd \u00ed\u0273\u010d\u0142\u016f\u010f\u00e9 \u0273\u016f\u0271\u0180\u00e9\u0159\u0161 \u00e1\u0273\u010f \u0142\u00e9\u0165\u0165\u00e9\u0159\u0161 ]]"},"change_email":{"action":"[[ \u010d\u0125\u00e1\u0273\u01e7\u00e9 ]]","title":"[[ \u010c\u0125\u00e1\u0273\u01e7\u00e9 \u00c9\u0271\u00e1\u00ed\u0142 ]]","taken":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e1\u0165 \u00e9\u0271\u00e1\u00ed\u0142 \u00ed\u0161 \u0273\u00f3\u0165 \u00e1\u03bd\u00e1\u00ed\u0142\u00e1\u0180\u0142\u00e9. ]]","error":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u010d\u0125\u00e1\u0273\u01e7\u00ed\u0273\u01e7 \u00fd\u00f3\u016f\u0159 \u00e9\u0271\u00e1\u00ed\u0142. \u0420\u00e9\u0159\u0125\u00e1\u01bf\u0161 \u0165\u0125\u00e1\u0165 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161 \u00ed\u0161 \u00e1\u0142\u0159\u00e9\u00e1\u010f\u00fd \u00ed\u0273 \u016f\u0161\u00e9? ]]","success":"[[ \u0174\u00e9'\u03bd\u00e9 \u0161\u00e9\u0273\u0165 \u00e1\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u0165\u00f3 \u0165\u0125\u00e1\u0165 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161. \u0420\u0142\u00e9\u00e1\u0161\u00e9 \u0192\u00f3\u0142\u0142\u00f3\u0175 \u0165\u0125\u00e9 \u010d\u00f3\u0273\u0192\u00ed\u0159\u0271\u00e1\u0165\u00ed\u00f3\u0273 \u00ed\u0273\u0161\u0165\u0159\u016f\u010d\u0165\u00ed\u00f3\u0273\u0161. ]]"},"email":{"title":"[[ \u00c9\u0271\u00e1\u00ed\u0142 ]]","instructions":"[[ \u00dd\u00f3\u016f\u0159 \u00e9\u0271\u00e1\u00ed\u0142 \u0175\u00ed\u0142\u0142 \u0273\u00e9\u03bd\u00e9\u0159 \u0180\u00e9 \u0161\u0125\u00f3\u0175\u0273 \u0165\u00f3 \u0165\u0125\u00e9 \u01bf\u016f\u0180\u0142\u00ed\u010d. ]]","ok":"[[ \u0141\u00f3\u00f3\u01e9\u0161 \u01e7\u00f3\u00f3\u010f. \u0174\u00e9 \u0175\u00ed\u0142\u0142 \u00e9\u0271\u00e1\u00ed\u0142 \u00fd\u00f3\u016f \u0165\u00f3 \u010d\u00f3\u0273\u0192\u00ed\u0159\u0271. ]]","invalid":"[[ \u0420\u0142\u00e9\u00e1\u0161\u00e9 \u00e9\u0273\u0165\u00e9\u0159 \u00e1 \u03bd\u00e1\u0142\u00ed\u010f \u00e9\u0271\u00e1\u00ed\u0142 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161. ]]","authenticated":"[[ \u00dd\u00f3\u016f\u0159 \u00e9\u0271\u00e1\u00ed\u0142 \u0125\u00e1\u0161 \u0180\u00e9\u00e9\u0273 \u00e1\u016f\u0165\u0125\u00e9\u0273\u0165\u00ed\u010d\u00e1\u0165\u00e9\u010f \u0180\u00fd {{provider}}. ]]","frequency":"[[ \u0174\u00e9'\u0142\u0142 \u00f3\u0273\u0142\u00fd \u00e9\u0271\u00e1\u00ed\u0142 \u00fd\u00f3\u016f \u00ed\u0192 \u0175\u00e9 \u0125\u00e1\u03bd\u00e9\u0273'\u0165 \u0161\u00e9\u00e9\u0273 \u00fd\u00f3\u016f \u0159\u00e9\u010d\u00e9\u0273\u0165\u0142\u00fd \u00e1\u0273\u010f \u00fd\u00f3\u016f \u0125\u00e1\u03bd\u00e9\u0273'\u0165 \u00e1\u0142\u0159\u00e9\u00e1\u010f\u00fd \u0161\u00e9\u00e9\u0273 \u0165\u0125\u00e9 \u0165\u0125\u00ed\u0273\u01e7 \u0175\u00e9'\u0159\u00e9 \u00e9\u0271\u00e1\u00ed\u0142\u00ed\u0273\u01e7 \u00fd\u00f3\u016f \u00e1\u0180\u00f3\u016f\u0165. ]]"},"name":{"title":"[[ \u040d\u00e1\u0271\u00e9 ]]","instructions":"[[ \u0164\u0125\u00e9 \u0142\u00f3\u0273\u01e7\u00e9\u0159 \u03bd\u00e9\u0159\u0161\u00ed\u00f3\u0273 \u00f3\u0192 \u00fd\u00f3\u016f\u0159 \u0273\u00e1\u0271\u00e9; \u010f\u00f3\u00e9\u0161 \u0273\u00f3\u0165 \u0273\u00e9\u00e9\u010f \u0165\u00f3 \u0180\u00e9 \u016f\u0273\u00ed\u01a3\u016f\u00e9. \u016e\u0161\u00e9\u010f \u0192\u00f3\u0159 \u00e1\u0142\u0165\u00e9\u0159\u0273\u00e1\u0165\u00e9 @\u0273\u00e1\u0271\u00e9 \u0271\u00e1\u0165\u010d\u0125\u00ed\u0273\u01e7 \u00e1\u0273\u010f \u0161\u0125\u00f3\u0175\u0273 \u00f3\u0273\u0142\u00fd \u00f3\u0273 \u00fd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159 \u01bf\u00e1\u01e7\u00e9. ]]","too_short":"[[ \u00dd\u00f3\u016f\u0159 \u0273\u00e1\u0271\u00e9 \u00ed\u0161 \u0165\u00f3\u00f3 \u0161\u0125\u00f3\u0159\u0165. ]]","ok":"[[ \u00dd\u00f3\u016f\u0159 \u0273\u00e1\u0271\u00e9 \u0142\u00f3\u00f3\u01e9\u0161 \u01e7\u00f3\u00f3\u010f. ]]"},"username":{"title":"[[ \u016e\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 ]]","instructions":"[[ \u03fa\u016f\u0161\u0165 \u0180\u00e9 \u016f\u0273\u00ed\u01a3\u016f\u00e9, \u0273\u00f3 \u0161\u01bf\u00e1\u010d\u00e9\u0161. \u0420\u00e9\u00f3\u01bf\u0142\u00e9 \u010d\u00e1\u0273 \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273 \u00fd\u00f3\u016f \u00e1\u0161 @\u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9. ]]","short_instructions":"[[ \u0420\u00e9\u00f3\u01bf\u0142\u00e9 \u010d\u00e1\u0273 \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273 \u00fd\u00f3\u016f \u00e1\u0161 @{{username}}. ]]","available":"[[ \u00dd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u00ed\u0161 \u00e1\u03bd\u00e1\u00ed\u0142\u00e1\u0180\u0142\u00e9. ]]","global_match":"[[ \u00c9\u0271\u00e1\u00ed\u0142 \u0271\u00e1\u0165\u010d\u0125\u00e9\u0161 \u0165\u0125\u00e9 \u0159\u00e9\u01e7\u00ed\u0161\u0165\u00e9\u0159\u00e9\u010f \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9. ]]","global_mismatch":"[[ \u00c1\u0142\u0159\u00e9\u00e1\u010f\u00fd \u0159\u00e9\u01e7\u00ed\u0161\u0165\u00e9\u0159\u00e9\u010f. \u0164\u0159\u00fd {{suggestion}}? ]]","not_available":"[[ \u040d\u00f3\u0165 \u00e1\u03bd\u00e1\u00ed\u0142\u00e1\u0180\u0142\u00e9. \u0164\u0159\u00fd {{suggestion}}? ]]","too_short":"[[ \u00dd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u00ed\u0161 \u0165\u00f3\u00f3 \u0161\u0125\u00f3\u0159\u0165. ]]","too_long":"[[ \u00dd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u00ed\u0161 \u0165\u00f3\u00f3 \u0142\u00f3\u0273\u01e7. ]]","checking":"[[ \u010c\u0125\u00e9\u010d\u01e9\u00ed\u0273\u01e7 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u00e1\u03bd\u00e1\u00ed\u0142\u00e1\u0180\u00ed\u0142\u00ed\u0165\u00fd... ]]","enter_email":"[[ \u016e\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u0192\u00f3\u016f\u0273\u010f. \u00c9\u0273\u0165\u00e9\u0159 \u0271\u00e1\u0165\u010d\u0125\u00ed\u0273\u01e7 \u00e9\u0271\u00e1\u00ed\u0142. ]]"},"password_confirmation":{"title":"[[ \u0420\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f \u00c1\u01e7\u00e1\u00ed\u0273 ]]"},"last_posted":"[[ \u0141\u00e1\u0161\u0165 \u0420\u00f3\u0161\u0165 ]]","last_emailed":"[[ \u0141\u00e1\u0161\u0165 \u00c9\u0271\u00e1\u00ed\u0142\u00e9\u010f ]]","last_seen":"[[ \u0141\u00e1\u0161\u0165 \u0160\u00e9\u00e9\u0273 ]]","created":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9\u010f \u00c1\u0165 ]]","log_out":"[[ \u0141\u00f3\u01e7 \u00d3\u016f\u0165 ]]","website":"[[ \u0174\u00e9\u0180 \u0160\u00ed\u0165\u00e9 ]]","email_settings":"[[ \u00c9\u0271\u00e1\u00ed\u0142 ]]","email_digests":{"title":"[[ \u0174\u0125\u00e9\u0273 \u00cd \u010f\u00f3\u0273'\u0165 \u03bd\u00ed\u0161\u00ed\u0165 \u0165\u0125\u00e9 \u0161\u00ed\u0165\u00e9, \u0161\u00e9\u0273\u010f \u0271\u00e9 \u00e1\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u010f\u00ed\u01e7\u00e9\u0161\u0165 \u00f3\u0192 \u0175\u0125\u00e1\u0165'\u0161 \u0273\u00e9\u0175 ]]","daily":"[[ \u010f\u00e1\u00ed\u0142\u00fd ]]","weekly":"[[ \u0175\u00e9\u00e9\u01e9\u0142\u00fd ]]","bi_weekly":"[[ \u00e9\u03bd\u00e9\u0159\u00fd \u0165\u0175\u00f3 \u0175\u00e9\u00e9\u01e9\u0161 ]]"},"email_direct":"[[ \u0158\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u00e1\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u0175\u0125\u00e9\u0273 \u0161\u00f3\u0271\u00e9\u00f3\u0273\u00e9 \u01a3\u016f\u00f3\u0165\u00e9\u0161 \u00fd\u00f3\u016f, \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u0161 \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165, \u00f3\u0159 \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u0161 \u00fd\u00f3\u016f\u0159 @\u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 ]]","email_private_messages":"[[ \u0158\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u00e1\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u0175\u0125\u00e9\u0273 \u0161\u00f3\u0271\u00e9\u00f3\u0273\u00e9 \u0161\u00e9\u0273\u010f\u0161 \u00fd\u00f3\u016f \u00e1 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 ]]","other_settings":"[[ \u00d3\u0165\u0125\u00e9\u0159 ]]","new_topic_duration":{"label":"[[ \u010c\u00f3\u0273\u0161\u00ed\u010f\u00e9\u0159 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0273\u00e9\u0175 \u0175\u0125\u00e9\u0273 ]]","not_viewed":"[[ \u00cd \u0125\u00e1\u03bd\u00e9\u0273'\u0165 \u03bd\u00ed\u00e9\u0175\u00e9\u010f \u0165\u0125\u00e9\u0271 \u00fd\u00e9\u0165 ]]","last_here":"[[ \u0165\u0125\u00e9\u00fd \u0175\u00e9\u0159\u00e9 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u0161\u00ed\u0273\u010d\u00e9 \u00cd \u0175\u00e1\u0161 \u0125\u00e9\u0159\u00e9 \u0142\u00e1\u0161\u0165 ]]","after_n_days":{"one":"[[ \u0165\u0125\u00e9\u00fd \u0175\u00e9\u0159\u00e9 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 \u0165\u0125\u00e9 \u0142\u00e1\u0161\u0165 \u010f\u00e1\u00fd ]]","other":"[[ \u0165\u0125\u00e9\u00fd \u0175\u00e9\u0159\u00e9 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 \u0165\u0125\u00e9 \u0142\u00e1\u0161\u0165 {{count}} \u010f\u00e1\u00fd\u0161 ]]"},"after_n_weeks":{"one":"[[ \u0165\u0125\u00e9\u00fd \u0175\u00e9\u0159\u00e9 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 \u0165\u0125\u00e9 \u0142\u00e1\u0161\u0165 \u0175\u00e9\u00e9\u01e9 ]]","other":"[[ \u0165\u0125\u00e9\u00fd \u0175\u00e9\u0159\u00e9 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 \u0165\u0125\u00e9 \u0142\u00e1\u0161\u0165 {{count}} \u0175\u00e9\u00e9\u01e9 ]]"}},"auto_track_topics":"[[ \u00c1\u016f\u0165\u00f3\u0271\u00e1\u0165\u00ed\u010d\u00e1\u0142\u0142\u00fd \u0165\u0159\u00e1\u010d\u01e9 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00cd \u00e9\u0273\u0165\u00e9\u0159 ]]","auto_track_options":{"never":"[[ \u0273\u00e9\u03bd\u00e9\u0159 ]]","always":"[[ \u00e1\u0142\u0175\u00e1\u00fd\u0161 ]]","after_n_seconds":{"one":"[[ \u00e1\u0192\u0165\u00e9\u0159 1 \u0161\u00e9\u010d\u00f3\u0273\u010f ]]","other":"[[ \u00e1\u0192\u0165\u00e9\u0159 {{count}} \u0161\u00e9\u010d\u00f3\u0273\u010f\u0161 ]]"},"after_n_minutes":{"one":"[[ \u00e1\u0192\u0165\u00e9\u0159 1 \u0271\u00ed\u0273\u016f\u0165\u00e9 ]]","other":"[[ \u00e1\u0192\u0165\u00e9\u0159 {{count}} \u0271\u00ed\u0273\u016f\u0165\u00e9\u0161 ]]"}},"invited":{"title":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9\u0161 ]]","user":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9\u010f \u016e\u0161\u00e9\u0159 ]]","none":"[[ {{username}} \u0125\u00e1\u0161\u0273'\u0165 \u00ed\u0273\u03bd\u00ed\u0165\u00e9\u010f \u00e1\u0273\u00fd \u016f\u0161\u00e9\u0159\u0161 \u0165\u00f3 \u0165\u0125\u00e9 \u0161\u00ed\u0165\u00e9. ]]","redeemed":"[[ \u0158\u00e9\u010f\u00e9\u00e9\u0271\u00e9\u010f \u00cd\u0273\u03bd\u00ed\u0165\u00e9\u0161 ]]","redeemed_at":"[[ \u0158\u00e9\u010f\u00e9\u00e9\u0271\u00e9\u010f \u00c1\u0165 ]]","pending":"[[ \u0420\u00e9\u0273\u010f\u00ed\u0273\u01e7 \u00cd\u0273\u03bd\u00ed\u0165\u00e9\u0161 ]]","topics_entered":"[[ \u0164\u00f3\u01bf\u00ed\u010d\u0161 \u00c9\u0273\u0165\u00e9\u0159\u00e9\u010f ]]","posts_read_count":"[[ \u0420\u00f3\u0161\u0165\u0161 \u0158\u00e9\u00e1\u010f ]]","rescind":"[[ \u0158\u00e9\u0271\u00f3\u03bd\u00e9 \u00cd\u0273\u03bd\u00ed\u0165\u00e1\u0165\u00ed\u00f3\u0273 ]]","rescinded":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9 \u0159\u00e9\u0271\u00f3\u03bd\u00e9\u010f ]]","time_read":"[[ \u0158\u00e9\u00e1\u010f \u0164\u00ed\u0271\u00e9 ]]","days_visited":"[[ \u010e\u00e1\u00fd\u0161 \u0476\u00ed\u0161\u00ed\u0165\u00e9\u010f ]]","account_age_days":"[[ \u00c1\u010d\u010d\u00f3\u016f\u0273\u0165 \u00e1\u01e7\u00e9 \u00ed\u0273 \u010f\u00e1\u00fd\u0161 ]]"},"password":{"title":"[[ \u0420\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f ]]","too_short":"[[ \u00dd\u00f3\u016f\u0159 \u01bf\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f \u00ed\u0161 \u0165\u00f3\u00f3 \u0161\u0125\u00f3\u0159\u0165. ]]","ok":"[[ \u00dd\u00f3\u016f\u0159 \u01bf\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f \u0142\u00f3\u00f3\u01e9\u0161 \u01e7\u00f3\u00f3\u010f. ]]"},"ip_address":{"title":"[[ \u0141\u00e1\u0161\u0165 \u00cd\u0420 \u00c1\u010f\u010f\u0159\u00e9\u0161\u0161 ]]"},"avatar":{"title":"[[ \u00c1\u03bd\u00e1\u0165\u00e1\u0159 ]]","instructions":"[[ \u0174\u00e9 \u016f\u0161\u00e9 <\u00e1 \u0125\u0159\u00e9\u0192='\u0125\u0165\u0165\u01bf\u0161://\u01e7\u0159\u00e1\u03bd\u00e1\u0165\u00e1\u0159.\u010d\u00f3\u0271' \u0165\u00e1\u0159\u01e7\u00e9\u0165='_\u0180\u0142\u00e1\u0273\u01e9'>\u01e6\u0159\u00e1\u03bd\u00e1\u0165\u00e1\u0159</\u00e1> \u0192\u00f3\u0159 \u00e1\u03bd\u00e1\u0165\u00e1\u0159\u0161 \u0180\u00e1\u0161\u00e9\u010f \u00f3\u0273 \u00fd\u00f3\u016f\u0159 \u00e9\u0271\u00e1\u00ed\u0142 ]]"},"filters":{"all":"[[ \u00c1\u0142\u0142 ]]"},"stream":{"posted_by":"[[ \u0420\u00f3\u0161\u0165\u00e9\u010f \u0180\u00fd ]]","sent_by":"[[ \u0160\u00e9\u0273\u0165 \u0180\u00fd ]]","private_message":"[[ \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 ]]","the_topic":"[[ \u0165\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d ]]"}},"loading":"[[ \u0141\u00f3\u00e1\u010f\u00ed\u0273\u01e7... ]]","close":"[[ \u010c\u0142\u00f3\u0161\u00e9 ]]","learn_more":"[[ \u0142\u00e9\u00e1\u0159\u0273 \u0271\u00f3\u0159\u00e9... ]]","year":"[[ \u00fd\u00e9\u00e1\u0159 ]]","year_desc":"[[ \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 \u0165\u0125\u00e9 \u0142\u00e1\u0161\u0165 365 \u010f\u00e1\u00fd\u0161 ]]","month":"[[ \u0271\u00f3\u0273\u0165\u0125 ]]","month_desc":"[[ \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 \u0165\u0125\u00e9 \u0142\u00e1\u0161\u0165 30 \u010f\u00e1\u00fd\u0161 ]]","week":"[[ \u0175\u00e9\u00e9\u01e9 ]]","week_desc":"[[ \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 \u0165\u0125\u00e9 \u0142\u00e1\u0161\u0165 7 \u010f\u00e1\u00fd\u0161 ]]","first_post":"[[ \u0191\u00ed\u0159\u0161\u0165 \u01bf\u00f3\u0161\u0165 ]]","mute":"[[ \u03fa\u016f\u0165\u00e9 ]]","unmute":"[[ \u016e\u0273\u0271\u016f\u0165\u00e9 ]]","best_of":{"title":"[[ \u0181\u00e9\u0161\u0165 \u00d3\u0192 ]]","enabled_description":"[[ \u00dd\u00f3\u016f \u00e1\u0159\u00e9 \u010d\u016f\u0159\u0159\u00e9\u0273\u0165\u0142\u00fd \u03bd\u00ed\u00e9\u0175\u00ed\u0273\u01e7 \u0165\u0125\u00e9 \"\u0181\u00e9\u0161\u0165 \u00d3\u0192\" \u03bd\u00ed\u00e9\u0175 \u00f3\u0192 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. ]]","description":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 <\u0180>{{count}}</\u0180> \u01bf\u00f3\u0161\u0165\u0161 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. \u0164\u0125\u00e1\u0165'\u0161 \u00e1 \u0142\u00f3\u0165! \u0174\u00f3\u016f\u0142\u010f \u00fd\u00f3\u016f \u0142\u00ed\u01e9\u00e9 \u0165\u00f3 \u0161\u00e1\u03bd\u00e9 \u0165\u00ed\u0271\u00e9 \u0180\u00fd \u0161\u0175\u00ed\u0165\u010d\u0125\u00ed\u0273\u01e7 \u00fd\u00f3\u016f\u0159 \u03bd\u00ed\u00e9\u0175 \u0165\u00f3 \u0161\u0125\u00f3\u0175 \u00f3\u0273\u0142\u00fd \u0165\u0125\u00e9 \u01bf\u00f3\u0161\u0165\u0161 \u0175\u00ed\u0165\u0125 \u0165\u0125\u00e9 \u0271\u00f3\u0161\u0165 \u00ed\u0273\u0165\u00e9\u0159\u00e1\u010d\u0165\u00ed\u00f3\u0273\u0161 \u00e1\u0273\u010f \u0159\u00e9\u0161\u01bf\u00f3\u0273\u0161\u00e9\u0161? ]]","enable":"[[ \u0160\u0175\u00ed\u0165\u010d\u0125 \u0165\u00f3 \"\u0181\u00e9\u0161\u0165 \u00d3\u0192\" \u03bd\u00ed\u00e9\u0175 ]]","disable":"[[ \u010c\u00e1\u0273\u010d\u00e9\u0142 \"\u0181\u00e9\u0161\u0165 \u00d3\u0192\" ]]"},"private_message_info":{"title":"[[ \u0420\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u03fa\u00e9\u0161\u0161\u00e1\u01e7\u00e9 ]]","invite":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9 \u00d3\u0165\u0125\u00e9\u0159\u0161... ]]"},"email":"[[ \u00c9\u0271\u00e1\u00ed\u0142 ]]","username":"[[ \u016e\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 ]]","last_seen":"[[ \u0141\u00e1\u0161\u0165 \u0160\u00e9\u00e9\u0273 ]]","created":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9\u010f ]]","trust_level":"[[ \u0164\u0159\u016f\u0161\u0165 \u0141\u00e9\u03bd\u00e9\u0142 ]]","create_account":{"title":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9 \u00c1\u010d\u010d\u00f3\u016f\u0273\u0165 ]]","action":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9 \u00f3\u0273\u00e9 \u0273\u00f3\u0175! ]]","invite":"[[ \u010e\u00f3\u0273'\u0165 \u0125\u00e1\u03bd\u00e9 \u00e1\u0273 \u00e1\u010d\u010d\u00f3\u016f\u0273\u0165 \u00fd\u00e9\u0165? ]]","failed":"[[ \u0160\u00f3\u0271\u00e9\u0165\u0125\u00ed\u0273\u01e7 \u0175\u00e9\u0273\u0165 \u0175\u0159\u00f3\u0273\u01e7, \u01bf\u00e9\u0159\u0125\u00e1\u01bf\u0161 \u0165\u0125\u00ed\u0161 \u00e9\u0271\u00e1\u00ed\u0142 \u00ed\u0161 \u00e1\u0142\u0159\u00e9\u00e1\u010f\u00fd \u0159\u00e9\u01e7\u00ed\u0161\u0165\u00e9\u0159\u00e9\u010f, \u0165\u0159\u00fd \u0165\u0125\u00e9 \u0192\u00f3\u0159\u01e7\u00f3\u0165 \u01bf\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f \u0142\u00ed\u0273\u01e9 ]]"},"forgot_password":{"title":"[[ \u0191\u00f3\u0159\u01e7\u00f3\u0165 \u0420\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f ]]","action":"[[ \u00cd \u0192\u00f3\u0159\u01e7\u00f3\u0165 \u0271\u00fd \u01bf\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f ]]","invite":"[[ \u00c9\u0273\u0165\u00e9\u0159 \u00fd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u00f3\u0159 \u00e9\u0271\u00e1\u00ed\u0142 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161, \u00e1\u0273\u010f \u0175\u00e9'\u0142\u0142 \u0161\u00e9\u0273\u010f \u00fd\u00f3\u016f \u00e1 \u01bf\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f \u0159\u00e9\u0161\u00e9\u0165 \u00e9\u0271\u00e1\u00ed\u0142. ]]","reset":"[[ \u0158\u00e9\u0161\u00e9\u0165 \u0420\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f ]]","complete":"[[ \u00dd\u00f3\u016f \u0161\u0125\u00f3\u016f\u0142\u010f \u0159\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u00e1\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u0175\u00ed\u0165\u0125 \u00ed\u0273\u0161\u0165\u0159\u016f\u010d\u0165\u00ed\u00f3\u0273\u0161 \u00f3\u0273 \u0125\u00f3\u0175 \u0165\u00f3 \u0159\u00e9\u0161\u00e9\u0165 \u00fd\u00f3\u016f\u0159 \u01bf\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f \u0161\u0125\u00f3\u0159\u0165\u0142\u00fd. ]]"},"login":{"title":"[[ \u0141\u00f3\u01e7 \u00cd\u0273 ]]","username":"[[ \u0141\u00f3\u01e7\u00ed\u0273 ]]","password":"[[ \u0420\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f ]]","email_placeholder":"[[ \u00e9\u0271\u00e1\u00ed\u0142 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161 \u00f3\u0159 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 ]]","error":"[[ \u016e\u0273\u01e9\u0273\u00f3\u0175\u0273 \u00e9\u0159\u0159\u00f3\u0159 ]]","reset_password":"[[ \u0158\u00e9\u0161\u00e9\u0165 \u0420\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f ]]","logging_in":"[[ \u0141\u00f3\u01e7\u01e7\u00ed\u0273\u01e7 \u00cd\u0273... ]]","or":"[[ \u00d3\u0159 ]]","authenticating":"[[ \u00c1\u016f\u0165\u0125\u00e9\u0273\u0165\u00ed\u010d\u00e1\u0165\u00ed\u0273\u01e7... ]]","awaiting_confirmation":"[[ \u00dd\u00f3\u016f\u0159 \u00e1\u010d\u010d\u00f3\u016f\u0273\u0165 \u00ed\u0161 \u00e1\u0175\u00e1\u00ed\u0165\u00ed\u0273\u01e7 \u00e1\u010d\u0165\u00ed\u03bd\u00e1\u0165\u00ed\u00f3\u0273, \u016f\u0161\u00e9 \u0165\u0125\u00e9 \u0192\u00f3\u0159\u01e7\u00f3\u0165 \u01bf\u00e1\u0161\u0161\u0175\u00f3\u0159\u010f \u0142\u00ed\u0273\u01e9 \u0165\u00f3 \u00ed\u0161\u0161\u016f\u00e9 \u00e1\u0273\u00f3\u0165\u0125\u00e9\u0159 \u00e1\u010d\u0165\u00ed\u03bd\u00e1\u0165\u00ed\u00f3\u0273 \u00e9\u0271\u00e1\u00ed\u0142. ]]","awaiting_approval":"[[ \u00dd\u00f3\u016f\u0159 \u00e1\u010d\u010d\u00f3\u016f\u0273\u0165 \u0125\u00e1\u0161 \u0273\u00f3\u0165 \u0180\u00e9\u00e9\u0273 \u00e1\u01bf\u01bf\u0159\u00f3\u03bd\u00e9\u010f \u0180\u00fd \u00e1 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159 \u00fd\u00e9\u0165. \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0159\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u00e1\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u0175\u0125\u00e9\u0273 \u00ed\u0165 \u00ed\u0161 \u00e1\u01bf\u01bf\u0159\u00f3\u03bd\u00e9\u010f. ]]","not_activated":"[[ \u00dd\u00f3\u016f \u010d\u00e1\u0273'\u0165 \u0142\u00f3\u01e7 \u00ed\u0273 \u00fd\u00e9\u0165. \u0174\u00e9 \u01bf\u0159\u00e9\u03bd\u00ed\u00f3\u016f\u0161\u0142\u00fd \u0161\u00e9\u0273\u0165 \u00e1\u0273 \u00e1\u010d\u0165\u00ed\u03bd\u00e1\u0165\u00ed\u00f3\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u0165\u00f3 \u00fd\u00f3\u016f \u00e1\u0165 <\u0180>{{sentTo}}</\u0180>. \u0420\u0142\u00e9\u00e1\u0161\u00e9 \u0192\u00f3\u0142\u0142\u00f3\u0175 \u0165\u0125\u00e9 \u00ed\u0273\u0161\u0165\u0159\u016f\u010d\u0165\u00ed\u00f3\u0273\u0161 \u00ed\u0273 \u0165\u0125\u00e1\u0165 \u00e9\u0271\u00e1\u00ed\u0142 \u0165\u00f3 \u00e1\u010d\u0165\u00ed\u03bd\u00e1\u0165\u00e9 \u00fd\u00f3\u016f\u0159 \u00e1\u010d\u010d\u00f3\u016f\u0273\u0165. ]]","resend_activation_email":"[[ \u010c\u0142\u00ed\u010d\u01e9 \u0125\u00e9\u0159\u00e9 \u0165\u00f3 \u0161\u00e9\u0273\u010f \u0165\u0125\u00e9 \u00e1\u010d\u0165\u00ed\u03bd\u00e1\u0165\u00ed\u00f3\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u00e1\u01e7\u00e1\u00ed\u0273. ]]","sent_activation_email_again":"[[ \u0174\u00e9 \u0161\u00e9\u0273\u0165 \u00e1\u0273\u00f3\u0165\u0125\u00e9\u0159 \u00e1\u010d\u0165\u00ed\u03bd\u00e1\u0165\u00ed\u00f3\u0273 \u00e9\u0271\u00e1\u00ed\u0142 \u0165\u00f3 \u00fd\u00f3\u016f \u00e1\u0165 <\u0180>{{currentEmail}}</\u0180>. \u00cd\u0165 \u0271\u00ed\u01e7\u0125\u0165 \u0165\u00e1\u01e9\u00e9 \u00e1 \u0192\u00e9\u0175 \u0271\u00ed\u0273\u016f\u0165\u00e9\u0161 \u0192\u00f3\u0159 \u00ed\u0165 \u0165\u00f3 \u00e1\u0159\u0159\u00ed\u03bd\u00e9; \u0180\u00e9 \u0161\u016f\u0159\u00e9 \u0165\u00f3 \u010d\u0125\u00e9\u010d\u01e9 \u00fd\u00f3\u016f\u0159 \u0161\u01bf\u00e1\u0271 \u0192\u00f3\u0142\u010f\u00e9\u0159. ]]","google":{"title":"[[ \u0175\u00ed\u0165\u0125 \u01e6\u00f3\u00f3\u01e7\u0142\u00e9 ]]","message":"[[ \u00c1\u016f\u0165\u0125\u00e9\u0273\u0165\u00ed\u010d\u00e1\u0165\u00ed\u0273\u01e7 \u0175\u00ed\u0165\u0125 \u01e6\u00f3\u00f3\u01e7\u0142\u00e9 (\u0271\u00e1\u01e9\u00e9 \u0161\u016f\u0159\u00e9 \u01bf\u00f3\u01bf \u016f\u01bf \u0180\u0142\u00f3\u010d\u01e9\u00e9\u0159\u0161 \u00e1\u0159\u00e9 \u0273\u00f3\u0165 \u00e9\u0273\u00e1\u0180\u0142\u00e9\u010f) ]]"},"twitter":{"title":"[[ \u0175\u00ed\u0165\u0125 \u0164\u0175\u00ed\u0165\u0165\u00e9\u0159 ]]","message":"[[ \u00c1\u016f\u0165\u0125\u00e9\u0273\u0165\u00ed\u010d\u00e1\u0165\u00ed\u0273\u01e7 \u0175\u00ed\u0165\u0125 \u0164\u0175\u00ed\u0165\u0165\u00e9\u0159 (\u0271\u00e1\u01e9\u00e9 \u0161\u016f\u0159\u00e9 \u01bf\u00f3\u01bf \u016f\u01bf \u0180\u0142\u00f3\u010d\u01e9\u00e9\u0159\u0161 \u00e1\u0159\u00e9 \u0273\u00f3\u0165 \u00e9\u0273\u00e1\u0180\u0142\u00e9\u010f) ]]"},"facebook":{"title":"[[ \u0175\u00ed\u0165\u0125 \u0191\u00e1\u010d\u00e9\u0180\u00f3\u00f3\u01e9 ]]","message":"[[ \u00c1\u016f\u0165\u0125\u00e9\u0273\u0165\u00ed\u010d\u00e1\u0165\u00ed\u0273\u01e7 \u0175\u00ed\u0165\u0125 \u0191\u00e1\u010d\u00e9\u0180\u00f3\u00f3\u01e9 (\u0271\u00e1\u01e9\u00e9 \u0161\u016f\u0159\u00e9 \u01bf\u00f3\u01bf \u016f\u01bf \u0180\u0142\u00f3\u010d\u01e9\u00e9\u0159\u0161 \u00e1\u0159\u00e9 \u0273\u00f3\u0165 \u00e9\u0273\u00e1\u0180\u0142\u00e9\u010f) ]]"},"yahoo":{"title":"[[ \u0175\u00ed\u0165\u0125 \u00dd\u00e1\u0125\u00f3\u00f3 ]]","message":"[[ \u00c1\u016f\u0165\u0125\u00e9\u0273\u0165\u00ed\u010d\u00e1\u0165\u00ed\u0273\u01e7 \u0175\u00ed\u0165\u0125 \u00dd\u00e1\u0125\u00f3\u00f3 (\u0271\u00e1\u01e9\u00e9 \u0161\u016f\u0159\u00e9 \u01bf\u00f3\u01bf \u016f\u01bf \u0180\u0142\u00f3\u010d\u01e9\u00e9\u0159\u0161 \u00e1\u0159\u00e9 \u0273\u00f3\u0165 \u00e9\u0273\u00e1\u0180\u0142\u00e9\u010f) ]]"},"github":{"title":"[[ \u0175\u00ed\u0165\u0125 \u01e6\u00ed\u0165\u0124\u016f\u0180 ]]","message":"[[ \u00c1\u016f\u0165\u0125\u00e9\u0273\u0165\u00ed\u010d\u00e1\u0165\u00ed\u0273\u01e7 \u0175\u00ed\u0165\u0125 \u01e6\u00ed\u0165\u0124\u016f\u0180 (\u0271\u00e1\u01e9\u00e9 \u0161\u016f\u0159\u00e9 \u01bf\u00f3\u01bf \u016f\u01bf \u0180\u0142\u00f3\u010d\u01e9\u00e9\u0159\u0161 \u00e1\u0159\u00e9 \u0273\u00f3\u0165 \u00e9\u0273\u00e1\u0180\u0142\u00e9\u010f) ]]"},"persona":{"title":"[[ \u0175\u00ed\u0165\u0125 \u0420\u00e9\u0159\u0161\u00f3\u0273\u00e1 ]]","message":"[[ \u00c1\u016f\u0165\u0125\u00e9\u0273\u0165\u00ed\u010d\u00e1\u0165\u00ed\u0273\u01e7 \u0175\u00ed\u0165\u0125 \u03fa\u00f3\u017e\u00ed\u0142\u0142\u00e1 \u0420\u00e9\u0159\u0161\u00f3\u0273\u00e1 (\u0271\u00e1\u01e9\u00e9 \u0161\u016f\u0159\u00e9 \u01bf\u00f3\u01bf \u016f\u01bf \u0180\u0142\u00f3\u010d\u01e9\u00e9\u0159\u0161 \u00e1\u0159\u00e9 \u0273\u00f3\u0165 \u00e9\u0273\u00e1\u0180\u0142\u00e9\u010f) ]]"}},"composer":{"posting_not_on_topic":"[[ \u00dd\u00f3\u016f \u00e1\u0159\u00e9 \u0159\u00e9\u01bf\u0142\u00fd\u00ed\u0273\u01e7 \u0165\u00f3 \u0165\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d \"{{title}}\", \u0180\u016f\u0165 \u00fd\u00f3\u016f \u00e1\u0159\u00e9 \u010d\u016f\u0159\u0159\u00e9\u0273\u0165\u0142\u00fd \u03bd\u00ed\u00e9\u0175\u00ed\u0273\u01e7 \u00e1 \u010f\u00ed\u0192\u0192\u00e9\u0159\u00e9\u0273\u0165 \u0165\u00f3\u01bf\u00ed\u010d. ]]","saving_draft_tip":"[[ \u0161\u00e1\u03bd\u00ed\u0273\u01e7 ]]","saved_draft_tip":"[[ \u0161\u00e1\u03bd\u00e9\u010f ]]","saved_local_draft_tip":"[[ \u0161\u00e1\u03bd\u00e9\u010f \u0142\u00f3\u010d\u00e1\u0142\u0142\u00fd ]]","similar_topics":"[[ \u00dd\u00f3\u016f\u0159 \u0165\u00f3\u01bf\u00ed\u010d \u00ed\u0161 \u0161\u00ed\u0271\u00ed\u0142\u00e1\u0159 \u0165\u00f3... ]]","drafts_offline":"[[ \u010f\u0159\u00e1\u0192\u0165\u0161 \u00f3\u0192\u0192\u0142\u00ed\u0273\u00e9 ]]","min_length":{"need_more_for_title":"[[ {{n}} \u0165\u00f3 \u01e7\u00f3 \u0192\u00f3\u0159 \u0165\u0125\u00e9 \u0165\u00ed\u0165\u0142\u00e9 ]]","need_more_for_reply":"[[ {{n}} \u0165\u00f3 \u01e7\u00f3 \u0192\u00f3\u0159 \u0165\u0125\u00e9 \u0159\u00e9\u01bf\u0142\u00fd ]]"},"save_edit":"[[ \u0160\u00e1\u03bd\u00e9 \u00c9\u010f\u00ed\u0165 ]]","reply_original":"[[ \u0158\u00e9\u01bf\u0142\u00fd \u00f3\u0273 \u00d3\u0159\u00ed\u01e7\u00ed\u0273\u00e1\u0142 \u0164\u00f3\u01bf\u00ed\u010d ]]","reply_here":"[[ \u0158\u00e9\u01bf\u0142\u00fd \u0124\u00e9\u0159\u00e9 ]]","reply":"[[ \u0158\u00e9\u01bf\u0142\u00fd ]]","cancel":"[[ \u010c\u00e1\u0273\u010d\u00e9\u0142 ]]","create_topic":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9 \u0164\u00f3\u01bf\u00ed\u010d ]]","create_pm":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9 \u0420\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u03fa\u00e9\u0161\u0161\u00e1\u01e7\u00e9 ]]","users_placeholder":"[[ \u00c1\u010f\u010f \u00e1 \u016f\u0161\u00e9\u0159 ]]","title_placeholder":"[[ \u0164\u00fd\u01bf\u00e9 \u00fd\u00f3\u016f\u0159 \u0165\u00ed\u0165\u0142\u00e9 \u0125\u00e9\u0159\u00e9. \u0174\u0125\u00e1\u0165 \u00ed\u0161 \u0165\u0125\u00ed\u0161 \u010f\u00ed\u0161\u010d\u016f\u0161\u0161\u00ed\u00f3\u0273 \u00e1\u0180\u00f3\u016f\u0165 \u00ed\u0273 \u00f3\u0273\u00e9 \u0180\u0159\u00ed\u00e9\u0192 \u0161\u00e9\u0273\u0165\u00e9\u0273\u010d\u00e9? ]]","reply_placeholder":"[[ \u0164\u00fd\u01bf\u00e9 \u0125\u00e9\u0159\u00e9. \u016e\u0161\u00e9 \u03fa\u00e1\u0159\u01e9\u010f\u00f3\u0175\u0273 \u00f3\u0159 \u0181\u0181\u010c\u00f3\u010f\u00e9 \u0165\u00f3 \u0192\u00f3\u0159\u0271\u00e1\u0165. \u010e\u0159\u00e1\u01e7 \u00f3\u0159 \u01bf\u00e1\u0161\u0165\u00e9 \u00e1\u0273 \u00ed\u0271\u00e1\u01e7\u00e9 \u0165\u00f3 \u016f\u01bf\u0142\u00f3\u00e1\u010f \u00ed\u0165. ]]","view_new_post":"[[ \u0476\u00ed\u00e9\u0175 \u00fd\u00f3\u016f\u0159 \u0273\u00e9\u0175 \u01bf\u00f3\u0161\u0165. ]]","saving":"[[ \u0160\u00e1\u03bd\u00ed\u0273\u01e7... ]]","saved":"[[ \u0160\u00e1\u03bd\u00e9\u010f! ]]","saved_draft":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9 \u00e1 \u01bf\u00f3\u0161\u0165 \u010f\u0159\u00e1\u0192\u0165 \u00ed\u0273 \u01bf\u0159\u00f3\u01e7\u0159\u00e9\u0161\u0161. \u010c\u0142\u00ed\u010d\u01e9 \u00e1\u0273\u00fd\u0175\u0125\u00e9\u0159\u00e9 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0180\u00f3\u0445 \u0165\u00f3 \u0159\u00e9\u0161\u016f\u0271\u00e9 \u00e9\u010f\u00ed\u0165\u00ed\u0273\u01e7. ]]","uploading":"[[ \u016e\u01bf\u0142\u00f3\u00e1\u010f\u00ed\u0273\u01e7... ]]","show_preview":"[[ \u0161\u0125\u00f3\u0175 \u01bf\u0159\u00e9\u03bd\u00ed\u00e9\u0175 &\u0159\u00e1\u01a3\u016f\u00f3; ]]","hide_preview":"[[ &\u0142\u00e1\u01a3\u016f\u00f3; \u0125\u00ed\u010f\u00e9 \u01bf\u0159\u00e9\u03bd\u00ed\u00e9\u0175 ]]","quote_post_title":"[[ \u01a2\u016f\u00f3\u0165\u00e9 \u0175\u0125\u00f3\u0142\u00e9 \u01bf\u00f3\u0161\u0165 ]]","bold_title":"[[ \u0160\u0165\u0159\u00f3\u0273\u01e7 ]]","bold_text":"[[ \u0161\u0165\u0159\u00f3\u0273\u01e7 \u0165\u00e9\u0445\u0165 ]]","italic_title":"[[ \u00c9\u0271\u01bf\u0125\u00e1\u0161\u00ed\u0161 ]]","italic_text":"[[ \u00e9\u0271\u01bf\u0125\u00e1\u0161\u00ed\u017e\u00e9\u010f \u0165\u00e9\u0445\u0165 ]]","link_title":"[[ \u0124\u00fd\u01bf\u00e9\u0159\u0142\u00ed\u0273\u01e9 ]]","link_description":"[[ \u00e9\u0273\u0165\u00e9\u0159 \u0142\u00ed\u0273\u01e9 \u010f\u00e9\u0161\u010d\u0159\u00ed\u01bf\u0165\u00ed\u00f3\u0273 \u0125\u00e9\u0159\u00e9 ]]","link_dialog_title":"[[ \u00cd\u0273\u0161\u00e9\u0159\u0165 \u0124\u00fd\u01bf\u00e9\u0159\u0142\u00ed\u0273\u01e9 ]]","link_optional_text":"[[ \u00f3\u01bf\u0165\u00ed\u00f3\u0273\u00e1\u0142 \u0165\u00ed\u0165\u0142\u00e9 ]]","quote_title":"[[ \u0181\u0142\u00f3\u010d\u01e9\u01a3\u016f\u00f3\u0165\u00e9 ]]","quote_text":"[[ \u0181\u0142\u00f3\u010d\u01e9\u01a3\u016f\u00f3\u0165\u00e9 ]]","code_title":"[[ \u010c\u00f3\u010f\u00e9 \u0160\u00e1\u0271\u01bf\u0142\u00e9 ]]","code_text":"[[ \u00e9\u0273\u0165\u00e9\u0159 \u010d\u00f3\u010f\u00e9 \u0125\u00e9\u0159\u00e9 ]]","image_title":"[[ \u00cd\u0271\u00e1\u01e7\u00e9 ]]","image_description":"[[ \u00e9\u0273\u0165\u00e9\u0159 \u00ed\u0271\u00e1\u01e7\u00e9 \u010f\u00e9\u0161\u010d\u0159\u00ed\u01bf\u0165\u00ed\u00f3\u0273 \u0125\u00e9\u0159\u00e9 ]]","image_dialog_title":"[[ \u00cd\u0273\u0161\u00e9\u0159\u0165 \u00cd\u0271\u00e1\u01e7\u00e9 ]]","image_optional_text":"[[ \u00f3\u01bf\u0165\u00ed\u00f3\u0273\u00e1\u0142 \u0165\u00ed\u0165\u0142\u00e9 ]]","image_hosting_hint":"[[ \u040d\u00e9\u00e9\u010f <\u00e1 \u0125\u0159\u00e9\u0192='\u0125\u0165\u0165\u01bf://\u0175\u0175\u0175.\u01e7\u00f3\u00f3\u01e7\u0142\u00e9.\u010d\u00f3\u0271/\u0161\u00e9\u00e1\u0159\u010d\u0125?\u01a3=\u0192\u0159\u00e9\u00e9+\u00ed\u0271\u00e1\u01e7\u00e9+\u0125\u00f3\u0161\u0165\u00ed\u0273\u01e7' \u0165\u00e1\u0159\u01e7\u00e9\u0165='_\u0180\u0142\u00e1\u0273\u01e9'>\u0192\u0159\u00e9\u00e9 \u00ed\u0271\u00e1\u01e7\u00e9 \u0125\u00f3\u0161\u0165\u00ed\u0273\u01e7?</\u00e1> ]]","olist_title":"[[ \u040d\u016f\u0271\u0180\u00e9\u0159\u00e9\u010f \u0141\u00ed\u0161\u0165 ]]","ulist_title":"[[ \u0181\u016f\u0142\u0142\u00e9\u0165\u00e9\u010f \u0141\u00ed\u0161\u0165 ]]","list_item":"[[ \u0141\u00ed\u0161\u0165 \u00ed\u0165\u00e9\u0271 ]]","heading_title":"[[ \u0124\u00e9\u00e1\u010f\u00ed\u0273\u01e7 ]]","heading_text":"[[ \u0124\u00e9\u00e1\u010f\u00ed\u0273\u01e7 ]]","hr_title":"[[ \u0124\u00f3\u0159\u00ed\u017e\u00f3\u0273\u0165\u00e1\u0142 \u0158\u016f\u0142\u00e9 ]]","undo_title":"[[ \u016e\u0273\u010f\u00f3 ]]","redo_title":"[[ \u0158\u00e9\u010f\u00f3 ]]","help":"[[ \u03fa\u00e1\u0159\u01e9\u010f\u00f3\u0175\u0273 \u00c9\u010f\u00ed\u0165\u00ed\u0273\u01e7 \u0124\u00e9\u0142\u01bf ]]","toggler":"[[ \u0125\u00ed\u010f\u00e9 \u00f3\u0159 \u0161\u0125\u00f3\u0175 \u0165\u0125\u00e9 \u010d\u00f3\u0271\u01bf\u00f3\u0161\u00e9\u0159 \u01bf\u00e1\u0273\u00e9\u0142 ]]"},"notifications":{"title":"[[ \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u00f3\u0192 @\u0273\u00e1\u0271\u00e9 \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u0161, \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u0161 \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165\u0161 \u00e1\u0273\u010f \u0165\u00f3\u01bf\u00ed\u010d\u0161, \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9\u0161, \u00e9\u0165\u010d ]]","none":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9 \u0273\u00f3 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0159\u00ed\u01e7\u0125\u0165 \u0273\u00f3\u0175. ]]","more":"[[ \u03bd\u00ed\u00e9\u0175 \u00f3\u0142\u010f\u00e9\u0159 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 ]]","mentioned":"[[ <\u0161\u01bf\u00e1\u0273 \u0165\u00ed\u0165\u0142\u00e9='\u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u00e9\u010f' \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273'>@</\u0161\u01bf\u00e1\u0273> {{username}} {{link}} ]]","quoted":"[[ <\u00ed \u0165\u00ed\u0165\u0142\u00e9='\u01a3\u016f\u00f3\u0165\u00e9\u010f' \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u01a3\u016f\u00f3\u0165\u00e9-\u0159\u00ed\u01e7\u0125\u0165'></\u00ed> {{username}} {{link}} ]]","replied":"[[ <\u00ed \u0165\u00ed\u0165\u0142\u00e9='\u0159\u00e9\u01bf\u0142\u00ed\u00e9\u010f' \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u0159\u00e9\u01bf\u0142\u00fd'></\u00ed> {{username}} {{link}} ]]","posted":"[[ <\u00ed \u0165\u00ed\u0165\u0142\u00e9='\u0159\u00e9\u01bf\u0142\u00ed\u00e9\u010f' \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u0159\u00e9\u01bf\u0142\u00fd'></\u00ed> {{username}} {{link}} ]]","edited":"[[ <\u00ed \u0165\u00ed\u0165\u0142\u00e9='\u00e9\u010f\u00ed\u0165\u00e9\u010f' \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u01bf\u00e9\u0273\u010d\u00ed\u0142'></\u00ed> {{username}} {{link}} ]]","liked":"[[ <\u00ed \u0165\u00ed\u0165\u0142\u00e9='\u0142\u00ed\u01e9\u00e9\u010f' \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u0125\u00e9\u00e1\u0159\u0165'></\u00ed> {{username}} {{link}} ]]","private_message":"[[ <\u00ed \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u00e9\u0273\u03bd\u00e9\u0142\u00f3\u01bf\u00e9-\u00e1\u0142\u0165' \u0165\u00ed\u0165\u0142\u00e9='\u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9'></\u00ed> {{username}} {{link}} ]]","invited_to_private_message":"[[ <\u00ed \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u00e9\u0273\u03bd\u00e9\u0142\u00f3\u01bf\u00e9-\u00e1\u0142\u0165' \u0165\u00ed\u0165\u0142\u00e9='\u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9'></\u00ed> {{username}} {{link}} ]]","invitee_accepted":"[[ <\u00ed \u0165\u00ed\u0165\u0142\u00e9='\u00e1\u010d\u010d\u00e9\u01bf\u0165\u00e9\u010f \u00fd\u00f3\u016f\u0159 \u00ed\u0273\u03bd\u00ed\u0165\u00e1\u0165\u00ed\u00f3\u0273' \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u0161\u00ed\u01e7\u0273\u00ed\u0273'></\u00ed> {{username}} \u00e1\u010d\u010d\u00e9\u01bf\u0165\u00e9\u010f \u00fd\u00f3\u016f\u0159 \u00ed\u0273\u03bd\u00ed\u0165\u00e1\u0165\u00ed\u00f3\u0273 ]]","moved_post":"[[ <\u00ed \u0165\u00ed\u0165\u0142\u00e9='\u0271\u00f3\u03bd\u00e9\u010f \u01bf\u00f3\u0161\u0165' \u010d\u0142\u00e1\u0161\u0161='\u00ed\u010d\u00f3\u0273 \u00ed\u010d\u00f3\u0273-\u00e1\u0159\u0159\u00f3\u0175-\u0159\u00ed\u01e7\u0125\u0165'></\u00ed> {{username}} \u0271\u00f3\u03bd\u00e9\u010f \u0165\u00f3 {{link}} ]]","total_flagged":"[[ \u0165\u00f3\u0165\u00e1\u0142 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u01bf\u00f3\u0161\u0165\u0161 ]]"},"image_selector":{"title":"[[ \u00cd\u0273\u0161\u00e9\u0159\u0165 \u00cd\u0271\u00e1\u01e7\u00e9 ]]","from_my_computer":"[[ \u0191\u0159\u00f3\u0271 \u03fa\u00fd \u010e\u00e9\u03bd\u00ed\u010d\u00e9 ]]","from_the_web":"[[ \u0191\u0159\u00f3\u0271 \u0164\u0125\u00e9 \u0174\u00e9\u0180 ]]","add_image":"[[ \u00c1\u010f\u010f \u00cd\u0271\u00e1\u01e7\u00e9 ]]","remote_title":"[[ \u0159\u00e9\u0271\u00f3\u0165\u00e9 \u00ed\u0271\u00e1\u01e7\u00e9 ]]","remote_tip":"[[ \u00e9\u0273\u0165\u00e9\u0159 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161 \u00f3\u0192 \u00e1\u0273 \u00ed\u0271\u00e1\u01e7\u00e9 \u00ed\u0273 \u0165\u0125\u00e9 \u0192\u00f3\u0159\u0271 \u0125\u0165\u0165\u01bf://\u00e9\u0445\u00e1\u0271\u01bf\u0142\u00e9.\u010d\u00f3\u0271/\u00ed\u0271\u00e1\u01e7\u00e9.\u02b2\u01bf\u01e7 ]]","local_title":"[[ \u0142\u00f3\u010d\u00e1\u0142 \u00ed\u0271\u00e1\u01e7\u00e9 ]]","local_tip":"[[ \u010d\u0142\u00ed\u010d\u01e9 \u0165\u00f3 \u0161\u00e9\u0142\u00e9\u010d\u0165 \u00e1\u0273 \u00ed\u0271\u00e1\u01e7\u00e9 \u0192\u0159\u00f3\u0271 \u00fd\u00f3\u016f\u0159 \u010f\u00e9\u03bd\u00ed\u010d\u00e9. ]]","upload":"[[ \u016e\u01bf\u0142\u00f3\u00e1\u010f ]]","uploading_image":"[[ \u016e\u01bf\u0142\u00f3\u00e1\u010f\u00ed\u0273\u01e7 \u00ed\u0271\u00e1\u01e7\u00e9 ]]"},"search":{"title":"[[ \u0161\u00e9\u00e1\u0159\u010d\u0125 \u0192\u00f3\u0159 \u0165\u00f3\u01bf\u00ed\u010d\u0161, \u01bf\u00f3\u0161\u0165\u0161, \u016f\u0161\u00e9\u0159\u0161, \u00f3\u0159 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00ed\u00e9\u0161 ]]","placeholder":"[[ \u0165\u00fd\u01bf\u00e9 \u00fd\u00f3\u016f\u0159 \u0161\u00e9\u00e1\u0159\u010d\u0125 \u0165\u00e9\u0159\u0271\u0161 \u0125\u00e9\u0159\u00e9 ]]","no_results":"[[ \u040d\u00f3 \u0159\u00e9\u0161\u016f\u0142\u0165\u0161 \u0192\u00f3\u016f\u0273\u010f. ]]","searching":"[[ \u0160\u00e9\u00e1\u0159\u010d\u0125\u00ed\u0273\u01e7 ... ]]"},"site_map":"[[ \u01e7\u00f3 \u0165\u00f3 \u00e1\u0273\u00f3\u0165\u0125\u00e9\u0159 \u0165\u00f3\u01bf\u00ed\u010d \u0142\u00ed\u0161\u0165 \u00f3\u0159 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]","go_back":"[[ \u01e7\u00f3 \u0180\u00e1\u010d\u01e9 ]]","current_user":"[[ \u01e7\u00f3 \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159 \u01bf\u00e1\u01e7\u00e9 ]]","favorite":{"title":"[[ \u0191\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9 ]]","help":{"star":"[[ \u00e1\u010f\u010f \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u0192\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9\u0161 \u0142\u00ed\u0161\u0165 ]]","unstar":"[[ \u0159\u00e9\u0271\u00f3\u03bd\u00e9 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u0192\u0159\u00f3\u0271 \u00fd\u00f3\u016f\u0159 \u0192\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9\u0161 \u0142\u00ed\u0161\u0165 ]]"}},"topics":{"none":{"favorited":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9\u0273'\u0165 \u0192\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9\u010f \u00e1\u0273\u00fd \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00fd\u00e9\u0165. \u0164\u00f3 \u0192\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9 \u00e1 \u0165\u00f3\u01bf\u00ed\u010d, \u010d\u0142\u00ed\u010d\u01e9 \u00f3\u0159 \u0165\u00e1\u01bf \u0165\u0125\u00e9 \u0161\u0165\u00e1\u0159 \u0273\u00e9\u0445\u0165 \u0165\u00f3 \u0165\u0125\u00e9 \u0165\u00ed\u0165\u0142\u00e9. ]]","unread":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9 \u0273\u00f3 \u016f\u0273\u0159\u00e9\u00e1\u010f \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","new":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9 \u0273\u00f3 \u0273\u00e9\u0175 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","read":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9\u0273'\u0165 \u0159\u00e9\u00e1\u010f \u00e1\u0273\u00fd \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00fd\u00e9\u0165. ]]","posted":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9\u0273'\u0165 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 \u00e1\u0273\u00fd \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00fd\u00e9\u0165. ]]","latest":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0142\u00e1\u0165\u00e9\u0161\u0165 \u0165\u00f3\u01bf\u00ed\u010d\u0161. \u0164\u0125\u00e1\u0165'\u0161 \u0161\u00e1\u010f. ]]","hot":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0125\u00f3\u0165 \u0165\u00f3\u01bf\u00ed\u010d\u0161. ]]","category":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 {{category}} \u0165\u00f3\u01bf\u00ed\u010d\u0161. ]]"},"bottom":{"latest":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0271\u00f3\u0159\u00e9 \u0142\u00e1\u0165\u00e9\u0161\u0165 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","hot":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0271\u00f3\u0159\u00e9 \u0125\u00f3\u0165 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","posted":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0271\u00f3\u0159\u00e9 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","read":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0271\u00f3\u0159\u00e9 \u0159\u00e9\u00e1\u010f \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","new":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0271\u00f3\u0159\u00e9 \u0273\u00e9\u0175 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","unread":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0271\u00f3\u0159\u00e9 \u016f\u0273\u0159\u00e9\u00e1\u010f \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","favorited":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0271\u00f3\u0159\u00e9 \u0192\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9\u010f \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0165\u00f3 \u0159\u00e9\u00e1\u010f. ]]","category":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u0273\u00f3 \u0271\u00f3\u0159\u00e9 {{category}} \u0165\u00f3\u01bf\u00ed\u010d\u0161. ]]"}},"rank_details":{"toggle":"[[ \u0165\u00f3\u01e7\u01e7\u0142\u00e9 \u0165\u00f3\u01bf\u00ed\u010d \u0159\u00e1\u0273\u01e9 \u010f\u00e9\u0165\u00e1\u00ed\u0142\u0161 ]]","show":"[[ \u0161\u0125\u00f3\u0175 \u0165\u00f3\u01bf\u00ed\u010d \u0159\u00e1\u0273\u01e9 \u010f\u00e9\u0165\u00e1\u00ed\u0142\u0161 ]]","title":"[[ \u0164\u00f3\u01bf\u00ed\u010d \u0158\u00e1\u0273\u01e9 \u010e\u00e9\u0165\u00e1\u00ed\u0142\u0161 ]]"},"topic":{"create_in":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9 {{categoryName}} \u0164\u00f3\u01bf\u00ed\u010d ]]","create":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9 \u0164\u00f3\u01bf\u00ed\u010d ]]","create_long":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9 \u00e1 \u0273\u00e9\u0175 \u0164\u00f3\u01bf\u00ed\u010d ]]","private_message":"[[ \u0160\u0165\u00e1\u0159\u0165 \u00e1 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 ]]","list":"[[ \u0164\u00f3\u01bf\u00ed\u010d\u0161 ]]","new":"[[ \u0273\u00e9\u0175 \u0165\u00f3\u01bf\u00ed\u010d ]]","title":"[[ \u0164\u00f3\u01bf\u00ed\u010d ]]","loading_more":"[[ \u0141\u00f3\u00e1\u010f\u00ed\u0273\u01e7 \u0271\u00f3\u0159\u00e9 \u0164\u00f3\u01bf\u00ed\u010d\u0161... ]]","loading":"[[ \u0141\u00f3\u00e1\u010f\u00ed\u0273\u01e7 \u0165\u00f3\u01bf\u00ed\u010d... ]]","invalid_access":{"title":"[[ \u0164\u00f3\u01bf\u00ed\u010d \u00ed\u0161 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 ]]","description":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u00fd\u00f3\u016f \u010f\u00f3\u0273'\u0165 \u0125\u00e1\u03bd\u00e9 \u00e1\u010d\u010d\u00e9\u0161\u0161 \u0165\u00f3 \u0165\u0125\u00e1\u0165 \u0165\u00f3\u01bf\u00ed\u010d! ]]"},"server_error":{"title":"[[ \u0164\u00f3\u01bf\u00ed\u010d \u0192\u00e1\u00ed\u0142\u00e9\u010f \u0165\u00f3 \u0142\u00f3\u00e1\u010f ]]","description":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0175\u00e9 \u010d\u00f3\u016f\u0142\u010f\u0273'\u0165 \u0142\u00f3\u00e1\u010f \u0165\u0125\u00e1\u0165 \u0165\u00f3\u01bf\u00ed\u010d, \u01bf\u00f3\u0161\u0161\u00ed\u0180\u0142\u00fd \u010f\u016f\u00e9 \u0165\u00f3 \u00e1 \u010d\u00f3\u0273\u0273\u00e9\u010d\u0165\u00ed\u00f3\u0273 \u01bf\u0159\u00f3\u0180\u0142\u00e9\u0271. \u0420\u0142\u00e9\u00e1\u0161\u00e9 \u0165\u0159\u00fd \u00e1\u01e7\u00e1\u00ed\u0273. \u00cd\u0192 \u0165\u0125\u00e9 \u01bf\u0159\u00f3\u0180\u0142\u00e9\u0271 \u01bf\u00e9\u0159\u0161\u00ed\u0161\u0165\u0161, \u0142\u00e9\u0165 \u016f\u0161 \u01e9\u0273\u00f3\u0175. ]]"},"not_found":{"title":"[[ \u0164\u00f3\u01bf\u00ed\u010d \u0273\u00f3\u0165 \u0192\u00f3\u016f\u0273\u010f ]]","description":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0175\u00e9 \u010d\u00f3\u016f\u0142\u010f\u0273'\u0165 \u0192\u00ed\u0273\u010f \u0165\u0125\u00e1\u0165 \u0165\u00f3\u01bf\u00ed\u010d. \u0420\u00e9\u0159\u0125\u00e1\u01bf\u0161 \u00ed\u0165 \u0175\u00e1\u0161 \u0159\u00e9\u0271\u00f3\u03bd\u00e9\u010f \u0180\u00fd \u00e1 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159? ]]"},"unread_posts":"[[ \u00fd\u00f3\u016f \u0125\u00e1\u03bd\u00e9 {{unread}} \u016f\u0273\u0159\u00e9\u00e1\u010f \u00f3\u0142\u010f \u01bf\u00f3\u0161\u0165\u0161 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]","new_posts":"[[ \u0165\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 {{new_posts}} \u0273\u00e9\u0175 \u01bf\u00f3\u0161\u0165\u0161 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u0161\u00ed\u0273\u010d\u00e9 \u00fd\u00f3\u016f \u0142\u00e1\u0161\u0165 \u0159\u00e9\u00e1\u010f \u00ed\u0165 ]]","likes":{"one":"[[ \u0165\u0125\u00e9\u0159\u00e9 \u00ed\u0161 1 \u0142\u00ed\u01e9\u00e9 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]","other":"[[ \u0165\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 {{count}} \u0142\u00ed\u01e9\u00e9\u0161 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]"},"back_to_list":"[[ \u0181\u00e1\u010d\u01e9 \u0165\u00f3 \u0164\u00f3\u01bf\u00ed\u010d \u0141\u00ed\u0161\u0165 ]]","options":"[[ \u0164\u00f3\u01bf\u00ed\u010d \u00d3\u01bf\u0165\u00ed\u00f3\u0273\u0161 ]]","show_links":"[[ \u0161\u0125\u00f3\u0175 \u0142\u00ed\u0273\u01e9\u0161 \u0175\u00ed\u0165\u0125\u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]","toggle_information":"[[ \u0165\u00f3\u01e7\u01e7\u0142\u00e9 \u0165\u00f3\u01bf\u00ed\u010d \u010f\u00e9\u0165\u00e1\u00ed\u0142\u0161 ]]","read_more_in_category":"[[ \u0174\u00e1\u0273\u0165 \u0165\u00f3 \u0159\u00e9\u00e1\u010f \u0271\u00f3\u0159\u00e9? \u0181\u0159\u00f3\u0175\u0161\u00e9 \u00f3\u0165\u0125\u00e9\u0159 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00ed\u0273 {{catLink}} \u00f3\u0159 {{latestLink}}. ]]","read_more":"[[ \u0174\u00e1\u0273\u0165 \u0165\u00f3 \u0159\u00e9\u00e1\u010f \u0271\u00f3\u0159\u00e9? {{catLink}} \u00f3\u0159 {{latestLink}}. ]]","browse_all_categories":"[[ \u0181\u0159\u00f3\u0175\u0161\u00e9 \u00e1\u0142\u0142 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00ed\u00e9\u0161 ]]","view_latest_topics":"[[ \u03bd\u00ed\u00e9\u0175 \u0142\u00e1\u0165\u00e9\u0161\u0165 \u0165\u00f3\u01bf\u00ed\u010d\u0161 ]]","suggest_create_topic":"[[ \u0174\u0125\u00fd \u0273\u00f3\u0165 \u010d\u0159\u00e9\u00e1\u0165\u00e9 \u00e1 \u0165\u00f3\u01bf\u00ed\u010d? ]]","read_position_reset":"[[ \u00dd\u00f3\u016f\u0159 \u0159\u00e9\u00e1\u010f \u01bf\u00f3\u0161\u00ed\u0165\u00ed\u00f3\u0273 \u0125\u00e1\u0161 \u0180\u00e9\u00e9\u0273 \u0159\u00e9\u0161\u00e9\u0165. ]]","jump_reply_up":"[[ \u02b2\u016f\u0271\u01bf \u0165\u00f3 \u00e9\u00e1\u0159\u0142\u00ed\u00e9\u0159 \u0159\u00e9\u01bf\u0142\u00fd ]]","jump_reply_down":"[[ \u02b2\u016f\u0271\u01bf \u0165\u00f3 \u0142\u00e1\u0165\u00e9\u0159 \u0159\u00e9\u01bf\u0142\u00fd ]]","deleted":"[[ \u0164\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d \u0125\u00e1\u0161 \u0180\u00e9\u00e9\u0273 \u010f\u00e9\u0142\u00e9\u0165\u00e9\u010f ]]","progress":{"title":"[[ \u0165\u00f3\u01bf\u00ed\u010d \u01bf\u0159\u00f3\u01e7\u0159\u00e9\u0161\u0161 ]]","jump_top":"[[ \u02b2\u016f\u0271\u01bf \u0165\u00f3 \u0192\u00ed\u0159\u0161\u0165 \u01bf\u00f3\u0161\u0165 ]]","jump_bottom":"[[ \u02b2\u016f\u0271\u01bf \u0165\u00f3 \u0142\u00e1\u0161\u0165 \u01bf\u00f3\u0161\u0165 ]]","total":"[[ \u0165\u00f3\u0165\u00e1\u0142 \u01bf\u00f3\u0161\u0165\u0161 ]]","current":"[[ \u010d\u016f\u0159\u0159\u00e9\u0273\u0165 \u01bf\u00f3\u0161\u0165 ]]"},"notifications":{"title":"[[  ]]","reasons":{"3_2":"[[ \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0159\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0180\u00e9\u010d\u00e1\u016f\u0161\u00e9 \u00fd\u00f3\u016f \u00e1\u0159\u00e9 \u0175\u00e1\u0165\u010d\u0125\u00ed\u0273\u01e7 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. ]]","3_1":"[[ \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0159\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0180\u00e9\u010d\u00e1\u016f\u0161\u00e9 \u00fd\u00f3\u016f \u010d\u0159\u00e9\u00e1\u0165\u00e9\u010f \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. ]]","3":"[[ \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0159\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0180\u00e9\u010d\u00e1\u016f\u0161\u00e9 \u00fd\u00f3\u016f \u00e1\u0159\u00e9 \u0175\u00e1\u0165\u010d\u0125\u00ed\u0273\u01e7 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. ]]","2_4":"[[ \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0159\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0180\u00e9\u010d\u00e1\u016f\u0161\u00e9 \u00fd\u00f3\u016f \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00e1 \u0159\u00e9\u01bf\u0142\u00fd \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. ]]","2_2":"[[ \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0159\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0180\u00e9\u010d\u00e1\u016f\u0161\u00e9 \u00fd\u00f3\u016f \u00e1\u0159\u00e9 \u0165\u0159\u00e1\u010d\u01e9\u00ed\u0273\u01e7 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. ]]","2":"[[ \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0159\u00e9\u010d\u00e9\u00ed\u03bd\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0180\u00e9\u010d\u00e1\u016f\u0161\u00e9 \u00fd\u00f3\u016f <\u00e1 \u0125\u0159\u00e9\u0192=\"/\u016f\u0161\u00e9\u0159\u0161/{{username}}/\u01bf\u0159\u00e9\u0192\u00e9\u0159\u00e9\u0273\u010d\u00e9\u0161\">\u0159\u00e9\u00e1\u010f \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d</\u00e1>. ]]","1":"[[ \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0180\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u00e9\u010f \u00f3\u0273\u0142\u00fd \u00ed\u0192 \u0161\u00f3\u0271\u00e9\u00f3\u0273\u00e9 \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u0161 \u00fd\u00f3\u016f\u0159 @\u0273\u00e1\u0271\u00e9 \u00f3\u0159 \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u0161 \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165. ]]","1_2":"[[ \u00dd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0180\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u00e9\u010f \u00f3\u0273\u0142\u00fd \u00ed\u0192 \u0161\u00f3\u0271\u00e9\u00f3\u0273\u00e9 \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u0161 \u00fd\u00f3\u016f\u0159 @\u0273\u00e1\u0271\u00e9 \u00f3\u0159 \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u0161 \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165. ]]","0":"[[ \u00dd\u00f3\u016f \u00e1\u0159\u00e9 \u00ed\u01e7\u0273\u00f3\u0159\u00ed\u0273\u01e7 \u00e1\u0142\u0142 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u00f3\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. ]]","0_2":"[[ \u00dd\u00f3\u016f \u00e1\u0159\u00e9 \u00ed\u01e7\u0273\u00f3\u0159\u00ed\u0273\u01e7 \u00e1\u0142\u0142 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u00f3\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d. ]]"},"watching":{"title":"[[ \u0174\u00e1\u0165\u010d\u0125\u00ed\u0273\u01e7 ]]","description":"[[ \u0161\u00e1\u0271\u00e9 \u00e1\u0161 \u0164\u0159\u00e1\u010d\u01e9\u00ed\u0273\u01e7, \u01bf\u0142\u016f\u0161 \u00fd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0180\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u00e9\u010f \u00f3\u0192 \u00e1\u0142\u0142 \u0273\u00e9\u0175 \u01bf\u00f3\u0161\u0165\u0161. ]]"},"tracking":{"title":"[[ \u0164\u0159\u00e1\u010d\u01e9\u00ed\u0273\u01e7 ]]","description":"[[ \u00fd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0180\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u00e9\u010f \u00f3\u0192 @\u0273\u00e1\u0271\u00e9 \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u0161 \u00e1\u0273\u010f \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u0161 \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165\u0161, \u01bf\u0142\u016f\u0161 \u00fd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0161\u00e9\u00e9 \u00e1 \u010d\u00f3\u016f\u0273\u0165 \u00f3\u0192 \u016f\u0273\u0159\u00e9\u00e1\u010f \u00e1\u0273\u010f \u0273\u00e9\u0175 \u01bf\u00f3\u0161\u0165\u0161. ]]"},"regular":{"title":"[[ \u0158\u00e9\u01e7\u016f\u0142\u00e1\u0159 ]]","description":"[[ \u00fd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0180\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u00e9\u010f \u00f3\u0273\u0142\u00fd \u00ed\u0192 \u0161\u00f3\u0271\u00e9\u00f3\u0273\u00e9 \u0271\u00e9\u0273\u0165\u00ed\u00f3\u0273\u0161 \u00fd\u00f3\u016f\u0159 @\u0273\u00e1\u0271\u00e9 \u00f3\u0159 \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u0161 \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165. ]]"},"muted":{"title":"[[ \u03fa\u016f\u0165\u00e9\u010f ]]","description":"[[ \u00fd\u00f3\u016f \u0175\u00ed\u0142\u0142 \u0273\u00f3\u0165 \u0180\u00e9 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u00e9\u010f \u00f3\u0192 \u00e1\u0273\u00fd\u0165\u0125\u00ed\u0273\u01e7 \u00e1\u0180\u00f3\u016f\u0165 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d, \u00e1\u0273\u010f \u00ed\u0165 \u0175\u00ed\u0142\u0142 \u0273\u00f3\u0165 \u00e1\u01bf\u01bf\u00e9\u00e1\u0159 \u00f3\u0273 \u00fd\u00f3\u016f\u0159 \u016f\u0273\u0159\u00e9\u00e1\u010f \u0165\u00e1\u0180. ]]"}},"actions":{"delete":"[[ \u010e\u00e9\u0142\u00e9\u0165\u00e9 \u0164\u00f3\u01bf\u00ed\u010d ]]","open":"[[ \u00d3\u01bf\u00e9\u0273 \u0164\u00f3\u01bf\u00ed\u010d ]]","close":"[[ \u010c\u0142\u00f3\u0161\u00e9 \u0164\u00f3\u01bf\u00ed\u010d ]]","unpin":"[[ \u016e\u0273-\u0420\u00ed\u0273 \u0164\u00f3\u01bf\u00ed\u010d ]]","pin":"[[ \u0420\u00ed\u0273 \u0164\u00f3\u01bf\u00ed\u010d ]]","unarchive":"[[ \u016e\u0273\u00e1\u0159\u010d\u0125\u00ed\u03bd\u00e9 \u0164\u00f3\u01bf\u00ed\u010d ]]","archive":"[[ \u00c1\u0159\u010d\u0125\u00ed\u03bd\u00e9 \u0164\u00f3\u01bf\u00ed\u010d ]]","invisible":"[[ \u03fa\u00e1\u01e9\u00e9 \u00cd\u0273\u03bd\u00ed\u0161\u00ed\u0180\u0142\u00e9 ]]","visible":"[[ \u03fa\u00e1\u01e9\u00e9 \u0476\u00ed\u0161\u00ed\u0180\u0142\u00e9 ]]","reset_read":"[[ \u0158\u00e9\u0161\u00e9\u0165 \u0158\u00e9\u00e1\u010f \u010e\u00e1\u0165\u00e1 ]]","multi_select":"[[ \u0164\u00f3\u01e7\u01e7\u0142\u00e9 \u03fa\u016f\u0142\u0165\u00ed-\u0160\u00e9\u0142\u00e9\u010d\u0165 ]]","convert_to_topic":"[[ \u010c\u00f3\u0273\u03bd\u00e9\u0159\u0165 \u0165\u00f3 \u0158\u00e9\u01e7\u016f\u0142\u00e1\u0159 \u0164\u00f3\u01bf\u00ed\u010d ]]"},"reply":{"title":"[[ \u0158\u00e9\u01bf\u0142\u00fd ]]","help":"[[ \u0180\u00e9\u01e7\u00ed\u0273 \u010d\u00f3\u0271\u01bf\u00f3\u0161\u00ed\u0273\u01e7 \u00e1 \u0159\u00e9\u01bf\u0142\u00fd \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]"},"clear_pin":{"title":"[[ \u010c\u0142\u00e9\u00e1\u0159 \u01bf\u00ed\u0273 ]]","help":"[[ \u010c\u0142\u00e9\u00e1\u0159 \u0165\u0125\u00e9 \u01bf\u00ed\u0273\u0273\u00e9\u010f \u0161\u0165\u00e1\u0165\u016f\u0161 \u00f3\u0192 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u0161\u00f3 \u00ed\u0165 \u0273\u00f3 \u0142\u00f3\u0273\u01e7\u00e9\u0159 \u00e1\u01bf\u01bf\u00e9\u00e1\u0159\u0161 \u00e1\u0165 \u0165\u0125\u00e9 \u0165\u00f3\u01bf \u00f3\u0192 \u00fd\u00f3\u016f\u0159 \u0165\u00f3\u01bf\u00ed\u010d \u0142\u00ed\u0161\u0165 ]]"},"share":{"title":"[[ \u0160\u0125\u00e1\u0159\u00e9 ]]","help":"[[ \u0161\u0125\u00e1\u0159\u00e9 \u00e1 \u0142\u00ed\u0273\u01e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]"},"inviting":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00ed\u0273\u01e7... ]]","invite_private":{"title":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9 \u0165\u00f3 \u0420\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u03fa\u00e9\u0161\u0161\u00e1\u01e7\u00e9 ]]","email_or_username":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9\u00e9'\u0161 \u00c9\u0271\u00e1\u00ed\u0142 \u00f3\u0159 \u016e\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 ]]","email_or_username_placeholder":"[[ \u00e9\u0271\u00e1\u00ed\u0142 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161 \u00f3\u0159 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 ]]","action":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9 ]]","success":"[[ \u0164\u0125\u00e1\u0273\u01e9\u0161! \u0174\u00e9'\u03bd\u00e9 \u00ed\u0273\u03bd\u00ed\u0165\u00e9\u010f \u0165\u0125\u00e1\u0165 \u016f\u0161\u00e9\u0159 \u0165\u00f3 \u01bf\u00e1\u0159\u0165\u00ed\u010d\u00ed\u01bf\u00e1\u0165\u00e9 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9. ]]","error":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u00ed\u0273\u03bd\u00ed\u0165\u00ed\u0273\u01e7 \u0165\u0125\u00e1\u0165 \u016f\u0161\u00e9\u0159. ]]"},"invite_reply":{"title":"[[ \u00cd\u0273\u03bd\u00ed\u0165\u00e9 \u0191\u0159\u00ed\u00e9\u0273\u010f\u0161 \u0165\u00f3 \u0158\u00e9\u01bf\u0142\u00fd ]]","action":"[[ \u00c9\u0271\u00e1\u00ed\u0142 \u00cd\u0273\u03bd\u00ed\u0165\u00e9 ]]","help":"[[ \u0161\u00e9\u0273\u010f \u00ed\u0273\u03bd\u00ed\u0165\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0165\u00f3 \u0192\u0159\u00ed\u00e9\u0273\u010f\u0161 \u0161\u00f3 \u0165\u0125\u00e9\u00fd \u010d\u00e1\u0273 \u0159\u00e9\u01bf\u0142\u00fd \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u0175\u00ed\u0165\u0125 \u00e1 \u0161\u00ed\u0273\u01e7\u0142\u00e9 \u010d\u0142\u00ed\u010d\u01e9 ]]","email":"[[ \u0174\u00e9'\u0142\u0142 \u0161\u00e9\u0273\u010f \u00fd\u00f3\u016f\u0159 \u0192\u0159\u00ed\u00e9\u0273\u010f \u00e1 \u0180\u0159\u00ed\u00e9\u0192 \u00e9\u0271\u00e1\u00ed\u0142 \u00e1\u0142\u0142\u00f3\u0175\u00ed\u0273\u01e7 \u0165\u0125\u00e9\u0271 \u0165\u00f3 \u0159\u00e9\u01bf\u0142\u00fd \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u0180\u00fd \u010d\u0142\u00ed\u010d\u01e9\u00ed\u0273\u01e7 \u00e1 \u0142\u00ed\u0273\u01e9. ]]","email_placeholder":"[[ \u00e9\u0271\u00e1\u00ed\u0142 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161 ]]","success":"[[ \u0164\u0125\u00e1\u0273\u01e9\u0161! \u0174\u00e9 \u0271\u00e1\u00ed\u0142\u00e9\u010f \u00f3\u016f\u0165 \u00e1\u0273 \u00ed\u0273\u03bd\u00ed\u0165\u00e1\u0165\u00ed\u00f3\u0273 \u0165\u00f3 <\u0180>{{email}}</\u0180>. \u0174\u00e9'\u0142\u0142 \u0142\u00e9\u0165 \u00fd\u00f3\u016f \u01e9\u0273\u00f3\u0175 \u0175\u0125\u00e9\u0273 \u0165\u0125\u00e9\u00fd \u0159\u00e9\u010f\u00e9\u00e9\u0271 \u00fd\u00f3\u016f\u0159 \u00ed\u0273\u03bd\u00ed\u0165\u00e1\u0165\u00ed\u00f3\u0273. \u010c\u0125\u00e9\u010d\u01e9 \u0165\u0125\u00e9 \u00ed\u0273\u03bd\u00ed\u0165\u00e1\u0165\u00ed\u00f3\u0273\u0161 \u0165\u00e1\u0180 \u00f3\u0273 \u00fd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159 \u01bf\u00e1\u01e7\u00e9 \u0165\u00f3 \u01e9\u00e9\u00e9\u01bf \u0165\u0159\u00e1\u010d\u01e9 \u00f3\u0192 \u0175\u0125\u00f3 \u00fd\u00f3\u016f'\u03bd\u00e9 \u00ed\u0273\u03bd\u00ed\u0165\u00e9\u010f. ]]","error":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0175\u00e9 \u010d\u00f3\u016f\u0142\u010f\u0273'\u0165 \u00ed\u0273\u03bd\u00ed\u0165\u00e9 \u0165\u0125\u00e1\u0165 \u01bf\u00e9\u0159\u0161\u00f3\u0273. \u0420\u00e9\u0159\u0125\u00e1\u01bf\u0161 \u0165\u0125\u00e9\u00fd \u00e1\u0159\u00e9 \u00e1\u0142\u0159\u00e9\u00e1\u010f\u00fd \u00e1 \u016f\u0161\u00e9\u0159? ]]"},"login_reply":"[[ \u0141\u00f3\u01e7 \u00cd\u0273 \u0165\u00f3 \u0158\u00e9\u01bf\u0142\u00fd ]]","filters":{"user":"[[ \u00dd\u00f3\u016f'\u0159\u00e9 \u03bd\u00ed\u00e9\u0175\u00ed\u0273\u01e7 \u00f3\u0273\u0142\u00fd {{n_posts}} {{by_n_users}}. ]]","n_posts":{"one":"[[ 1 \u01bf\u00f3\u0161\u0165 ]]","other":"[[ {{count}} \u01bf\u00f3\u0161\u0165\u0161 ]]"},"by_n_users":{"one":"[[ \u0271\u00e1\u010f\u00e9 \u0180\u00fd 1 \u0161\u01bf\u00e9\u010d\u00ed\u0192\u00ed\u010d \u016f\u0161\u00e9\u0159 ]]","other":"[[ \u0271\u00e1\u010f\u00e9 \u0180\u00fd {{count}} \u0161\u01bf\u00e9\u010d\u00ed\u0192\u00ed\u010d \u016f\u0161\u00e9\u0159\u0161 ]]"},"best_of":"[[ \u00dd\u00f3\u016f'\u0159\u00e9 \u03bd\u00ed\u00e9\u0175\u00ed\u0273\u01e7 \u0165\u0125\u00e9 {{n_best_posts}} {{of_n_posts}}. ]]","n_best_posts":{"one":"[[ 1 \u0180\u00e9\u0161\u0165 \u01bf\u00f3\u0161\u0165 ]]","other":"[[ {{count}} \u0180\u00e9\u0161\u0165 \u01bf\u00f3\u0161\u0165\u0161 ]]"},"of_n_posts":{"one":"[[ \u00f3\u0192 1 \u00ed\u0273 \u0165\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d ]]","other":"[[ \u00f3\u0192 {{count}} \u00ed\u0273 \u0165\u0125\u00e9 \u0165\u00f3\u01bf\u00ed\u010d ]]"},"cancel":"[[ \u0160\u0125\u00f3\u0175 \u00e1\u0142\u0142 \u01bf\u00f3\u0161\u0165\u0161 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u00e1\u01e7\u00e1\u00ed\u0273. ]]"},"move_selected":{"title":"[[ \u03fa\u00f3\u03bd\u00e9 \u0160\u00e9\u0142\u00e9\u010d\u0165\u00e9\u010f \u0420\u00f3\u0161\u0165\u0161 ]]","topic_name":"[[ \u040d\u00e9\u0175 \u0164\u00f3\u01bf\u00ed\u010d \u040d\u00e1\u0271\u00e9: ]]","error":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u0271\u00f3\u03bd\u00ed\u0273\u01e7 \u0165\u0125\u00f3\u0161\u00e9 \u01bf\u00f3\u0161\u0165\u0161. ]]","instructions":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0159\u00e9 \u00e1\u0180\u00f3\u016f\u0165 \u0165\u00f3 \u010d\u0159\u00e9\u00e1\u0165\u00e9 \u00e1 \u0273\u00e9\u0175 \u0165\u00f3\u01bf\u00ed\u010d \u00e1\u0273\u010f \u01bf\u00f3\u01bf\u016f\u0142\u00e1\u0165\u00e9 \u00ed\u0165 \u0175\u00ed\u0165\u0125 \u0165\u0125\u00e9 \u01bf\u00f3\u0161\u0165 \u00fd\u00f3\u016f'\u03bd\u00e9 \u0161\u00e9\u0142\u00e9\u010d\u0165\u00e9\u010f. ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0159\u00e9 \u00e1\u0180\u00f3\u016f\u0165 \u0165\u00f3 \u010d\u0159\u00e9\u00e1\u0165\u00e9 \u00e1 \u0273\u00e9\u0175 \u0165\u00f3\u01bf\u00ed\u010d \u00e1\u0273\u010f \u01bf\u00f3\u01bf\u016f\u0142\u00e1\u0165\u00e9 \u00ed\u0165 \u0175\u00ed\u0165\u0125 \u0165\u0125\u00e9 <\u0180>{{count}}</\u0180> \u01bf\u00f3\u0161\u0165\u0161 \u00fd\u00f3\u016f'\u03bd\u00e9 \u0161\u00e9\u0142\u00e9\u010d\u0165\u00e9\u010f. ]]"}},"multi_select":{"select":"[[ \u0161\u00e9\u0142\u00e9\u010d\u0165 ]]","selected":"[[ \u0161\u00e9\u0142\u00e9\u010d\u0165\u00e9\u010f ({{count}}) ]]","delete":"[[ \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u0161\u00e9\u0142\u00e9\u010d\u0165\u00e9\u010f ]]","cancel":"[[ \u010d\u00e1\u0273\u010d\u00e9\u0142 \u0161\u00e9\u0142\u00e9\u010d\u0165\u00ed\u0273\u01e7 ]]","move":"[[ \u0271\u00f3\u03bd\u00e9 \u0161\u00e9\u0142\u00e9\u010d\u0165\u00e9\u010f ]]","description":{"one":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9 \u0161\u00e9\u0142\u00e9\u010d\u0165\u00e9\u010f <\u0180>1</\u0180> \u01bf\u00f3\u0161\u0165. ]]","other":"[[ \u00dd\u00f3\u016f \u0125\u00e1\u03bd\u00e9 \u0161\u00e9\u0142\u00e9\u010d\u0165\u00e9\u010f <\u0180>{{count}}</\u0180> \u01bf\u00f3\u0161\u0165\u0161. ]]"}}},"post":{"reply":"[[ \u0158\u00e9\u01bf\u0142\u00fd\u00ed\u0273\u01e7 \u0165\u00f3 {{link}} \u0180\u00fd {{replyAvatar}} {{username}} ]]","reply_topic":"[[ \u0158\u00e9\u01bf\u0142\u00fd \u0165\u00f3 {{link}} ]]","quote_reply":"[[ \u01a3\u016f\u00f3\u0165\u00e9 \u0159\u00e9\u01bf\u0142\u00fd ]]","edit":"[[ \u00c9\u010f\u00ed\u0165\u00ed\u0273\u01e7 {{link}} \u0180\u00fd {{replyAvatar}} {{username}} ]]","post_number":"[[ \u01bf\u00f3\u0161\u0165 {{number}} ]]","in_reply_to":"[[ \u00ed\u0273 \u0159\u00e9\u01bf\u0142\u00fd \u0165\u00f3 ]]","reply_as_new_topic":"[[ \u0158\u00e9\u01bf\u0142\u00fd \u00e1\u0161 \u0273\u00e9\u0175 \u0164\u00f3\u01bf\u00ed\u010d ]]","continue_discussion":"[[ \u010c\u00f3\u0273\u0165\u00ed\u0273\u016f\u00ed\u0273\u01e7 \u0165\u0125\u00e9 \u010f\u00ed\u0161\u010d\u016f\u0161\u0161\u00ed\u00f3\u0273 \u0192\u0159\u00f3\u0271 {{postLink}}: ]]","follow_quote":"[[ \u01e7\u00f3 \u0165\u00f3 \u0165\u0125\u00e9 \u01a3\u016f\u00f3\u0165\u00e9\u010f \u01bf\u00f3\u0161\u0165 ]]","deleted_by_author":"[[ (\u01bf\u00f3\u0161\u0165 \u0159\u00e9\u0271\u00f3\u03bd\u00e9\u010f \u0180\u00fd \u00e1\u016f\u0165\u0125\u00f3\u0159) ]]","expand_collapse":"[[ \u00e9\u0445\u01bf\u00e1\u0273\u010f/\u010d\u00f3\u0142\u0142\u00e1\u01bf\u0161\u00e9 ]]","has_replies":{"one":"[[ \u0158\u00e9\u01bf\u0142\u00fd ]]","other":"[[ \u0158\u00e9\u01bf\u0142\u00ed\u00e9\u0161 ]]"},"errors":{"create":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u010d\u0159\u00e9\u00e1\u0165\u00ed\u0273\u01e7 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165. \u0420\u0142\u00e9\u00e1\u0161\u00e9 \u0165\u0159\u00fd \u00e1\u01e7\u00e1\u00ed\u0273. ]]","edit":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u00e9\u010f\u00ed\u0165\u00ed\u0273\u01e7 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165. \u0420\u0142\u00e9\u00e1\u0161\u00e9 \u0165\u0159\u00fd \u00e1\u01e7\u00e1\u00ed\u0273. ]]","upload":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u016f\u01bf\u0142\u00f3\u00e1\u010f\u00ed\u0273\u01e7 \u0165\u0125\u00e1\u0165 \u0192\u00ed\u0142\u00e9. \u0420\u0142\u00e9\u00e1\u0161\u00e9 \u0165\u0159\u00fd \u00e1\u01e7\u00e1\u00ed\u0273. ]]","upload_too_large":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e9 \u0192\u00ed\u0142\u00e9 \u00fd\u00f3\u016f \u00e1\u0159\u00e9 \u0165\u0159\u00fd\u00ed\u0273\u01e7 \u0165\u00f3 \u016f\u01bf\u0142\u00f3\u00e1\u010f \u00ed\u0161 \u0165\u00f3\u00f3 \u0180\u00ed\u01e7 (\u0271\u00e1\u0445\u00ed\u0271\u016f\u0271 \u0161\u00ed\u017e\u00e9 \u00ed\u0161 {{max_size_kb}}\u01e9\u0180), \u01bf\u0142\u00e9\u00e1\u0161\u00e9 \u0159\u00e9\u0161\u00ed\u017e\u00e9 \u00ed\u0165 \u00e1\u0273\u010f \u0165\u0159\u00fd \u00e1\u01e7\u00e1\u00ed\u0273. ]]","upload_too_many_images":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u00fd\u00f3\u016f \u010d\u00e1\u0273 \u00f3\u0273\u0142\u00fd \u016f\u01bf\u0142\u00f3\u00e1\u010f \u00f3\u0273\u00e9 \u00ed\u0271\u00e1\u01e7\u00e9 \u00e1\u0165 \u00e1 \u0165\u00ed\u0271\u00e9. ]]","only_images_are_supported":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u00fd\u00f3\u016f \u010d\u00e1\u0273 \u00f3\u0273\u0142\u00fd \u016f\u01bf\u0142\u00f3\u00e1\u010f \u00ed\u0271\u00e1\u01e7\u00e9\u0161. ]]"},"abandon":"[[ \u00c1\u0159\u00e9 \u00fd\u00f3\u016f \u0161\u016f\u0159\u00e9 \u00fd\u00f3\u016f \u0175\u00e1\u0273\u0165 \u0165\u00f3 \u00e1\u0180\u00e1\u0273\u010f\u00f3\u0273 \u00fd\u00f3\u016f\u0159 \u01bf\u00f3\u0161\u0165? ]]","archetypes":{"save":"[[ \u0160\u00e1\u03bd\u00e9 \u00d3\u01bf\u0165\u00ed\u00f3\u0273\u0161 ]]"},"controls":{"reply":"[[ \u0180\u00e9\u01e7\u00ed\u0273 \u010d\u00f3\u0271\u01bf\u00f3\u0161\u00ed\u0273\u01e7 \u00e1 \u0159\u00e9\u01bf\u0142\u00fd \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","like":"[[ \u0142\u00ed\u01e9\u00e9 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","edit":"[[ \u00e9\u010f\u00ed\u0165 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","flag":"[[ \u0192\u0142\u00e1\u01e7 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 \u0192\u00f3\u0159 \u00e1\u0165\u0165\u00e9\u0273\u0165\u00ed\u00f3\u0273 \u00f3\u0159 \u0161\u00e9\u0273\u010f \u00e1 \u0273\u00f3\u0165\u00ed\u0192\u00ed\u010d\u00e1\u0165\u00ed\u00f3\u0273 \u00e1\u0180\u00f3\u016f\u0165 \u00ed\u0165 ]]","delete":"[[ \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","undelete":"[[ \u016f\u0273\u010f\u00e9\u0142\u00e9\u0165\u00e9 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","share":"[[ \u0161\u0125\u00e1\u0159\u00e9 \u00e1 \u0142\u00ed\u0273\u01e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","bookmark":"[[ \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 \u0165\u00f3 \u00fd\u00f3\u016f\u0159 \u016f\u0161\u00e9\u0159 \u01bf\u00e1\u01e7\u00e9 ]]","more":"[[ \u03fa\u00f3\u0159\u00e9 ]]"},"actions":{"flag":"[[ \u0191\u0142\u00e1\u01e7 ]]","clear_flags":{"one":"[[ \u010c\u0142\u00e9\u00e1\u0159 \u0192\u0142\u00e1\u01e7 ]]","other":"[[ \u010c\u0142\u00e9\u00e1\u0159 \u0192\u0142\u00e1\u01e7\u0161 ]]"},"it_too":{"off_topic":"[[ \u0191\u0142\u00e1\u01e7 \u00ed\u0165 \u0165\u00f3\u00f3 ]]","spam":"[[ \u0191\u0142\u00e1\u01e7 \u00ed\u0165 \u0165\u00f3\u00f3 ]]","inappropriate":"[[ \u0191\u0142\u00e1\u01e7 \u00ed\u0165 \u0165\u00f3\u00f3 ]]","custom_flag":"[[ \u0191\u0142\u00e1\u01e7 \u00ed\u0165 \u0165\u00f3\u00f3 ]]","bookmark":"[[ \u0181\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9 \u00ed\u0165 \u0165\u00f3\u00f3 ]]","like":"[[ \u0141\u00ed\u01e9\u00e9 \u00ed\u0165 \u0165\u00f3\u00f3 ]]","vote":"[[ \u0476\u00f3\u0165\u00e9 \u0192\u00f3\u0159 \u00ed\u0165 \u0165\u00f3\u00f3 ]]"},"undo":{"off_topic":"[[ \u016e\u0273\u010f\u00f3 \u0192\u0142\u00e1\u01e7 ]]","spam":"[[ \u016e\u0273\u010f\u00f3 \u0192\u0142\u00e1\u01e7 ]]","inappropriate":"[[ \u016e\u0273\u010f\u00f3 \u0192\u0142\u00e1\u01e7 ]]","bookmark":"[[ \u016e\u0273\u010f\u00f3 \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9 ]]","like":"[[ \u016e\u0273\u010f\u00f3 \u0142\u00ed\u01e9\u00e9 ]]","vote":"[[ \u016e\u0273\u010f\u00f3 \u03bd\u00f3\u0165\u00e9 ]]"},"people":{"off_topic":"[[ {{icons}} \u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00f3\u0192\u0192-\u0165\u00f3\u01bf\u00ed\u010d ]]","spam":"[[ {{icons}} \u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u0161\u01bf\u00e1\u0271 ]]","inappropriate":"[[ {{icons}} \u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00ed\u0273\u00e1\u01bf\u01bf\u0159\u00f3\u01bf\u0159\u00ed\u00e1\u0165\u00e9 ]]","notify_moderators":"[[ {{icons}} \u0273\u00f3\u0165\u00ed\u0192\u00ed\u00e9\u010f \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159\u0161 ]]","notify_moderators_with_url":"[[ {{icons}} <\u00e1 \u0125\u0159\u00e9\u0192='{{postUrl}}'>\u0273\u00f3\u0165\u00ed\u0192\u00ed\u00e9\u010f \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159\u0161</\u00e1> ]]","notify_user":"[[ {{icons}} \u0161\u00e9\u0273\u0165 \u00e1 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 ]]","notify_user_with_url":"[[ {{icons}} \u0161\u00e9\u0273\u0165 \u00e1 <\u00e1 \u0125\u0159\u00e9\u0192='{{postUrl}}'>\u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9</\u00e1> ]]","bookmark":"[[ {{icons}} \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 ]]","like":"[[ {{icons}} \u0142\u00ed\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 ]]","vote":"[[ {{icons}} \u03bd\u00f3\u0165\u00e9\u010f \u0192\u00f3\u0159 \u0165\u0125\u00ed\u0161 ]]"},"by_you":{"off_topic":"[[ \u00dd\u00f3\u016f \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00f3\u0192\u0192-\u0165\u00f3\u01bf\u00ed\u010d ]]","spam":"[[ \u00dd\u00f3\u016f \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u0161\u01bf\u00e1\u0271 ]]","inappropriate":"[[ \u00dd\u00f3\u016f \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00ed\u0273\u00e1\u01bf\u01bf\u0159\u00f3\u01bf\u0159\u00ed\u00e1\u0165\u00e9 ]]","notify_moderators":"[[ \u00dd\u00f3\u016f \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u0192\u00f3\u0159 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00ed\u00f3\u0273 ]]","notify_user":"[[ \u00dd\u00f3\u016f \u0161\u00e9\u0273\u0165 \u00e1 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 ]]","bookmark":"[[ \u00dd\u00f3\u016f \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","like":"[[ \u00dd\u00f3\u016f \u0142\u00ed\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 ]]","vote":"[[ \u00dd\u00f3\u016f \u03bd\u00f3\u0165\u00e9\u010f \u0192\u00f3\u0159 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]"},"by_you_and_others":{"off_topic":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f 1 \u00f3\u0165\u0125\u00e9\u0159 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00f3\u0192\u0192-\u0165\u00f3\u01bf\u00ed\u010d ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f {{count}} \u00f3\u0165\u0125\u00e9\u0159 \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00f3\u0192\u0192-\u0165\u00f3\u01bf\u00ed\u010d ]]"},"spam":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f 1 \u00f3\u0165\u0125\u00e9\u0159 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u0161\u01bf\u00e1\u0271 ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f {{count}} \u00f3\u0165\u0125\u00e9\u0159 \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u0161\u01bf\u00e1\u0271 ]]"},"inappropriate":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f 1 \u00f3\u0165\u0125\u00e9\u0159 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00ed\u0273\u00e1\u01bf\u01bf\u0159\u00f3\u01bf\u0159\u00ed\u00e1\u0165\u00e9 ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f {{count}} \u00f3\u0165\u0125\u00e9\u0159 \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00ed\u0273\u00e1\u01bf\u01bf\u0159\u00f3\u01bf\u0159\u00ed\u00e1\u0165\u00e9 ]]"},"notify_moderators":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f 1 \u00f3\u0165\u0125\u00e9\u0159 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u0192\u00f3\u0159 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00ed\u00f3\u0273 ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f {{count}} \u00f3\u0165\u0125\u00e9\u0159 \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u0192\u00f3\u0159 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00ed\u00f3\u0273 ]]"},"notify_user":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f 1 \u00f3\u0165\u0125\u00e9\u0159 \u0161\u00e9\u0273\u0165 \u00e1 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f {{count}} \u00f3\u0165\u0125\u00e9\u0159 \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0161\u00e9\u0273\u0165 \u00e1 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 ]]"},"bookmark":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f 1 \u00f3\u0165\u0125\u00e9\u0159 \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f {{count}} \u00f3\u0165\u0125\u00e9\u0159 \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]"},"like":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f 1 \u00f3\u0165\u0125\u00e9\u0159 \u0142\u00ed\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f {{count}} \u00f3\u0165\u0125\u00e9\u0159 \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0142\u00ed\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 ]]"},"vote":{"one":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f 1 \u00f3\u0165\u0125\u00e9\u0159 \u03bd\u00f3\u0165\u00e9\u010f \u0192\u00f3\u0159 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","other":"[[ \u00dd\u00f3\u016f \u00e1\u0273\u010f {{count}} \u00f3\u0165\u0125\u00e9\u0159 \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u03bd\u00f3\u0165\u00e9\u010f \u0192\u00f3\u0159 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]"}},"by_others":{"off_topic":{"one":"[[ 1 \u01bf\u00e9\u0159\u0161\u00f3\u0273 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00f3\u0192\u0192-\u0165\u00f3\u01bf\u00ed\u010d ]]","other":"[[ {{count}} \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00f3\u0192\u0192-\u0165\u00f3\u01bf\u00ed\u010d ]]"},"spam":{"one":"[[ 1 \u01bf\u00e9\u0159\u0161\u00f3\u0273 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u0161\u01bf\u00e1\u0271 ]]","other":"[[ {{count}} \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u0161\u01bf\u00e1\u0271 ]]"},"inappropriate":{"one":"[[ 1 \u01bf\u00e9\u0159\u0161\u00f3\u0273 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00ed\u0273\u00e1\u01bf\u01bf\u0159\u00f3\u01bf\u0159\u00ed\u00e1\u0165\u00e9 ]]","other":"[[ {{count}} \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u00e1\u0161 \u00ed\u0273\u00e1\u01bf\u01bf\u0159\u00f3\u01bf\u0159\u00ed\u00e1\u0165\u00e9 ]]"},"notify_moderators":{"one":"[[ 1 \u01bf\u00e9\u0159\u0161\u00f3\u0273 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u0192\u00f3\u0159 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00ed\u00f3\u0273 ]]","other":"[[ {{count}} \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0192\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0165\u0125\u00ed\u0161 \u0192\u00f3\u0159 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00ed\u00f3\u0273 ]]"},"notify_user":{"one":"[[ 1 \u01bf\u00e9\u0159\u0161\u00f3\u0273 \u0161\u00e9\u0273\u0165 \u00e1 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 ]]","other":"[[ {{count}} \u0161\u00e9\u0273\u0165 \u00e1 \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0271\u00e9\u0161\u0161\u00e1\u01e7\u00e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 ]]"},"bookmark":{"one":"[[ 1 \u01bf\u00e9\u0159\u0161\u00f3\u0273 \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","other":"[[ {{count}} \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0180\u00f3\u00f3\u01e9\u0271\u00e1\u0159\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]"},"like":{"one":"[[ 1 \u01bf\u00e9\u0159\u0161\u00f3\u0273 \u0142\u00ed\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 ]]","other":"[[ {{count}} \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u0142\u00ed\u01e9\u00e9\u010f \u0165\u0125\u00ed\u0161 ]]"},"vote":{"one":"[[ 1 \u01bf\u00e9\u0159\u0161\u00f3\u0273 \u03bd\u00f3\u0165\u00e9\u010f \u0192\u00f3\u0159 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]","other":"[[ {{count}} \u01bf\u00e9\u00f3\u01bf\u0142\u00e9 \u03bd\u00f3\u0165\u00e9\u010f \u0192\u00f3\u0159 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 ]]"}}},"edits":{"one":"[[ 1 \u00e9\u010f\u00ed\u0165 ]]","other":"[[ {{count}} \u00e9\u010f\u00ed\u0165\u0161 ]]","zero":"[[ \u0273\u00f3 \u00e9\u010f\u00ed\u0165\u0161 ]]"},"delete":{"confirm":{"one":"[[ \u00c1\u0159\u00e9 \u00fd\u00f3\u016f \u0161\u016f\u0159\u00e9 \u00fd\u00f3\u016f \u0175\u00e1\u0273\u0165 \u0165\u00f3 \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u0165\u0125\u00e1\u0165 \u01bf\u00f3\u0161\u0165? ]]","other":"[[ \u00c1\u0159\u00e9 \u00fd\u00f3\u016f \u0161\u016f\u0159\u00e9 \u00fd\u00f3\u016f \u0175\u00e1\u0273\u0165 \u0165\u00f3 \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u00e1\u0142\u0142 \u0165\u0125\u00f3\u0161\u00e9 \u01bf\u00f3\u0161\u0165\u0161? ]]"}}},"category":{"none":"[[ (\u0273\u00f3 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd) ]]","edit":"[[ \u00e9\u010f\u00ed\u0165 ]]","edit_long":"[[ \u00c9\u010f\u00ed\u0165 \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]","edit_uncategorized":"[[ \u00c9\u010f\u00ed\u0165 \u016e\u0273\u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00ed\u017e\u00e9\u010f ]]","view":"[[ \u0476\u00ed\u00e9\u0175 \u0164\u00f3\u01bf\u00ed\u010d\u0161 \u00ed\u0273 \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]","delete":"[[ \u010e\u00e9\u0142\u00e9\u0165\u00e9 \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]","create":"[[ \u010c\u0159\u00e9\u00e1\u0165\u00e9 \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]","save":"[[ \u0160\u00e1\u03bd\u00e9 \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]","creation_error":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u0125\u00e1\u0161 \u0180\u00e9\u00e9\u0273 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u010f\u016f\u0159\u00ed\u0273\u01e7 \u0165\u0125\u00e9 \u010d\u0159\u00e9\u00e1\u0165\u00ed\u00f3\u0273 \u00f3\u0192 \u0165\u0125\u00e9 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd. ]]","save_error":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u0161\u00e1\u03bd\u00ed\u0273\u01e7 \u0165\u0125\u00e9 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd. ]]","more_posts":"[[ \u03bd\u00ed\u00e9\u0175 \u00e1\u0142\u0142 {{posts}}... ]]","name":"[[ \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd \u040d\u00e1\u0271\u00e9 ]]","description":"[[ \u010e\u00e9\u0161\u010d\u0159\u00ed\u01bf\u0165\u00ed\u00f3\u0273 ]]","topic":"[[ \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd \u0165\u00f3\u01bf\u00ed\u010d ]]","badge_colors":"[[ \u0181\u00e1\u010f\u01e7\u00e9 \u010d\u00f3\u0142\u00f3\u0159\u0161 ]]","background_color":"[[ \u0181\u00e1\u010d\u01e9\u01e7\u0159\u00f3\u016f\u0273\u010f \u010d\u00f3\u0142\u00f3\u0159 ]]","foreground_color":"[[ \u0191\u00f3\u0159\u00e9\u01e7\u0159\u00f3\u016f\u0273\u010f \u010d\u00f3\u0142\u00f3\u0159 ]]","name_placeholder":"[[ \u0160\u0125\u00f3\u016f\u0142\u010f \u0180\u00e9 \u0161\u0125\u00f3\u0159\u0165 \u00e1\u0273\u010f \u0161\u016f\u010d\u010d\u00ed\u0273\u010d\u0165. ]]","color_placeholder":"[[ \u00c1\u0273\u00fd \u0175\u00e9\u0180 \u010d\u00f3\u0142\u00f3\u0159 ]]","delete_confirm":"[[ \u00c1\u0159\u00e9 \u00fd\u00f3\u016f \u0161\u016f\u0159\u00e9 \u00fd\u00f3\u016f \u0175\u00e1\u0273\u0165 \u0165\u00f3 \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u0165\u0125\u00ed\u0161 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd? ]]","delete_error":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u010f\u00e9\u0142\u00e9\u0165\u00ed\u0273\u01e7 \u0165\u0125\u00e9 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd. ]]","list":"[[ \u0141\u00ed\u0161\u0165 \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00ed\u00e9\u0161 ]]","no_description":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u00ed\u0161 \u0273\u00f3 \u010f\u00e9\u0161\u010d\u0159\u00ed\u01bf\u0165\u00ed\u00f3\u0273 \u0192\u00f3\u0159 \u0165\u0125\u00ed\u0161 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd. ]]","change_in_category_topic":"[[ \u00c9\u010f\u00ed\u0165 \u010e\u00e9\u0161\u010d\u0159\u00ed\u01bf\u0165\u00ed\u00f3\u0273 ]]","hotness":"[[ \u0124\u00f3\u0165\u0273\u00e9\u0161\u0161 ]]","already_used":"[[ \u0164\u0125\u00ed\u0161 \u010d\u00f3\u0142\u00f3\u0159 \u0125\u00e1\u0161 \u0180\u00e9\u00e9\u0273 \u016f\u0161\u00e9\u010f \u0180\u00fd \u00e1\u0273\u00f3\u0165\u0125\u00e9\u0159 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]"},"flagging":{"title":"[[ \u0174\u0125\u00fd \u00e1\u0159\u00e9 \u00fd\u00f3\u016f \u0192\u0142\u00e1\u01e7\u01e7\u00ed\u0273\u01e7 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165? ]]","action":"[[ \u0191\u0142\u00e1\u01e7 \u0420\u00f3\u0161\u0165 ]]","notify_action":"[[ \u040d\u00f3\u0165\u00ed\u0192\u00fd ]]","cant":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u00fd\u00f3\u016f \u010d\u00e1\u0273'\u0165 \u0192\u0142\u00e1\u01e7 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 \u00e1\u0165 \u0165\u0125\u00ed\u0161 \u0165\u00ed\u0271\u00e9. ]]","custom_placeholder_notify_user":"[[ \u0174\u0125\u00fd \u010f\u00f3\u00e9\u0161 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 \u0159\u00e9\u01a3\u016f\u00ed\u0159\u00e9 \u00fd\u00f3\u016f \u0165\u00f3 \u0161\u01bf\u00e9\u00e1\u01e9 \u0165\u00f3 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 \u010f\u00ed\u0159\u00e9\u010d\u0165\u0142\u00fd \u00e1\u0273\u010f \u01bf\u0159\u00ed\u03bd\u00e1\u0165\u00e9\u0142\u00fd? \u0181\u00e9 \u0161\u01bf\u00e9\u010d\u00ed\u0192\u00ed\u010d, \u0180\u00e9 \u010d\u00f3\u0273\u0161\u0165\u0159\u016f\u010d\u0165\u00ed\u03bd\u00e9, \u00e1\u0273\u010f \u00e1\u0142\u0175\u00e1\u00fd\u0161 \u0180\u00e9 \u01e9\u00ed\u0273\u010f. ]]","custom_placeholder_notify_moderators":"[[ \u0174\u0125\u00fd \u010f\u00f3\u00e9\u0161 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 \u0159\u00e9\u01a3\u016f\u00ed\u0159\u00e9 \u0271\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159 \u00e1\u0165\u0165\u00e9\u0273\u0165\u00ed\u00f3\u0273? \u0141\u00e9\u0165 \u016f\u0161 \u01e9\u0273\u00f3\u0175 \u0161\u01bf\u00e9\u010d\u00ed\u0192\u00ed\u010d\u00e1\u0142\u0142\u00fd \u0175\u0125\u00e1\u0165 \u00fd\u00f3\u016f \u00e1\u0159\u00e9 \u010d\u00f3\u0273\u010d\u00e9\u0159\u0273\u00e9\u010f \u00e1\u0180\u00f3\u016f\u0165, \u00e1\u0273\u010f \u01bf\u0159\u00f3\u03bd\u00ed\u010f\u00e9 \u0159\u00e9\u0142\u00e9\u03bd\u00e1\u0273\u0165 \u0142\u00ed\u0273\u01e9\u0161 \u0175\u0125\u00e9\u0159\u00e9 \u01bf\u00f3\u0161\u0161\u00ed\u0180\u0142\u00e9. ]]","custom_message":{"at_least":"[[ \u00e9\u0273\u0165\u00e9\u0159 \u00e1\u0165 \u0142\u00e9\u00e1\u0161\u0165 {{n}} \u010d\u0125\u00e1\u0159\u00e1\u010d\u0165\u00e9\u0159\u0161 ]]","more":"[[ {{n}} \u0165\u00f3 \u01e7\u00f3... ]]","left":"[[ {{n}} \u0159\u00e9\u0271\u00e1\u00ed\u0273\u00ed\u0273\u01e7 ]]"}},"topic_summary":{"title":"[[ \u0164\u00f3\u01bf\u00ed\u010d \u0160\u016f\u0271\u0271\u00e1\u0159\u00fd ]]","links_shown":"[[ \u0161\u0125\u00f3\u0175 \u00e1\u0142\u0142 {{totalLinks}} \u0142\u00ed\u0273\u01e9\u0161... ]]","clicks":"[[ \u010d\u0142\u00ed\u010d\u01e9\u0161 ]]","topic_link":"[[ \u0165\u00f3\u01bf\u00ed\u010d \u0142\u00ed\u0273\u01e9 ]]"},"topic_statuses":{"locked":{"help":"[[ \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u00ed\u0161 \u010d\u0142\u00f3\u0161\u00e9\u010f; \u00ed\u0165 \u0273\u00f3 \u0142\u00f3\u0273\u01e7\u00e9\u0159 \u00e1\u010d\u010d\u00e9\u01bf\u0165\u0161 \u0273\u00e9\u0175 \u0159\u00e9\u01bf\u0142\u00ed\u00e9\u0161 ]]"},"pinned":{"help":"[[ \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u00ed\u0161 \u01bf\u00ed\u0273\u0273\u00e9\u010f; \u00ed\u0165 \u0175\u00ed\u0142\u0142 \u010f\u00ed\u0161\u01bf\u0142\u00e1\u00fd \u00e1\u0165 \u0165\u0125\u00e9 \u0165\u00f3\u01bf \u00f3\u0192 \u00ed\u0165\u0161 \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]"},"archived":{"help":"[[ \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u00ed\u0161 \u00e1\u0159\u010d\u0125\u00ed\u03bd\u00e9\u010f; \u00ed\u0165 \u00ed\u0161 \u0192\u0159\u00f3\u017e\u00e9\u0273 \u00e1\u0273\u010f \u010d\u00e1\u0273\u0273\u00f3\u0165 \u0180\u00e9 \u010d\u0125\u00e1\u0273\u01e7\u00e9\u010f ]]"},"invisible":{"help":"[[ \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u00ed\u0161 \u00ed\u0273\u03bd\u00ed\u0161\u00ed\u0180\u0142\u00e9; \u00ed\u0165 \u0175\u00ed\u0142\u0142 \u0273\u00f3\u0165 \u0180\u00e9 \u010f\u00ed\u0161\u01bf\u0142\u00e1\u00fd\u00e9\u010f \u00ed\u0273 \u0165\u00f3\u01bf\u00ed\u010d \u0142\u00ed\u0161\u0165\u0161, \u00e1\u0273\u010f \u010d\u00e1\u0273 \u00f3\u0273\u0142\u00fd \u0180\u00e9 \u00e1\u010d\u010d\u00e9\u0161\u0161\u00e9\u010f \u03bd\u00ed\u00e1 \u00e1 \u010f\u00ed\u0159\u00e9\u010d\u0165 \u0142\u00ed\u0273\u01e9 ]]"}},"posts":"[[ \u0420\u00f3\u0161\u0165\u0161 ]]","posts_long":"[[ {{number}} \u01bf\u00f3\u0161\u0165\u0161 \u00ed\u0273 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d ]]","original_post":"[[ \u00d3\u0159\u00ed\u01e7\u00ed\u0273\u00e1\u0142 \u0420\u00f3\u0161\u0165 ]]","views":"[[ \u0476\u00ed\u00e9\u0175\u0161 ]]","replies":"[[ \u0158\u00e9\u01bf\u0142\u00ed\u00e9\u0161 ]]","views_long":"[[ \u0165\u0125\u00ed\u0161 \u0165\u00f3\u01bf\u00ed\u010d \u0125\u00e1\u0161 \u0180\u00e9\u00e9\u0273 \u03bd\u00ed\u00e9\u0175\u00e9\u010f {{number}} \u0165\u00ed\u0271\u00e9\u0161 ]]","activity":"[[ \u00c1\u010d\u0165\u00ed\u03bd\u00ed\u0165\u00fd ]]","likes":"[[ \u0141\u00ed\u01e9\u00e9\u0161 ]]","top_contributors":"[[ \u0420\u00e1\u0159\u0165\u00ed\u010d\u00ed\u01bf\u00e1\u0273\u0165\u0161 ]]","category_title":"[[ \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]","history":"[[ \u0124\u00ed\u0161\u0165\u00f3\u0159\u00fd ]]","changed_by":"[[ \u0180\u00fd {{author}} ]]","categories_list":"[[ \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00ed\u00e9\u0161 \u0141\u00ed\u0161\u0165 ]]","filters":{"latest":{"title":"[[ \u0141\u00e1\u0165\u00e9\u0161\u0165 ]]","help":"[[ \u0165\u0125\u00e9 \u0271\u00f3\u0161\u0165 \u0159\u00e9\u010d\u00e9\u0273\u0165 \u0165\u00f3\u01bf\u00ed\u010d\u0161 ]]"},"hot":{"title":"[[ \u0124\u00f3\u0165 ]]","help":"[[ \u00e1 \u0161\u00e9\u0142\u00e9\u010d\u0165\u00ed\u00f3\u0273 \u00f3\u0192 \u0165\u0125\u00e9 \u0125\u00f3\u0165\u0165\u00e9\u0161\u0165 \u0165\u00f3\u01bf\u00ed\u010d\u0161 ]]"},"favorited":{"title":"[[ \u0191\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9\u010f ]]","help":"[[ \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00fd\u00f3\u016f \u0271\u00e1\u0159\u01e9\u00e9\u010f \u00e1\u0161 \u0192\u00e1\u03bd\u00f3\u0159\u00ed\u0165\u00e9\u0161 ]]"},"read":{"title":"[[ \u0158\u00e9\u00e1\u010f ]]","help":"[[ \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00fd\u00f3\u016f'\u03bd\u00e9 \u0159\u00e9\u00e1\u010f, \u00ed\u0273 \u0165\u0125\u00e9 \u00f3\u0159\u010f\u00e9\u0159 \u0165\u0125\u00e1\u0165 \u00fd\u00f3\u016f \u0142\u00e1\u0161\u0165 \u0159\u00e9\u00e1\u010f \u0165\u0125\u00e9\u0271 ]]"},"categories":{"title":"[[ \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00ed\u00e9\u0161 ]]","title_in":"[[ \u010c\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd - {{categoryName}} ]]","help":"[[ \u00e1\u0142\u0142 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u01e7\u0159\u00f3\u016f\u01bf\u00e9\u010f \u0180\u00fd \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]"},"unread":{"title":{"zero":"[[ \u016e\u0273\u0159\u00e9\u00e1\u010f ]]","one":"[[ \u016e\u0273\u0159\u00e9\u00e1\u010f (1) ]]","other":"[[ \u016e\u0273\u0159\u00e9\u00e1\u010f ({{count}}) ]]"},"help":"[[ \u0165\u0159\u00e1\u010d\u01e9\u00e9\u010f \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0175\u00ed\u0165\u0125 \u016f\u0273\u0159\u00e9\u00e1\u010f \u01bf\u00f3\u0161\u0165\u0161 ]]"},"new":{"title":{"zero":"[[ \u040d\u00e9\u0175 ]]","one":"[[ \u040d\u00e9\u0175 (1) ]]","other":"[[ \u040d\u00e9\u0175 ({{count}}) ]]"},"help":"[[ \u0273\u00e9\u0175 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u0161\u00ed\u0273\u010d\u00e9 \u00fd\u00f3\u016f\u0159 \u0142\u00e1\u0161\u0165 \u03bd\u00ed\u0161\u00ed\u0165 ]]"},"posted":{"title":"[[ \u03fa\u00fd \u0420\u00f3\u0161\u0165\u0161 ]]","help":"[[ \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00fd\u00f3\u016f \u0125\u00e1\u03bd\u00e9 \u01bf\u00f3\u0161\u0165\u00e9\u010f \u00ed\u0273 ]]"},"category":{"title":{"zero":"[[ {{categoryName}} ]]","one":"[[ {{categoryName}} (1) ]]","other":"[[ {{categoryName}} ({{count}}) ]]"},"help":"[[ \u0142\u00e1\u0165\u00e9\u0161\u0165 \u0165\u00f3\u01bf\u00ed\u010d\u0161 \u00ed\u0273 \u0165\u0125\u00e9 {{categoryName}} \u010d\u00e1\u0165\u00e9\u01e7\u00f3\u0159\u00fd ]]"}},"browser_update":"[[ \u016e\u0273\u0192\u00f3\u0159\u0165\u016f\u0273\u00e1\u0165\u00e9\u0142\u00fd, <\u00e1 \u0125\u0159\u00e9\u0192=\"\u0125\u0165\u0165\u01bf://\u0175\u0175\u0175.\u010f\u00ed\u0161\u010d\u00f3\u016f\u0159\u0161\u00e9.\u00f3\u0159\u01e7/\u0192\u00e1\u01a3/#\u0180\u0159\u00f3\u0175\u0161\u00e9\u0159\">\u00fd\u00f3\u016f\u0159 \u0180\u0159\u00f3\u0175\u0161\u00e9\u0159 \u00ed\u0161 \u0165\u00f3\u00f3 \u00f3\u0142\u010f \u0165\u00f3 \u0175\u00f3\u0159\u01e9 \u00f3\u0273 \u0165\u0125\u00ed\u0161 \u010e\u00ed\u0161\u010d\u00f3\u016f\u0159\u0161\u00e9 \u0192\u00f3\u0159\u016f\u0271</\u00e1>. \u0420\u0142\u00e9\u00e1\u0161\u00e9 <\u00e1 \u0125\u0159\u00e9\u0192=\"\u0125\u0165\u0165\u01bf://\u0180\u0159\u00f3\u0175\u0161\u00e9\u0125\u00e1\u01bf\u01bf\u00fd.\u010d\u00f3\u0271\">\u016f\u01bf\u01e7\u0159\u00e1\u010f\u00e9 \u00fd\u00f3\u016f\u0159 \u0180\u0159\u00f3\u0175\u0161\u00e9\u0159</\u00e1>. ]]","type_to_filter":"[[ \u0165\u00fd\u01bf\u00e9 \u0165\u00f3 \u0192\u00ed\u0142\u0165\u00e9\u0159... ]]","admin":{"title":"[[ \u010e\u00ed\u0161\u010d\u00f3\u016f\u0159\u0161\u00e9 \u00c1\u010f\u0271\u00ed\u0273 ]]","moderator":"[[ \u03fa\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159 ]]","dashboard":{"title":"[[ \u010e\u00e1\u0161\u0125\u0180\u00f3\u00e1\u0159\u010f ]]","version":"[[ \u0476\u00e9\u0159\u0161\u00ed\u00f3\u0273 ]]","up_to_date":"[[ \u00dd\u00f3\u016f'\u0159\u00e9 \u016f\u01bf \u0165\u00f3 \u010f\u00e1\u0165\u00e9! ]]","critical_available":"[[ \u00c1 \u010d\u0159\u00ed\u0165\u00ed\u010d\u00e1\u0142 \u016f\u01bf\u010f\u00e1\u0165\u00e9 \u00ed\u0161 \u00e1\u03bd\u00e1\u00ed\u0142\u00e1\u0180\u0142\u00e9. ]]","updates_available":"[[ \u016e\u01bf\u010f\u00e1\u0165\u00e9\u0161 \u00e1\u0159\u00e9 \u00e1\u03bd\u00e1\u00ed\u0142\u00e1\u0180\u0142\u00e9. ]]","please_upgrade":"[[ \u0420\u0142\u00e9\u00e1\u0161\u00e9 \u016f\u01bf\u01e7\u0159\u00e1\u010f\u00e9! ]]","installed_version":"[[ \u00cd\u0273\u0161\u0165\u00e1\u0142\u0142\u00e9\u010f ]]","latest_version":"[[ \u0141\u00e1\u0165\u00e9\u0161\u0165 ]]","problems_found":"[[ \u0160\u00f3\u0271\u00e9 \u01bf\u0159\u00f3\u0180\u0142\u00e9\u0271\u0161 \u0125\u00e1\u03bd\u00e9 \u0180\u00e9\u00e9\u0273 \u0192\u00f3\u016f\u0273\u010f \u0175\u00ed\u0165\u0125 \u00fd\u00f3\u016f\u0159 \u00ed\u0273\u0161\u0165\u00e1\u0142\u0142\u00e1\u0165\u00ed\u00f3\u0273 \u00f3\u0192 \u010e\u00ed\u0161\u010d\u00f3\u016f\u0159\u0161\u00e9: ]]","last_checked":"[[ \u0141\u00e1\u0161\u0165 \u010d\u0125\u00e9\u010d\u01e9\u00e9\u010f ]]","refresh_problems":"[[ \u0158\u00e9\u0192\u0159\u00e9\u0161\u0125 ]]","no_problems":"[[ \u040d\u00f3 \u01bf\u0159\u00f3\u0180\u0142\u00e9\u0271\u0161 \u0175\u00e9\u0159\u00e9 \u0192\u00f3\u016f\u0273\u010f. ]]","moderators":"[[ \u03fa\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159\u0161: ]]","admins":"[[ \u00c1\u010f\u0271\u00ed\u0273\u0161: ]]","private_messages_short":"[[ \u0420\u03fa\u0161 ]]","private_messages_title":"[[ \u0420\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u03fa\u00e9\u0161\u0161\u00e1\u01e7\u00e9\u0161 ]]","reports":{"today":"[[ \u0164\u00f3\u010f\u00e1\u00fd ]]","yesterday":"[[ \u00dd\u00e9\u0161\u0165\u00e9\u0159\u010f\u00e1\u00fd ]]","last_7_days":"[[ \u0141\u00e1\u0161\u0165 7 \u010e\u00e1\u00fd\u0161 ]]","last_30_days":"[[ \u0141\u00e1\u0161\u0165 30 \u010e\u00e1\u00fd\u0161 ]]","all_time":"[[ \u00c1\u0142\u0142 \u0164\u00ed\u0271\u00e9 ]]","7_days_ago":"[[ 7 \u010e\u00e1\u00fd\u0161 \u00c1\u01e7\u00f3 ]]","30_days_ago":"[[ 30 \u010e\u00e1\u00fd\u0161 \u00c1\u01e7\u00f3 ]]","all":"[[ \u00c1\u0142\u0142 ]]","view_table":"[[ \u0476\u00ed\u00e9\u0175 \u00e1\u0161 \u0164\u00e1\u0180\u0142\u00e9 ]]","view_chart":"[[ \u0476\u00ed\u00e9\u0175 \u00e1\u0161 \u0181\u00e1\u0159 \u010c\u0125\u00e1\u0159\u0165 ]]"}},"commits":{"latest_changes":"[[ \u0141\u00e1\u0165\u00e9\u0161\u0165 \u010d\u0125\u00e1\u0273\u01e7\u00e9\u0161: \u01bf\u0142\u00e9\u00e1\u0161\u00e9 \u016f\u01bf\u010f\u00e1\u0165\u00e9 \u00f3\u0192\u0165\u00e9\u0273! ]]","by":"[[ \u0180\u00fd ]]"},"flags":{"title":"[[ \u0191\u0142\u00e1\u01e7\u0161 ]]","old":"[[ \u00d3\u0142\u010f ]]","active":"[[ \u00c1\u010d\u0165\u00ed\u03bd\u00e9 ]]","clear":"[[ \u010c\u0142\u00e9\u00e1\u0159 \u0191\u0142\u00e1\u01e7\u0161 ]]","clear_title":"[[ \u010f\u00ed\u0161\u0271\u00ed\u0161\u0161 \u00e1\u0142\u0142 \u0192\u0142\u00e1\u01e7\u0161 \u00f3\u0273 \u0165\u0125\u00ed\u0161 \u01bf\u00f3\u0161\u0165 (\u0175\u00ed\u0142\u0142 \u016f\u0273\u0125\u00ed\u010f\u00e9 \u0125\u00ed\u010f\u010f\u00e9\u0273 \u01bf\u00f3\u0161\u0165\u0161) ]]","delete":"[[ \u010e\u00e9\u0142\u00e9\u0165\u00e9 \u0420\u00f3\u0161\u0165 ]]","delete_title":"[[ \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u01bf\u00f3\u0161\u0165 (\u00ed\u0192 \u00ed\u0165\u0161 \u0165\u0125\u00e9 \u0192\u00ed\u0159\u0161\u0165 \u01bf\u00f3\u0161\u0165 \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u0165\u00f3\u01bf\u00ed\u010d) ]]","flagged_by":"[[ \u0191\u0142\u00e1\u01e7\u01e7\u00e9\u010f \u0180\u00fd ]]","error":"[[ \u0160\u00f3\u0271\u00e9\u0165\u0125\u00ed\u0273\u01e7 \u0175\u00e9\u0273\u0165 \u0175\u0159\u00f3\u0273\u01e7 ]]"},"groups":{"title":"[[ \u01e6\u0159\u00f3\u016f\u01bf\u0161 ]]","edit":"[[ \u00c9\u010f\u00ed\u0165 \u01e6\u0159\u00f3\u016f\u01bf\u0161 ]]","selector_placeholder":"[[ \u00e1\u010f\u010f \u016f\u0161\u00e9\u0159\u0161 ]]"},"api":{"title":"[[ \u00c1\u0420\u00cd ]]"},"customize":{"title":"[[ \u010c\u016f\u0161\u0165\u00f3\u0271\u00ed\u017e\u00e9 ]]","long_title":"[[ \u0160\u00ed\u0165\u00e9 \u010c\u016f\u0161\u0165\u00f3\u0271\u00ed\u017e\u00e1\u0165\u00ed\u00f3\u0273\u0161 ]]","header":"[[ \u0124\u00e9\u00e1\u010f\u00e9\u0159 ]]","css":"[[ \u0160\u0165\u00fd\u0142\u00e9\u0161\u0125\u00e9\u00e9\u0165 ]]","override_default":"[[ \u010e\u00f3 \u0273\u00f3\u0165 \u00ed\u0273\u010d\u0142\u016f\u010f\u00e9 \u0161\u0165\u00e1\u0273\u010f\u00e1\u0159\u010f \u0161\u0165\u00fd\u0142\u00e9 \u0161\u0125\u00e9\u00e9\u0165 ]]","enabled":"[[ \u00c9\u0273\u00e1\u0180\u0142\u00e9\u010f? ]]","preview":"[[ \u01bf\u0159\u00e9\u03bd\u00ed\u00e9\u0175 ]]","undo_preview":"[[ \u016f\u0273\u010f\u00f3 \u01bf\u0159\u00e9\u03bd\u00ed\u00e9\u0175 ]]","save":"[[ \u0160\u00e1\u03bd\u00e9 ]]","new":"[[ \u040d\u00e9\u0175 ]]","new_style":"[[ \u040d\u00e9\u0175 \u0160\u0165\u00fd\u0142\u00e9 ]]","delete":"[[ \u010e\u00e9\u0142\u00e9\u0165\u00e9 ]]","delete_confirm":"[[ \u010e\u00e9\u0142\u00e9\u0165\u00e9 \u0165\u0125\u00ed\u0161 \u010d\u016f\u0161\u0165\u00f3\u0271\u00ed\u017e\u00e1\u0165\u00ed\u00f3\u0273? ]]","about":"[[ \u0160\u00ed\u0165\u00e9 \u010c\u016f\u0161\u0165\u00f3\u0271\u00ed\u017e\u00e1\u0165\u00ed\u00f3\u0273 \u00e1\u0142\u0142\u00f3\u0175 \u00fd\u00f3\u016f \u0165\u00f3 \u0271\u00f3\u010f\u00ed\u0192\u00fd \u0161\u0165\u00fd\u0142\u00e9\u0161\u0125\u00e9\u00e9\u0165\u0161 \u00e1\u0273\u010f \u0125\u00e9\u00e1\u010f\u00e9\u0159\u0161 \u00f3\u0273 \u0165\u0125\u00e9 \u0161\u00ed\u0165\u00e9. \u010c\u0125\u00f3\u00f3\u0161\u00e9 \u00f3\u0159 \u00e1\u010f\u010f \u00f3\u0273\u00e9 \u0165\u00f3 \u0161\u0165\u00e1\u0159\u0165 \u00e9\u010f\u00ed\u0165\u00ed\u0273\u01e7. ]]"},"email":{"title":"[[ \u00c9\u0271\u00e1\u00ed\u0142 \u0141\u00f3\u01e7\u0161 ]]","sent_at":"[[ \u0160\u00e9\u0273\u0165 \u00c1\u0165 ]]","email_type":"[[ \u00c9\u0271\u00e1\u00ed\u0142 \u0164\u00fd\u01bf\u00e9 ]]","to_address":"[[ \u0164\u00f3 \u00c1\u010f\u010f\u0159\u00e9\u0161\u0161 ]]","test_email_address":"[[ \u00e9\u0271\u00e1\u00ed\u0142 \u00e1\u010f\u010f\u0159\u00e9\u0161\u0161 \u0165\u00f3 \u0165\u00e9\u0161\u0165 ]]","send_test":"[[ \u0161\u00e9\u0273\u010f \u0165\u00e9\u0161\u0165 \u00e9\u0271\u00e1\u00ed\u0142 ]]","sent_test":"[[ \u0161\u00e9\u0273\u0165! ]]"},"impersonate":{"title":"[[ \u00cd\u0271\u01bf\u00e9\u0159\u0161\u00f3\u0273\u00e1\u0165\u00e9 \u016e\u0161\u00e9\u0159 ]]","username_or_email":"[[ \u016e\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u00f3\u0159 \u00c9\u0271\u00e1\u00ed\u0142 \u00f3\u0192 \u016e\u0161\u00e9\u0159 ]]","help":"[[ \u016e\u0161\u00e9 \u0165\u0125\u00ed\u0161 \u0165\u00f3\u00f3\u0142 \u0165\u00f3 \u00ed\u0271\u01bf\u00e9\u0159\u0161\u00f3\u0273\u00e1\u0165\u00e9 \u00e1 \u016f\u0161\u00e9\u0159 \u00e1\u010d\u010d\u00f3\u016f\u0273\u0165 \u0192\u00f3\u0159 \u010f\u00e9\u0180\u016f\u01e7\u01e7\u00ed\u0273\u01e7 \u01bf\u016f\u0159\u01bf\u00f3\u0161\u00e9\u0161. ]]","not_found":"[[ \u0164\u0125\u00e1\u0165 \u016f\u0161\u00e9\u0159 \u010d\u00e1\u0273'\u0165 \u0180\u00e9 \u0192\u00f3\u016f\u0273\u010f. ]]","invalid":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u00fd\u00f3\u016f \u0271\u00e1\u00fd \u0273\u00f3\u0165 \u00ed\u0271\u01bf\u00e9\u0159\u0161\u00f3\u0273\u00e1\u0165\u00e9 \u0165\u0125\u00e1\u0165 \u016f\u0161\u00e9\u0159. ]]"},"users":{"title":"[[ \u016e\u0161\u00e9\u0159\u0161 ]]","create":"[[ \u00c1\u010f\u010f \u00c1\u010f\u0271\u00ed\u0273 \u016e\u0161\u00e9\u0159 ]]","last_emailed":"[[ \u0141\u00e1\u0161\u0165 \u00c9\u0271\u00e1\u00ed\u0142\u00e9\u010f ]]","not_found":"[[ \u0160\u00f3\u0159\u0159\u00fd, \u0165\u0125\u00e1\u0165 \u016f\u0161\u00e9\u0159\u0273\u00e1\u0271\u00e9 \u010f\u00f3\u00e9\u0161\u0273'\u0165 \u00e9\u0445\u00ed\u0161\u0165 \u00ed\u0273 \u00f3\u016f\u0159 \u0161\u00fd\u0161\u0165\u00e9\u0271. ]]","new":"[[ \u040d\u00e9\u0175 ]]","active":"[[ \u00c1\u010d\u0165\u00ed\u03bd\u00e9 ]]","pending":"[[ \u0420\u00e9\u0273\u010f\u00ed\u0273\u01e7 ]]","approved":"[[ \u00c1\u01bf\u01bf\u0159\u00f3\u03bd\u00e9\u010f? ]]","approved_selected":{"one":"[[ \u00e1\u01bf\u01bf\u0159\u00f3\u03bd\u00e9 \u016f\u0161\u00e9\u0159 ]]","other":"[[ \u00e1\u01bf\u01bf\u0159\u00f3\u03bd\u00e9 \u016f\u0161\u00e9\u0159\u0161 ({{count}}) ]]"},"titles":{"active":"[[ \u00c1\u010d\u0165\u00ed\u03bd\u00e9 \u016e\u0161\u00e9\u0159\u0161 ]]","new":"[[ \u040d\u00e9\u0175 \u016e\u0161\u00e9\u0159\u0161 ]]","pending":"[[ \u016e\u0161\u00e9\u0159\u0161 \u0420\u00e9\u0273\u010f\u00ed\u0273\u01e7 \u0158\u00e9\u03bd\u00ed\u00e9\u0175 ]]","newuser":"[[ \u016e\u0161\u00e9\u0159\u0161 \u00e1\u0165 \u0164\u0159\u016f\u0161\u0165 \u0141\u00e9\u03bd\u00e9\u0142 0 (\u040d\u00e9\u0175 \u016e\u0161\u00e9\u0159) ]]","basic":"[[ \u016e\u0161\u00e9\u0159\u0161 \u00e1\u0165 \u0164\u0159\u016f\u0161\u0165 \u0141\u00e9\u03bd\u00e9\u0142 1 (\u0181\u00e1\u0161\u00ed\u010d \u016e\u0161\u00e9\u0159) ]]","regular":"[[ \u016e\u0161\u00e9\u0159\u0161 \u00e1\u0165 \u0164\u0159\u016f\u0161\u0165 \u0141\u00e9\u03bd\u00e9\u0142 2 (\u0158\u00e9\u01e7\u016f\u0142\u00e1\u0159 \u016e\u0161\u00e9\u0159) ]]","leader":"[[ \u016e\u0161\u00e9\u0159\u0161 \u00e1\u0165 \u0164\u0159\u016f\u0161\u0165 \u0141\u00e9\u03bd\u00e9\u0142 3 (\u0141\u00e9\u00e1\u010f\u00e9\u0159) ]]","elder":"[[ \u016e\u0161\u00e9\u0159\u0161 \u00e1\u0165 \u0164\u0159\u016f\u0161\u0165 \u0141\u00e9\u03bd\u00e9\u0142 4 (\u00c9\u0142\u010f\u00e9\u0159) ]]","admins":"[[ \u00c1\u010f\u0271\u00ed\u0273 \u016e\u0161\u00e9\u0159\u0161 ]]","moderators":"[[ \u03fa\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159\u0161 ]]"}},"user":{"ban_failed":"[[ \u0160\u00f3\u0271\u00e9\u0165\u0125\u00ed\u0273\u01e7 \u0175\u00e9\u0273\u0165 \u0175\u0159\u00f3\u0273\u01e7 \u0180\u00e1\u0273\u0273\u00ed\u0273\u01e7 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 {{error}} ]]","unban_failed":"[[ \u0160\u00f3\u0271\u00e9\u0165\u0125\u00ed\u0273\u01e7 \u0175\u00e9\u0273\u0165 \u0175\u0159\u00f3\u0273\u01e7 \u016f\u0273\u0180\u00e1\u0273\u0273\u00ed\u0273\u01e7 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 {{error}} ]]","ban_duration":"[[ \u0124\u00f3\u0175 \u0142\u00f3\u0273\u01e7 \u0175\u00f3\u016f\u0142\u010f \u00fd\u00f3\u016f \u0142\u00ed\u01e9\u00e9 \u0165\u00f3 \u0180\u00e1\u0273 \u0165\u0125\u00e9 \u016f\u0161\u00e9\u0159 \u0192\u00f3\u0159? (\u010f\u00e1\u00fd\u0161) ]]","delete_all_posts":"[[ \u010e\u00e9\u0142\u00e9\u0165\u00e9 \u00e1\u0142\u0142 \u01bf\u00f3\u0161\u0165\u0161 ]]","ban":"[[ \u0181\u00e1\u0273 ]]","unban":"[[ \u016e\u0273\u0180\u00e1\u0273 ]]","banned":"[[ \u0181\u00e1\u0273\u0273\u00e9\u010f? ]]","moderator":"[[ \u03fa\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00f3\u0159? ]]","admin":"[[ \u00c1\u010f\u0271\u00ed\u0273? ]]","show_admin_profile":"[[ \u00c1\u010f\u0271\u00ed\u0273 ]]","refresh_browsers":"[[ \u0191\u00f3\u0159\u010d\u00e9 \u0180\u0159\u00f3\u0175\u0161\u00e9\u0159 \u0159\u00e9\u0192\u0159\u00e9\u0161\u0125 ]]","show_public_profile":"[[ \u0160\u0125\u00f3\u0175 \u0420\u016f\u0180\u0142\u00ed\u010d \u0420\u0159\u00f3\u0192\u00ed\u0142\u00e9 ]]","impersonate":"[[ \u00cd\u0271\u01bf\u00e9\u0159\u0161\u00f3\u0273\u00e1\u0165\u00e9 ]]","revoke_admin":"[[ \u0158\u00e9\u03bd\u00f3\u01e9\u00e9 \u00c1\u010f\u0271\u00ed\u0273 ]]","grant_admin":"[[ \u01e6\u0159\u00e1\u0273\u0165 \u00c1\u010f\u0271\u00ed\u0273 ]]","revoke_moderation":"[[ \u0158\u00e9\u03bd\u00f3\u01e9\u00e9 \u03fa\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00ed\u00f3\u0273 ]]","grant_moderation":"[[ \u01e6\u0159\u00e1\u0273\u0165 \u03fa\u00f3\u010f\u00e9\u0159\u00e1\u0165\u00ed\u00f3\u0273 ]]","reputation":"[[ \u0158\u00e9\u01bf\u016f\u0165\u00e1\u0165\u00ed\u00f3\u0273 ]]","permissions":"[[ \u0420\u00e9\u0159\u0271\u00ed\u0161\u0161\u00ed\u00f3\u0273\u0161 ]]","activity":"[[ \u00c1\u010d\u0165\u00ed\u03bd\u00ed\u0165\u00fd ]]","like_count":"[[ \u0141\u00ed\u01e9\u00e9\u0161 \u0158\u00e9\u010d\u00e9\u00ed\u03bd\u00e9\u010f ]]","private_topics_count":"[[ \u0420\u0159\u00ed\u03bd\u00e1\u0165\u00e9 \u0164\u00f3\u01bf\u00ed\u010d\u0161 \u010c\u00f3\u016f\u0273\u0165 ]]","posts_read_count":"[[ \u0420\u00f3\u0161\u0165\u0161 \u0158\u00e9\u00e1\u010f ]]","post_count":"[[ \u0420\u00f3\u0161\u0165\u0161 \u010c\u0159\u00e9\u00e1\u0165\u00e9\u010f ]]","topics_entered":"[[ \u0164\u00f3\u01bf\u00ed\u010d\u0161 \u00c9\u0273\u0165\u00e9\u0159\u00e9\u010f ]]","flags_given_count":"[[ \u0191\u0142\u00e1\u01e7\u0161 \u01e6\u00ed\u03bd\u00e9\u0273 ]]","flags_received_count":"[[ \u0191\u0142\u00e1\u01e7\u0161 \u0158\u00e9\u010d\u00e9\u00ed\u03bd\u00e9\u010f ]]","approve":"[[ \u00c1\u01bf\u01bf\u0159\u00f3\u03bd\u00e9 ]]","approved_by":"[[ \u00e1\u01bf\u01bf\u0159\u00f3\u03bd\u00e9\u010f \u0180\u00fd ]]","time_read":"[[ \u0158\u00e9\u00e1\u010f \u0164\u00ed\u0271\u00e9 ]]","delete":"[[ \u010e\u00e9\u0142\u00e9\u0165\u00e9 \u016e\u0161\u00e9\u0159 ]]","delete_forbidden":"[[ \u0164\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 \u010d\u00e1\u0273'\u0165 \u0180\u00e9 \u010f\u00e9\u0142\u00e9\u0165\u00e9\u010f \u0180\u00e9\u010d\u00e1\u016f\u0161\u00e9 \u0165\u0125\u00e9\u0159\u00e9 \u00e1\u0159\u00e9 \u01bf\u00f3\u0161\u0165\u0161. \u010e\u00e9\u0142\u00e9\u0165\u00e9 \u00e1\u0142\u0142 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159'\u0161 \u01bf\u00f3\u0161\u0165\u0161 \u0192\u00ed\u0159\u0161\u0165. ]]","delete_confirm":"[[ \u00c1\u0159\u00e9 \u00fd\u00f3\u016f \u0160\u016e\u0158\u00c9 \u00fd\u00f3\u016f \u0175\u00e1\u0273\u0165 \u0165\u00f3 \u01bf\u00e9\u0159\u0271\u00e1\u0273\u00e9\u0273\u0165\u0142\u00fd \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u0165\u0125\u00ed\u0161 \u016f\u0161\u00e9\u0159 \u0192\u0159\u00f3\u0271 \u0165\u0125\u00e9 \u0161\u00ed\u0165\u00e9? \u0164\u0125\u00ed\u0161 \u00e1\u010d\u0165\u00ed\u00f3\u0273 \u00ed\u0161 \u01bf\u00e9\u0159\u0271\u00e1\u0273\u00e9\u0273\u0165! ]]","deleted":"[[ \u0164\u0125\u00e9 \u016f\u0161\u00e9\u0159 \u0175\u00e1\u0161 \u010f\u00e9\u0142\u00e9\u0165\u00e9\u010f. ]]","delete_failed":"[[ \u0164\u0125\u00e9\u0159\u00e9 \u0175\u00e1\u0161 \u00e1\u0273 \u00e9\u0159\u0159\u00f3\u0159 \u010f\u00e9\u0142\u00e9\u0165\u00ed\u0273\u01e7 \u0165\u0125\u00e1\u0165 \u016f\u0161\u00e9\u0159. \u03fa\u00e1\u01e9\u00e9 \u0161\u016f\u0159\u00e9 \u00e1\u0142\u0142 \u01bf\u00f3\u0161\u0165\u0161 \u00e1\u0159\u00e9 \u010f\u00e9\u0142\u00e9\u0165\u00e9\u010f \u0180\u00e9\u0192\u00f3\u0159\u00e9 \u0165\u0159\u00fd\u00ed\u0273\u01e7 \u0165\u00f3 \u010f\u00e9\u0142\u00e9\u0165\u00e9 \u0165\u0125\u00e9 \u016f\u0161\u00e9\u0159. ]]"},"site_content":{"none":"[[ \u010c\u0125\u00f3\u00f3\u0161\u00e9 \u00e1 \u0165\u00fd\u01bf\u00e9 \u00f3\u0192 \u010d\u00f3\u0273\u0165\u00e9\u0273\u0165 \u0165\u00f3 \u0180\u00e9\u01e7\u00ed\u0273 \u00e9\u010f\u00ed\u0165\u00ed\u0273\u01e7. ]]","title":"[[ \u0160\u00ed\u0165\u00e9 \u010c\u00f3\u0273\u0165\u00e9\u0273\u0165 ]]","edit":"[[ \u00c9\u010f\u00ed\u0165 \u0160\u00ed\u0165\u00e9 \u010c\u00f3\u0273\u0165\u00e9\u0273\u0165 ]]"},"site_settings":{"show_overriden":"[[ \u00d3\u0273\u0142\u00fd \u0161\u0125\u00f3\u0175 \u00f3\u03bd\u00e9\u0159\u0159\u00ed\u010f\u010f\u00e9\u0273 ]]","title":"[[ \u0160\u00ed\u0165\u00e9 \u0160\u00e9\u0165\u0165\u00ed\u0273\u01e7\u0161 ]]","reset":"[[ \u0159\u00e9\u0161\u00e9\u0165 \u0165\u00f3 \u010f\u00e9\u0192\u00e1\u016f\u0142\u0165 ]]"}}}}};
I18n.locale = 'pseudo';
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
