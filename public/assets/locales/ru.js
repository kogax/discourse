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
MessageFormat.locale.ru = function (n) {
  if ((n % 10) == 1 && (n % 100) != 11) {
    return 'one';
  }
  if ((n % 10) >= 2 && (n % 10) <= 4 &&
      ((n % 100) < 12 || (n % 100) > 14) && n == Math.floor(n)) {
    return 'few';
  }
  if ((n % 10) === 0 || ((n % 10) >= 5 && (n % 10) <= 9) ||
      ((n % 100) >= 11 && (n % 100) <= 14) && n == Math.floor(n)) {
    return 'many';
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
    })({});I18n.translations = {"ru":{"js":{"dates":{"tiny":{"half_a_minute":"< 1\u043c\u0438\u043d","less_than_x_seconds":{"one":"< 1\u0441\u0435\u043a","other":"< %{count}\u0441\u0435\u043a","few":"< %{count}\u0441\u0435\u043a","many":"< %{count}\u0441\u0435\u043a"},"x_seconds":{"one":"1\u0441\u0435\u043a","other":"%{count}\u0441\u0435\u043a","few":"%{count}\u0441\u0435\u043a","many":"%{count}\u0441\u0435\u043a"},"less_than_x_minutes":{"one":"< 1\u043c\u0438\u043d","other":"< %{count}\u043c\u0438\u043d","few":"< %{count}\u043c\u0438\u043d","many":"< %{count}\u043c\u0438\u043d"},"x_minutes":{"one":"1\u043c","other":"%{count}\u043c\u0438\u043d","few":"%{count}\u043c\u0438\u043d","many":"%{count}\u043c\u0438\u043d"},"about_x_hours":{"one":"1\u0447","other":"%{count}\u0447","few":"%{count}\u0447","many":"%{count}\u0447"},"x_days":{"one":"1\u0434","other":"%{count}\u0434","few":"%{count}\u0434","many":"%{count}\u0434"},"about_x_months":{"one":"1\u043c\u0435\u0441","other":"%{count}\u043c\u0435\u0441","few":"%{count}\u043c\u0435\u0441","many":"%{count}\u043c\u0435\u0441"},"x_months":{"one":"1\u043c\u0435\u0441","other":"%{count}\u043c\u0435\u0441","few":"%{count}\u043c\u0435\u0441","many":"%{count}\u043c\u0435\u0441"},"about_x_years":{"one":"1\u0433","other":"%{count}\u043b\u0435\u0442","few":"%{count}\u043b\u0435\u0442","many":"%{count}\u043b\u0435\u0442"},"over_x_years":{"one":"> 1\u0433","other":"> %{count}\u043b\u0435\u0442","few":"> %{count}\u043b\u0435\u0442","many":"> %{count}\u043b\u0435\u0442"},"almost_x_years":{"one":"1\u0433","other":"%{count}\u043b\u0435\u0442","few":"%{count}\u043b\u0435\u0442","many":"%{count}\u043b\u0435\u0442"}},"medium":{"x_minutes":{"one":"1 \u043c\u0438\u043d\u0443\u0442\u0430","other":"%{count} \u043c\u0438\u043d\u0443\u0442","few":"%{count} \u043c\u0438\u043d\u0443\u0442\u044b","many":"%{count} \u043c\u0438\u043d\u0443\u0442"},"x_hours":{"one":"1 \u0447\u0430\u0441","other":"%{count} \u0447\u0430\u0441\u043e\u0432","few":"%{count} \u0447\u0430\u0441\u0430","many":"%{count} \u0447\u0430\u0441\u043e\u0432"},"x_days":{"one":"1 \u0434\u0435\u043d\u044c","other":"%{count} \u0434\u043d\u0435\u0439","few":"%{count} \u0434\u043d\u044f","many":"%{count} \u0434\u043d\u0435\u0439"}},"medium_with_ago":{"x_minutes":{"one":"\u043c\u0438\u043d\u0443\u0442\u0443 \u043d\u0430\u0437\u0430\u0434","other":"%{count} \u043c\u0438\u043d\u0443\u0442 \u043d\u0430\u0437\u0430\u0434","few":"%{count} \u043c\u0438\u043d\u0443\u0442\u044b \u043d\u0430\u0437\u0430\u0434","many":"%{count} \u043c\u0438\u043d\u0443\u0442 \u043d\u0430\u0437\u0430\u0434"},"x_hours":{"one":"\u0447\u0430\u0441 \u043d\u0430\u0437\u0430\u0434","other":"%{count} \u0447\u0430\u0441\u043e\u0432 \u043d\u0430\u0437\u0430\u0434","few":"%{count} \u0447\u0430\u0441\u0430 \u043d\u0430\u0437\u0430\u0434","many":"%{count} \u0447\u0430\u0441\u043e\u0432 \u043d\u0430\u0437\u0430\u0434"},"x_days":{"one":"\u0434\u0435\u043d\u044c \u043d\u0430\u0437\u0430\u0434","other":"%{count} \u0434\u043d\u0435\u0439 \u043d\u0430\u0437\u0430\u0434","few":"%{count} \u0434\u043d\u044f \u043d\u0430\u0437\u0430\u0434","many":"%{count} \u0434\u043d\u0435\u0439 \u043d\u0430\u0437\u0430\u0434"}}},"share":{"topic":"\u043f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u043d\u0430 \u0442\u0435\u043c\u0443","post":"\u043f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","close":"\u0437\u0430\u043a\u0440\u044b\u0442\u044c","twitter":"\u043f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u0447\u0435\u0440\u0435\u0437 Twitter","facebook":"\u043f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u0447\u0435\u0440\u0435\u0437 Facebook","google+":"\u043f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u0447\u0435\u0440\u0435\u0437 Google+","email":"\u043f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u043f\u043e email"},"edit":"\u043e\u0442\u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e \u0442\u0435\u043c\u044b","not_implemented":"\u0418\u0437\u0432\u0438\u043d\u0438\u0442\u0435, \u044d\u0442\u0430 \u0444\u0443\u043d\u043a\u0446\u0438\u044f \u0435\u0449\u0435 \u043d\u0435 \u0440\u0435\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d\u0430!","no_value":"\u043d\u0435\u0442","yes_value":"\u0434\u0430","of_value":"\u0438\u0437","generic_error":"\u0418\u0437\u0432\u0438\u043d\u0438\u0442\u0435, \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","log_in":"\u0412\u043e\u0439\u0442\u0438","age":"\u0412\u043e\u0437\u0440\u0430\u0441\u0442","last_post":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","admin_title":"\u0410\u0434\u043c\u0438\u043d","flags_title":"\u0416\u0430\u043b\u043e\u0431\u044b","show_more":"\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0435\u0449\u0435","links":"\u0421\u0441\u044b\u043b\u043a\u0438","faq":"FAQ","you":"\u0412\u044b","or":"\u0438\u043b\u0438","now":"\u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e","read_more":"\u0447\u0438\u0442\u0430\u0442\u044c \u0435\u0449\u0435","in_n_seconds":{"one":"\u0447\u0435\u0440\u0435\u0437 1 \u0441\u0435\u043a\u0443\u043d\u0434\u0443","other":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0441\u0435\u043a\u0443\u043d\u0434","few":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0441\u0435\u043a\u0443\u043d\u0434\u044b","many":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0441\u0435\u043a\u0443\u043d\u0434"},"in_n_minutes":{"one":"\u0447\u0435\u0440\u0435\u0437 1 \u043c\u0438\u043d\u0443\u0442\u0443","other":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u043c\u0438\u043d\u0443\u0442","few":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u043c\u0438\u043d\u0443\u0442\u044b","many":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u043c\u0438\u043d\u0443\u0442"},"in_n_hours":{"one":"\u0447\u0435\u0440\u0435\u0437 1 \u0447\u0430\u0441","other":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0447\u0430\u0441\u043e\u0432","few":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0447\u0430\u0441\u0430","many":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0447\u0430\u0441\u043e\u0432"},"in_n_days":{"one":"\u0447\u0435\u0440\u0435\u0437 1 \u0434\u0435\u043d\u044c","other":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0434\u043d\u0435\u0439","few":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0434\u043d\u044f","many":"\u0447\u0435\u0440\u0435\u0437 {{count}} \u0434\u043d\u0435\u0439"},"suggested_topics":{"title":"\u041f\u043e\u0445\u043e\u0436\u0438\u0435 \u0442\u0435\u043c\u044b"},"bookmarks":{"not_logged_in":"\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u043e\u0439\u0434\u0438\u0442\u0435 \u043d\u0430 \u0444\u043e\u0440\u0443\u043c \u0434\u043b\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438.","created":"\u0412\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438.","not_bookmarked":"\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043e. \u0429\u0435\u043b\u043a\u043d\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438.","last_read":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435, \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u043e\u0435 \u0432\u0430\u043c\u0438."},"new_topics_inserted":"{{count}} \u043d\u043e\u0432\u044b\u0445 \u0442\u0435\u043c.","show_new_topics":"\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c.","preview":"\u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440","cancel":"\u043e\u0442\u043c\u0435\u043d\u0430","save":"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f","saving":"\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...","saved":"\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e!","choose_topic":{"none_found":"\u0422\u0435\u043c\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b.","title":{"search":"\u0418\u0441\u043a\u0430\u0442\u044c \u0442\u0435\u043c\u0443 \u043f\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044e, \u0441\u0441\u044b\u043b\u043a\u0435 \u0438\u043b\u0438 \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u043e\u043c\u0443 \u043d\u043e\u043c\u0435\u0440\u0443:","placeholder":"\u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0437\u0434\u0435\u0441\u044c \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0442\u0435\u043c\u044b"}},"user_action":{"user_posted_topic":"<a href='{{userUrl}}'>{{user}}</a> \u0441\u043e\u0437\u0434\u0430\u043b <a href='{{topicUrl}}'>\u0442\u0435\u043c\u0443</a>","you_posted_topic":"<a href='{{userUrl}}'>\u0412\u044b</a> \u0441\u043e\u0437\u0434\u0430\u043b\u0438 <a href='{{topicUrl}}'>\u0442\u0435\u043c\u0443</a>","user_replied_to_post":"<a href='{{userUrl}}'>{{user}}</a> \u043e\u0442\u0432\u0435\u0442\u0438\u043b \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 <a href='{{postUrl}}'>{{post_number}}</a>","you_replied_to_post":"<a href='{{userUrl}}'>\u0412\u044b</a> \u043e\u0442\u0432\u0435\u0442\u0438\u043b\u0438 \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 <a href='{{postUrl}}'>{{post_number}}</a>","user_replied_to_topic":"<a href='{{userUrl}}'>{{user}}</a> \u043e\u0442\u0432\u0435\u0442\u0438\u043b \u0432 <a href='{{topicUrl}}'>\u0442\u0435\u043c\u0435</a>","you_replied_to_topic":"<a href='{{userUrl}}'>\u0412\u044b</a> \u043e\u0442\u0432\u0435\u0442\u0438\u043b\u0438 \u0432 <a href='{{topicUrl}}'>\u0442\u0435\u043c\u0435</a>","user_mentioned_user":"<a href='{{user1Url}}'>{{user}}</a> \u0443\u043f\u043e\u043c\u044f\u043d\u0443\u043b <a href='{{user2Url}}'>{{another_user}}</a>","user_mentioned_you":"<a href='{{user1Url}}'>{{user}}</a> \u0443\u043f\u043e\u043c\u044f\u043d\u0443\u043b<a href='{{user2Url}}'>\u0412\u0430\u0441</a>","you_mentioned_user":"<a href='{{user1Url}}'>\u0412\u044b</a> \u0443\u043f\u043e\u043c\u044f\u043d\u0443\u043b\u0438<a href='{{user2Url}}'>{{user}}</a>","posted_by_user":"\u0420\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u043c <a href='{{userUrl}}'>{{user}}</a>","posted_by_you":"\u0420\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u043e <a href='{{userUrl}}'>\u0412\u0430\u043c\u0438</a>","sent_by_user":"\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u043c <a href='{{userUrl}}'>{{user}}</a>","sent_by_you":"\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e <a href='{{userUrl}}'>\u0412\u0430\u043c\u0438</a>"},"user_action_groups":{"1":"\u041e\u0442\u0434\u0430\u043d\u043e \u0441\u0438\u043c\u043f\u0430\u0442\u0438\u0439","2":"\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u0441\u0438\u043c\u043f\u0430\u0442\u0438\u0439","3":"\u0417\u0430\u043a\u043b\u0430\u0434\u043a\u0438","4":"\u0422\u0435\u043c\u044b","5":"\u041e\u0442\u0432\u0435\u0442\u044b","6":"\u041e\u0442\u0432\u0435\u0442\u044b","7":"\u0423\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f","9":"\u0426\u0438\u0442\u0430\u0442\u044b","10":"\u0418\u0437\u0431\u0440\u0430\u043d\u043e\u0435","11":"\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f","12":"\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043d\u044b\u0435 \u0444\u0430\u0439\u043b\u044b","13":"\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435"},"user":{"profile":"\u041f\u0440\u043e\u0444\u0430\u0439\u043b","title":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c","mute":"\u041e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c","edit":"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438","download_archive":"\u0441\u043a\u0430\u0447\u0430\u0442\u044c \u0430\u0440\u0445\u0438\u0432 \u0432\u0430\u0448\u0438\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439","private_message":"\u041b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","private_messages":"\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","activity_stream":"\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c","preferences":"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438","bio":"\u041e\u0431\u043e \u043c\u043d\u0435","invited_by":"\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u043c","trust_level":"\u0423\u0440\u043e\u0432\u0435\u043d\u044c \u0434\u043e\u0432\u0435\u0440\u0438\u044f","external_links_in_new_tab":"\u041e\u0442\u043a\u0440\u044b\u0432\u0430\u0442\u044c \u0432\u0441\u0435 \u0432\u043d\u0435\u0448\u043d\u0438\u0435 \u0441\u0441\u044b\u043b\u043a\u0438 \u0432 \u043d\u043e\u0432\u043e\u0439 \u0432\u043a\u043b\u0430\u0434\u043a\u0435","enable_quoting":"\u041f\u043e\u0437\u0432\u043e\u043b\u0438\u0442\u044c \u043e\u0442\u0432\u0435\u0447\u0430\u0442\u044c \u0441 \u0446\u0438\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435\u043c \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u043e\u0433\u043e \u0442\u0435\u043a\u0441\u0442\u0430","moderator":"{{user}} - \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440","admin":"{{user}} - \u0430\u0434\u043c\u0438\u043d","change_password":{"action":"\u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c","success":"(\u043f\u0438\u0441\u044c\u043c\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e)","in_progress":"(\u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0430 \u043f\u0438\u0441\u044c\u043c\u0430)","error":"(\u043e\u0448\u0438\u0431\u043a\u0430)"},"change_username":{"action":"\u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c","title":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","confirm":"\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0438\u043c\u0435\u043d\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043c\u043e\u0436\u0435\u0442 \u043f\u043e\u0432\u043b\u0435\u0447\u044c \u0437\u0430 \u0441\u043e\u0431\u043e\u0439 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0435 \u043f\u043e\u0441\u043b\u0435\u0434\u0441\u0442\u0432\u0438\u044f. \u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b?","taken":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442\u043e.","error":"\u041f\u0440\u0438 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0438 \u0438\u043c\u0435\u043d\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","invalid":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0434\u043e\u043b\u0436\u043d\u043e \u0441\u043e\u0441\u0442\u043e\u044f\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0438\u0437 \u0446\u0438\u0444\u0440 \u0438 \u043b\u0430\u0442\u0438\u043d\u0441\u043a\u0438\u0445 \u0431\u0443\u043a\u0432"},"change_email":{"action":"\u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c","title":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c Email","taken":"\u0414\u0430\u043d\u043d\u044b\u0439 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.","error":"\u041f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430. \u0412\u043e\u0437\u043c\u043e\u0436\u043d\u043e, \u044d\u0442\u043e\u0442 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u0443\u0436\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f?","success":"\u041d\u0430 \u0443\u043a\u0430\u0437\u0430\u043d\u043d\u044b\u0439 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043f\u0438\u0441\u044c\u043c\u043e \u0441 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u044f\u043c\u0438."},"email":{"title":"Email","instructions":"\u0412\u0430\u0448 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u0432\u0441\u0435\u0433\u0434\u0430 \u0441\u043a\u0440\u044b\u0442.","ok":"\u041e\u0442\u043b\u0438\u0447\u043d\u043e, \u043c\u044b \u043f\u043e\u0441\u043b\u0430\u043b\u0438 \u0432\u0430\u043c \u043f\u0438\u0441\u044c\u043c\u043e \u0441 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u044f\u043c\u0438.","invalid":"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b.","authenticated":"\u0410\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d {{provider}}.","frequency":"\u0412 \u0441\u043b\u0443\u0447\u0430\u0435 \u0432\u0430\u0448\u0435\u0433\u043e \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044f \u043d\u0430 \u0444\u043e\u0440\u0443\u043c\u0435 \u0432\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u043e \u043d\u043e\u0432\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u0445."},"name":{"title":"\u0418\u043c\u044f","instructions":"\u0412\u0430\u0448\u0435 \u043f\u043e\u043b\u043d\u043e\u0435 \u0438\u043c\u044f \u0438\u043b\u0438 \u043f\u0441\u0435\u0432\u0434\u043e\u043d\u0438\u043c. \u041d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u043e\u0435. \u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 \u0432\u0430\u0448\u0435\u0439 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.","too_short":"\u0412\u0430\u0448\u0435 \u0438\u043c\u044f \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0435.","ok":"\u0414\u043e\u043f\u0443\u0441\u0442\u0438\u043c\u043e\u0435 \u0438\u043c\u044f."},"username":{"title":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","instructions":"\u0414\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u043c \u0438 \u0431\u0435\u0437 \u043f\u0440\u043e\u0431\u0435\u043b\u043e\u0432. \u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u043c\u043e\u0433\u0443\u0442 \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u0442\u044c \u0432\u0430\u0441 \u043f\u043e @username.","short_instructions":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u043c\u043e\u0433\u0443\u0442 \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u0442\u044c \u0432\u0430\u0441 \u043f\u043e @{{username}}.","available":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e.","global_match":"\u0410\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u0435\u0442 \u0441 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u043c.","global_mismatch":"\u0423\u0436\u0435 \u0437\u0430\u043d\u044f\u0442\u043e. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 {{suggestion}}?","not_available":"\u041d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 {{suggestion}}?","too_short":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0435.","too_long":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043b\u0438\u043d\u043d\u043e\u0435.","checking":"\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u044e \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0441\u0442\u044c \u0438\u043c\u0435\u043d\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f...","enter_email":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043d\u0430\u0439\u0434\u0435\u043d\u043e. \u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b."},"password_confirmation":{"title":"\u041f\u0430\u0440\u043e\u043b\u044c \u0435\u0449\u0435 \u0440\u0430\u0437"},"last_posted":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","last_emailed":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u043f\u0438\u0441\u044c\u043c\u043e","last_seen":"\u041f\u043e\u0441\u043b. \u0432\u0438\u0437\u0438\u0442","created":"\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f","log_out":"\u0412\u044b\u0439\u0442\u0438","website":"\u0412\u0435\u0431-\u0441\u0430\u0439\u0442","email_settings":"\u042d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u0430\u044f \u043f\u043e\u0447\u0442\u0430","email_digests":{"title":"\u0412 \u0441\u043b\u0443\u0447\u0430\u0435 \u043c\u043e\u0435\u0433\u043e \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044f \u043d\u0430 \u0444\u043e\u0440\u0443\u043c\u0435, \u043f\u0440\u0438\u0441\u044b\u043b\u0430\u0439\u0442\u0435 \u043c\u043d\u0435 \u0441\u0432\u043e\u0434\u043a\u0443 \u043d\u043e\u0432\u043e\u0441\u0442\u0435\u0439","daily":"\u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u043e","weekly":"\u0435\u0436\u0435\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u043e","bi_weekly":"\u043a\u0430\u0436\u0434\u044b\u0435 \u0434\u0432\u0435 \u043d\u0435\u0434\u0435\u043b\u0438"},"email_direct":"\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u043f\u043e \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u0435 \u043e\u0431 \u043e\u0442\u0432\u0435\u0442\u0430\u0445 \u043d\u0430 \u0432\u0430\u0448\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f, \u0446\u0438\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0438 \u0432\u0430\u0441 \u0438\u043b\u0438 \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0438 \u0432\u0430\u0441 \u043f\u043e @username","email_private_messages":"\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u043f\u043e \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u0435 \u043e \u043b\u0438\u0447\u043d\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u0445","other_settings":"\u041f\u0440\u043e\u0447\u0435\u0435","new_topic_duration":{"label":"\u0421\u0447\u0438\u0442\u0430\u0442\u044c \u0442\u0435\u043c\u044b \u043d\u043e\u0432\u044b\u043c\u0438, \u0435\u0441\u043b\u0438","not_viewed":"\u043e\u043d\u0438 \u0435\u0449\u0435 \u043d\u0435 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u044b \u0432\u0430\u043c\u0438","last_here":"\u043e\u043d\u0438 \u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u043f\u043e\u0441\u043b\u0435 \u0432\u0430\u0448\u0435\u0433\u043e \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0433\u043e \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u044f","after_n_days":{"one":"\u043e\u043d\u0438 \u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0441\u0443\u0442\u043a\u0438","other":"\u043e\u043d\u0438 \u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 {{count}} \u0434\u043d\u0435\u0439","few":"\u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 {{count}} \u0434\u043d\u044f","many":"\u043e\u043d\u0438 \u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 {{count}} \u0434\u043d\u0435\u0439"},"after_n_weeks":{"one":"\u043e\u043d\u0438 \u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u044e\u044e \u043d\u0435\u0434\u0435\u043b\u044e","other":"\u043e\u043d\u0438 \u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 {{count}} \u043d\u0435\u0434\u0435\u043b\u044c","few":"\u043e\u043d\u0438 \u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 {{count}} \u043d\u0435\u0434\u0435\u043b\u0438","many":"\u043e\u043d\u0438 \u0431\u044b\u043b\u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 {{count}} \u043d\u0435\u0434\u0435\u043b\u044c"}},"auto_track_topics":"\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0442\u044c \u0442\u0435\u043c\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u044f \u043f\u0440\u043e\u0441\u043c\u0430\u0442\u0440\u0438\u0432\u0430\u044e","auto_track_options":{"never":"\u043d\u0438\u043a\u043e\u0433\u0434\u0430","always":"\u0432\u0441\u0435\u0433\u0434\u0430","after_n_seconds":{"one":"\u0441\u043f\u0443\u0441\u0442\u044f 1 \u0441\u0435\u043a\u0443\u043d\u0434\u0443","other":"\u0441\u043f\u0443\u0441\u0442\u044f {{count}} \u0441\u0435\u043a\u0443\u043d\u0434","few":"\u0441\u043f\u0443\u0441\u0442\u044f {{count}} \u0441\u0435\u043a\u0443\u043d\u0434\u044b","many":"\u0441\u043f\u0443\u0441\u0442\u044f {{count}} \u0441\u0435\u043a\u0443\u043d\u0434"},"after_n_minutes":{"one":"\u0441\u043f\u0443\u0441\u0442\u044f 1 \u043c\u0438\u043d\u0443\u0442\u0443","other":"\u0441\u043f\u0443\u0441\u0442\u044f {{count}} \u043c\u0438\u043d\u0443\u0442","few":"\u0441\u043f\u0443\u0441\u0442\u044f {{count}} \u043c\u0438\u043d\u0443\u0442\u044b","many":"\u0441\u043f\u0443\u0441\u0442\u044f {{count}} \u043c\u0438\u043d\u0443\u0442"}},"invited":{"title":"\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f","user":"\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u043d\u044b\u0439 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c","none":"{{username}} \u043d\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0441\u0438\u043b \u043d\u0438 \u043e\u0434\u043d\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043d\u0430 \u0444\u043e\u0440\u0443\u043c.","redeemed":"\u041f\u0440\u0438\u043d\u044f\u0442\u044b\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f","redeemed_at":"\u041f\u0440\u0438\u043d\u044f\u0442\u043e","pending":"\u0415\u0449\u0435 \u043d\u0435 \u043f\u0440\u0438\u043d\u044f\u0442\u044b\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f","topics_entered":"\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043e \u0442\u0435\u043c","posts_read_count":"\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439","rescind":"\u041e\u0442\u043e\u0437\u0432\u0430\u0442\u044c \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435","rescinded":"\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435 \u043e\u0442\u043e\u0437\u0432\u0430\u043d\u043e","time_read":"\u0412\u0440\u0435\u043c\u044f \u0447\u0442\u0435\u043d\u0438\u044f","days_visited":"\u0414\u043d\u0435\u0439 \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u044f","account_age_days":"\u0414\u043d\u0435\u0439 \u0441 \u043c\u043e\u043c\u0435\u043d\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438"},"password":{"title":"\u041f\u0430\u0440\u043e\u043b\u044c","too_short":"\u041f\u0430\u0440\u043e\u043b\u044c \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439.","ok":"\u0414\u043e\u043f\u0443\u0441\u0442\u0438\u043c\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c."},"ip_address":{"title":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 IP \u0430\u0434\u0440\u0435\u0441"},"avatar":{"title":"\u0410\u0432\u0430\u0442\u0430\u0440","instructions":"\u0421\u0435\u0440\u0432\u0438\u0441 <a href='https://ru.gravatar.com/' target='_blank'>Gravatar</a> \u043f\u043e\u0437\u0432\u043e\u043b\u044f\u0435\u0442 \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u0432\u0430\u0442\u0430\u0440 \u0434\u043b\u044f \u0432\u0430\u0448\u0435\u0433\u043e \u0430\u0434\u0440\u0435\u0441\u0430 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b"},"filters":{"all":"\u0412\u0441\u0435"},"stream":{"posted_by":"\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043e","sent_by":"\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e","private_message":"\u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","the_topic":"\u0442\u0435\u043c\u0430"}},"loading":"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...","close":"\u0417\u0430\u043a\u0440\u044b\u0442\u044c","learn_more":"\u043f\u043e\u0434\u0440\u043e\u0431\u043d\u0435\u0435...","year":"\u0433\u043e\u0434","year_desc":"\u0441\u043e\u0437\u0434\u0430\u043d\u043e \u0442\u0435\u043c \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 365 \u0434\u043d\u0435\u0439","month":"\u043c\u0435\u0441\u044f\u0446","month_desc":"\u0441\u043e\u0437\u0434\u0430\u043d\u043e \u0442\u0435\u043c \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 30 \u0434\u043d\u0435\u0439","week":"\u043d\u0435\u0434\u0435\u043b\u044f","week_desc":"\u0441\u043e\u0437\u0434\u0430\u043d\u043e \u0442\u0435\u043c \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 7 \u0434\u043d\u0435\u0439","first_post":"\u041f\u0435\u0440\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","mute":"\u041e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c","unmute":"\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c","best_of":{"title":"\u041d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u043f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u043e\u0435","enabled_description":"\u0412\u044b \u0441\u0435\u0439\u0447\u0430\u0441 \u043f\u0440\u043e\u0441\u043c\u0430\u0442\u0440\u0438\u0432\u0430\u0435\u0442\u0435 \u043d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u043f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0432 \u0442\u0435\u043c\u0435.","description":"\u0412 \u0442\u0435\u043c\u0435 <b>{{count}}</b> \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439. \u0425\u043e\u0442\u0438\u0442\u0435 \u0441\u044d\u043a\u043e\u043d\u043e\u043c\u0438\u0442\u044c \u0432\u0440\u0435\u043c\u044f \u0438 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043f\u0440\u0438\u0432\u043b\u0435\u043a\u043b\u0438 \u043a \u0441\u0435\u0431\u0435 \u0431\u043e\u043b\u044c\u0448\u0435 \u0432\u0441\u0435\u0433\u043e \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u044f \u0438 \u043e\u0442\u0432\u0435\u0442\u043e\u0432?","enable":"\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u043d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u043f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","disable":"\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0438\u0442\u044c\u0441\u044f \u0432 \u0440\u0435\u0436\u0438\u043c \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430 \u0432\u0441\u0435\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439"},"private_message_info":{"title":"\u041b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","invite":"\u041f\u0440\u0438\u0433\u043b\u0430\u0441\u0438\u0442\u044c \u0434\u0440\u0443\u0433\u0438\u0445..."},"email":"Email","username":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","last_seen":"\u0411\u044b\u043b","created":"\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f","trust_level":"\u0423\u0440\u043e\u0432\u0435\u043d\u044c \u0434\u043e\u0432\u0435\u0440\u0438\u044f","create_account":{"title":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0443\u0447\u0435\u0442\u043d\u0443\u044e \u0437\u0430\u043f\u0438\u0441\u044c","action":"\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f!","invite":"\u0415\u0449\u0451 \u043d\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u044b?","failed":"\u041f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430. \u0412\u043e\u0437\u043c\u043e\u0436\u043d\u043e, \u044d\u0442\u043e\u0442 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u0443\u0436\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c"},"forgot_password":{"title":"\u0417\u0430\u0431\u044b\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c?","action":"\u042f \u0437\u0430\u0431\u044b\u043b \u0441\u0432\u043e\u0439 \u043f\u0430\u0440\u043e\u043b\u044c","invite":"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0432\u0430\u0448\u0435 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0438\u043b\u0438 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b, \u0438 \u043c\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043c \u0432\u0430\u043c \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0430 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u043f\u0430\u0440\u043e\u043b\u044f.","reset":"\u0421\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f","complete":"\u041f\u0438\u0441\u044c\u043c\u043e \u0441 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u044f\u043c\u0438 \u043f\u043e \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044e \u043f\u0430\u0440\u043e\u043b\u044f \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043d\u0430 \u0430\u0434\u0440\u0435\u0441 \u0432\u0430\u0448\u0435\u0439 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b."},"login":{"title":"\u0412\u043e\u0439\u0442\u0438","username":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","password":"\u041f\u0430\u0440\u043e\u043b\u044c","email_placeholder":"\u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u0438\u043b\u0438 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","error":"\u041d\u0435\u043f\u0440\u0435\u0434\u0432\u0438\u0434\u0435\u043d\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430","reset_password":"\u0421\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f","logging_in":"\u041e\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0432\u0445\u043e\u0434...","or":"\u0438\u043b\u0438","authenticating":"\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430...","awaiting_confirmation":"\u0412\u0430\u0448\u0430 \u0443\u0447\u0435\u0442\u043d\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438. \u0414\u043b\u044f \u0442\u043e\u0433\u043e \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u043e\u043d\u043d\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e, \u0432\u043e\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435\u0441\u044c \u043e\u043f\u0446\u0438\u0435\u0439 \u0441\u0431\u0440\u043e\u0441\u0430 \u043f\u0430\u0440\u043e\u043b\u044f.","awaiting_approval":"\u0412\u0430\u0448\u0430 \u0443\u0447\u0435\u0442\u043d\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c \u0435\u0449\u0435 \u043d\u0435 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u043e\u043c. \u0421\u0440\u0430\u0437\u0443 \u043f\u043e\u0441\u043b\u0435 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u044f \u0432\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u043f\u043e \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u0435.","not_activated":"\u041f\u0440\u0435\u0436\u0434\u0435 \u0447\u0435\u043c \u0432\u044b \u0441\u043c\u043e\u0436\u0435\u0442\u0435 \u0432\u043e\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c\u0441\u044f \u043d\u043e\u0432\u043e\u0439 \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u044c\u044e, \u0432\u0430\u043c \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0435\u0435 \u0430\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c. \u041c\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u0432\u0430\u043c \u043d\u0430 \u043f\u043e\u0447\u0442\u0443 <b>{{sentTo}}</b> \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u044b\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u0438, \u043a\u0430\u043a \u044d\u0442\u043e c\u0434\u0435\u043b\u0430\u0442\u044c.","resend_activation_email":"\u0429\u0435\u043b\u043a\u043d\u0438\u0442\u0435 \u0437\u0434\u0435\u0441\u044c, \u0447\u0442\u043e\u0431\u044b \u043c\u044b \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e \u0432\u044b\u0441\u043b\u0430\u043b\u0438 \u0432\u0430\u043c \u043f\u0438\u0441\u044c\u043c\u043e \u0434\u043b\u044f \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438.","sent_activation_email_again":"\u041f\u043e \u0430\u0434\u0440\u0435\u0441\u0443 <b>{{currentEmail}}</b> \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043f\u0438\u0441\u044c\u043c\u043e \u0441 \u043a\u043e\u0434\u043e\u043c \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438. \u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u043c\u043e\u0436\u0435\u0442 \u0437\u0430\u043d\u044f\u0442\u044c \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0438\u043d\u0443\u0442. \u0418\u043c\u0435\u0439\u0442\u0435 \u0432 \u0432\u0438\u0434\u0443, \u0447\u0442\u043e \u0438\u043d\u043e\u0433\u0434\u0430 \u043f\u043e \u043e\u0448\u0438\u0431\u043a\u0435 \u043f\u0438\u0441\u044c\u043c\u043e \u043c\u043e\u0436\u0435\u0442 \u043f\u043e\u043f\u0430\u0441\u0442\u044c \u0432 \u043f\u0430\u043f\u043a\u0443 \u0421\u043f\u0430\u043c.","google":{"title":"\u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e Google","message":"\u0412\u0445\u043e\u0434 \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 Google (\u0432\u0441\u043f\u043b\u044b\u0432\u0430\u044e\u0449\u0438\u0435 \u043e\u043a\u043d\u0430 \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b)"},"twitter":{"title":"\u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e Twitter","message":"\u0412\u0445\u043e\u0434 \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 Twitter (\u0432\u0441\u043f\u043b\u044b\u0432\u0430\u044e\u0449\u0438\u0435 \u043e\u043a\u043d\u0430 \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b)"},"facebook":{"title":"\u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e Facebook","message":"\u0412\u0445\u043e\u0434 \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 Facebook (\u0432\u0441\u043f\u043b\u044b\u0432\u0430\u044e\u0449\u0438\u0435 \u043e\u043a\u043d\u0430 \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b)"},"cas":{"title":"\u0412\u043e\u0439\u0442\u0438 \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e CAS","message":"\u0412\u0445\u043e\u0434 \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 CAS (\u0432\u0441\u043f\u043b\u044b\u0432\u0430\u044e\u0449\u0438\u0435 \u043e\u043a\u043d\u0430 \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b)"},"yahoo":{"title":"\u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e Yahoo","message":"\u0412\u0445\u043e\u0434 \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 Yahoo (\u0432\u0441\u043f\u043b\u044b\u0432\u0430\u044e\u0449\u0438\u0435 \u043e\u043a\u043d\u0430 \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b)"},"github":{"title":"\u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e GitHub","message":"\u0412\u0445\u043e\u0434 \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 GitHub (\u0432\u0441\u043f\u043b\u044b\u0432\u0430\u044e\u0449\u0438\u0435 \u043e\u043a\u043d\u0430 \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b)"},"persona":{"title":"\u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e Persona","message":"\u0412\u0445\u043e\u0434 \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e \u0443\u0447\u0435\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 Mozilla Persona (\u0432\u0441\u043f\u043b\u044b\u0432\u0430\u044e\u0449\u0438\u0435 \u043e\u043a\u043d\u0430 \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b)"}},"composer":{"posting_not_on_topic":"\u0412\u044b \u043e\u0442\u0432\u0435\u0447\u0430\u0435\u0442\u0435 \u0432 \u0442\u0435\u043c\u0435 \"{{title}}\", \u043d\u043e \u0432 \u0434\u0430\u043d\u043d\u044b\u0439 \u043c\u043e\u043c\u0435\u043d\u0442 \u043f\u0440\u043e\u0441\u043c\u0430\u0442\u0440\u0438\u0432\u0430\u0435\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u0442\u0435\u043c\u0443.","saving_draft_tip":"\u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435","saved_draft_tip":"\u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e","saved_local_draft_tip":"\u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e","similar_topics":"\u0412\u0430\u0448\u0430 \u0442\u0435\u043c\u0430 \u043f\u043e\u0445\u043e\u0436\u0430 \u043d\u0430...","drafts_offline":"\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043d\u044b\u0435 \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a\u0438","min_length":{"need_more_for_title":"\u0434\u043b\u044f \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043a\u0430 \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0435\u0449\u0435 {{n}} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432","need_more_for_reply":"\u0434\u043b\u044f \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0435\u0449\u0435 {{n}} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432"},"error":{"title_missing":"\u041d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a.","title_too_short":"\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043c\u0438\u043d\u0438\u043c\u0443\u043c {{min}} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.","title_too_long":"\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u043c\u043e\u0436\u0435\u0442 \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c {{max}} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.","post_missing":"\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u043c.","post_length":"\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0434\u043e\u043b\u0436\u043d\u043e \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043c\u0438\u043d\u0438\u043c\u0443\u043c {{min}} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.","category_missing":"\u041d\u0443\u0436\u043d\u043e \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e."},"save_edit":"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435","reply_original":"\u041e\u0442\u0432\u0435\u0442 \u0432 \u043f\u0435\u0440\u0432\u043e\u043d\u0430\u0447\u0430\u043b\u044c\u043d\u043e\u0439 \u0442\u0435\u043c\u0435","reply_here":"\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u0432 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0442\u0435\u043c\u0435","reply":"\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c","cancel":"\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c","create_topic":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0442\u0435\u043c\u0443","create_pm":"\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","users_placeholder":"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","title_placeholder":"\u041d\u0430\u043f\u0435\u0447\u0430\u0442\u0430\u0439\u0442\u0435 \u0437\u0434\u0435\u0441\u044c \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a. \u0412 \u0447\u0451\u043c, \u0432 \u0434\u0432\u0443\u0445 \u0441\u043b\u043e\u0432\u0430\u0445, \u0441\u0443\u0442\u044c \u043f\u0440\u0435\u0434\u0441\u0442\u043e\u044f\u0449\u0435\u0433\u043e \u043e\u0431\u0441\u0443\u0436\u0434\u0435\u043d\u0438\u044f?","reply_placeholder":"\u041f\u0435\u0447\u0430\u0442\u0430\u0439\u0442\u0435 \u0437\u0434\u0435\u0441\u044c. \u0414\u043b\u044f \u0444\u043e\u0440\u043c\u0430\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f \u0442\u0435\u043a\u0441\u0442\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 Markdown \u0438 BBCode. \u041f\u0435\u0440\u0435\u0442\u044f\u043d\u0438\u0442\u0435 \u0438\u043b\u0438 \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435, \u0447\u0442\u043e\u0431\u044b \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0435\u0433\u043e \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440.","view_new_post":"\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0441\u043e\u0437\u0434\u0430\u043d\u043d\u043e\u0435 \u0432\u0430\u043c\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.","saving":"\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...","saved":"\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e!","saved_draft":"\u0412\u044b \u0432 \u0434\u0430\u043d\u043d\u044b\u0439 \u043c\u043e\u043c\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u0435\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u0432 \u043b\u044e\u0431\u043e\u043c \u043c\u0435\u0441\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0432\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044e.","uploading":"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...","show_preview":"\u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 &raquo;","hide_preview":"&laquo; \u0441\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440","quote_post_title":"\u041f\u0440\u043e\u0446\u0438\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u0441\u0451 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","bold_title":"\u0412\u044b\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0436\u0438\u0440\u043d\u044b\u043c","bold_text":"\u0442\u0435\u043a\u0441\u0442, \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0439 \u0436\u0438\u0440\u043d\u044b\u043c","italic_title":"\u0412\u044b\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u043a\u0443\u0440\u0441\u0438\u0432\u043e\u043c","italic_text":"\u0442\u0435\u043a\u0441\u0442, \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0439 \u043a\u0443\u0440\u0441\u0438\u0432\u043e\u043c","link_title":"\u0421\u0441\u044b\u043b\u043a\u0430","link_description":"\u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0441\u0441\u044b\u043b\u043a\u0438","link_dialog_title":"\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443","link_optional_text":"\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435","quote_title":"\u0426\u0438\u0442\u0430\u0442\u0430","quote_text":"\u0426\u0438\u0442\u0430\u0442\u0430","code_title":"\u0424\u0440\u0430\u0433\u043c\u0435\u043d\u0442 \u043a\u043e\u0434\u0430","code_text":"\u0432\u0432\u043e\u0434\u0438\u0442\u0435 \u043a\u043e\u0434 \u0437\u0434\u0435\u0441\u044c","image_title":"\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435","image_description":"\u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0437\u0434\u0435\u0441\u044c \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f","image_dialog_title":"\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f","image_optional_text":"\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435","image_hosting_hint":"\u041d\u0443\u0436\u0435\u043d <a href='http://www.google.com/search?q=free+image+hosting' target='_blank'>\u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0439 \u0445\u043e\u0441\u0442\u0438\u043d\u0433 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0439?</a>","olist_title":"\u041d\u0443\u043c\u0435\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u0441\u043f\u0438\u0441\u043e\u043a","ulist_title":"\u041c\u0430\u0440\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u0441\u043f\u0438\u0441\u043e\u043a","list_item":"\u042d\u043b\u0435\u043c\u0435\u043d\u0442 \u0441\u043f\u0438\u0441\u043a\u0430","heading_title":"\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a","heading_text":"\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a","hr_title":"\u0413\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u044c\u043d\u044b\u0439 \u0440\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u0435\u043b\u044c","undo_title":"\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c","redo_title":"\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c","help":"\u0421\u043f\u0440\u0430\u0432\u043a\u0430 \u043f\u043e Markdown","toggler":"\u0441\u043a\u0440\u044b\u0442\u044c / \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f","admin_options_title":"\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0442\u0435\u043c\u044b","auto_close_label":"\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u044c \u0442\u0435\u043c\u0443 \u043f\u043e\u0441\u043b\u0435:","auto_close_units":"\u0434\u043d\u0435\u0439"},"notifications":{"title":"\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u043e\u0431 \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0438 @name \u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u0445, \u043e\u0442\u0432\u0435\u0442\u0430\u0445 \u043d\u0430 \u0432\u0430\u0448\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0438 \u0442\u0435\u043c\u044b, \u043b\u0438\u0447\u043d\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0438 \u0442.\u0434.","none":"\u041d\u0430 \u0434\u0430\u043d\u043d\u044b\u0439 \u043c\u043e\u043c\u0435\u043d\u0442 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u043d\u0435\u0442.","more":"\u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0431\u043e\u043b\u0435\u0435 \u0440\u0430\u043d\u043d\u0438\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f","mentioned":"<span title='mentioned' class='icon'>@</span> {{username}} {{link}}","quoted":"<i title='quoted' class='icon icon-quote-right'></i> {{username}} {{link}}","replied":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","posted":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","edited":"<i title='edited' class='icon icon-pencil'></i> {{username}} {{link}}","liked":"<i title='liked' class='icon icon-heart'></i> {{username}} {{link}}","private_message":"<i class='icon icon-envelope-alt' title='private message'></i> {{username}} {{link}}","invited_to_private_message":"<i class='icon icon-envelope-alt' title='private message'></i> {{username}} {{link}}","invitee_accepted":"<i title='\u043f\u0440\u0438\u043d\u044f\u0442\u043e\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435' class='icon icon-signin'></i> {{username}} \u043f\u0440\u0438\u043d\u044f\u043b \u0432\u0430\u0448\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435","moved_post":"<i title='\u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0435\u043d\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435' class='icon icon-arrow-right'></i> {{username}} \u043f\u0435\u0440\u0435\u043d\u0435\u0441 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 {{link}}","total_flagged":"\u0432\u0441\u0435\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0441 \u0436\u0430\u043b\u043e\u0431\u0430\u043c\u0438"},"image_selector":{"title":"\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f","from_my_computer":"\u0421 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430","from_the_web":"\u0418\u0437 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430","add_image":"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435","remote_title":"\u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u0438\u0437 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0430","remote_tip":"\u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u0432 \u0444\u043e\u0440\u043c\u0430\u0442\u0435 http://example.com/image.jpg","local_title":"\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435","local_tip":"\u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u0441 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430.","upload":"\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c","uploading_image":"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f"},"search":{"title":"\u043f\u043e\u0438\u0441\u043a \u043f\u043e \u0442\u0435\u043c\u0430\u043c, \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u043c, \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f\u043c \u0438\u043b\u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f\u043c","placeholder":"\u0443\u0441\u043b\u043e\u0432\u0438\u044f \u043f\u043e\u0438\u0441\u043a\u0430...","no_results":"\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.","searching":"\u041f\u043e\u0438\u0441\u043a ...","prefer":{"user":"\u043f\u0440\u0438 \u043f\u043e\u0438\u0441\u043a\u0435 \u043e\u0442\u0434\u0430\u0432\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043f\u043e\u0447\u0442\u0435\u043d\u0438\u0435 @{{username}}","category":"\u043f\u0440\u0438 \u043f\u043e\u0438\u0441\u043a\u0435 \u043e\u0442\u0434\u0430\u0432\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043f\u043e\u0447\u0442\u0435\u043d\u0438\u0435 {{category}}"}},"site_map":"\u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u0434\u0440\u0443\u0433\u043e\u043c\u0443 \u0441\u043f\u0438\u0441\u043a\u0443 \u0442\u0435\u043c \u0438\u043b\u0438 \u0434\u0440\u0443\u0433\u043e\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438","go_back":"\u0432\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f","current_user":"\u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043d\u0430 \u0432\u0430\u0448\u0443 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","favorite":{"title":"\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435","help":{"star":"\u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u0435\u043c\u0443 \u0432 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435","unstar":"\u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u0435\u043c\u0443 \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e"}},"topics":{"none":{"favorited":"\u0412\u044b \u0435\u0449\u0435 \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u043d\u0438 \u043e\u0434\u043d\u043e\u0439 \u0442\u0435\u043c\u044b \u0432 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435. \u0427\u0442\u043e\u0431\u044b \u0442\u0435\u043c\u0430 \u043f\u043e\u043f\u0430\u043b\u0430 \u0432 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435, \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u043d\u0430 \u0437\u0432\u0435\u0437\u0434\u043e\u0447\u043a\u0443 \u0440\u044f\u0434\u043e\u043c \u0441 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435\u043c \u0442\u0435\u043c\u044b.","unread":"\u0412\u0441\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u044b.","new":"\u0412\u0441\u0435 \u0442\u0435\u043c\u044b \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u044b.","read":"\u0412\u044b \u0435\u0449\u0435 \u043d\u0435 \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043b\u0438 \u043d\u0438 \u043e\u0434\u043d\u043e\u0439 \u0442\u0435\u043c\u044b.","posted":"\u0412\u044b \u043d\u0435 \u043f\u0440\u0438\u043d\u0438\u043c\u0430\u043b\u0438 \u0443\u0447\u0430\u0441\u0442\u0438\u0435 \u0432 \u043e\u0431\u0441\u0443\u0436\u0434\u0435\u043d\u0438\u0438.","latest":"\u041d\u043e\u0432\u044b\u0445 \u0442\u0435\u043c \u043d\u0435\u0442.","hot":"\u041f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0445 \u0442\u0435\u043c \u043d\u0435\u0442.","category":"\u0412 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 {{category}} \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0442 \u0442\u0435\u043c\u044b."},"bottom":{"latest":"\u0411\u043e\u043b\u044c\u0448\u0435 \u043d\u043e\u0432\u044b\u0445 \u0442\u0435\u043c \u043d\u0435\u0442.","hot":"\u0411\u043e\u043b\u044c\u0448\u0435 \u043f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0445 \u0442\u0435\u043c \u043d\u0435\u0442.","posted":"\u0411\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u0442 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u0442\u0435\u043c.","read":"\u0411\u043e\u043b\u044c\u0448\u0435 \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0445 \u0442\u0435\u043c \u043d\u0435\u0442.","new":"\u0411\u043e\u043b\u044c\u0448\u0435 \u043d\u043e\u0432\u044b\u0445 \u0442\u0435\u043c \u043d\u0435\u0442.","unread":"\u0411\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0445 \u0442\u0435\u043c \u043d\u0435\u0442.","favorited":"\u0411\u043e\u043b\u044c\u0448\u0435 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0442\u0435\u043c \u043d\u0435\u0442.","category":"\u0411\u043e\u043b\u044c\u0448\u0435 \u0432 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 {{category}} \u043d\u0435\u0442 \u0442\u0435\u043c."}},"rank_details":{"toggle":"\u0441\u043a\u0440\u044b\u0442\u044c / \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0434\u0435\u0442\u0430\u043b\u044c\u043d\u044b\u0439 \u0440\u0435\u0439\u0442\u0438\u043d\u0433 \u0442\u0435\u043c\u044b","show":"\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0434\u0435\u0442\u0430\u043b\u044c\u043d\u044b\u0439 \u0440\u0435\u0439\u0442\u0438\u043d\u0433 \u0442\u0435\u043c\u044b","title":"\u0414\u0435\u0442\u0430\u043b\u044c\u043d\u044b\u0439 \u0440\u0435\u0439\u0442\u0438\u043d\u0433 \u0442\u0435\u043c\u044b"},"topic":{"create_in":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0442\u0435\u043c\u0443","create":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0442\u0435\u043c\u0443","create_long":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u0443\u044e \u0442\u0435\u043c\u0443","private_message":"\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","list":"\u0422\u0435\u043c\u044b","new":"\u043d\u043e\u0432\u0430\u044f \u0442\u0435\u043c\u0430","title":"\u0422\u0435\u043c\u0430","loading_more":"\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u0442\u0435\u043c\u044b...","loading":"\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u0442\u0435\u043c\u0443...","invalid_access":{"title":"\u0427\u0430\u0441\u0442\u043d\u0430\u044f \u0442\u0435\u043c\u0430","description":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u0443 \u0432\u0430\u0441 \u043d\u0435\u0442 \u043f\u0440\u0430\u0432 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u0442\u0435\u043c\u0435!"},"server_error":{"title":"\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0442\u0435\u043c\u0443","description":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u043c\u044b \u043d\u0435 \u0441\u043c\u043e\u0433\u043b\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0442\u0435\u043c\u0443, \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e, \u0438\u0437-\u0437\u0430 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u044b \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437. \u0415\u0441\u043b\u0438 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0441\u044f, \u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0441\u043e\u043e\u0431\u0449\u0438\u0442\u0435 \u043d\u0430\u043c \u043e\u0431 \u044d\u0442\u043e\u043c."},"not_found":{"title":"\u0422\u0435\u043c\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430","description":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u0437\u0430\u043f\u0440\u043e\u0448\u0435\u043d\u043d\u0430\u044f \u0442\u0435\u043c\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430. \u0412\u043e\u0437\u043c\u043e\u0436\u043d\u043e, \u043e\u043d\u0430 \u0431\u044b\u043b\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u043e\u043c."},"unread_posts":"{{unread}} \u043d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u0442\u0435\u043c\u0435","new_posts":"{{new_posts}} \u043d\u043e\u0432\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u0442\u0435\u043c\u0435","likes":{"one":"\u044d\u0442\u0430 \u0442\u0435\u043c\u0430 \u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f \u043e\u0434\u043d\u043e\u043c\u0443 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0443","other":"\u044d\u0442\u0430 \u0442\u0435\u043c\u0430 \u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f {{count}} \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430\u043c","few":"\u0442\u0435\u043c\u0430 \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u0430\u0441\u044c {{count}} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f\u043c","many":"\u0442\u0435\u043c\u0430 \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u0430\u0441\u044c {{count}} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f\u043c"},"back_to_list":"\u0412\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a \u0441\u043f\u0438\u0441\u043a\u0443 \u0442\u0435\u043c","options":"\u041e\u043f\u0446\u0438\u0438 \u0442\u0435\u043c\u044b","show_links":"\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0438 \u0432 \u0442\u0435\u043c\u0435","toggle_information":"\u0441\u043a\u0440\u044b\u0442\u044c / \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u0443\u044e \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044e \u043e \u0442\u0435\u043c\u0435","read_more_in_category":"\u0425\u043e\u0442\u0438\u0442\u0435 \u043f\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0447\u0442\u043e-\u043d\u0438\u0431\u0443\u0434\u044c \u0435\u0449\u0435? \u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0438\u0442\u0435 \u0442\u0435\u043c\u044b \u0432 {{catLink}} \u0438\u043b\u0438 {{latestLink}}.","read_more":"\u0425\u043e\u0442\u0438\u0442\u0435 \u043f\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0447\u0442\u043e-\u043d\u0438\u0431\u0443\u0434\u044c \u0435\u0449\u0435? {{catLink}} or {{latestLink}}.","browse_all_categories":"\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u0441\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438","view_latest_topics":"\u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0442\u0435\u043c\u044b","suggest_create_topic":"\u041f\u043e\u0447\u0435\u043c\u0443 \u0431\u044b \u0432\u0430\u043c \u043d\u0435 \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u0443\u044e \u0442\u0435\u043c\u0443?","read_position_reset":"\u0417\u0430\u043a\u043b\u0430\u0434\u043a\u0430 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0430.","jump_reply_up":"\u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u0431\u043e\u043b\u0435\u0435 \u0440\u0430\u043d\u043d\u0438\u043c \u043e\u0442\u0432\u0435\u0442\u0430\u043c","jump_reply_down":"\u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u0431\u043e\u043b\u0435\u0435 \u043f\u043e\u0437\u0434\u043d\u0438\u043c \u043e\u0442\u0432\u0435\u0442\u0430\u043c","deleted":"\u0422\u0435\u043c\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430","auto_close_notice":"\u0422\u0435\u043c\u0430 \u0431\u0443\u0434\u0435\u0442 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u0430 \u0447\u0435\u0440\u0435\u0437 %{timeLeft}.","auto_close_title":"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u0438\u044f \u0442\u0435\u043c\u044b","auto_close_save":"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c","auto_close_cancel":"\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c","auto_close_remove":"\u041d\u0435 \u0437\u0430\u043a\u0440\u044b\u0432\u0430\u0442\u044c \u0442\u0435\u043c\u0443 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438","progress":{"title":"\u0442\u0435\u043a\u0443\u0449\u0435\u0435 \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0432 \u0442\u0435\u043c\u0435","jump_top":"\u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u043f\u0435\u0440\u0432\u043e\u043c\u0443 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044e","jump_bottom":"\u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u043c\u0443 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044e","total":"\u0432\u0441\u0435\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439","current":"\u0442\u0435\u043a\u0443\u0449\u0435\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435"},"notifications":{"title":"","reasons":{"3_2":"\u0412\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u0432\u044b \u043d\u0430\u0431\u043b\u044e\u0434\u0430\u0435\u0442\u0435 \u0437\u0430 \u0442\u0435\u043c\u043e\u0439.","3_1":"\u0412\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u0432\u044b \u0441\u043e\u0437\u0434\u0430\u043b\u0438 \u0442\u0435\u043c\u0443.","3":"\u0412\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u0432\u044b \u043d\u0430\u0431\u043b\u044e\u0434\u0430\u0435\u0442\u0435 \u0437\u0430 \u0442\u0435\u043c\u043e\u0439.","2_4":"\u0412\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u0432\u044b \u043e\u0442\u0432\u0435\u0442\u0438\u043b\u0438 \u0432 \u0442\u0435\u043c\u0435.","2_2":"\u0412\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u0432\u044b \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0435 \u0442\u0435\u043c\u0443.","2":"\u0412\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u0432\u044b <a href=\"/users/{{username}}/preferences\">\u0447\u0438\u0442\u0430\u043b\u0438 \u0442\u0435\u043c\u0443</a>.","1":"\u0412\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435, \u0442\u043e\u043b\u044c\u043a\u043e \u0435\u0441\u043b\u0438 \u043a\u0442\u043e-\u043d\u0438\u0431\u0443\u0434\u044c \u0443\u043f\u043e\u043c\u044f\u043d\u0435\u0442 \u0432\u0430\u0441 \u043f\u043e @name \u0438\u043b\u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u0442 \u043d\u0430 \u0432\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.","1_2":"\u0412\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435, \u0442\u043e\u043b\u044c\u043a\u043e \u0435\u0441\u043b\u0438 \u043a\u0442\u043e-\u043d\u0438\u0431\u0443\u0434\u044c \u0443\u043f\u043e\u043c\u044f\u043d\u0435\u0442 \u0432\u0430\u0441 \u043f\u043e @name \u0438\u043b\u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u0442 \u043d\u0430 \u0432\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.","0":"\u0412\u044b \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u043f\u043e \u0442\u0435\u043c\u0435.","0_2":"\u0412\u044b \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u043f\u043e \u0442\u0435\u043c\u0435."},"watching":{"title":"\u041d\u0430\u0431\u043b\u044e\u0434\u0435\u043d\u0438\u0435","description":"\u0442\u043e \u0436\u0435 \u0441\u0430\u043c\u043e\u0435, \u0447\u0442\u043e \u0438 \u0440\u0435\u0436\u0438\u043c \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u043d\u0438\u044f, \u043d\u043e \u0432\u044b \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u043e\u0431\u043e \u0432\u0441\u0435\u0445 \u043d\u043e\u0432\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u0445."},"tracking":{"title":"\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u043d\u0438\u0435","description":"\u0432\u0430\u043c \u0431\u0443\u0434\u0435\u0442 \u043f\u0440\u0438\u0441\u043b\u0430\u043d\u043e \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435, \u0435\u0441\u043b\u0438 \u043a\u0442\u043e-\u0442\u043e \u0443\u043f\u043e\u043c\u044f\u043d\u0435\u0442 \u0432\u0430\u0441 \u043f\u043e @name \u0438\u043b\u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u0442 \u043d\u0430 \u0432\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435, \u0430 \u0442\u0430\u043a\u0436\u0435 \u0432\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u0432\u0438\u0434\u0435\u0442\u044c \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439, \u043d\u043e\u0432\u044b\u0445 \u0438 \u043d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0445 \u0432\u0430\u043c\u0438."},"regular":{"title":"\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u043d\u044b\u0439","description":"\u0432\u0430\u043c \u0431\u0443\u0434\u0435\u0442 \u043f\u0440\u0438\u0441\u043b\u0430\u043d\u043e \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435, \u0435\u0441\u043b\u0438 \u043a\u0442\u043e-\u0442\u043e \u0443\u043f\u043e\u043c\u044f\u043d\u0435\u0442 \u0432\u0430\u0441 \u043f\u043e @name \u0438\u043b\u0438 \u043e\u0442\u0432\u0435\u0442\u0438\u0442 \u043d\u0430 \u0432\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435."},"muted":{"title":"\u0412\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u043e","description":"\u0442\u0435\u043c\u0430 \u043d\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u043d\u0430 \u0432\u043a\u043b\u0430\u0434\u043a\u0435 <b>\u041d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0435</b>, \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u043e \u043d\u043e\u0432\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u0445 \u0432 \u0442\u0435\u043c\u0435 \u0432\u0430\u043c \u043d\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u044e\u0442\u0441\u044f."}},"actions":{"delete":"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u0435\u043c\u0443","open":"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0442\u0435\u043c\u0443","close":"\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0442\u0435\u043c\u0443","auto_close":"\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u0437\u0430\u043a\u0440\u044b\u0442\u0438\u0435","unpin":"\u041e\u0442\u043b\u0435\u043f\u0438\u0442\u044c \u0442\u0435\u043c\u0443","pin":"\u041f\u0440\u0438\u043b\u0435\u043f\u0438\u0442\u044c \u0442\u0435\u043c\u0443","unarchive":"\u0420\u0430\u0437\u0430\u0440\u0445\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0442\u0435\u043c\u0443","archive":"\u0410\u0440\u0445\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0442\u0435\u043c\u0443","invisible":"\u0421\u0434\u0435\u043b\u0430\u0442\u044c \u043d\u0435\u0432\u0438\u0434\u0438\u043c\u043e\u0439","visible":"\u0421\u0434\u0435\u043b\u0430\u0442\u044c \u0432\u0438\u0434\u0438\u043c\u043e\u0439","reset_read":"\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0441\u0447\u0435\u0442\u0447\u0438\u043a\u0438","multi_select":"\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0434\u043b\u044f \u043e\u0431\u044a\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f/\u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f","convert_to_topic":"\u041f\u0440\u0435\u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u0442\u044c \u0432 \u043e\u0431\u044b\u0447\u043d\u0443\u044e \u0442\u0435\u043c\u0443"},"reply":{"title":"\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c","help":"\u043e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u0432 \u0442\u0435\u043c\u0435"},"clear_pin":{"title":"\u041e\u0442\u043b\u0435\u043f\u0438\u0442\u044c","help":"\u041e\u0442\u043b\u0435\u043f\u0438\u0442\u044c \u0442\u0435\u043c\u0443, \u0447\u0442\u043e\u0431\u044b \u043e\u043d\u0430 \u0431\u043e\u043b\u0435\u0435 \u043d\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u043b\u0430\u0441\u044c \u0432 \u0441\u0430\u043c\u043e\u043c \u043d\u0430\u0447\u0430\u043b\u0435 \u0441\u043f\u0438\u0441\u043a\u0430 \u0442\u0435\u043c"},"share":{"title":"\u041f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f","help":"\u041f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u043d\u0430 \u0442\u0435\u043c\u0443"},"inviting":"\u0412\u044b\u0441\u044b\u043b\u0430\u044e \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435...","invite_private":{"title":"\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","email_or_username":"\u0410\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u0438\u043b\u0438 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0442\u043e\u0433\u043e, \u043a\u043e\u0433\u043e \u0432\u044b \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0441\u0438\u0442\u044c","email_or_username_placeholder":"\u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b \u0438\u043b\u0438 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","action":"\u041f\u0440\u0438\u0433\u043b\u0430\u0441\u0438\u0442\u044c","success":"\u041b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0431\u044b\u043b\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e.","error":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u0432 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430."},"invite_reply":{"title":"\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0434\u0440\u0443\u0437\u0435\u0439","action":"\u0412\u044b\u0441\u043b\u0430\u0442\u044c \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435 \u043f\u043e \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u0435","help":"\u043e\u0442\u043f\u0440\u0430\u0432\u044c\u0442\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f \u0441\u0432\u043e\u0438\u043c \u0434\u0440\u0443\u0437\u044c\u044f\u043c, \u0447\u0442\u043e\u0431\u044b \u043e\u043d\u0438 \u0442\u043e\u0436\u0435 \u0441\u043c\u043e\u0433\u043b\u0438 \u043f\u043e\u0443\u0447\u0430\u0441\u0442\u0432\u043e\u0432\u0430\u0442\u044c \u0432 \u043e\u0431\u0441\u0443\u0436\u0434\u0435\u043d\u0438\u0438 \u0442\u0435\u043c\u044b","email":"\u041c\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043c \u0432\u0430\u0448\u0435\u043c\u0443 \u0434\u0440\u0443\u0433\u0443 \u043a\u0440\u0430\u0442\u043a\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e, \u0438 \u043e\u043d \u0441\u043c\u043e\u0436\u0435\u0442 \u043e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u043e\u0434\u043d\u0438\u043c \u0449\u0435\u043b\u0447\u043a\u043e\u043c \u043c\u044b\u0448\u0438.","email_placeholder":"\u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b","success":"\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043f\u043e \u0430\u0434\u0440\u0435\u0441\u0443 <b>{{email}}</b>. \u041c\u044b \u0432\u044b\u0448\u043b\u0435\u043c \u0432\u0430\u043c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435, \u043a\u043e\u0433\u0434\u0430 \u0432\u0430\u0448\u0438\u043c \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435\u043c \u0432\u043e\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u044e\u0442\u0441\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0432\u043a\u043b\u0430\u0434\u043a\u0443 <b>\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f</b> \u043d\u0430 \u0432\u0430\u0448\u0435\u0439 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f, \u0447\u0442\u043e\u0431\u044b \u0432\u0438\u0434\u0435\u0442\u044c, \u043a\u043e\u0433\u043e \u0432\u044b \u0443\u0436\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0441\u0438\u043b\u0438.","error":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u043c\u044b \u043d\u0435 \u0441\u043c\u043e\u0433\u043b\u0438 \u043f\u0440\u0438\u0433\u043b\u0430\u0441\u0438\u0442\u044c \u044d\u0442\u043e\u0433\u043e \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430. \u0412\u043e\u0437\u043c\u043e\u0436\u043d\u043e, \u043e\u043d \u0443\u0436\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0444\u043e\u0440\u0443\u043c\u0430?"},"login_reply":"\u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u043d\u0430 \u0444\u043e\u0440\u0443\u043c, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","filters":{"user":"\u041e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e {{n_posts}} \u043e\u0442 {{by_n_users}}.","n_posts":{"one":"1 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","other":"{{count}} \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439","few":"{{count}} \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","many":"{{count}} \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439"},"by_n_users":{"one":"\u043e\u0442 \u043e\u0434\u043d\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","other":"\u043e\u0442 {{count}} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439","few":"\u043e\u0442 {{count}} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","many":"\u043e\u0442 {{count}} \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439"},"best_of":"\u041e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e {{n_best_posts}} \u0438\u0437 {{of_n_posts}}.","n_best_posts":{"one":"1 \u043b\u0443\u0447\u0448\u0435\u0435","other":"{{count}} \u043b\u0443\u0447\u0448\u0438\u0445","few":"{{count}} \u043b\u0443\u0447\u0448\u0438\u0445","many":"{{count}} \u043b\u0443\u0447\u0448\u0438\u0445"},"of_n_posts":{"one":"\u0438\u0437 1 \u0432 \u0442\u0435\u043c\u0435","other":"\u0438\u0437 {{count}} \u0432 \u0442\u0435\u043c\u0435","few":"\u0438\u0437 {{count}} \u0432 \u0442\u0435\u043c\u0435","many":"\u0438\u0437 {{count}} \u0432 \u0442\u0435\u043c\u0435"},"cancel":"\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0432 \u044d\u0442\u043e\u0439 \u0442\u0435\u043c\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437."},"split_topic":{"title":"\u0420\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u044c \u0442\u0435\u043c\u0443","action":"\u0440\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u044c \u0442\u0435\u043c\u0443","topic_name":"\u041d\u043e\u0432\u044b\u0439 \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u0442\u0435\u043c\u044b:","error":"\u0412 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u0435 \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u0442\u0435\u043c\u044b \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","instructions":{"one":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u0443\u044e \u0442\u0435\u043c\u0443, \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u044f \u0432 \u043d\u0435\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.","other":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u0443\u044e \u0442\u0435\u043c\u0443, \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u044f \u0432 \u043d\u0435\u0435  <b>{{count}}</b> \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.","few":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u0443\u044e \u0442\u0435\u043c\u0443, \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u044f \u0432 \u043d\u0435\u0435  <b>{{count}}</b> \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f.","many":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u0443\u044e \u0442\u0435\u043c\u0443, \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u044f \u0432 \u043d\u0435\u0435  <b>{{count}}</b> \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439."}},"merge_topic":{"title":"\u041e\u0431\u044a\u0435\u0434\u0438\u043d\u0438\u0442\u044c \u0442\u0435\u043c\u0443","action":"\u043e\u0431\u044a\u0435\u0434\u0438\u043d\u0438\u0442\u044c \u0442\u0435\u043c\u0443","error":"\u0412 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u0435 \u043e\u0431\u044a\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f \u0442\u0435\u043c\u044b \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","instructions":{"one":"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0435\u043c\u0443, \u0432 \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0442\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.","other":"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0435\u043c\u0443, \u0432 \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0442\u0438 <b>{{count}}</b> \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.","few":"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0435\u043c\u0443, \u0432 \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0442\u0438 <b>{{count}}</b> \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f.","many":"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0435\u043c\u0443, \u0432 \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0442\u0438 <b>{{count}}</b> \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439."}},"multi_select":{"select":"\u0432\u044b\u0431\u0440\u0430\u0442\u044c","selected":"\u0432\u044b\u0431\u0440\u0430\u043d\u043e ({{count}})","delete":"\u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435","cancel":"\u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u0438\u0435","description":{"one":"\u0412\u044b \u0432\u044b\u0431\u0440\u0430\u043b\u0438 <b>1</b> \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.","other":"\u0412\u044b \u0432\u044b\u0431\u0440\u0430\u043b\u0438 <b>{{count}}</b> \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.","few":"\u0412\u044b \u0432\u044b\u0431\u0440\u0430\u043b\u0438 <b>{{count}}</b> \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f.","many":"\u0412\u044b \u0432\u044b\u0431\u0440\u0430\u043b\u0438 <b>{{count}}</b> \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439."}}},"post":{"reply":"\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u043d\u0430 {{link}} \u043e\u0442 {{replyAvatar}} {{username}}","reply_topic":"\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u043d\u0430 {{link}}","quote_reply":"\u043e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u0446\u0438\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435\u043c","edit":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c {{link}} \u043e\u0442 {{replyAvatar}} {{username}}","post_number":"\u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 {{number}}","in_reply_to":"\u0432 \u043e\u0442\u0432\u0435\u0442\u0435","reply_as_new_topic":"\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u0432 \u043d\u043e\u0432\u043e\u0439 \u0442\u0435\u043c\u0435","continue_discussion":"\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u043e\u0431\u0441\u0443\u0436\u0434\u0435\u043d\u0438\u0435 \u0438\u0437 {{postLink}}:","follow_quote":"\u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u043f\u0440\u043e\u0446\u0438\u0442\u0438\u0440\u0443\u0435\u043c\u043e\u043c\u0443 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044e","deleted_by_author":"(\u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e \u0430\u0432\u0442\u043e\u0440\u043e\u043c)","expand_collapse":"\u0440\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c/\u0441\u0432\u0435\u0440\u043d\u0443\u0442\u044c","has_replies":{"one":"\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c","other":"\u041e\u0442\u0432\u0435\u0442\u044b","few":"\u041e\u0442\u0432\u0435\u0442\u044b","many":"\u041e\u0442\u0432\u0435\u0442\u044b"},"errors":{"create":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.","edit":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.","upload":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0444\u0430\u0439\u043b. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.","upload_too_large":"\u041f\u0440\u0435\u0432\u044b\u0448\u0435\u043d \u0434\u043e\u043f\u0443\u0441\u0442\u0438\u043c\u044b\u0439 \u0440\u0430\u0437\u043c\u0435\u0440 ({{max_size_kb}}kb) \u0444\u0430\u0439\u043b\u0430. \u0423\u043c\u0435\u043d\u044c\u0448\u0438\u0442\u0435 \u0440\u0430\u0437\u043c\u0435\u0440 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.","upload_too_many_images":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u0437\u0430 \u043e\u0434\u0438\u043d \u0440\u0430\u0437 \u043c\u043e\u0436\u043d\u043e \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043e\u0434\u043d\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435.","only_images_are_supported":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u043c\u043e\u0436\u043d\u043e \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f."},"abandon":"\u0412\u044b \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u043e\u043a\u0438\u043d\u0443\u0442\u044c \u0432\u0430\u0448\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435?","archetypes":{"save":"\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f"},"controls":{"reply":"\u043d\u0430\u0447\u0430\u0442\u044c \u0441\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043e\u0442\u0432\u0435\u0442\u0430 \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","like":"\u043c\u043d\u0435 \u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f","edit":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","flag":"\u041f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c\u0441\u044f \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","delete":"\u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","undelete":"\u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u0435","share":"\u043f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","bookmark":"\u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","more":"\u0415\u0449\u0451"},"actions":{"flag":"\u0416\u0430\u043b\u043e\u0431\u0430","clear_flags":{"one":"\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443","other":"\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u044b","few":"\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u044b","many":"\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u044b"},"it_too":{"off_topic":"\u041f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c\u0441\u044f","spam":"\u041f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c\u0441\u044f","inappropriate":"\u041f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c\u0441\u044f","custom_flag":"\u041f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c\u0441\u044f","bookmark":"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","like":"\u041c\u043d\u0435 \u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f","vote":"\u041f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u0442\u044c"},"undo":{"off_topic":"\u041e\u0442\u043e\u0437\u0432\u0430\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443","spam":"\u041e\u0442\u043e\u0437\u0432\u0430\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443","inappropriate":"\u041e\u0442\u043e\u0437\u0432\u0430\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443","bookmark":"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0438\u0437 \u0437\u0430\u043a\u043b\u0430\u0434\u043e\u043a","like":"\u0411\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f","vote":"\u041e\u0442\u043e\u0437\u0432\u0430\u0442\u044c \u0433\u043e\u043b\u043e\u0441"},"people":{"off_topic":"{{icons}} \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a","spam":"{{icons}} \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u043a\u0430\u043a \u0441\u043f\u0430\u043c","inappropriate":"{{icons}} \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435","notify_moderators":"{{icons}} \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u0430\u043c","notify_moderators_with_url":"{{icons}} <a href='{{postUrl}}'>\u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u0430\u043c</a>","notify_user":"{{icons}} \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","notify_user_with_url":"{{icons}} \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 <a href='{{postUrl}}'>\u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435</a>","bookmark":"{{icons}} \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","like":"{{icons}} \u0432\u044b\u0440\u0430\u0437\u0438\u043b\u0438 \u0441\u0438\u043c\u043f\u0430\u0442\u0438\u044e","vote":"{{icons}} \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430"},"by_you":{"off_topic":"\u041f\u043e\u043c\u0435\u0447\u0435\u043d\u0430 \u0432\u0430\u043c\u0438 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a","spam":"\u041f\u043e\u043c\u0435\u0447\u0435\u043d\u0430 \u0432\u0430\u043c\u0438 \u043a\u0430\u043a \u0441\u043f\u0430\u043c","inappropriate":"\u041f\u043e\u043c\u0435\u0447\u0435\u043d\u0430 \u0432\u0430\u043c\u0438 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435","notify_moderators":"\u0412\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u0436\u0430\u043b\u043e\u0431\u0443 \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u0443","notify_user":"\u0412\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e","bookmark":"\u0412\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","like":"\u0412\u0430\u043c \u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f","vote":"\u0412\u044b \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430 \u0434\u0430\u043d\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435"},"by_you_and_others":{"off_topic":{"one":"\u0412\u044b \u0438 \u0435\u0449\u0435 1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a","other":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a","few":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a","many":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a"},"spam":{"one":"\u0412\u044b \u0438 \u0435\u0449\u0435 1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u0441\u043f\u0430\u043c","other":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u0441\u043f\u0430\u043c","few":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u0441\u043f\u0430\u043c","many":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u0441\u043f\u0430\u043c"},"inappropriate":{"one":"\u0412\u044b \u0438 \u0435\u0449\u0435 1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435","other":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435","few":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435","many":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435"},"notify_moderators":{"one":"\u0412\u044b \u0438 \u0435\u0449\u0435 1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","other":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","few":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","many":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435"},"notify_user":{"one":"\u0412\u044b \u0438 \u0435\u0449\u0435 1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e","other":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e","few":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e","many":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e"},"bookmark":{"one":"\u0412\u044b \u0438 \u0435\u0449\u0435 1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","other":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","few":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","many":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438"},"like":{"one":"\u0412\u0430\u043c \u0438 \u0435\u0449\u0435 \u043e\u0434\u043d\u043e\u043c\u0443 \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0443 \u044d\u0442\u043e \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c","other":"\u0412\u0430\u043c \u0438 \u0435\u0449\u0435 {{count}} \u0434\u0440\u0443\u0433\u0438\u043c \u043b\u044e\u0434\u044f\u043c \u044d\u0442\u043e \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c","few":"\u0412\u0430\u043c \u0438 \u0435\u0449\u0435 {{count}} \u043b\u044e\u0434\u044f\u043c \u044d\u0442\u043e \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c","many":"\u0412\u0430\u043c \u0438 \u0435\u0449\u0435 {{count}} \u043b\u044e\u0434\u044f\u043c \u044d\u0442\u043e \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c"},"vote":{"one":"\u0412\u044b \u0438 \u0435\u0449\u0435 1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","other":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","few":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","many":"\u0412\u044b \u0438 \u0435\u0449\u0435 {{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435"}},"by_others":{"off_topic":{"one":"1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a","other":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a","few":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a","many":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043e\u0444\u0444\u0442\u043e\u043f\u0438\u043a"},"spam":{"one":"1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u0441\u043f\u0430\u043c","other":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u0441\u043f\u0430\u043c","few":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u0441\u043f\u0430\u043c","many":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u0441\u043f\u0430\u043c"},"inappropriate":{"one":"1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435","other":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435","few":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435","many":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043a\u0430\u043a \u043d\u0435\u0443\u043c\u0435\u0441\u0442\u043d\u043e\u0435"},"notify_moderators":{"one":"1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0441\u044f \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","other":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","few":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","many":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435"},"notify_user":{"one":"1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u044d\u0442\u043e\u043c\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e","other":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u044d\u0442\u043e\u043c\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e","few":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u044d\u0442\u043e\u043c\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e","many":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043b\u0438\u0447\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u044d\u0442\u043e\u043c\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e"},"bookmark":{"one":"1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u0434\u043e\u0431\u0430\u0432\u0438\u043b \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","other":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","few":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438","many":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u043b\u0430\u0434\u043a\u0438"},"like":{"one":"1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0443 \u044d\u0442\u043e \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c","other":"{{count}} \u043b\u044e\u0434\u044f\u043c \u044d\u0442\u043e \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c","few":"{{count}} \u043b\u044e\u0434\u044f\u043c \u044d\u0442\u043e \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c","many":"{{count}} \u043b\u044e\u0434\u044f\u043c \u044d\u0442\u043e \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c"},"vote":{"one":"1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b \u0437\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","other":"{{count}} \u043b\u044e\u0434\u0435\u0439 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","few":"{{count}} \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","many":"{{count}} \u043b\u044e\u0434\u0435\u0439 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u0438 \u0437\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435"}}},"edits":{"one":"\u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043b\u043e\u0441\u044c 1 \u0440\u0430\u0437","other":"\u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043b\u043e\u0441\u044c {{count}} \u0440\u0430\u0437","zero":"\u043d\u0435 \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043b\u043e\u0441\u044c"},"delete":{"confirm":{"one":"\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435?","other":"\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f?","few":"\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f?","many":"\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f?"}}},"category":{"none":"(\u0431\u0435\u0437 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438)","edit":"\u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c","edit_long":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e","edit_uncategorized":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \"\u0411\u0435\u0437 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438\"","view":"\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0442\u0435\u043c \u043f\u043e \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f\u043c","general":"\u041e\u0431\u0449\u0438\u0435","settings":"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438","delete":"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e","create":"\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e","save":"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e","creation_error":"\u041f\u0440\u0438 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0438 \u043d\u043e\u0432\u043e\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u0432\u043e\u0437\u043d\u0438\u043a\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","save_error":"\u041f\u0440\u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u0432\u043e\u0437\u043d\u0438\u043a\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","more_posts":"\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u0441\u0435 {{posts}}...","name":"\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438","description":"\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435","topic":"\u0442\u0435\u043c\u0430 \u0432 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438","badge_colors":"\u0426\u0432\u0435\u0442\u0430 \u043c\u0435\u0442\u043a\u0438","background_color":"\u0426\u0432\u0435\u0442 \u0444\u043e\u043d\u0430","foreground_color":"\u0426\u0432\u0435\u0442 \u043f\u0435\u0440\u0435\u0434\u043d\u0435\u0433\u043e \u043f\u043b\u0430\u043d\u0430","name_placeholder":"\u0414\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u043a\u0440\u0430\u0442\u043a\u0438\u043c \u0438 \u0435\u043c\u043a\u0438\u043c.","color_placeholder":"\u041b\u044e\u0431\u043e\u0439 \u0446\u0432\u0435\u0442 \u0438\u0437 \u0432\u0435\u0431-\u043f\u0430\u043b\u0438\u0442\u0440\u044b","delete_confirm":"\u0412\u044b \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e?","delete_error":"\u041f\u0440\u0438 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","list":"\u0421\u043f\u0438\u0441\u043e\u043a \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0439","no_description":"\u0414\u043b\u044f \u044d\u0442\u043e\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043d\u0435\u0442 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f, \u043e\u0442\u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0442\u0435\u043c\u044b.","change_in_category_topic":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435","hotness":"\u041f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u043e\u0441\u0442\u044c","already_used":"\u0426\u0432\u0435\u0442 \u0443\u0436\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f \u0434\u0440\u0443\u0433\u043e\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0435\u0439","is_secure":"\u041e\u0431\u0435\u0437\u043e\u043f\u0430\u0441\u0438\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e?","add_group":"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0433\u0440\u0443\u043f\u043f\u0443","security":"\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c","allowed_groups":"\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u0433\u0440\u0443\u043f\u043f\u044b:","auto_close_label":"\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0442\u0435\u043c\u0443 \u0447\u0435\u0440\u0435\u0437:"},"flagging":{"title":"\u041f\u043e\u0447\u0435\u043c\u0443 \u0432\u044b \u043f\u043e\u0441\u044b\u043b\u0430\u0435\u0442\u0435 \u0436\u0430\u043b\u043e\u0431\u0443 \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435?","action":"\u041f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c\u0441\u044f","take_action":"\u041f\u0440\u0438\u043d\u044f\u0442\u044c \u043c\u0435\u0440\u044b","notify_action":"\u041e\u043f\u043e\u0432\u0435\u0441\u0442\u0438\u0442\u044c","cant":"\u0418\u0437\u0432\u0438\u043d\u0438\u0442\u0435, \u043d\u043e \u0432\u044b \u043d\u0435 \u043c\u043e\u0436\u0435\u0442\u0435 \u0441\u0435\u0439\u0447\u0430\u0441 \u043f\u043e\u0441\u043b\u0430\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u0443.","custom_placeholder_notify_user":"\u041f\u043e\u0447\u0435\u043c\u0443 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e\u0431\u0443\u0434\u0438\u043b\u043e \u0432\u0430\u0441 \u043e\u0431\u0440\u0430\u0442\u0438\u0442\u044c\u0441\u044f \u043a \u044d\u0442\u043e\u043c\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e \u043d\u0430\u043f\u0440\u044f\u043c\u0443\u044e \u0438 \u0432 \u0447\u0430\u0441\u0442\u043d\u043e\u043c \u043f\u043e\u0440\u044f\u0434\u043a\u0435? \u0411\u0443\u0434\u044c\u0442\u0435 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u044b, \u0431\u0443\u0434\u044c\u0442\u0435 \u043a\u043e\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0438\u0432\u043d\u044b \u0438 \u0432\u0441\u0435\u0433\u0434\u0430 \u0434\u043e\u0431\u0440\u043e\u0436\u0435\u043b\u0430\u0442\u0435\u043b\u044c\u043d\u044b.","custom_placeholder_notify_moderators":"\u041f\u043e\u0447\u0435\u043c\u0443 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043f\u043e\u0431\u0443\u0434\u0438\u043b\u043e \u0432\u0430\u0441 \u043e\u0431\u0440\u0430\u0442\u0438\u0442\u044c\u0441\u044f \u0441 \u0436\u0430\u043b\u043e\u0431\u043e\u0439 \u043a \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u0443? \u0421\u043e\u043e\u0431\u0449\u0438\u0442\u0435 \u043d\u0430\u043c \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u043e, \u0447\u0435\u043c \u0432\u044b \u043e\u0431\u0435\u0441\u043f\u043e\u043a\u043e\u0435\u043d\u044b \u0438 \u043f\u0440\u0435\u0434\u043e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044e\u0449\u0438\u0435 \u0441\u0441\u044b\u043b\u043a\u0438, \u0433\u0434\u0435 \u044d\u0442\u043e \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e.","custom_message":{"at_least":"\u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u0430\u043a \u043c\u0438\u043d\u0438\u043c\u0443\u043c {{n}} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432","more":"\u0435\u0449\u0451 {{n}} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432...","left":"\u043e\u0441\u0442\u0430\u043b\u043e\u0441\u044c {{n}} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432"}},"topic_summary":{"title":"\u0421\u0432\u043e\u0434\u043a\u0430 \u043f\u043e \u0442\u0435\u043c\u0435","links_shown":"\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435 {{totalLinks}} \u0441\u0441\u044b\u043b\u043e\u043a...","clicks":"\u043f\u0435\u0440\u0435\u0445\u043e\u0434\u043e\u0432","topic_link":"\u0441\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u0442\u0435\u043c\u0443"},"topic_statuses":{"locked":{"help":"\u0437\u0430\u043a\u0440\u044b\u0442\u0430\u044f \u0442\u0435\u043c\u0430 (\u0432 \u044d\u0442\u043e\u0439 \u0442\u0435\u043c\u0435 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u0432\u0435\u0447\u0430\u0442\u044c)"},"pinned":{"help":"\u043f\u0440\u0438\u043b\u0435\u043f\u043b\u0435\u043d\u043d\u0430\u044f \u0442\u0435\u043c\u0430 (\u0431\u0443\u0434\u0435\u0442 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0430 \u0432 \u043d\u0430\u0447\u0430\u043b\u0435 \u0441\u043f\u0438\u0441\u043a\u0430 \u0442\u0435\u043c \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044e\u0449\u0435\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438)"},"archived":{"help":"\u0430\u0440\u0445\u0438\u0432\u043d\u0430\u044f \u0442\u0435\u043c\u0430 (\u0437\u0430\u043c\u043e\u0440\u043e\u0436\u0435\u043d\u0430 \u0438 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0430)"},"invisible":{"help":"\u0441\u043a\u0440\u044b\u0442\u0430\u044f \u0442\u0435\u043c\u0430 (\u043d\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0432 \u0441\u043f\u0438\u0441\u043a\u0435 \u0442\u0435\u043c, \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u0442\u0435\u043c\u0435 \u043e\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e \u043f\u0440\u044f\u043c\u043e\u0439 \u0441\u0441\u044b\u043b\u043a\u0435)"}},"posts":"\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","posts_long":"{{number}} \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u0442\u0435\u043c\u0435","original_post":"\u041d\u0430\u0447\u0430\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","views":"\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u043e\u0432","replies":"\u041e\u0442\u0432\u0435\u0442\u043e\u0432","views_long":"\u0442\u0435\u043c\u0430 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u0430 {{number}} \u0440\u0430\u0437","activity":"\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c","likes":"\u0421\u0438\u043c\u043f\u0430\u0442\u0438\u0439","top_contributors":"\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432","category_title":"\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f","history":"\u0418\u0441\u0442\u043e\u0440\u0438\u044f","changed_by":"\u0430\u0432\u0442\u043e\u0440\u043e\u043c {{author}}","categories_list":"\u0421\u043f\u0438\u0441\u043e\u043a \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0439","filters":{"latest":{"title":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435","help":"\u0441\u0430\u043c\u044b\u0435 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0442\u0435\u043c\u044b"},"hot":{"title":"\u041f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u043e\u0435","help":"\u043f\u043e\u0434\u0431\u043e\u0440\u043a\u0430 \u043f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0445 \u0442\u0435\u043c"},"favorited":{"title":"\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435","help":"\u0442\u0435\u043c\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0432\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438 \u0432 \u0441\u043f\u0438\u0441\u043e\u043a \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u044b\u0445"},"read":{"title":"\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u043e\u0435","help":"\u0442\u0435\u043c\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0432\u0430\u0441 \u0437\u0430\u0438\u043d\u0442\u0435\u0440\u0435\u0441\u043e\u0432\u0430\u043b\u0438 (\u0432 \u043e\u0431\u0440\u0430\u0442\u043d\u043e\u043c \u0445\u0440\u043e\u043d\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u043e\u043c \u043f\u043e\u0440\u044f\u0434\u043a\u0435)"},"categories":{"title":"\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438","title_in":"\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f - {{categoryName}}","help":"\u0432\u0441\u0435 \u0442\u0435\u043c\u044b, \u0441\u0433\u0440\u0443\u043f\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043f\u043e \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f\u043c"},"unread":{"title":{"zero":"\u041d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0435","one":"\u041d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0435 (1)","other":"\u041d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0435 ({{count}})"},"help":"\u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u043c\u044b\u0435 \u0442\u0435\u043c\u044b \u0441 \u043d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u043c\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u043c\u0438"},"new":{"title":{"zero":"\u041d\u043e\u0432\u044b\u0435","one":"\u041d\u043e\u0432\u044b\u0435 (1)","other":"\u041d\u043e\u0432\u044b\u0435 ({{count}})"},"help":"\u043d\u043e\u0432\u044b\u0435 \u0442\u0435\u043c\u044b \u0441 \u043c\u043e\u043c\u0435\u043d\u0442\u0430 \u0432\u0430\u0448\u0435\u0433\u043e \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0433\u043e \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u044f"},"posted":{"title":"\u041c\u043e\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","help":"\u0442\u0435\u043c\u044b, \u0432 \u043a\u043e\u0442\u043e\u0440\u044b\u0445 \u0432\u044b \u043e\u0442\u0432\u0435\u0447\u0430\u043b\u0438"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"\u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0442\u0435\u043c\u044b \u0432 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 {{categoryName}}"}},"browser_update":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, <a href=\"http://www.discourse.org/faq/#browser\">\u0432\u0430\u0448 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0443\u0441\u0442\u0430\u0440\u0435\u043b</a> \u0434\u043b\u044f \u043a\u043e\u043c\u0444\u043e\u0440\u0442\u043d\u043e\u0433\u043e \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430 \u043d\u0430\u0448\u0435\u0433\u043e \u0444\u043e\u0440\u0443\u043c\u0430. \u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, <a href=\"http://browsehappy.com\">\u043e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0432\u0430\u0448 \u0431\u0440\u0430\u0443\u0437\u0435\u0440</a>.","type_to_filter":"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043a\u0441\u0442 \u0434\u043b\u044f \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u0446\u0438\u0438...","admin":{"title":"Discourse Admin","moderator":"\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440","dashboard":{"title":"\u0418\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u043e\u043d\u043d\u0430\u044f \u043f\u0430\u043d\u0435\u043b\u044c","version":"\u0412\u0435\u0440\u0441\u0438\u044f","up_to_date":"\u0412\u044b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0435 \u0441\u0430\u043c\u0443\u044e \u0441\u0432\u0435\u0436\u0438\u044e \u0432\u0435\u0440\u0441\u0438\u044e!","critical_available":"\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u043a\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435.","updates_available":"\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f.","please_upgrade":"\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u0435\u0441\u044c!","installed_version":"\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u0430\u044f \u0432\u0435\u0440\u0441\u0438\u044f","latest_version":"\u0421\u0430\u043c\u0430\u044f \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f","problems_found":"\u041c\u044b \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0438\u043b\u0438 \u043d\u0435\u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u044b \u0432 \u0432\u0430\u0448\u0435\u0439 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0435 Discourse:","last_checked":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430","refresh_problems":"\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c","no_problems":"\u041f\u0440\u043e\u0431\u043b\u0435\u043c\u044b \u043d\u0435 \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u044b.","moderators":"\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u044b:","admins":"\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u044b:","blocked":"\u0417\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u044b:","private_messages_short":"\u041b\u0421","private_messages_title":"\u041b\u0438\u0447\u043d\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","reports":{"today":"\u0421\u0435\u0433\u043e\u0434\u043d\u044f","yesterday":"\u0412\u0447\u0435\u0440\u0430","last_7_days":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 7 \u0434\u043d\u0435\u0439","last_30_days":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 30 \u0434\u043d\u0435\u0439","all_time":"\u0417\u0430 \u0432\u0441\u0435 \u0432\u0440\u0435\u043c\u044f","7_days_ago":"7 \u0434\u043d\u0435\u0439 \u043d\u0430\u0437\u0430\u0434","30_days_ago":"30 \u0434\u043d\u0435\u0439 \u043d\u0430\u0437\u0430\u0434","all":"\u0412\u0441\u0435","view_table":"\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0432 \u0432\u0438\u0434\u0435 \u0442\u0430\u0431\u043b\u0438\u0446\u044b","view_chart":"\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0432 \u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u043e\u043c \u0432\u0438\u0434\u0435"}},"commits":{"latest_changes":"\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u0432 \u0440\u0435\u043f\u043e\u0437\u0438\u0442\u043e\u0440\u0438\u0438 Github","by":"\u043e\u0442"},"flags":{"title":"\u0416\u0430\u043b\u043e\u0431\u044b","old":"\u0421\u0442\u0430\u0440\u044b\u0435","active":"\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435","clear":"\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0436\u0430\u043b\u043e\u0431\u044b","clear_title":"\u043e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c \u0432\u0441\u0435 \u0436\u0430\u043b\u043e\u0431\u044b \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 (\u043f\u043e\u043a\u0430\u0436\u0435\u0442 \u0441\u043a\u0440\u044b\u0442\u044b\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f)","delete":"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","delete_title":"\u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 (\u0435\u0441\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0438\u0434\u0435\u0442 \u043f\u0435\u0440\u0432\u044b\u043c, \u0442\u043e \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043b\u0435\u043d\u0430 \u0432\u0441\u044f \u0442\u0435\u043c\u0430)","flagged_by":"\u041e\u0442\u043c\u0435\u0447\u0435\u043d\u043e","error":"\u0447\u0442\u043e-\u0442\u043e \u043f\u043e\u0448\u043b\u043e \u043d\u0435 \u0442\u0430\u043a","view_message":"\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435","no_results":"\u0416\u0430\u043b\u043e\u0431 \u043d\u0435\u0442."},"groups":{"title":"\u0413\u0440\u0443\u043f\u043f\u044b","edit":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0433\u0440\u0443\u043f\u043f\u044b","selector_placeholder":"\u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439","name_placeholder":"\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0433\u0440\u0443\u043f\u043f\u044b, \u0431\u0435\u0437 \u043f\u0440\u043e\u0431\u0435\u043b\u043e\u0432, \u043f\u043e \u0442\u0435\u043c \u0436\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u0430\u043c, \u0447\u0442\u043e \u0438 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f."},"api":{"title":"API","long_title":"\u0418\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f \u043e\u0431 API","key":"\u041a\u043b\u044e\u0447","generate":"\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043a\u043b\u044e\u0447 API","regenerate":"\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043a\u043b\u044e\u0447 API \u0437\u0430\u043d\u043e\u0432\u043e","info_html":"\u0412\u0430\u0448 API \u043a\u043b\u044e\u0447 \u043f\u043e\u0437\u0432\u043e\u043b\u0438\u0442 \u0432\u0430\u043c \u0441\u043e\u0437\u0434\u0430\u0432\u0430\u0442\u044c \u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u044f\u0442\u044c \u0442\u0435\u043c\u044b, \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u044f JSON calls.","note_html":"\u041d\u0438\u043a\u043e\u043c\u0443 <strong>\u043d\u0435 \u0441\u043e\u043e\u0431\u0449\u0430\u0439\u0442\u0435</strong> \u044d\u0442\u0438 \u043a\u043b\u044e\u0447\u0438, \u0422\u043e\u0442, \u0443 \u043a\u043e\u0433\u043e \u043e\u043d\u0438 \u0435\u0441\u0442\u044c, \u0441\u043c\u043e\u0436\u0435\u0442 \u0441\u043e\u0437\u0434\u0430\u0432\u0430\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f, \u0432\u044b\u0434\u0430\u0432\u0430\u044f \u0441\u0435\u0431\u044f \u0437\u0430 \u043b\u044e\u0431\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0444\u043e\u0440\u0443\u043c\u0430."},"customize":{"title":"\u041e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0435","long_title":"\u0421\u0442\u0438\u043b\u0438 \u0438 \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043a\u0438","header":"\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a","css":"\u0422\u0430\u0431\u043b\u0438\u0446\u0430 \u0441\u0442\u0438\u043b\u0435\u0439","override_default":"\u041d\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c \u0441\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u043d\u0443\u044e \u0442\u0430\u0431\u043b\u0438\u0446\u0443 \u0441\u0442\u0438\u043b\u0435\u0439","enabled":"\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c?","preview":"\u043a\u0430\u043a \u0431\u0443\u0434\u0435\u0442","undo_preview":"\u043a\u0430\u043a \u0431\u044b\u043b\u043e","save":"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c","new":"\u041d\u043e\u0432\u043e\u0435","new_style":"\u041d\u043e\u0432\u044b\u0439 \u0441\u0442\u0438\u043b\u044c","delete":"\u0423\u0434\u0430\u043b\u0438\u0442\u044c","delete_confirm":"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438?","about":"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 \u0441\u0430\u0439\u0442\u0430 \u043f\u043e\u0437\u0432\u043e\u043b\u044f\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u044f\u0442\u044c \u0442\u0430\u0431\u043b\u0438\u0446\u044b \u0441\u0442\u0438\u043b\u0435\u0439 \u0438 \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043a\u0438. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u043b\u0438 \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0447\u0442\u043e-\u043d\u0438\u0431\u0443\u0434\u044c \u0434\u043b\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f."},"email":{"title":"Email","settings":"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438","logs":"\u041b\u043e\u0433\u0438","sent_at":"\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e","email_type":"\u0412\u0438\u0434 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","to_address":"\u0410\u0434\u0440\u0435\u0441","test_email_address":"\u042d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u044b\u0439 \u0430\u0434\u0440\u0435\u0441 \u0434\u043b\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438","send_test":"\u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0442\u0435\u0441\u0442\u043e\u0432\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e","sent_test":"\u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e!","delivery_method":"\u041c\u0435\u0442\u043e\u0434 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438","preview_digest":"\u041e\u0431\u0437\u043e\u0440 \u0441\u0432\u043e\u0434\u043a\u0438","preview_digest_desc":"\u0418\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442 \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0433\u043e \u0434\u0430\u0439\u0434\u0436\u0435\u0441\u0442\u043e\u0432 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b, \u043e\u0442\u0441\u044b\u043b\u0430\u0435\u043c\u044b\u0445 \u0444\u043e\u0440\u0443\u043c\u043e\u043c.","refresh":"\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c","format":"\u0424\u043e\u0440\u043c\u0430\u0442","html":"html","text":"\u0442\u0435\u043a\u0441\u0442","last_seen_user":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u0435:"},"impersonate":{"title":"\u041f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u044c\u0441\u044f \u043a\u0430\u043a \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c","username_or_email":"\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0438\u043b\u0438 Email","help":"\u0417\u0434\u0435\u0441\u044c \u0432\u044b \u043c\u043e\u0436\u0435\u0442\u0435 \u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0441\u044f \u0441\u0438\u0441\u0442\u0435\u043c\u0435 \u043a\u0430\u043a \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0444\u043e\u0440\u0443\u043c\u0430, \u0434\u043b\u044f \u043e\u0442\u043b\u0430\u0434\u043a\u0438.","not_found":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.","invalid":"\u0418\u0437\u0432\u0438\u043d\u0438\u0442\u0435, \u043d\u043e \u0432\u044b \u043d\u0435 \u043c\u043e\u0436\u0435\u0442\u0435 \u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u044c\u0441\u044f \u044d\u0442\u0438\u043c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u043c."},"users":{"title":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438","create":"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430","last_emailed":"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u043f\u0438\u0441\u044c\u043c\u043e","not_found":"\u041a \u0441\u043e\u0436\u0430\u043b\u0435\u043d\u0438\u044e, \u044d\u0442\u043e\u0442 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d.","new":"\u041d\u043e\u0432\u044b\u0439","active":"\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0439","pending":"\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u044f","approved":"\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c?","approved_selected":{"one":"\u043e\u0434\u043e\u0431\u0440\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","other":"\u043e\u0434\u043e\u0431\u0440\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439 ({{count}})","few":"\u043e\u0434\u043e\u0431\u0440\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439 ({{count}})","many":"\u043e\u0434\u043e\u0431\u0440\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439 ({{count}})"},"titles":{"active":"\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438","new":"\u041d\u043e\u0432\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438","pending":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438, \u043e\u0436\u0438\u0434\u0430\u044e\u0449\u0438\u0435 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u044f","newuser":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u0441 \u0443\u0440\u043e\u0432\u043d\u0435\u043c \u0434\u043e\u0432\u0435\u0440\u0438\u044f 0 (\u041d\u043e\u0432\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438)","basic":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u0441 \u0443\u0440\u043e\u0432\u043d\u0435\u043c \u0434\u043e\u0432\u0435\u0440\u0438\u044f 1 (\u0411\u0430\u0437\u043e\u0432\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438)","regular":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u0441 \u0443\u0440\u043e\u0432\u043d\u0435\u043c \u0434\u043e\u0432\u0435\u0440\u0438\u044f 2 (\u041f\u043e\u0441\u0442\u043e\u044f\u043d\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438)","leader":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u0441 \u0443\u0440\u043e\u0432\u043d\u0435\u043c \u0434\u043e\u0432\u0435\u0440\u0438\u044f 3 (\u041b\u0438\u0434\u0435\u0440\u044b)","elder":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u0441 \u0443\u0440\u043e\u0432\u043d\u0435\u043c \u0434\u043e\u0432\u0435\u0440\u0438\u044f 4 (\u041e\u043f\u044b\u0442\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438)","admins":"\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u044b","moderators":"\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u044b","blocked":"\u0417\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438"}},"user":{"ban_failed":"\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u043d\u0430\u043b\u043e\u0436\u0435\u043d\u0438\u0438 \u0431\u0430\u043d\u0430 {{error}}","unban_failed":"\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0441\u043d\u044f\u0442\u0438\u0438 \u0431\u0430\u043d\u0430 {{error}}","ban_duration":"\u041d\u0430\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0432\u044b \u0445\u043e\u0442\u0438\u0442\u0435 \u0437\u0430\u0431\u0430\u043d\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f? (\u0432 \u0434\u043d\u044f\u0445)","delete_all_posts":"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u0441\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f","ban":"\u0417\u0430\u0431\u0430\u043d\u0438\u0442\u044c","unban":"\u0420\u0430\u0437\u0431\u0430\u043d\u0438\u0442\u044c","banned":"\u0417\u0430\u0431\u0430\u043d\u0435\u043d?","moderator":"\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440?","admin":"\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440?","blocked":"\u0417\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d?","show_admin_profile":"\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440","refresh_browsers":"\u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u043f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430","show_public_profile":"\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u044b\u0439 \u043f\u0440\u043e\u0444\u0430\u0439\u043b","impersonate":"\u041f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u044c\u0441\u044f \u043a\u0430\u043a \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c","revoke_admin":"\u041b\u0438\u0448\u0438\u0442\u044c \u043f\u0440\u0430\u0432 \u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430","grant_admin":"\u0412\u044b\u0434\u0430\u0442\u044c \u043f\u0440\u0430\u0432\u0430 \u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430","revoke_moderation":"\u041b\u0438\u0448\u0438\u0442\u044c \u043f\u0440\u0430\u0432 \u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u0430","grant_moderation":"\u0412\u044b\u0434\u0430\u0442\u044c \u043f\u0440\u0430\u0432\u0430 \u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u0430","unblock":"\u0420\u0430\u0437\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u0442\u044c","block":"\u0417\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u0442\u044c","reputation":"\u0420\u0435\u043f\u0443\u0442\u0430\u0446\u0438\u044f","permissions":"\u041f\u0440\u0430\u0432\u0430","activity":"\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c","like_count":"\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u0441\u0438\u043c\u043f\u0430\u0442\u0438\u0439","private_topics_count":"\u0421\u0447\u0435\u0442\u0447\u0438\u043a \u0447\u0430\u0441\u0442\u043d\u044b\u0445 \u0442\u0435\u043c","posts_read_count":"\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439","post_count":"\u0421\u043e\u0437\u0434\u0430\u043d\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439","topics_entered":"\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043e \u0442\u0435\u043c","flags_given_count":"\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u0436\u0430\u043b\u043e\u0431","flags_received_count":"\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u0436\u0430\u043b\u043e\u0431","approve":"\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c","approved_by":"\u041e\u0434\u043e\u0431\u0440\u0435\u043d\u043e","approve_success":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043e\u0434\u043e\u0431\u0440\u0435\u043d, \u043d\u0430 \u0435\u0433\u043e \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u0443\u044e \u043f\u043e\u0447\u0442\u0443 \u043f\u043e\u0441\u043b\u0430\u043d\u043e \u043f\u0438\u0441\u044c\u043c\u043e \u0441 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u0435\u0439\n\u043f\u043e \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438.\n","approve_bulk_success":"\u0423\u0441\u043f\u0435\u0445! \u0412\u0441\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u044b\n\u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u044b.\n","time_read":"\u0412\u0440\u0435\u043c\u044f \u0447\u0442\u0435\u043d\u0438\u044f","delete":"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f","delete_forbidden":"\u041d\u0435\u043b\u044c\u0437\u044f \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u0443 \u043d\u0435\u0433\u043e \u0435\u0441\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f. \u0412\u043d\u0430\u0447\u0430\u043b\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u0435 \u0432\u0441\u0435 \u0435\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f.","delete_confirm":"\u0412\u044b \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f? \u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c!","deleted":"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0443\u0434\u0430\u043b\u0435\u043d.","delete_failed":"\u041f\u0440\u0438 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0432\u043e\u0437\u043d\u0438\u043a\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430. \u0414\u043b\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0441\u043d\u0430\u0447\u0430\u043b\u0430 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u0441\u0435 \u0435\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f.","send_activation_email":"\u041f\u043e\u0441\u043b\u0430\u0442\u044c \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u043e\u043d\u043d\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e","activation_email_sent":"\u0410\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u043e\u043d\u043d\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e.","send_activation_email_failed":"\u0412\u043e \u0432\u0440\u0435\u043c\u044f \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438 \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u043e\u043d\u043d\u043e\u0433\u043e \u043f\u0438\u0441\u044c\u043c\u0430 \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","activate":"\u0410\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0443\u0447\u0435\u0442\u043d\u0443\u044e \u0437\u0430\u043f\u0438\u0441\u044c","activate_failed":"\u0412\u043e \u0432\u0440\u0435\u043c\u044f \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","deactivate_account":"\u0414\u0435\u0430\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0443\u0447\u0435\u0442\u043d\u0443\u044e \u0437\u0430\u043f\u0438\u0441\u044c","deactivate_failed":"\u0412\u043e \u0432\u0440\u0435\u043c\u044f \u0434\u0435\u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430.","unblock_failed":"\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0437\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.","block_failed":"\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.","block_explanation":"\u0417\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u043e\u0442\u0432\u0435\u0447\u0430\u0442\u044c \u0438 \u0441\u043e\u0437\u0434\u0430\u0432\u0430\u0442\u044c \u043d\u043e\u0432\u044b\u0435 \u0442\u0435\u043c\u044b."},"site_content":{"none":"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043f \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435.","title":"\u041a\u043e\u043d\u0442\u0435\u043d\u0442 \u0441\u0430\u0439\u0442\u0430","edit":"\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u0441\u0430\u0439\u0442\u0430"},"site_settings":{"show_overriden":"\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u0435\u0440\u0435\u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0435","title":"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0441\u0430\u0439\u0442\u0430","reset":"\u0441\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0434\u043e \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043a \u043f\u043e \u0443\u043c\u043e\u043b\u0447\u0430\u043d\u0438\u044e","none":"(\u043d\u0435\u0442)"}}}}};
I18n.locale = 'ru';
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

I18n.pluralizationRules['ru'] = function (n) {
  if (n == 0) return ["zero", "none", "other"];
  if (n % 10 == 1 && n % 100 != 11) return "one";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "few";
  return "many";
}
;
