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
MessageFormat.locale.zh_TW = function ( n ) {
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
    })({});I18n.translations = {"zh_TW":{"js":{"share":{"topic":"\u5206\u4eab\u4e00\u500b\u5230\u672c\u4e3b\u984c\u7684\u93c8\u63a5","post":"\u5206\u4eab\u4e00\u500b\u5230\u672c\u5e16\u7684\u93c8\u63a5","close":"\u95dc\u9589","twitter":"\u5206\u4eab\u9019\u500b\u93c8\u63a5\u5230 Twitter","facebook":"\u5206\u4eab\u9019\u500b\u93c8\u63a5\u5230 Facebook","google+":"\u5206\u4eab\u9019\u500b\u93c8\u63a5\u5230 Google+","email":"\u7528\u96fb\u5b50\u90f5\u4ef6\u767c\u9001\u9019\u500b\u93c8\u63a5"},"edit":"\u7de8\u8f2f\u672c\u4e3b\u984c\u7684\u6a19\u984c\u548c\u5206\u985e","not_implemented":"\u975e\u5e38\u62b1\u6b49\uff0c\u6b64\u529f\u80fd\u66ab\u6642\u5c1a\u672a\u5be6\u73fe\uff01","no_value":"\u5426","yes_value":"\u662f","of_value":"\u4e4b\u4e8e","generic_error":"\u62b1\u6b49\uff0c\u767c\u751f\u4e86\u4e00\u500b\u932f\u8aa4\u3002","log_in":"\u767b\u9304","age":"\u58fd\u547d","last_post":"\u6700\u5f8c\u4e00\u5e16","admin_title":"\u7ba1\u7406\u54e1","flags_title":"\u6295\u8a34","show_more":"\u986f\u793a\u66f4\u591a","links":"\u93c8\u63a5","faq":"\u5e38\u898b\u554f\u7b54\uff08FAQ\uff09","you":"\u4f60","or":"\u6216","now":"\u525b\u525b","read_more":"\u95b1\u8b80\u66f4\u591a","in_n_seconds":{"one":"\u4e00\u79d2\u5167","other":"{{count}}\u79d2\u5167"},"in_n_minutes":{"one":"\u4e00\u5206\u937e\u5167","other":"{{count}}\u5206\u937e\u5167"},"in_n_hours":{"one":"\u4e00\u5c0f\u6642\u5167","other":"{{count}}\u5c0f\u6642\u5167"},"in_n_days":{"one":"\u4e00\u5929\u5167","other":"{{count}}\u5929\u5167"},"suggested_topics":{"title":"\u63a8\u85a6\u4e3b\u984c"},"bookmarks":{"not_logged_in":"\u62b1\u6b49\uff0c\u8981\u7d66\u5e16\u5b50\u52a0\u66f8\u7c3d\uff0c\u4f60\u5fc5\u9808\u5148\u767b\u9304\u3002","created":"\u4f60\u7d66\u6b64\u5e16\u7684\u66f8\u7c3d\u5df2\u52a0\u4e0a\u3002","not_bookmarked":"\u4f60\u5df2\u7d93\u95b1\u8b80\u904e\u6b64\u5e16\uff0c\u9ede\u6b64\u7d66\u5b83\u52a0\u4e0a\u66f8\u7c3d\u3002","last_read":"\u9019\u662f\u4f60\u95b1\u8b80\u904e\u7684\u6700\u5f8c\u4e00\u5e16\u3002"},"new_topics_inserted":"{{count}} \u500b\u65b0\u4e3b\u984c\u3002","show_new_topics":"\u9ede\u6b64\u986f\u793a\u3002","preview":"\u9810\u89bd","cancel":"\u53d6\u6d88","save":"\u4fdd\u5b58\u4fee\u6539","saving":"\u4fdd\u5b58\u4e2d\u2026\u2026","saved":"\u5df2\u4fdd\u5b58\uff01","choose_topic":{"none_found":"\u6c92\u6709\u627e\u5230\u4e3b\u984c","title":{"search":"\u901a\u904e\u540d\u7a31\u3001url\u6216\u8005id\uff0c\u641c\u7d22\u4e3b\u984c\uff1a","placeholder":"\u5728\u6b64\u8f38\u5165\u4e3b\u984c\u6a19\u984c"}},"user_action":{"user_posted_topic":"<a href='{{userUrl}}'>{{user}}</a> \u767c\u8d77 <a href='{{topicUrl}}'>\u672c\u4e3b\u984c</a>","you_posted_topic":"<a href='{{userUrl}}'>\u4f60</a> \u767c\u8d77 <a href='{{topicUrl}}'>\u672c\u4e3b\u984c</a>","user_replied_to_post":"<a href='{{userUrl}}'>{{user}}</a> \u56de\u8907 <a href='{{postUrl}}'>{{post_number}}</a>","you_replied_to_post":"<a href='{{userUrl}}'>\u4f60</a> \u56de\u8907 <a href='{{postUrl}}'>{{post_number}}</a>","user_replied_to_topic":"<a href='{{userUrl}}'>{{user}}</a> \u56de\u8907 <a href='{{topicUrl}}'>\u672c\u4e3b\u984c</a>","you_replied_to_topic":"<a href='{{userUrl}}'>\u4f60</a> \u56de\u8907 <a href='{{topicUrl}}'>\u672c\u4e3b\u984c</a>","user_mentioned_user":"<a href='{{user1Url}}'>{{user}}</a> \u63d0\u5230 <a href='{{user2Url}}'>{{another_user}}</a>","user_mentioned_you":"<a href='{{user1Url}}'>{{user}}</a> \u63d0\u5230 <a href='{{user2Url}}'>\u4f60</a>","you_mentioned_user":"<a href='{{user1Url}}'>\u4f60</a> \u63d0\u5230 <a href='{{user2Url}}'>{{user}}</a>","posted_by_user":"\u767c\u8d77\u4eba <a href='{{userUrl}}'>{{user}}</a>","posted_by_you":"\u767c\u8d77\u4eba <a href='{{userUrl}}'>\u4f60</a>","sent_by_user":"\u767c\u9001\u4eba <a href='{{userUrl}}'>{{user}}</a>","sent_by_you":"\u767c\u9001\u4eba <a href='{{userUrl}}'>\u4f60</a>"},"user_action_groups":{"1":"\u7d66\u51fa\u7684\u8d0a","2":"\u6536\u5230\u7684\u8d0a","3":"\u66f8\u7c3d","4":"\u4e3b\u984c","5":"\u56de\u8907","6":"\u56de\u61c9","7":"\u63d0\u5230","9":"\u5f15\u7528","10":"\u559c\u611b","11":"\u7de8\u8f2f","12":"\u767c\u9001\u689d\u76ee","13":"\u6536\u4ef6\u7bb1"},"user":{"profile":"\u4ecb\u7d39\u4fe1\u606f","title":"\u7528\u6236","mute":"\u9632\u6253\u64fe","edit":"\u4fee\u6539\u53c3\u6578","download_archive":"\u4e0b\u8f09\u6211\u7684\u5e16\u5b50\u7684\u5b58\u6a94","private_message":"\u79c1\u4fe1","private_messages":"\u6d88\u606f","activity_stream":"\u6d3b\u52d5","preferences":"\u8a2d\u7f6e","bio":"\u95dc\u4e8e\u6211","invited_by":"\u9080\u8acb\u8005\u7232","trust_level":"\u7528\u6236\u7d1a\u5225","external_links_in_new_tab":"\u59cb\u7d42\u5728\u65b0\u7684\u6a19\u7c3d\u9801\u6253\u958b\u5916\u90e8\u93c8\u63a5","enable_quoting":"\u5728\u9ad8\u4eae\u9078\u64c7\u6587\u5b57\u6642\u5553\u7528\u5f15\u7528\u56de\u8907","moderator":"{{user}} \u662f\u7248\u4e3b","admin":"{{user}} \u662f\u7ba1\u7406\u54e1","change_password":{"action":"\u4fee\u6539","success":"\uff08\u96fb\u5b50\u90f5\u4ef6\u5df2\u767c\u9001\uff09","in_progress":"\uff08\u6b63\u5728\u767c\u9001\u96fb\u5b50\u90f5\u4ef6\uff09","error":"\uff08\u932f\u8aa4\uff09"},"change_username":{"action":"\u4fee\u6539","title":"\u4fee\u6539\u7528\u6236\u540d","confirm":"\u4fee\u6539\u4f60\u7684\u7528\u6236\u540d\u53ef\u80fd\u6703\u5c0e\u81f4\u4e00\u4e9b\u76f8\u95dc\u5f8c\u679c\uff0c\u4f60\u771f\u7684\u78ba\u5b9a\u8981\u9019\u9ebd\u505a\u9ebd\uff1f","taken":"\u62b1\u6b49\u6b64\u7528\u6236\u540d\u5df2\u7d93\u6709\u4eba\u4f7f\u7528\u4e86\u3002","error":"\u5728\u4fee\u6539\u4f60\u7684\u7528\u6236\u540d\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002","invalid":"\u6b64\u7528\u6236\u540d\u4e0d\u5408\u6cd5\uff0c\u7528\u6236\u540d\u53ea\u80fd\u5305\u542b\u5b57\u6bcd\u548c\u6578\u5b57"},"change_email":{"action":"\u4fee\u6539","title":"\u4fee\u6539\u96fb\u5b50\u90f5\u7bb1","taken":"\u62b1\u6b49\u6b64\u96fb\u5b50\u90f5\u7bb1\u4e0d\u53ef\u7528\u3002","error":"\u62b1\u6b49\u5728\u4fee\u6539\u4f60\u7684\u96fb\u5b50\u90f5\u7bb1\u6642\u767c\u751f\u4e86\u932f\u8aa4\uff0c\u53ef\u80fd\u6b64\u90f5\u7bb1\u5df2\u7d93\u88ab\u4f7f\u7528\u4e86\uff1f","success":"\u6211\u5011\u767c\u9001\u4e86\u4e00\u5c01\u78ba\u8a8d\u4fe1\u5230\u6b64\u90f5\u7bb1\u5730\u5740\uff0c\u8acb\u6309\u7167\u90f5\u7bb1\u5167\u6307\u793a\u5b8c\u6210\u78ba\u8a8d\u3002"},"email":{"title":"\u96fb\u5b50\u90f5\u7bb1","instructions":"\u4f60\u7684\u96fb\u5b50\u90f5\u7bb1\u7d55\u4e0d\u6703\u516c\u958b\u7d66\u4ed6\u4eba\u3002","ok":"\u4e0d\u932f\u54e6\uff0c\u6211\u5011\u6703\u767c\u9001\u96fb\u5b50\u90f5\u4ef6\u8b93\u4f60\u78ba\u8a8d\u3002","invalid":"\u8acb\u586b\u5beb\u6b63\u78ba\u7684\u96fb\u5b50\u90f5\u7bb1\u5730\u5740\u3002","authenticated":"\u4f60\u7684\u96fb\u5b50\u90f5\u7bb1\u5df2\u7d93\u88ab {{provider}} \u78ba\u8a8d\u6709\u6548\u3002","frequency":"\u53ea\u6709\u7576\u4f60\u6700\u8fd1\u4e00\u6bb5\u6642\u9593\u6c92\u6709\u8a2a\u554f\u6642\uff0c\u6211\u5011\u624d\u6703\u628a\u4f60\u672a\u8b80\u904e\u7684\u5167\u5bb9\u767c\u9001\u5230\u4f60\u7684\u96fb\u5b50\u90f5\u7bb1\u3002"},"name":{"title":"\u540d\u5b57","instructions":"\u4f60\u7684\u540d\u5b57\uff0c\u4e0d\u8981\u6c42\u7368\u4e00\u7121\u4e8c\uff08\u53ef\u4ee5\u8207\u4ed6\u4eba\u7684\u540d\u5b57\u91cd\u8907\uff09\u3002\u7528\u4e8e\u5728@name\u5339\u914d\u4f60\u6642\u53c3\u8003\uff0c\u53ea\u5728\u4f60\u7684\u7528\u6236\u9801\u9762\u986f\u793a\u3002","too_short":"\u4f60\u8a2d\u7f6e\u7684\u540d\u5b57\u592a\u77ed\u4e86\u3002","ok":"\u4f60\u7684\u540d\u5b57\u7b26\u5408\u8981\u6c42\u3002"},"username":{"title":"\u7528\u6236\u540d","instructions":"\u5fc5\u9808\u662f\u7368\u4e00\u7121\u4e8c\u7684\uff0c\u4e2d\u9593\u4e0d\u80fd\u6709\u7a7a\u683c\u3002\u5176\u4ed6\u4eba\u53ef\u4ee5\u4f7f\u7528 @{{username}} \u4f86\u63d0\u53ca\u4f60\u3002","short_instructions":"\u5176\u4ed6\u4eba\u53ef\u4ee5\u7528 @{{username}} \u4f86\u63d0\u53ca\u4f60\u3002","available":"\u4f60\u7684\u7528\u6236\u540d\u53ef\u7528\u3002","global_match":"\u96fb\u5b50\u90f5\u7bb1\u8207\u6ce8\u518a\u7528\u6236\u540d\u76f8\u5339\u914d\u3002","global_mismatch":"\u5df2\u88ab\u4eba\u6ce8\u518a\u3002\u8a66\u8a66 {{suggestion}} \uff1f","not_available":"\u4e0d\u53ef\u7528\u3002\u8a66\u8a66 {{suggestion}} \uff1f","too_short":"\u4f60\u8a2d\u7f6e\u7684\u7528\u6236\u540d\u592a\u77ed\u4e86\u3002","too_long":"\u4f60\u8a2d\u7f6e\u7684\u7528\u6236\u540d\u592a\u9577\u4e86\u3002","checking":"\u67e5\u770b\u7528\u6236\u540d\u662f\u5426\u53ef\u7528\u2026\u2026","enter_email":"\u627e\u5230\u7528\u6236\u540d\uff0c\u8acb\u8f38\u5165\u5c0d\u61c9\u96fb\u5b50\u90f5\u7bb1\u3002"},"password_confirmation":{"title":"\u8acb\u518d\u6b21\u8f38\u5165\u5bc6\u78bc"},"last_posted":"\u6700\u5f8c\u4e00\u5e16","last_emailed":"\u6700\u5f8c\u4e00\u6b21\u90f5\u5bc4","last_seen":"\u6700\u5f8c\u4e00\u6b21\u898b\u5230","created":"\u5275\u5efa\u6642\u9593","log_out":"\u767b\u51fa","website":"\u7db2\u7ad9","email_settings":"\u96fb\u5b50\u90f5\u7bb1","email_digests":{"title":"\u7576\u6211\u4e0d\u8a2a\u554f\u6b64\u7ad9\u6642\uff0c\u5411\u6211\u7684\u90f5\u7bb1\u767c\u9001\u6700\u65b0\u6458\u8981","daily":"\u6bcf\u5929","weekly":"\u6bcf\u5468","bi_weekly":"\u6bcf\u5169\u5468"},"email_direct":"\u7576\u6709\u4eba\u5f15\u7528\u4f60\u3001\u56de\u8907\u4f60\u6216\u63d0\u53ca\u4f60 @username \u6642\u767c\u9001\u4e00\u5c01\u90f5\u4ef6\u7d66\u4f60","email_private_messages":"\u7576\u6709\u4eba\u7d66\u4f60\u767c\u79c1\u4fe1\u6642\u767c\u9001\u4e00\u5c01\u90f5\u4ef6\u7d66\u4f60","other_settings":"\u5176\u5b83","new_topic_duration":{"label":"\u8a8d\u7232\u4e3b\u984c\u662f\u65b0\u4e3b\u984c\uff0c\u7576","not_viewed":"\u6211\u9084\u6c92\u6709\u6d4f\u89bd\u5b83\u5011","last_here":"\u5b83\u5011\u662f\u5728\u6211\u6700\u8fd1\u4e00\u6b21\u8a2a\u554f\u9019\u88cf\u4e4b\u5f8c\u767c\u8868\u7684","after_n_days":{"one":"\u5b83\u5011\u662f\u6628\u5929\u767c\u8868\u7684","other":"\u5b83\u5011\u662f\u4e4b\u524d {{count}} \u5929\u767c\u8868\u7684"},"after_n_weeks":{"one":"\u5b83\u5011\u662f\u4e0a\u5468\u767c\u8868\u7684","other":"\u5b83\u5011\u662f\u4e4b\u524d {{count}} \u5468\u767c\u8868\u7684"}},"auto_track_topics":"\u81ea\u52d5\u8ffd\u8e64\u6211\u9032\u5165\u7684\u4e3b\u984c","auto_track_options":{"never":"\u5f9e\u4e0d","always":"\u59cb\u7d42","after_n_seconds":{"one":"1 \u79d2\u4e4b\u5f8c","other":"{{count}} \u79d2\u4e4b\u5f8c"},"after_n_minutes":{"one":"1 \u5206\u937e\u4e4b\u5f8c","other":"{{count}} \u5206\u937e\u4e4b\u5f8c"}},"invited":{"title":"\u9080\u8acb","user":"\u9080\u8acb\u7528\u6236","none":"{{username}} \u5c1a\u672a\u9080\u8acb\u4efb\u4f55\u7528\u6236\u5230\u672c\u7ad9\u3002","redeemed":"\u78ba\u8a8d\u9080\u8acb","redeemed_at":"\u78ba\u8a8d\u6642\u9593","pending":"\u5f85\u5b9a\u9080\u8acb","topics_entered":"\u5df2\u9032\u5165\u7684\u4e3b\u984c","posts_read_count":"\u5df2\u95b1\u7684\u5e16\u5b50","rescind":"\u522a\u9664\u9080\u8acb","rescinded":"\u9080\u8acb\u5df2\u522a\u9664","time_read":"\u95b1\u8b80\u6642\u9593","days_visited":"\u8a2a\u554f\u5929\u6578","account_age_days":"\u5e33\u865f\u5b58\u5728\u5929\u6578"},"password":{"title":"\u5bc6\u78bc","too_short":"\u4f60\u8a2d\u7f6e\u7684\u5bc6\u78bc\u592a\u77ed\u4e86\u3002","ok":"\u4f60\u8a2d\u7f6e\u7684\u5bc6\u78bc\u7b26\u5408\u8981\u6c42\u3002"},"ip_address":{"title":"\u6700\u5f8c\u4f7f\u7528\u7684IP\u5730\u5740"},"avatar":{"title":"\u982d\u50cf","instructions":"\u6211\u5011\u76ee\u524d\u4f7f\u7528 <a href='https://gravatar.com' target='_blank'>Gravatar</a> \u4f86\u57fa\u4e8e\u4f60\u7684\u90f5\u7bb1\u751f\u6210\u982d\u50cf"},"filters":{"all":"\u5168\u90e8"},"stream":{"posted_by":"\u767c\u5e16\u4eba","sent_by":"\u767c\u9001\u6642\u9593","private_message":"\u79c1\u4fe1","the_topic":"\u672c\u4e3b\u984c"}},"loading":"\u8f09\u5165\u4e2d\u2026\u2026","close":"\u95dc\u9589","learn_more":"\u4e86\u89e3\u66f4\u591a\u2026\u2026","year":"\u5e74","year_desc":"365\u5929\u4ee5\u524d\u767c\u8868\u7684\u4e3b\u984c","month":"\u6708","month_desc":"30\u5929\u4ee5\u524d\u767c\u8868\u7684\u4e3b\u984c","week":"\u5468","week_desc":"7\u5929\u4ee5\u524d\u767c\u8868\u7684\u4e3b\u984c","first_post":"\u7b2c\u4e00\u5e16","mute":"\u9632\u6253\u64fe","unmute":"\u89e3\u9664\u9632\u6253\u64fe","best_of":{"title":"\u512a\u79c0","enabled_description":"\u4f60\u73fe\u5728\u6b63\u5728\u6d4f\u89bd\u672c\u4e3b\u984c\u7684\u201c\u512a\u79c0\u201d\u8996\u5716\u3002","description":"\u6b64\u4e3b\u984c\u4e2d\u6709 <b>{{count}}</b> \u500b\u5e16\u5b50\uff0c\u662f\u4e0d\u662f\u6709\u9ede\u591a\u54e6\uff01\u4f60\u9858\u610f\u5207\u63db\u5230\u53ea\u986f\u793a\u6700\u591a\u4ea4\u4e92\u548c\u56de\u8907\u7684\u5e16\u5b50\u8996\u5716\u9ebd\uff1f","enable":"\u5207\u63db\u5230\u201c\u512a\u79c0\u201d\u8996\u5716","disable":"\u53d6\u6d88\u201c\u512a\u79c0\u201d"},"private_message_info":{"title":"\u79c1\u4e0b\u4ea4\u6d41","invite":"\u9080\u8acb\u5176\u4ed6\u4eba\u2026\u2026"},"email":"\u96fb\u5b50\u90f5\u7bb1","username":"\u7528\u6236\u540d","last_seen":"\u6700\u5f8c\u4e00\u6b21\u898b\u5230","created":"\u5275\u5efa\u6642\u9593","trust_level":"\u7528\u6236\u7d1a\u5225","create_account":{"title":"\u5275\u5efa\u5e33\u865f","action":"\u73fe\u5728\u5c31\u5275\u5efa\u4e00\u500b\uff01","invite":"\u9084\u6c92\u6709\u5e33\u865f\u55ce\uff1f","failed":"\u51fa\u554f\u984c\u4e86\uff0c\u6709\u53ef\u80fd\u9019\u500b\u96fb\u5b50\u90f5\u7bb1\u5df2\u7d93\u88ab\u6ce8\u518a\u4e86\u3002\u8a66\u8a66\u5fd8\u8a18\u5bc6\u78bc\u93c8\u63a5"},"forgot_password":{"title":"\u5fd8\u8a18\u5bc6\u78bc","action":"\u6211\u5fd8\u8a18\u4e86\u6211\u7684\u5bc6\u78bc","invite":"\u8f38\u5165\u4f60\u7684\u7528\u6236\u540d\u548c\u96fb\u5b50\u90f5\u7bb1\u5730\u5740\uff0c\u6211\u5011\u6703\u767c\u9001\u5bc6\u78bc\u91cd\u7f6e\u90f5\u4ef6\u7d66\u4f60\u3002","reset":"\u91cd\u7f6e\u5bc6\u78bc","complete":"\u4f60\u5f88\u5feb\u6703\u6536\u5230\u4e00\u5c01\u96fb\u5b50\u90f5\u4ef6\uff0c\u544a\u8a34\u4f60\u5982\u4f55\u91cd\u7f6e\u5bc6\u78bc\u3002"},"login":{"title":"\u767b\u9304","username":"\u767b\u9304","password":"\u5bc6\u78bc","email_placeholder":"\u96fb\u5b50\u90f5\u7bb1\u5730\u5740\u6216\u7528\u6236\u540d","error":"\u672a\u77e5\u932f\u8aa4","reset_password":"\u91cd\u7f6e\u5bc6\u78bc","logging_in":"\u767b\u9304\u4e2d\u2026\u2026","or":"\u6216","authenticating":"\u9a57\u8b49\u4e2d\u2026\u2026","awaiting_confirmation":"\u4f60\u7684\u5e33\u865f\u5c1a\u672a\u6fc0\u6d3b\uff0c\u9ede\u64ca\u5fd8\u8a18\u5bc6\u78bc\u93c8\u63a5\u4f86\u91cd\u65b0\u767c\u9001\u6fc0\u6d3b\u90f5\u4ef6\u3002","awaiting_approval":"\u4f60\u7684\u5e33\u865f\u5c1a\u672a\u88ab\u8ad6\u58c7\u7248\u4e3b\u6279\u51c6\u3002\u4e00\u65e6\u4f60\u7684\u5e33\u865f\u7372\u5f97\u6279\u51c6\uff0c\u4f60\u6703\u6536\u5230\u4e00\u5c01\u96fb\u5b50\u90f5\u4ef6\u3002","not_activated":"\u4f60\u9084\u4e0d\u80fd\u767b\u9304\u3002\u6211\u5011\u4e4b\u524d\u5728<b>{{sentTo}}</b>\u767c\u9001\u4e86\u4e00\u5c01\u6fc0\u6d3b\u90f5\u4ef6\u7d66\u4f60\u3002\u8acb\u6309\u7167\u90f5\u4ef6\u4e2d\u7684\u4ecb\u7d39\u4f86\u6fc0\u6d3b\u4f60\u7684\u5e33\u865f\u3002","resend_activation_email":"\u9ede\u64ca\u6b64\u8655\u4f86\u91cd\u65b0\u767c\u9001\u6fc0\u6d3b\u90f5\u4ef6\u3002","sent_activation_email_again":"\u6211\u5011\u5728<b>{{currentEmail}}</b>\u53c8\u767c\u9001\u4e86\u4e00\u5c01\u6fc0\u6d3b\u90f5\u4ef6\u7d66\u4f60\uff0c\u90f5\u4ef6\u9001\u9054\u53ef\u80fd\u9700\u8981\u5e7e\u5206\u937e\uff0c\u6709\u7684\u96fb\u5b50\u90f5\u7bb1\u670d\u52d9\u5546\u53ef\u80fd\u6703\u8a8d\u7232\u6b64\u90f5\u4ef6\u7232\u5783\u573e\u90f5\u4ef6\uff0c\u8acb\u6aa2\u67e5\u4e00\u4e0b\u4f60\u90f5\u7bb1\u7684\u5783\u573e\u90f5\u4ef6\u6587\u4ef6\u593e\u3002","google":{"title":"\u4f7f\u7528\u8c37\u6b4c\u5e33\u865f\u767b\u9304","message":"\u4f7f\u7528\u8c37\u6b4c\uff08Google\uff09\u5e33\u865f\u9a57\u8b49\u767b\u9304\uff08\u8acb\u78ba\u4fdd\u6c92\u6709\u7981\u6b62\u6d4f\u89bd\u5668\u5f48\u51fa\u5c0d\u8a71\u6846\uff09"},"twitter":{"title":"\u4f7f\u7528\u63a8\u7279\u5e33\u865f\u767b\u9304","message":"\u4f7f\u7528\u63a8\u7279\uff08Twitter\uff09\u5e33\u865f\u9a57\u8b49\u767b\u9304\uff08\u8acb\u78ba\u4fdd\u6c92\u6709\u7981\u6b62\u6d4f\u89bd\u5668\u5f48\u51fa\u5c0d\u8a71\u6846\uff09"},"facebook":{"title":"\u4f7f\u7528\u81c9\u66f8\u5e33\u865f\u767b\u9304","message":"\u4f7f\u7528\u81c9\u66f8\uff08Facebook\uff09\u5e33\u865f\u9a57\u8b49\u767b\u9304\uff08\u8acb\u78ba\u4fdd\u6c92\u6709\u7981\u6b62\u6d4f\u89bd\u5668\u5f48\u51fa\u5c0d\u8a71\u6846\uff09"},"yahoo":{"title":"\u4f7f\u7528\u96c5\u864e\u5e33\u865f\u767b\u9304","message":"\u4f7f\u7528\u96c5\u864e\uff08Yahoo\uff09\u5e33\u865f\u9a57\u8b49\u767b\u9304\uff08\u8acb\u78ba\u4fdd\u6c92\u6709\u7981\u6b62\u6d4f\u89bd\u5668\u5f48\u51fa\u5c0d\u8a71\u6846\uff09"},"github":{"title":"\u4f7f\u7528 GitHub \u5e33\u865f\u767b\u9304","message":"\u4f7f\u7528 GitHub \u5e33\u865f\u9a57\u8b49\u767b\u9304\uff08\u8acb\u78ba\u4fdd\u6c92\u6709\u7981\u6b62\u6d4f\u89bd\u5668\u5f48\u51fa\u5c0d\u8a71\u6846\uff09"},"persona":{"title":"\u4f7f\u7528 Persona \u5e33\u865f\u767b\u9304","message":"\u4f7f\u7528 Mozilla Persona \u5e33\u865f\u9a57\u8b49\u767b\u9304\uff08\u8acb\u78ba\u4fdd\u6c92\u6709\u7981\u6b62\u6d4f\u89bd\u5668\u5f48\u51fa\u5c0d\u8a71\u6846\uff09"}},"composer":{"posting_not_on_topic":"\u4f60\u6b63\u5728\u56de\u8907\u4e3b\u984c \"{{title}}\"\uff0c\u4f46\u662f\u7576\u524d\u4f60\u6b63\u5728\u6d4f\u89bd\u7684\u662f\u53e6\u5916\u4e00\u500b\u4e3b\u984c\u3002","saving_draft_tip":"\u4fdd\u5b58\u4e2d","saved_draft_tip":"\u5df2\u4fdd\u5b58","saved_local_draft_tip":"\u5df2\u672c\u5730\u4fdd\u5b58","similar_topics":"\u4f60\u7684\u4e3b\u984c\u8207\u6b64\u6709\u4e9b\u985e\u4f3c...","drafts_offline":"\u96e2\u7dda\u8349\u7a3f","min_length":{"need_more_for_title":"\u8acb\u7d66\u6a19\u984c\u518d\u8f38\u5165\u81f3\u5c11 {{n}} \u500b\u5b57\u7b26","need_more_for_reply":"\u8acb\u7d66\u6b63\u6587\u5167\u5bb9\u518d\u8f38\u5165\u81f3\u5c11 {{n}} \u500b\u5b57\u7b26"},"save_edit":"\u4fdd\u5b58\u7de8\u8f2f","reply_original":"\u56de\u8907\u539f\u59cb\u5e16","reply_here":"\u5728\u6b64\u56de\u8907","reply":"\u56de\u8907","cancel":"\u53d6\u6d88","create_topic":"\u5275\u5efa\u4e3b\u984c","create_pm":"\u5275\u5efa\u79c1\u4fe1","users_placeholder":"\u6dfb\u52a0\u4e00\u500b\u7528\u6236","title_placeholder":"\u5728\u6b64\u8f38\u5165\u4f60\u7684\u6a19\u984c\uff0c\u7c21\u660e\u627c\u8981\u7684\u7528\u4e00\u53e5\u8a71\u8aaa\u660e\u8a0e\u8ad6\u7684\u5167\u5bb9\u3002","reply_placeholder":"\u5728\u6b64\u8f38\u5165\u4f60\u7684\u5167\u5bb9\u3002\u4f60\u53ef\u4ee5\u4f7f\u7528 Markdown\uff08\u53c3\u8003 http://wowubuntu.com/markdown/\uff09 \u6216 BBCode\uff08\u53c3\u8003 http://www.bbcode.org/reference.php\uff09 \u4f86\u683c\u5f0f\u5316\u5167\u5bb9\u3002\u62d6\u62fd\u6216\u7c98\u8cbc\u4e00\u5e45\u5716\u7247\u5230\u9019\u5152\u5373\u53ef\u5c07\u5b83\u4e0a\u50b3\u3002","view_new_post":"\u6d4f\u89bd\u4f60\u7684\u65b0\u5e16\u5b50\u3002","saving":"\u4fdd\u5b58\u4e2d\u2026\u2026","saved":"\u5df2\u4fdd\u5b58\uff01","saved_draft":"\u4f60\u6709\u4e00\u500b\u5e16\u5b50\u8349\u7a3f\u5c1a\u767c\u8868\u3002\u5728\u6846\u4e2d\u4efb\u610f\u8655\u9ede\u64ca\u5373\u53ef\u63a5\u8457\u7de8\u8f2f\u3002","uploading":"\u4e0a\u50b3\u4e2d\u2026\u2026","show_preview":"\u986f\u793a\u9810\u89bd &raquo;","hide_preview":"&laquo; \u96b1\u85cf\u9810\u89bd","quote_post_title":"\u5f15\u7528\u6574\u500b\u5e16\u5b50","bold_title":"\u52a0\u7c97","bold_text":"\u52a0\u7c97\u6587\u5b57","italic_title":"\u659c\u9ad4","italic_text":"\u659c\u9ad4\u6587\u5b57","link_title":"\u93c8\u63a5","link_description":"\u5728\u6b64\u8f38\u5165\u93c8\u63a5\u63cf\u8ff0","link_dialog_title":"\u63d2\u5165\u93c8\u63a5","link_optional_text":"\u53ef\u9078\u6a19\u984c","quote_title":"\u5f15\u7528","quote_text":"\u5f15\u7528","code_title":"\u4ee3\u78bc","code_text":"\u5728\u6b64\u8f38\u5165\u4ee3\u78bc","image_title":"\u5716\u7247","image_description":"\u5728\u6b64\u8f38\u5165\u5716\u7247\u63cf\u8ff0","image_dialog_title":"\u63d2\u5165\u5716\u7247","image_optional_text":"\u53ef\u9078\u6a19\u984c","image_hosting_hint":"\u9700\u8981 <a href='http://www.google.com/search?q=free+image+hosting' target='_blank'>\u514d\u8cbb\u5716\u7247\u5b58\u5132\uff1f</a>","olist_title":"\u6578\u5b57\u5217\u8868","ulist_title":"\u7b26\u865f\u5217\u8868","list_item":"\u5217\u8868\u689d\u76ee","heading_title":"\u6a19\u984c","heading_text":"\u6a19\u984c\u982d","hr_title":"\u5206\u5272\u7dda","undo_title":"\u64a4\u92b7","redo_title":"\u91cd\u505a","help":"Markdown \u7de8\u8f2f\u5e6b\u52a9","toggler":"\u96b1\u85cf\u6216\u986f\u793a\u7de8\u8f2f\u9762\u677f","admin_options_title":"\u672c\u4e3b\u984c\u53ef\u9078\u8a2d\u7f6e","auto_close_label":"\u81ea\u52d5\u95dc\u9589\u4e3b\u984c\uff0c\u904e\uff1a","auto_close_units":"\u5929"},"notifications":{"title":"\u4f7f\u7528 @name \u63d0\u53ca\u5230\u4f60\uff0c\u56de\u8907\u4f60\u7684\u5e16\u5b50\u548c\u4e3b\u984c\uff0c\u79c1\u4fe1\u7b49\u7b49\u7684\u901a\u77e5\u6d88\u606f","none":"\u4f60\u7576\u524d\u6c92\u6709\u4efb\u4f55\u901a\u77e5\u3002","more":"\u6d4f\u89bd\u4ee5\u524d\u7684\u901a\u77e5","mentioned":"<span title='mentioned' class='icon'>@</span> {{username}} {{link}}","quoted":"<i title='quoted' class='icon icon-quote-right'></i> {{username}} {{link}}","replied":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","posted":"<i title='replied' class='icon icon-reply'></i> {{username}} {{link}}","edited":"<i title='edited' class='icon icon-pencil'></i> {{username}} {{link}}","liked":"<i title='liked' class='icon icon-heart'></i> {{username}} {{link}}","private_message":"<i class='icon icon-envelope-alt' title='\u79c1\u4fe1'></i> {{username}} \u767c\u9001\u7d66\u4f60\u4e00\u689d\u79c1\u4fe1\uff1a{{link}}","invited_to_private_message":"{{username}} \u9080\u8acb\u4f60\u9032\u884c\u79c1\u4e0b\u4ea4\u6d41\uff1a{{link}}","invitee_accepted":"<i title='\u5df2\u63a5\u53d7\u4f60\u7684\u9080\u8acb' class='icon icon-signin'></i> {{username}} \u5df2\u63a5\u53d7\u4f60\u7684\u9080\u8acb","moved_post":"<i title='\u79fb\u52d5\u5e16\u5b50' class='icon icon-arrow-right'></i> {{username}} \u5df2\u5c07\u5e16\u5b50\u79fb\u52d5\u5230 {{link}}","total_flagged":"\u88ab\u6295\u8a34\u5e16\u5b50\u7684\u7e3d\u6578"},"image_selector":{"title":"\u63d2\u5165\u5716\u7247","from_my_computer":"\u4f86\u81ea\u6211\u7684\u8a2d\u5099","from_the_web":"\u4f86\u81ea\u7db2\u7d61","add_image":"\u6dfb\u52a0\u5716\u7247","remote_title":"\u7db2\u7d61\u5716\u7247","remote_tip":"\u8f38\u5165\u5716\u7247\u7db2\u7d61\uff0c\u683c\u5f0f\u7232\uff1ahttp://example.com/image.jpg","local_title":"\u672c\u5730\u5716\u7247","local_tip":"\u9ede\u64ca\u5f9e\u4f60\u7684\u8a2d\u5099\u4e2d\u9078\u64c7\u4e00\u5f35\u5716\u7247\u3002","upload":"\u4e0a\u50b3","uploading_image":"\u4e0a\u50b3\u5716\u7247\u4e2d"},"search":{"title":"\u641c\u7d22\u4e3b\u984c\u3001\u5e16\u5b50\u3001\u7528\u6236\u6216\u5206\u985e","placeholder":"\u5728\u6b64\u8f38\u5165\u4f60\u7684\u641c\u7d22\u689d\u4ef6","no_results":"\u6c92\u6709\u627e\u5230\u7d50\u679c\u3002","searching":"\u641c\u7d22\u4e2d\u2026\u2026"},"site_map":"\u53bb\u53e6\u4e00\u500b\u4e3b\u984c\u5217\u8868\u6216\u5206\u985e","go_back":"\u8fd4\u56de","current_user":"\u53bb\u4f60\u7684\u7528\u6236\u9801\u9762","favorite":{"title":"\u6536\u85cf","help":{"star":"\u5c07\u6b64\u4e3b\u984c\u52a0\u5165\u4f60\u7684\u6536\u85cf\u5217\u8868","unstar":"\u5c07\u6b64\u4e3b\u984c\u5f9e\u4f60\u7684\u6536\u85cf\u5217\u8868\u4e2d\u79fb\u9664"}},"topics":{"none":{"favorited":"\u4f60\u5c1a\u672a\u6536\u85cf\u4efb\u4f55\u4e3b\u984c\u3002\u8981\u6536\u85cf\u4e00\u500b\u4e3b\u984c\uff0c\u9ede\u64ca\u6a19\u984c\u65c1\u7684\u661f\u661f\u5716\u6a19\u3002","unread":"\u4f60\u6c92\u6709\u672a\u95b1\u4e3b\u984c\u3002","new":"\u4f60\u6c92\u6709\u65b0\u4e3b\u984c\u53ef\u8b80\u3002","read":"\u4f60\u5c1a\u672a\u95b1\u8b80\u4efb\u4f55\u4e3b\u984c\u3002","posted":"\u4f60\u5c1a\u672a\u5728\u4efb\u4f55\u4e3b\u984c\u4e2d\u767c\u5e16\u3002","latest":"\u50b7\u5fc3\u554a\uff0c\u6c92\u6709\u4e3b\u984c\u3002","hot":"\u6c92\u6709\u71b1\u9580\u4e3b\u984c\u3002","category":"\u6c92\u6709 {{category}} \u5206\u985e\u7684\u4e3b\u984c\u3002"},"bottom":{"latest":"\u6c92\u6709\u66f4\u591a\u4e3b\u984c\u53ef\u770b\u4e86\u3002","hot":"\u6c92\u6709\u66f4\u591a\u71b1\u9580\u4e3b\u984c\u53ef\u770b\u4e86\u3002","posted":"\u6c92\u6709\u66f4\u591a\u5df2\u767c\u5e03\u4e3b\u984c\u53ef\u770b\u4e86\u3002","read":"\u6c92\u6709\u66f4\u591a\u5df2\u95b1\u4e3b\u984c\u53ef\u770b\u4e86\u3002","new":"\u6c92\u6709\u66f4\u591a\u65b0\u4e3b\u984c\u53ef\u770b\u4e86\u3002","unread":"\u6c92\u6709\u66f4\u591a\u672a\u95b1\u4e3b\u984c\u53ef\u770b\u4e86\u3002","favorited":"\u6c92\u6709\u66f4\u591a\u6536\u85cf\u4e3b\u984c\u53ef\u770b\u4e86\u3002","category":"\u6c92\u6709\u66f4\u591a {{category}} \u5206\u985e\u7684\u4e3b\u984c\u4e86\u3002"}},"rank_details":{"toggle":"\u5207\u63db\u4e3b\u984c\u6392\u540d\u8a73\u7d30","show":"\u986f\u793a\u4e3b\u984c\u6392\u540d\u8a73\u7d30\u4fe1\u606f","title":"\u4e3b\u984c\u6392\u540d\u8a73\u7d30"},"topic":{"create_in":"\u5275\u5efa\u4e00\u500b {{categoryName}} \u5206\u985e\u7684\u4e3b\u984c","create":"\u5275\u5efa\u4e3b\u984c","create_long":"\u5275\u5efa\u4e00\u500b\u65b0\u4e3b\u984c","private_message":"\u958b\u5553\u4e00\u6bb5\u79c1\u4e0b\u4ea4\u6d41","list":"\u4e3b\u984c","new":"\u65b0\u4e3b\u984c","title":"\u4e3b\u984c","loading_more":"\u8f09\u5165\u66f4\u591a\u4e3b\u984c\u4e2d\u2026\u2026","loading":"\u8f09\u5165\u4e3b\u984c\u4e2d\u2026\u2026","invalid_access":{"title":"\u9019\u662f\u79c1\u5bc6\u4e3b\u984c","description":"\u62b1\u6b49\uff0c\u4f60\u6c92\u6709\u8a2a\u554f\u6b64\u4e3b\u984c\u7684\u6b0a\u9650\uff01"},"server_error":{"title":"\u8f09\u5165\u4e3b\u984c\u5931\u6557","description":"\u62b1\u6b49\uff0c\u7121\u6cd5\u8f09\u5165\u6b64\u4e3b\u984c\u3002\u6709\u53ef\u80fd\u662f\u7db2\u7d61\u9023\u63a5\u554f\u984c\u5c0e\u81f4\u7684\uff0c\u8acb\u91cd\u8a66\u3002\u5982\u679c\u554f\u984c\u59cb\u7d42\u5b58\u5728\uff0c\u8acb\u544a\u8a34\u6211\u5011\u3002"},"not_found":{"title":"\u672a\u627e\u5230\u4e3b\u984c","description":"\u62b1\u6b49\uff0c\u7121\u6cd5\u627e\u5230\u6b64\u4e3b\u984c\u3002\u6709\u53ef\u80fd\u5b83\u88ab\u8ad6\u58c7\u7248\u4e3b\u522a\u6389\u4e86\uff1f"},"unread_posts":"\u6b64\u4e3b\u984c\u4e2d\u4f60\u6709 {{unread}} \u500b\u5e16\u5b50\u672a\u95b1","new_posts":"\u5f9e\u4f60\u6700\u8fd1\u4e00\u6b21\u95b1\u8b80\u6b64\u4e3b\u984c\u5f8c\uff0c\u53c8\u6709 {{new_posts}} \u500b\u65b0\u5e16\u5b50\u767c\u8868","likes":{"one":"\u6b64\u4e3b\u984c\u5f97\u5230\u4e86\u4e00\u500b\u8d0a","other":"\u6b64\u4e3b\u984c\u5f97\u5230\u4e86 {{count}} \u500b\u8d0a"},"back_to_list":"\u8fd4\u56de\u4e3b\u984c\u5217\u8868","options":"\u4e3b\u984c\u9078\u9805","show_links":"\u986f\u793a\u6b64\u4e3b\u984c\u4e2d\u7684\u93c8\u63a5","toggle_information":"\u5207\u63db\u4e3b\u984c\u8a73\u7d30","read_more_in_category":"\u60f3\u95b1\u8b80\u66f4\u591a\u5167\u5bb9\uff1f\u6d4f\u89bd {{catLink}} \u6216 {{latestLink}} \u88cf\u7684\u5176\u5b83\u4e3b\u984c\u3002","read_more":"\u60f3\u95b1\u8b80\u66f4\u591a\u5167\u5bb9\uff1f{{catLink}} \u6216 {{latestLink}}\u3002","browse_all_categories":"\u6d4f\u89bd\u6240\u6709\u5206\u985e","view_latest_topics":"\u6d4f\u89bd\u71b1\u9580\u4e3b\u984c","suggest_create_topic":"\u9019\u5c31\u5275\u5efa\u4e00\u500b\u4e3b\u984c\u5427\uff01","read_position_reset":"\u4f60\u7684\u95b1\u8b80\u4f4d\u7f6e\u5df2\u7d93\u88ab\u91cd\u7f6e\u3002","jump_reply_up":"\u8df3\u8f49\u81f3\u66f4\u65e9\u7684\u56de\u8907","jump_reply_down":"\u8df3\u8f49\u81f3\u66f4\u665a\u7684\u56de\u8907","deleted":"\u6b64\u4e3b\u984c\u5df2\u88ab\u522a\u9664","auto_close_notice":"\u672c\u4e3b\u984c\u5c07\u5728%{timeLeft}\u5f8c\u81ea\u52d5\u95dc\u9589","auto_close_title":"\u81ea\u52d5\u95dc\u9589\u8a2d\u7f6e","auto_close_save":"\u4fdd\u5b58","auto_close_cancel":"\u53d6\u6d88","auto_close_remove":"\u4e0d\u81ea\u52d5\u95dc\u9589\u8a72\u4e3b\u984c","progress":{"title":"\u4e3b\u984c\u9032\u5ea6","jump_top":"\u8df3\u8f49\u5230\u7b2c\u4e00\u5e16","jump_bottom":"\u8df3\u8f49\u5230\u6700\u5f8c\u4e00\u5e16","total":"\u5168\u90e8\u5e16\u5b50","current":"\u7576\u524d\u5e16"},"notifications":{"title":"","reasons":{"3_2":"\u56e0\u7232\u4f60\u5728\u95dc\u6ce8\u6b64\u4e3b\u984c\uff0c\u6240\u4ee5\u4f60\u5c07\u6536\u5230\u76f8\u95dc\u901a\u77e5\u3002","3_1":"\u56e0\u7232\u4f60\u5275\u5efa\u4e86\u6b64\u4e3b\u984c\uff0c\u6240\u4ee5\u4f60\u5c07\u6536\u5230\u76f8\u95dc\u901a\u77e5\u3002","3":"\u56e0\u7232\u4f60\u5728\u95dc\u6ce8\u6b64\u4e3b\u984c\uff0c\u6240\u4ee5\u4f60\u5c07\u6536\u5230\u76f8\u95dc\u901a\u77e5\u3002","2_4":"\u56e0\u7232\u4f60\u5728\u6b64\u4e3b\u984c\u5167\u767c\u8868\u4e86\u56de\u8907\uff0c\u6240\u4ee5\u4f60\u5c07\u6536\u5230\u76f8\u95dc\u901a\u77e5\u3002","2_2":"\u56e0\u7232\u4f60\u5728\u8ffd\u8e64\u6b64\u4e3b\u984c\uff0c\u6240\u4ee5\u4f60\u5c07\u6536\u5230\u76f8\u95dc\u901a\u77e5\u3002","2":"\u56e0\u7232\u4f60<a href=\"/users/{{username}}/preferences\">\u95b1\u8b80\u4e86\u6b64\u4e3b\u984c</a>\uff0c\u6240\u4ee5\u4f60\u5c07\u6536\u5230\u76f8\u95dc\u901a\u77e5\u3002","1":"\u56e0\u7232\u6709\u4eba @name \u63d0\u53ca\u4e86\u4f60\u6216\u56de\u8907\u4e86\u4f60\u7684\u5e16\u5b50\uff0c\u6240\u4ee5\u4f60\u5c07\u6536\u5230\u76f8\u95dc\u901a\u77e5\u3002","1_2":"\u50c5\u7576\u6709\u4eba @name \u63d0\u53ca\u4e86\u4f60\u6216\u56de\u8907\u4e86\u4f60\u7684\u5e16\u5b50\uff0c\u4f60\u624d\u6703\u6536\u5230\u76f8\u95dc\u901a\u77e5\u3002","0":"\u4f60\u5c07\u5ffd\u7565\u95dc\u4e8e\u6b64\u4e3b\u984c\u7684\u6240\u6709\u901a\u77e5\u3002","0_2":"\u4f60\u5c07\u5ffd\u7565\u95dc\u4e8e\u6b64\u4e3b\u984c\u7684\u6240\u6709\u901a\u77e5\u3002"},"watching":{"title":"\u95dc\u6ce8","description":"\u8207\u8ffd\u8e64\u4e00\u6a23\uff0c\u984d\u5916\u7684\u662f\u4e00\u65e6\u6709\u65b0\u5e16\u5b50\u767c\u8868\uff0c\u4f60\u90fd\u6703\u6536\u5230\u901a\u77e5\u3002"},"tracking":{"title":"\u8ffd\u8e64","description":"\u95dc\u4e8e\u4f60\u7684\u672a\u95b1\u5e16\u5b50\u3001@name \u63d0\u53ca\u8207\u5c0d\u4f60\u7684\u5e16\u5b50\u7684\u56de\u8907\uff0c\u4f60\u90fd\u6703\u6536\u5230\u901a\u77e5\u3002"},"regular":{"title":"\u5e38\u898f","description":"\u53ea\u6709\u7576\u6709\u4eba @name \u63d0\u53ca\u4f60\u6216\u8005\u56de\u8907\u4f60\u7684\u5e16\u5b50\u6642\uff0c\u4f60\u624d\u6703\u6536\u5230\u901a\u77e5\u3002"},"muted":{"title":"\u9632\u6253\u64fe","description":"\u4f60\u4e0d\u6703\u6536\u5230\u95dc\u4e8e\u6b64\u4e3b\u984c\u7684\u4efb\u4f55\u901a\u77e5\uff0c\u4e5f\u4e0d\u6703\u5728\u4f60\u7684\u672a\u95b1\u9078\u9805\u5361\u4e2d\u986f\u793a\u3002"}},"actions":{"delete":"\u522a\u9664\u4e3b\u984c","open":"\u6253\u958b\u4e3b\u984c","close":"\u95dc\u9589\u4e3b\u984c","auto_close":"\u81ea\u52d5\u95dc\u9589","unpin":"\u89e3\u9664\u4e3b\u984c\u7f6e\u9802","pin":"\u7f6e\u9802\u4e3b\u984c","unarchive":"\u89e3\u9664\u4e3b\u984c\u5b58\u6a94","archive":"\u5b58\u6a94\u4e3b\u984c","invisible":"\u4f7f\u4e0d\u53ef\u898b","visible":"\u4f7f\u53ef\u898b","reset_read":"\u91cd\u7f6e\u95b1\u8b80\u6578\u64da","multi_select":"\u9078\u64c7\u5c07\u88ab\u5408\u4e26/\u62c6\u5206\u7684\u5e16\u5b50","convert_to_topic":"\u8f49\u63db\u5230\u5e38\u898f\u4e3b\u984c"},"reply":{"title":"\u56de\u8907","help":"\u958b\u59cb\u7d66\u672c\u4e3b\u984c\u64b0\u5beb\u56de\u8907"},"clear_pin":{"title":"\u6e05\u9664\u7f6e\u9802","help":"\u5c07\u672c\u4e3b\u984c\u7684\u7f6e\u9802\u72c0\u614b\u6e05\u9664\uff0c\u9019\u6a23\u5b83\u5c07\u4e0d\u518d\u59cb\u7d42\u986f\u793a\u5728\u4e3b\u984c\u5217\u8868\u9802\u90e8"},"share":{"title":"\u5206\u4eab","help":"\u5206\u4eab\u4e00\u500b\u5230\u672c\u5e16\u7684\u93c8\u63a5"},"inviting":"\u9080\u8acb\u4e2d\u2026\u2026","invite_private":{"title":"\u9080\u8acb\u9032\u884c\u79c1\u4e0b\u4ea4\u6d41","email_or_username":"\u53d7\u9080\u4eba\u7684\u96fb\u5b50\u90f5\u7bb1\u6216\u7528\u6236\u540d","email_or_username_placeholder":"\u96fb\u5b50\u90f5\u7bb1\u5730\u5740\u6216\u7528\u6236\u540d","action":"\u9080\u8acb","success":"\u8b1d\u8b1d\uff01\u6211\u5011\u5df2\u7d93\u9080\u8acb\u8a72\u7528\u6236\u53c3\u8207\u6b64\u79c1\u4e0b\u4ea4\u6d41\u3002","error":"\u62b1\u6b49\uff0c\u5728\u9080\u8acb\u8a72\u7528\u6236\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002"},"invite_reply":{"title":"\u9080\u8acb\u670b\u53cb\u4f86\u56de\u8907","action":"\u90f5\u4ef6\u9080\u8acb","help":"\u5411\u4f60\u7684\u670b\u53cb\u767c\u9001\u9080\u8acb\uff0c\u4ed6\u5011\u53ea\u9700\u8981\u4e00\u500b\u9ede\u64ca\u5c31\u80fd\u56de\u8907\u9019\u500b\u4e3b\u984c","email":"\u6211\u5011\u6703\u7d66\u4f60\u7684\u670b\u53cb\u767c\u9001\u4e00\u5c01\u90f5\u4ef6\uff0c\u4ed6\u5011\u53ea\u9700\u8981\u9ede\u64ca\u5176\u4e2d\u7684\u4e00\u500b\u93c8\u63a5\u5c31\u53ef\u4ee5\u56de\u8907\u9019\u500b\u4e3b\u984c\u4e86\u3002","email_placeholder":"\u96fb\u5b50\u90f5\u7bb1\u5730\u5740","success":"\u8b1d\u8b1d\uff01\u6211\u5011\u5df2\u767c\u9001\u4e00\u500b\u9080\u8acb\u90f5\u4ef6\u5230<b>{{email}}</b>\u3002\u7576\u4ed6\u5011\u78ba\u8a8d\u7684\u6642\u5019\u6211\u5011\u6703\u901a\u77e5\u4f60\u3002\u4f60\u4e5f\u53ef\u4ee5\u5728\u4f60\u7684\u7528\u6236\u9801\u9762\u7684\u9080\u8acb\u9078\u9805\u5361\u4e0b\u67e5\u770b\u9080\u8acb\u72c0\u614b\u3002","error":"\u62b1\u6b49\uff0c\u6211\u5011\u4e0d\u80fd\u9080\u8acb\u6b64\u4eba\uff0c\u53ef\u80fd\u4ed6/\u5979\u5df2\u7d93\u662f\u672c\u7ad9\u7528\u6236\u4e86\uff1f"},"login_reply":"\u767b\u9304\u4f86\u56de\u8907","filters":{"user":"\u4f60\u5728\u6d4f\u89bd {{n_posts}} {{by_n_users}}.","n_posts":{"one":"\u4e00\u500b\u5e16\u5b50","other":"{{count}} \u5e16\u5b50"},"by_n_users":{"one":"\u4e00\u500b\u6307\u5b9a\u7528\u6236","other":"{{count}} \u500b\u7528\u6236\u4e2d\u7684"},"best_of":"\u4f60\u5728\u6d4f\u89bd {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"\u4e00\u500b\u512a\u79c0\u5e16\u5b50","other":"{{count}} \u512a\u79c0\u5e16\u5b50"},"of_n_posts":{"one":"\u4e00\u500b\u5e16\u5b50\u4e2d\u7684","other":"{{count}} \u500b\u5e16\u5b50\u4e2d\u7684"},"cancel":"\u518d\u6b21\u986f\u793a\u672c\u4e3b\u984c\u4e0b\u7684\u6240\u6709\u5e16\u5b50\u3002"},"split_topic":{"title":"\u62c6\u5206\u4e3b\u984c","action":"\u62c6\u5206\u4e3b\u984c","topic_name":"\u65b0\u4e3b\u984c\u540d\uff1a","error":"\u62c6\u5206\u4e3b\u984c\u6642\u767c\u751f\u932f\u8aa4\u3002","instructions":{"one":"\u4f60\u60f3\u5982\u4f55\u79fb\u52d5\u8a72\u5e16\uff1f","other":"\u4f60\u60f3\u5982\u4f55\u79fb\u52d5\u4f60\u6240\u9078\u64c7\u7684\u9019{{count}}\u7bc7\u5e16\u5b50\uff1f"}},"merge_topic":{"title":"\u5408\u4e26\u4e3b\u984c","action":"\u5408\u4e26\u4e3b\u984c","error":"\u5408\u4e26\u4e3b\u984c\u6642\u767c\u751f\u932f\u8aa4\u3002","instructions":{"one":"\u8acb\u9078\u64c7\u4f60\u60f3\u5c07\u90a3\u7bc7\u5e16\u5b50\u79fb\u81f3\u5176\u4e0b\u7684\u4e3b\u984c\u3002","other":"\u8acb\u9078\u64c7\u4f60\u60f3\u5c07\u90a3{{count}}\u7bc7\u5e16\u5b50\u79fb\u81f3\u5176\u4e0b\u7684\u4e3b\u984c\u3002"}},"multi_select":{"select":"\u9078\u64c7","selected":"\u5df2\u9078\u64c7\uff08{{count}}\uff09","delete":"\u522a\u9664\u6240\u9078","cancel":"\u53d6\u6d88\u9078\u64c7","description":{"one":"\u4f60\u5df2\u9078\u64c7\u4e86<b>\u4e00\u500b</b>\u5e16\u5b50\u3002","other":"\u4f60\u5df2\u9078\u64c7\u4e86<b>{{count}}</b>\u500b\u5e16\u5b50\u3002"}}},"post":{"reply":"\u56de\u8907 {{replyAvatar}} {{username}} \u767c\u8868\u7684 {{link}}","reply_topic":"\u56de\u8907 {{link}}","quote_reply":"\u5f15\u7528\u56de\u8907","edit":"\u7de8\u8f2f {{link}}","post_number":"\u5e16\u5b50 {{number}}","in_reply_to":"\u56de\u8907\u7d66","reply_as_new_topic":"\u56de\u8907\u7232\u65b0\u4e3b\u984c","continue_discussion":"\u5f9e {{postLink}} \u7e7c\u7e8c\u8a0e\u8ad6\uff1a","follow_quote":"\u8df3\u8f49\u81f3\u6240\u5f15\u7528\u7684\u5e16\u5b50","deleted_by_author":"\uff08\u4f5c\u8005\u522a\u9664\u4e86\u5e16\u5b50\uff09","expand_collapse":"\u5c55\u958b/\u6536\u7e2e","has_replies":{"one":"\u56de\u8907","other":"\u56de\u8907"},"errors":{"create":"\u62b1\u6b49\uff0c\u5728\u5275\u5efa\u4f60\u7684\u5e16\u5b50\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002\u8acb\u91cd\u8a66\u3002","edit":"\u62b1\u6b49\uff0c\u5728\u7de8\u8f2f\u4f60\u7684\u5e16\u5b50\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002\u8acb\u91cd\u8a66\u3002","upload":"\u62b1\u6b49\uff0c\u5728\u4e0a\u50b3\u6587\u4ef6\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002\u8acb\u91cd\u8a66\u3002","upload_too_large":"\u62b1\u6b49\uff0c\u4f60\u4e0a\u50b3\u7684\u6587\u4ef6\u592a\u5927\u4e86\uff08\u6700\u5927\u4e0d\u80fd\u8d85\u904e {{max_size_kb}}kb\uff09\uff0c\u8acb\u8abf\u6574\u6587\u4ef6\u5927\u5c0f\u5f8c\u91cd\u65b0\u4e0a\u50b3\u3002","upload_too_many_images":"\u62b1\u6b49, \u4f60\u53ea\u80fd\u4e00\u6b21\u4e0a\u50b3\u4e00\u5f35\u5716\u7247\u3002","only_images_are_supported":"\u62b1\u6b49\uff0c\u4f60\u53ea\u80fd\u4e0a\u50b3\u5716\u7247\u3002"},"abandon":"\u4f60\u78ba\u5b9a\u8981\u4e1f\u68c4\u4f60\u7684\u5e16\u5b50\u55ce\uff1f","archetypes":{"save":"\u4fdd\u5b58\u9078\u9805"},"controls":{"reply":"\u958b\u59cb\u7d66\u672c\u5e16\u64b0\u5beb\u56de\u8907","like":"\u8d0a\u672c\u5e16","edit":"\u7de8\u8f2f\u672c\u5e16","flag":"\u6295\u8a34\u672c\u5e16\u4ee5\u63d0\u9192\u8ad6\u58c7\u7248\u4e3b","delete":"\u522a\u9664\u672c\u5e16","undelete":"\u6062\u8907\u672c\u5e16","share":"\u5206\u4eab\u4e00\u500b\u5230\u672c\u5e16\u7684\u93c8\u63a5","bookmark":"\u7d66\u672c\u5e16\u505a\u66f8\u7c3d\u5230\u4f60\u7684\u7528\u6236\u9801","more":"\u66f4\u591a"},"actions":{"flag":"\u6295\u8a34","clear_flags":{"one":"\u6e05\u9664\u6295\u8a34","other":"\u6e05\u9664\u6295\u8a34"},"it_too":{"off_topic":"\u4e5f\u6295\u8a34","spam":"\u4e5f\u6295\u8a34","inappropriate":"\u4e5f\u6295\u8a34","custom_flag":"\u4e5f\u6295\u8a34","bookmark":"\u4e5f\u505a\u66f8\u7c3d","like":"\u4e5f\u8d0a\u5b83","vote":"\u4e5f\u5c0d\u5b83\u6295\u7968"},"undo":{"off_topic":"\u64a4\u92b7\u6295\u8a34","spam":"\u64a4\u92b7\u6295\u8a34","inappropriate":"\u64a4\u92b7\u6295\u8a34","bookmark":"\u64a4\u92b7\u66f8\u7c3d","like":"\u64a4\u92b7\u8d0a","vote":"\u64a4\u92b7\u6295\u7968"},"people":{"off_topic":"{{icons}} \u6295\u8a34\u5b83\u504f\u96e2\u4e3b\u984c","spam":"{{icons}} \u6295\u8a34\u5b83\u7232\u5783\u573e\u4fe1\u606f","inappropriate":"{{icons}} \u6295\u8a34\u5b83\u7232\u4e0d\u7576\u5167\u5bb9","notify_moderators":"{{icons}} \u5411\u7248\u4e3b\u6295\u8a34\u5b83","notify_moderators_with_url":"{{icons}} <a href='{{postUrl}}'>\u901a\u77e5\u4e86\u7248\u4e3b</a>","notify_user":"{{icons}} \u767c\u8d77\u4e86\u4e00\u500b\u79c1\u4e0b\u4ea4\u6d41","notify_user_with_url":"{{icons}} \u767c\u9001\u4e86\u4e00\u689d<a href='{{postUrl}}'>\u79c1\u6709\u6d88\u606f</a>","bookmark":"{{icons}} \u5c0d\u5b83\u505a\u4e86\u66f8\u7c3d","like":"{{icons}} \u8d0a\u4e86\u5b83","vote":"{{icons}} \u5c0d\u5b83\u6295\u7968"},"by_you":{"off_topic":"\u4f60\u6295\u8a34\u5b83\u504f\u96e2\u4e3b\u984c","spam":"\u4f60\u6295\u8a34\u5b83\u7232\u5783\u573e\u4fe1\u606f","inappropriate":"\u4f60\u6295\u8a34\u5b83\u7232\u4e0d\u7576\u5167\u5bb9","notify_moderators":"\u4f60\u5411\u7248\u4e3b\u6295\u8a34\u4e86\u5b83","notify_user":"\u4f60\u5c0d\u8a72\u7528\u6236\u767c\u8d77\u4e86\u4e00\u500b\u79c1\u4e0b\u4ea4\u6d41","bookmark":"\u4f60\u5c0d\u8a72\u5e16\u505a\u4e86\u66f8\u7c3d","like":"\u4f60\u8d0a\u4e86\u5b83","vote":"\u4f60\u5c0d\u8a72\u5e16\u6295\u4e86\u7968"},"by_you_and_others":{"off_topic":{"one":"\u4f60\u548c\u53e6\u4e00\u500b\u7528\u6236\u6295\u8a34\u5b83\u504f\u96e2\u4e3b\u984c","other":"\u4f60\u548c\u5176\u4ed6 {{count}} \u500b\u7528\u6236\u6295\u8a34\u5b83\u504f\u96e2\u4e3b\u984c"},"spam":{"one":"\u4f60\u548c\u53e6\u4e00\u500b\u7528\u6236\u6295\u8a34\u5b83\u7232\u5783\u573e\u4fe1\u606f","other":"\u4f60\u548c\u5176\u4ed6 {{count}} \u500b\u7528\u6236\u6295\u8a34\u5b83\u7232\u5783\u573e\u4fe1\u606f"},"inappropriate":{"one":"\u4f60\u548c\u53e6\u4e00\u500b\u7528\u6236\u6295\u8a34\u5b83\u7232\u4e0d\u7576\u5167\u5bb9","other":"\u4f60\u548c\u5176\u4ed6 {{count}} \u500b\u7528\u6236\u6295\u8a34\u5b83\u7232\u4e0d\u7576\u5167\u5bb9"},"notify_moderators":{"one":"\u4f60\u548c\u53e6\u4e00\u500b\u7528\u6236\u5411\u7248\u4e3b\u6295\u8a34\u4e86\u5b83","other":"\u4f60\u548c\u5176\u4ed6 {{count}} \u500b\u7528\u6236\u5411\u7248\u4e3b\u6295\u8a34\u4e86\u5b83"},"notify_user":{"one":"\u4f60\u548c\u53e6\u4e00\u500b\u7528\u6236\u5c0d\u8a72\u7528\u6236\u767c\u8d77\u4e86\u4e00\u500b\u79c1\u4e0b\u4ea4\u6d41","other":"\u4f60\u548c\u5176\u4ed6 {{count}} \u500b\u7528\u6236\u5c0d\u8a72\u7528\u6236\u767c\u8d77\u4e86\u4e00\u500b\u79c1\u4e0b\u4ea4\u6d41"},"bookmark":{"one":"\u4f60\u548c\u53e6\u4e00\u500b\u7528\u6236\u5c0d\u8a72\u5e16\u505a\u4e86\u66f8\u7c3d","other":"\u4f60\u548c\u5176\u4ed6 {{count}} \u500b\u7528\u6236\u5c0d\u8a72\u5e16\u505a\u4e86\u66f8\u7c3d"},"like":{"one":"\u4f60\u548c\u53e6\u4e00\u500b\u7528\u6236\u8d0a\u4e86\u5b83","other":"\u4f60\u548c\u5176\u4ed6 {{count}} \u500b\u7528\u6236\u8d0a\u4e86\u5b83"},"vote":{"one":"\u4f60\u548c\u53e6\u4e00\u500b\u7528\u6236\u5c0d\u8a72\u5e16\u6295\u4e86\u7968","other":"\u4f60\u548c\u5176\u4ed6 {{count}} \u500b\u7528\u6236\u5c0d\u8a72\u5e16\u6295\u4e86\u7968"}},"by_others":{"off_topic":{"one":"\u4e00\u500b\u7528\u6236\u6295\u8a34\u5b83\u504f\u96e2\u4e3b\u984c","other":"{{count}} \u500b\u7528\u6236\u6295\u8a34\u5b83\u504f\u96e2\u4e3b\u984c"},"spam":{"one":"\u4e00\u500b\u7528\u6236\u6295\u8a34\u5b83\u7232\u5783\u573e\u4fe1\u606f","other":"{{count}} \u500b\u7528\u6236\u6295\u8a34\u5b83\u7232\u5783\u573e\u4fe1\u606f"},"inappropriate":{"one":"\u4e00\u500b\u7528\u6236\u6295\u8a34\u5b83\u7232\u4e0d\u7576\u5167\u5bb9","other":"{{count}} \u500b\u7528\u6236\u6295\u8a34\u5b83\u7232\u4e0d\u7576\u5167\u5bb9"},"notify_moderators":{"one":"\u4e00\u500b\u7528\u6236\u5411\u7248\u4e3b\u6295\u8a34\u4e86\u5b83","other":"{{count}} \u500b\u7528\u6236\u5411\u7248\u4e3b\u6295\u8a34\u4e86\u5b83"},"notify_user":{"one":"\u4e00\u500b\u7528\u6236\u5c0d\u8a72\u7528\u6236\u767c\u8d77\u4e86\u4e00\u500b\u79c1\u4e0b\u4ea4\u6d41","other":"{{count}} \u500b\u7528\u6236\u5c0d\u8a72\u7528\u6236\u767c\u8d77\u4e86\u4e00\u500b\u79c1\u4e0b\u4ea4\u6d41"},"bookmark":{"one":"\u4e00\u500b\u7528\u6236\u5c0d\u8a72\u5e16\u505a\u4e86\u66f8\u7c3d","other":"{{count}} \u500b\u7528\u6236\u5c0d\u8a72\u5e16\u505a\u4e86\u66f8\u7c3d"},"like":{"one":"\u4e00\u500b\u7528\u6236\u8d0a\u4e86\u5b83","other":"{{count}} \u500b\u7528\u6236\u8d0a\u4e86\u5b83"},"vote":{"one":"\u4e00\u500b\u7528\u6236\u5c0d\u8a72\u5e16\u6295\u4e86\u7968","other":"{{count}} \u500b\u7528\u6236\u5c0d\u8a72\u5e16\u6295\u4e86\u7968"}}},"edits":{"one":"\u4e00\u6b21\u7de8\u8f2f","other":"{{count}}\u6b21\u7de8\u8f2f","zero":"\u672a\u7de8\u8f2f"},"delete":{"confirm":{"one":"\u4f60\u78ba\u5b9a\u8981\u522a\u9664\u6b64\u5e16\u55ce\uff1f","other":"\u4f60\u78ba\u5b9a\u8981\u522a\u9664\u9019\u4e9b\u5e16\u5b50\u55ce\uff1f"}}},"category":{"none":"\uff08\u672a\u5206\u985e\uff09","edit":"\u7de8\u8f2f","edit_long":"\u7de8\u8f2f\u5206\u985e","edit_uncategorized":"\u7de8\u8f2f\u672a\u5206\u985e\u7684","view":"\u6d4f\u89bd\u5206\u985e\u4e0b\u7684\u4e3b\u984c","general":"\u901a\u5e38","settings":"\u8a2d\u7f6e","delete":"\u522a\u9664\u5206\u985e","create":"\u5275\u5efa\u5206\u985e","save":"\u4fdd\u5b58\u5206\u985e","creation_error":"\u5275\u5efa\u6b64\u5206\u985e\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002","save_error":"\u5728\u4fdd\u5b58\u6b64\u5206\u985e\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002","more_posts":"\u6d4f\u89bd\u5168\u90e8 {{posts}} \u2026\u2026","name":"\u5206\u985e\u540d\u7a31","description":"\u63cf\u8ff0","topic":"\u5206\u985e\u4e3b\u984c","badge_colors":"\u5fbd\u7ae0\u9854\u8272","background_color":"\u80cc\u666f\u8272","foreground_color":"\u524d\u666f\u8272","name_placeholder":"\u61c9\u8a72\u7c21\u660e\u627c\u8981\u3002","color_placeholder":"\u4efb\u4f55\u7db2\u7d61\u8272\u5f69","delete_confirm":"\u4f60\u78ba\u5b9a\u8981\u522a\u9664\u6b64\u5206\u985e\u55ce\uff1f","delete_error":"\u5728\u522a\u9664\u6b64\u5206\u985e\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002","list":"\u5217\u51fa\u5206\u985e","no_description":"\u672c\u5206\u985e\u6c92\u6709\u63cf\u8ff0\u4fe1\u606f\u3002","change_in_category_topic":"\u8a2a\u554f\u5206\u985e\u4e3b\u984c\u4f86\u7de8\u8f2f\u63cf\u8ff0\u4fe1\u606f","hotness":"\u71b1\u5ea6","already_used":"\u6b64\u8272\u5f69\u5df2\u7d93\u88ab\u53e6\u4e00\u500b\u5206\u985e\u4f7f\u7528","is_secure":"\u5b89\u5168\u985e\u578b\uff1f","add_group":"\u6dfb\u52a0\u5206\u7d44","security":"\u5b89\u5168","allowed_groups":"\u6388\u6b0a\u7684\u5206\u7d44\uff1a","auto_close_label":"\u81ea\u52d5\u95dc\u9589\u4e3b\u984c\uff0c\u904e\uff1a"},"flagging":{"title":"\u7232\u4f55\u8981\u7d66\u6295\u8a34\u672c\u5e16\uff1f","action":"\u6295\u8a34\u5e16\u5b50","notify_action":"\u901a\u77e5","cant":"\u62b1\u6b49\uff0c\u7576\u524d\u4f60\u4e0d\u80fd\u6295\u8a34\u672c\u5e16\u3002","custom_placeholder_notify_user":"\u7232\u4f55\u4f60\u8981\u79c1\u4e0b\u806f\u7cfb\u8a72\u7528\u6236\uff1f","custom_placeholder_notify_moderators":"\u7232\u4f55\u672c\u5e16\u9700\u8981\u8ad6\u58c7\u7248\u4e3b\u7684\u95dc\u6ce8\uff1f\u7232\u4f55\u672c\u5e16\u9700\u8981\u8ad6\u58c7\u7248\u4e3b\u7684\u95dc\u6ce8\uff1f","custom_message":{"at_least":"\u8f38\u5165\u81f3\u5c11 {{n}} \u500b\u5b57\u7b26","more":"\u9084\u5dee {{n}} \u500b\u2026\u2026","left":"\u9084\u5269\u4e0b {{n}}"}},"topic_summary":{"title":"\u4e3b\u984c\u6982\u8981","links_shown":"\u986f\u793a\u6240\u6709 {{totalLinks}} \u500b\u93c8\u63a5\u2026\u2026","clicks":"\u9ede\u64ca","topic_link":"\u4e3b\u984c\u93c8\u63a5"},"topic_statuses":{"locked":{"help":"\u672c\u4e3b\u984c\u5df2\u95dc\u9589\uff0c\u4e0d\u518d\u63a5\u53d7\u65b0\u7684\u56de\u8907"},"pinned":{"help":"\u672c\u4e3b\u984c\u5df2\u7f6e\u9802\uff0c\u5b83\u5c07\u59cb\u7d42\u986f\u793a\u5728\u5b83\u6240\u5c6c\u5206\u985e\u7684\u9802\u90e8"},"archived":{"help":"\u672c\u4e3b\u984c\u5df2\u6b78\u6a94\uff0c\u5373\u5df2\u7d93\u51cd\u7d50\uff0c\u7121\u6cd5\u4fee\u6539"},"invisible":{"help":"\u672c\u4e3b\u984c\u4e0d\u53ef\u898b\uff0c\u5b83\u5c07\u4e0d\u88ab\u986f\u793a\u5728\u4e3b\u984c\u5217\u8868\u4e2d\uff0c\u53ea\u80fd\u901a\u904e\u4e00\u500b\u76f4\u63a5\u93c8\u63a5\u4f86\u8a2a\u554f"}},"posts":"\u5e16\u5b50","posts_long":"\u672c\u4e3b\u984c\u6709 {{number}} \u500b\u5e16\u5b50","original_post":"\u539f\u59cb\u5e16","views":"\u6d4f\u89bd","replies":"\u56de\u8907","views_long":"\u672c\u4e3b\u984c\u5df2\u7d93\u88ab\u6d4f\u89bd\u904e {{number}} \u6b21","activity":"\u6d3b\u52d5","likes":"\u8d0a","top_contributors":"\u53c3\u8207\u8005","category_title":"\u5206\u985e","history":"\u66c6\u53f2","changed_by":"\u7531 {{author}}","categories_list":"\u5206\u985e\u5217\u8868","filters":{"latest":{"title":"\u6700\u65b0","help":"\u6700\u65b0\u767c\u5e03\u7684\u5e16\u5b50"},"hot":{"title":"\u71b1\u9580","help":"\u6700\u8fd1\u6700\u53d7\u6b61\u8fce\u7684\u4e3b\u984c"},"favorited":{"title":"\u6536\u85cf","help":"\u4f60\u6536\u85cf\u7684\u4e3b\u984c"},"read":{"title":"\u5df2\u95b1","help":"\u4f60\u5df2\u7d93\u95b1\u8b80\u904e\u7684\u4e3b\u984c"},"categories":{"title":"\u5206\u985e","title_in":"\u5206\u985e - {{categoryName}}","help":"\u6b78\u5c6c\u4e8e\u4e0d\u540c\u5206\u985e\u7684\u6240\u6709\u4e3b\u984c"},"unread":{"title":{"zero":"\u672a\u95b1","one":"1\u500b\u672a\u95b1\u4e3b\u984c","other":"{{count}}\u500b\u672a\u95b1\u4e3b\u984c"},"help":"\u8ffd\u8e64\u7684\u4e3b\u984c\u4e2d\u6709\u672a\u95b1\u5e16\u5b50\u7684\u4e3b\u984c"},"new":{"title":{"zero":"\u65b0\u4e3b\u984c","one":"\u65b0\u4e3b\u984c\uff081\uff09","other":"\u65b0\u4e3b\u984c\uff08{{count}}\uff09"},"help":"\u4f60\u6700\u8fd1\u4e00\u6b21\u8a2a\u554f\u5f8c\u7684\u65b0\u4e3b\u984c\uff0c\u4ee5\u53ca\u4f60\u8ffd\u8e64\u7684\u4e3b\u984c\u4e2d\u6709\u65b0\u5e16\u5b50\u7684\u4e3b\u984c"},"posted":{"title":"\u6211\u7684\u5e16\u5b50","help":"\u4f60\u767c\u8868\u904e\u5e16\u5b50\u7684\u4e3b\u984c"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}}\uff081\uff09","other":"{{categoryName}}\uff08{{count}}\uff09"},"help":"\u5728 {{categoryName}} \u5206\u985e\u4e2d\u71b1\u9580\u7684\u4e3b\u984c"}},"browser_update":"\u62b1\u6b49, <a href=\"http://www.iteriter.com/faq/#browser\">\u4f60\u7684\u6d4f\u89bd\u5668\u7248\u672c\u592a\u4f4e\uff0c\u63a8\u85a6\u4f7f\u7528Chrome</a>. \u8acb <a href=\"http://www.google.com/chrome/\">\u5347\u7d1a\u4f60\u7684\u6d4f\u89bd\u5668</a>\u3002","type_to_filter":"\u8f38\u5165\u904e\u6ffe\u689d\u4ef6\u2026\u2026","admin":{"title":"\u8ad6\u9053 \u7ba1\u7406","moderator":"\u7248\u4e3b","dashboard":{"title":"\u7ba1\u7406\u9762\u677f","version":"\u5b89\u88dd\u7684\u7248\u672c","up_to_date":"\u4f60\u6b63\u5728\u904b\u884c\u6700\u65b0\u7684\u8ad6\u58c7\u7248\u672c\u3002","critical_available":"\u6709\u4e00\u500b\u95dc\u9375\u66f4\u65b0\u53ef\u7528\u3002","updates_available":"\u76ee\u524d\u6709\u53ef\u7528\u66f4\u65b0\u3002","please_upgrade":"\u8acb\u5347\u7d1a\uff01","installed_version":"\u5df2\u5b89\u88dd","latest_version":"\u6700\u65b0\u7248\u672c","problems_found":"\u4f60\u5b89\u88dd\u7684\u8ad6\u58c7\u76ee\u524d\u6709\u4ee5\u4e0b\u554f\u984c\uff1a","last_checked":"\u4e0a\u6b21\u6aa2\u67e5","refresh_problems":"\u5237\u65b0","no_problems":"\u627e\u4e0d\u5230\u554f\u984c.","moderators":"\u7248\u4e3b\uff1a","admins":"\u7ba1\u7406\u54e1\uff1a","private_messages_short":"\u79c1\u4fe1","private_messages_title":"\u79c1\u5bc6\u4fe1\u606f","reports":{"today":"\u4eca\u5929","yesterday":"\u6628\u5929","last_7_days":"7 \u5929\u4ee5\u5167","last_30_days":"30 \u5929\u4ee5\u5167","all_time":"\u6240\u6709\u6642\u9593\u5167","7_days_ago":"7 \u5929\u4e4b\u524d","30_days_ago":"30 \u5929\u4e4b\u524d","all":"\u5168\u90e8","view_table":"\u4ee5\u8868\u683c\u5c55\u793a","view_chart":"\u4ee5\u67f1\u72c0\u5716\u5c55\u793a"}},"commits":{"latest_changes":"\u6700\u5f8c\u7684\u6539\u52d5: \u8acb\u7d93\u5e38\u5347\u7d1a\uff01","by":"\u4f86\u81ea"},"flags":{"title":"\u6295\u8a34","old":"\u904e\u53bb\u7684","active":"\u6d3b\u8e8d\u7684","clear":"\u6e05\u9664\u6295\u8a34","clear_title":"\u64a4\u92b7\u672c\u5e16\u7684\u6240\u6709\u6295\u8a34\uff08\u5df2\u96b1\u85cf\u7684\u5e16\u5b50\u5c07\u6703\u88ab\u53d6\u6d88\u96b1\u85cf\uff09","delete":"\u522a\u9664\u5e16\u5b50","delete_title":"\u522a\u9664\u5e16\u5b50\uff08\u5982\u679c\u5b83\u662f\u4e3b\u984c\u7b2c\u4e00\u5e16\uff0c\u90a3\u9ebd\u5c07\u522a\u9664\u4e3b\u984c\uff09","flagged_by":"\u6295\u8a34\u8005\u7232","error":"\u51fa\u932f\u4e86","view_message":"\u67e5\u770b\u6d88\u606f"},"groups":{"title":"\u7fa4\u7d44","edit":"\u7de8\u8f2f\u7fa4\u7d44","selector_placeholder":"\u6dfb\u52a0\u7528\u6236","name_placeholder":"\u7d44\u540d\uff0c\u4e0d\u80fd\u542b\u6709\u7a7a\u683c\uff0c\u8207\u7528\u6236\u540d\u898f\u5247\u4e00\u81f4"},"api":{"title":"\u61c9\u7528\u958b\u767c\u63a5\u53e3\uff08API\uff09","long_title":"API\u4fe1\u606f","key":"\u5bc6\u9470","generate":"\u751f\u6210API\u5bc6\u9470","regenerate":"\u91cd\u65b0\u751f\u6210API\u5bc6\u9470","info_html":"API\u5bc6\u9470\u53ef\u4ee5\u7528\u4f86\u901a\u904eJSON\u8abf\u7528\u5275\u5efa\u548c\u66f4\u65b0\u4e3b\u984c\u3002","note_html":"\u8acb<strong>\u5b89\u5168\u7684</strong>\u4fdd\u7ba1\u597d\u672c\u5bc6\u9470\uff0c\u4efb\u4f55\u64c1\u6709\u8a72\u5bc6\u9470\u7684\u7528\u6236\u53ef\u4ee5\u4f7f\u7528\u5b83\u4ee5\u8ad6\u58c7\u4efb\u4f55\u7528\u6236\u7684\u540d\u7fa9\u4f86\u767c\u5e16\u3002"},"customize":{"title":"\u5b9a\u5236","long_title":"\u7ad9\u9ede\u5b9a\u5236","header":"\u982d\u90e8","css":"\u5c64\u758a\u6a23\u5f0f\u8868\uff08CSS\uff09","override_default":"\u8986\u84cb\u7f3a\u7701\u503c\uff1f","enabled":"\u5553\u7528\uff1f","preview":"\u9810\u89bd","undo_preview":"\u64a4\u92b7\u9810\u89bd","save":"\u4fdd\u5b58","new":"\u65b0\u5efa","new_style":"\u65b0\u6a23\u5f0f","delete":"\u522a\u9664","delete_confirm":"\u522a\u9664\u672c\u5b9a\u5236\u5167\u5bb9\uff1f","about":"\u7ad9\u9ede\u5b9a\u5236\u5141\u8a31\u4f60\u4fee\u6539\u6a23\u5f0f\u8868\u548c\u7ad9\u9ede\u982d\u90e8\u3002\u9078\u64c7\u6216\u8005\u6dfb\u52a0\u4e00\u500b\u4f86\u958b\u59cb\u7de8\u8f2f\u3002"},"email":{"title":"\u96fb\u5b50\u90f5\u4ef6","sent_at":"\u767c\u9001\u6642\u9593","email_type":"\u90f5\u4ef6\u985e\u578b","to_address":"\u76ee\u7684\u5730\u5740","test_email_address":"\u6e2c\u8a66\u96fb\u5b50\u90f5\u4ef6\u5730\u5740","send_test":"\u767c\u9001\u6e2c\u8a66\u96fb\u5b50\u90f5\u4ef6","sent_test":"\u5df2\u767c\u9001\uff01"},"impersonate":{"title":"\u5047\u5192\u7528\u6236","username_or_email":"\u7528\u6236\u540d\u6216\u7528\u6236\u96fb\u5b50\u90f5\u4ef6","help":"\u4f7f\u7528\u6b64\u5de5\u5177\u4f86\u5047\u5192\u4e00\u500b\u7528\u6236\u5e33\u865f\u4ee5\u65b9\u4fbf\u8abf\u8a66\u3002","not_found":"\u7121\u6cd5\u627e\u5230\u8a72\u7528\u6236\u3002","invalid":"\u62b1\u6b49\uff0c\u4f60\u4e0d\u80fd\u5047\u5192\u8a72\u7528\u6236\u3002"},"users":{"title":"\u7528\u6236","create":"\u6dfb\u52a0\u7ba1\u7406\u54e1\u7528\u6236","last_emailed":"\u6700\u5f8c\u4e00\u6b21\u90f5\u5bc4","not_found":"\u62b1\u6b49\uff0c\u5728\u6211\u5011\u7684\u7cfb\u7d71\u4e2d\u6b64\u7528\u6236\u540d\u4e0d\u5b58\u5728\u3002","new":"\u65b0\u5efa","active":"\u6d3b\u8e8d","pending":"\u5f85\u5b9a","approved":"\u5df2\u6279\u51c6\uff1f","approved_selected":{"one":"\u6279\u51c6\u7528\u6236","other":"\u6279\u51c6\u7528\u6236\uff08{{count}}\uff09"},"titles":{"active":"\u6d3b\u52d5\u7528\u6236","new":"\u65b0\u7528\u6236","pending":"\u7b49\u5f85\u5be9\u6838\u7528\u6236","newuser":"\u4fe1\u7528\u7b49\u7d1a\u72320\u7684\u7528\u6236\uff08\u65b0\u7528\u6236\uff09","basic":"\u4fe1\u7528\u7b49\u7d1a\u72321\u7684\u7528\u6236\uff08\u57fa\u672c\u7528\u6236\uff09","regular":"\u4fe1\u7528\u7b49\u7d1a\u72322\u7684\u7528\u6236\uff08\u5e38\u8a2a\u554f\u7528\u6236\uff09","leader":"\u4fe1\u7528\u7b49\u7d1a\u72323\u7684\u7528\u6236\uff08\u9ad8\u7d1a\u7528\u6236\uff09","elder":"\u4fe1\u7528\u7b49\u7d1a\u72324\u7684\u7528\u6236\uff08\u9aa8\u7070\u7528\u6236\uff09","admins":"\u7ba1\u7406\u54e1","moderators":"\u7248\u4e3b"}},"user":{"ban_failed":"\u7981\u6b62\u6b64\u7528\u6236\u6642\u767c\u751f\u4e86\u932f\u8aa4 {{error}}","unban_failed":"\u89e3\u7981\u6b64\u7528\u6236\u6642\u767c\u751f\u4e86\u932f\u8aa4 {{error}}","ban_duration":"\u4f60\u8a08\u5283\u7981\u6b62\u8a72\u7528\u6236\u591a\u4e45\uff1f\uff08\u5929\uff09","delete_all_posts":"\u522a\u9664\u6240\u6709\u5e16\u5b50","ban":"\u7981\u6b62","unban":"\u89e3\u7981","banned":"\u5df2\u7981\u6b62\uff1f","moderator":"\u7248\u4e3b\uff1f","admin":"\u7ba1\u7406\u54e1\uff1f","show_admin_profile":"\u7ba1\u7406\u54e1","refresh_browsers":"\u5f37\u5236\u6d4f\u89bd\u5668\u5237\u65b0","show_public_profile":"\u986f\u793a\u516c\u958b\u4ecb\u7d39","impersonate":"\u5047\u5192\u7528\u6236","revoke_admin":"\u540a\u92b7\u7ba1\u7406\u54e1\u8cc7\u683c","grant_admin":"\u8ce6\u4e88\u7ba1\u7406\u54e1\u8cc7\u683c","revoke_moderation":"\u540a\u92b7\u8ad6\u58c7\u7248\u4e3b\u8cc7\u683c","grant_moderation":"\u8ce6\u4e88\u8ad6\u58c7\u7248\u4e3b\u8cc7\u683c","reputation":"\u8072\u8b7d","permissions":"\u6b0a\u9650","activity":"\u6d3b\u52d5","like_count":"\u6536\u5230\u7684\u8d0a","private_topics_count":"\u79c1\u6709\u4e3b\u984c\u6578\u91cf","posts_read_count":"\u5df2\u95b1\u5e16\u5b50\u6578\u91cf","post_count":"\u5275\u5efa\u7684\u5e16\u5b50\u6578\u91cf","topics_entered":"\u9032\u5165\u7684\u4e3b\u984c\u6578\u91cf","flags_given_count":"\u6240\u505a\u6295\u8a34\u6578\u91cf","flags_received_count":"\u6536\u5230\u6295\u8a34\u6578\u91cf","approve":"\u6279\u51c6","approved_by":"\u6279\u51c6\u4eba","time_read":"\u95b1\u8b80\u6b21\u6578","delete":"\u522a\u9664\u7528\u6236","delete_forbidden":"\u6b64\u7528\u6236\u9084\u7121\u6cd5\u522a\u9664\uff0c\u56e0\u7232\u4ed6/\u5979\u9084\u6709\u5e16\u5b50\u3002\u8acb\u5148\u522a\u9664\u8a72\u7528\u6236\u7684\u6240\u6709\u5e16\u5b50\u3002","delete_confirm":"\u4f60 \u78ba\u5b9a \u4f60\u8981\u6c38\u4e45\u7684\u5f9e\u672c\u7ad9\u522a\u9664\u6b64\u7528\u6236\uff1f\u8a72\u64cd\u4f5c\u7121\u6cd5\u64a4\u92b7\uff01","deleted":"\u8a72\u7528\u6236\u5df2\u88ab\u522a\u9664\u3002","delete_failed":"\u5728\u522a\u9664\u7528\u6236\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002\u8acb\u78ba\u4fdd\u522a\u9664\u8a72\u7528\u6236\u524d\u522a\u9664\u4e86\u8a72\u7528\u6236\u7684\u6240\u6709\u5e16\u5b50\u3002","send_activation_email":"\u767c\u9001\u6fc0\u6d3b\u90f5\u4ef6","activation_email_sent":"\u6fc0\u6d3b\u90f5\u4ef6\u5df2\u767c\u9001\u3002","send_activation_email_failed":"\u5728\u767c\u9001\u6fc0\u6d3b\u90f5\u4ef6\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002","activate":"\u6fc0\u6d3b\u5e33\u865f","activate_failed":"\u5728\u6fc0\u6d3b\u7528\u6236\u5e33\u865f\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002","deactivate_account":"\u505c\u7528\u5e33\u865f","deactivate_failed":"\u5728\u505c\u7528\u7528\u6236\u5e33\u865f\u6642\u767c\u751f\u4e86\u932f\u8aa4\u3002"},"site_content":{"none":"\u9078\u64c7\u5167\u5bb9\u985e\u578b\u4ee5\u958b\u59cb\u7de8\u8f2f\u3002","title":"\u5167\u5bb9","edit":"\u7de8\u8f2f\u7ad9\u9ede\u5167\u5bb9"},"site_settings":{"show_overriden":"\u53ea\u986f\u793a\u88ab\u8986\u84cb\u4e86\u7f3a\u7701\u503c\u7684","title":"\u8a2d\u7f6e","reset":"\u91cd\u7f6e\u7232\u7f3a\u7701\u503c"}}}}};
I18n.locale = 'zh_TW';
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
