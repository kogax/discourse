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
MessageFormat.locale.es = function ( n ) {
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
    })({});I18n.translations = {"es":{"js":{"dates":{"tiny":{"half_a_minute":"< 1m","less_than_x_seconds":{"one":"< 1s","other":"< %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"< 1m","other":"< %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_months":{"one":"1mes","other":"%{count}meses"},"x_months":{"one":"1mes","other":"%{count}meses"},"about_x_years":{"one":"1y","other":"%{count}y"},"over_x_years":{"one":"> 1y","other":"> %{count}y"},"almost_x_years":{"one":"1y","other":"%{count}y"}}},"share":{"topic":"comparte un enlace a este tema","post":"comparte un enlace a esta publicaci\u00f3n","close":"cerrar"},"edit":"editar el t\u00edtulo y la categor\u00eda de este tema","not_implemented":"Esta caracter\u00edstica no ha sido implementada a\u00fan, \u00a1lo sentimos!","no_value":"No","yes_value":"S\u00ed","of_value":"de","generic_error":"Lo sentimos, ha ocurrido un error.","log_in":"Ingreso","age":"Edad","last_post":"\u00daltima publicaci\u00f3n","admin_title":"Admin","flags_title":"Banderas","show_more":"ver m\u00e1s","links":"Enlaces","faq":"FAQ","you":"Usted","ok":"Hecho","or":"o","now":"ahora mismo","suggested_topics":{"title":"Temas Sugeridos"},"bookmarks":{"not_logged_in":"Lo sentimos, debes haber ingresado para marcar publicaciones.","created":"Has marcado esta publicaci\u00f3n como favorita.","not_bookmarked":"Has le\u00eddo esta publicaci\u00f3n, de click para marcarla como favorita.","last_read":"Esta es la \u00faltima publicaci\u00f3n que has le\u00eddo."},"new_topics_inserted":"{{count}} nuevos temas.","show_new_topics":"Click para mostrar.","preview":"vista previa","cancel":"cancelar","save":"Guardar Cambios","saving":"Guardando...","saved":"\u00a1Guardado!","user_action":{"user_posted_topic":"<a href='{{userUrl}}'>{{user}}</a> poste\u00f3 <a href='{{topicUrl}}'>el tema</a>","you_posted_topic":"<a href='{{userUrl}}'>T\u00fa</a> posteaste <a href='{{topicUrl}}'>el tema</a>","user_replied_to_post":"<a href='{{userUrl}}'>{{user}}</a> contest\u00f3 a <a href='{{postUrl}}'>{{post_number}}</a>","you_replied_to_post":"<a href='{{userUrl}}'>T\u00fa</a> contestaste a <a href='{{postUrl}}'>{{post_number}}</a>","user_replied_to_topic":"<a href='{{userUrl}}'>{{user}}</a> contest\u00f3 a <a href='{{topicUrl}}'>el tema</a>","you_replied_to_topic":"<a href='{{userUrl}}'>T\u00fa</a> contestaste <a href='{{topicUrl}}'>el tema</a>","user_mentioned_user":"<a href='{{user1Url}}'>{{user}}</a> mencion\u00f3 <a href='{{user2Url}}'>{{another_user}}</a>","user_mentioned_you":"<a href='{{user1Url}}'>{{user}}</a> <a href='{{user2Url}}'>te</a> mencion\u00f3","you_mentioned_user":"<a href='{{user1Url}}'>T\u00fa</a> mencionaste a <a href='{{user2Url}}'>{{user}}</a>","posted_by_user":"Posteado por <a href='{{userUrl}}'>{{user}}</a>","posted_by_you":"Posteado por <a href='{{userUrl}}'>ti</a>","sent_by_user":"Enviado por <a href='{{userUrl}}'>{{user}}</a>","sent_by_you":"Enviado por <a href='{{userUrl}}'>ti</a>"},"user_action_groups":{"1":"Likes Dados","2":"Likes Recibidos","3":"Bookmarks","4":"Temas","5":"Replies","6":"Respuestas","7":"Menciones","9":"Quotes","10":"Favoritos","11":"Ediciones","12":"Items enviados","13":"Inbox"},"user_action_descriptions":{"6":"Respuestas"},"user":{"profile":"Perfil","title":"Usuario","mute":"Silenciar","edit":"Editar Preferencias","download_archive":"descargar un archivo con mis publicaciones","private_message":"Mensaje Privado","private_messages":"Mensajes","activity_stream":"Actividad","preferences":"Preferencias","bio":"Acerca de m\u00ed","change_password":{"action":"cambiar","success":"(email enviado)","in_progress":"(enviando email)","error":"(error)"},"invited_by":"Invitado por","trust_level":"Nivel de Confianza","external_links_in_new_tab":"Abrir todos los links externos en una nueva pesta\u00f1a","enable_quoting":"Activar respuesta citando el texto resaltado","change_username":{"action":"cambiar","title":"Cambiar Nombre de Usuario","confirm":"Pueden haber consecuencias al cambiar tu nombre de usuario. \u00bfEst\u00e1s absolutamente seguro de que deseas cambiarlo?","taken":"Lo sentimos, pero este nombre de usuario ya est\u00e1 tomado.","error":"Hubo un error al cambiar tu nombre de usuario.","invalid":"Este nombre de usuario es inv\u00e1lido. Debe incluir s\u00f3lo n\u00fameros y letras"},"change_email":{"action":"cambiar","title":"Cambiar Email","taken":"Lo sentimos, este email no est\u00e1 disponible.","error":"Hubo un error al cambiar tu email. \u00bfTal vez esa direcci\u00f3n ya est\u00e1 en uso?","success":"Te hemos enviado un email a esa direcci\u00f3n. Por favor sigue las instrucciones de confirmaci\u00f3n."},"email":{"title":"Email","instructions":"Tu email nunca ser\u00e1 mostrado al p\u00fablico.","ok":"Se ve bien. Te enviaremos un email para confirmar.","invalid":"Por favor ingresa una direcci\u00f3n de email v\u00e1lida.","authenticated":"Tu email ha sido autenticado por {{provider}}.","frequency":"S\u00f3lo te enviaremos emails si no te hemos visto recientemente y todav\u00eda no has visto lo que te estamos enviando."},"name":{"title":"Nombre","instructions":"La versi\u00f3n m\u00e1s larga de tu nombre; no tiene por qu\u00e9 ser \u00fanico. Usado para coincidir con @nombre y mostrado s\u00f3lo en la p\u00e1gina de tu usuario.","too_short":"Tu nombre es muy corto.","ok":"Tu nombre se ve bien."},"username":{"title":"Nombre de usuario","instructions":"Debe ser \u00fanico, sin espacios. La gente puede mencionarte como @{{username}}.","short_instructions":"La gente puede mencionarte como @{{username}}.","available":"Your username is available.","global_match":"Email matches the registered username.","global_mismatch":"Already registered. Try {{suggestion}}?","not_available":"Not available. Try {{suggestion}}?","too_short":"Your username is too short.","too_long":"Your username is too long.","checking":"Checking username availability...","enter_email":"Username found. Enter matching email."},"password_confirmation":{"title":"Ingrese la Contrase\u00f1a Nuevamente"},"last_posted":"\u00daltimo Publicado","last_emailed":"\u00daltimo Enviado por Email","last_seen":"\u00daltimo Visto","created":"Creado el","log_out":"Cerrar Sesi\u00f3n","website":"Sitio Web","email_settings":"Email","email_digests":{"title":"Cuando no visite el sitio, env\u00edenme un resumen v\u00eda email de las novedades","daily":"diariamente","weekly":"semanalmente","bi_weekly":"cada dos semanas"},"email_direct":"Recibir un email cuando alguien cite, responda, o mencione tu @nombredeusuario","email_private_messages":"Recibir un email cuando alguien te env\u00ede un mensaje privado","other_settings":"Otros","new_topic_duration":{"label":"Considerar que los temas son nuevos cuando","not_viewed":"Todav\u00eda no los he visto","last_here":"han sido publicados desde la \u00faltima vez que estuve aqu\u00ed","after_n_days":{"one":"han sido publicados en el \u00faltimo d\u00eda","other":"han sido publicados en los \u00faltimos {{count}} d\u00edas"},"after_n_weeks":{"one":"han sido publicados en la \u00faltima semana","other":"han sido publicados en las \u00faltimas {{count}} semanas"}},"auto_track_topics":"Seguir autom\u00e1ticamente los temas donde entro","auto_track_options":{"never":"nunca","always":"siempre","after_n_seconds":{"one":"luego de 1 segundo","other":"luego de {{count}} segundos"},"after_n_minutes":{"one":"luego de 1 minuto","other":"luego de {{count}} minutos"}},"invited":{"title":"Invitaciones","user":"Invitar Usuario","none":"{{username}} no ha invitado a ning\u00fan usuario al sitio.","redeemed":"Invitaciones Compensadas","redeemed_at":"Compensada el","pending":"Invitaciones Pendientes","topics_entered":"Temas Vistos","posts_read_count":"Publicaciones Le\u00eddas","rescind":"Eliminar Invitaci\u00f3n","rescinded":"Invitaci\u00f3n eliminada","time_read":"Tiempo de Lectura","days_visited":"D\u00edas Visitados","account_age_days":"Edad de la cuenta en d\u00edas"},"password":{"title":"Contrase\u00f1a","too_short":"Tu contrase\u00f1a es muy corta.","ok":"Tu contrase\u00f1a se ve bien."},"ip_address":{"title":"\u00daltima Direcci\u00f3n IP"},"avatar":{"title":"Avatar","instructions":"Usamos <a href='https://gravatar.com' target='_blank'>Gravatar</a> para obtener tu avatar basado en tu direcci\u00f3n de email."},"filters":{"all":"Todos"},"stream":{"posted_by":"Publicado por","sent_by":"Enviado por","private_message":"mensaje privado","the_topic":"el tema"}},"loading":"Cargando...","close":"Cerrar","learn_more":"aprender m\u00e1s...","year":"a\u00f1o","year_desc":"temas publicados en los \u00faltimos 365 d\u00edas","month":"mes","month_desc":"temas publicados en los \u00faltimos 30 d\u00edas","week":"semana","week_desc":"temas publicados en los \u00faltimos 7 d\u00edas","first_post":"Primera publicaci\u00f3n","mute":"Silenciar","unmute":"Quitar silencio","best_of":{"title":"Lo Mejor De","description":"Hay <b>{{count}}</b> publicaciones en este tema. \u00a1Son realmente muchas! \u00bfTe gustar\u00eda ahorrar algo de tiempo viendo s\u00f3lo las publicaciones con m\u00e1s interacciones y respuestas?","button":"Cambiar a la vista \"Lo Mejor De\""},"private_message_info":{"title":"Conversaci\u00f3n Privada","invite":"Invitar Otros..."},"email":"Email","username":"Nombre de usuario","last_seen":"Visto por \u00faltima vez","created":"Creado","trust_level":"Nivel de Confianza","create_account":{"title":"Crear Cuenta","action":"\u00a1Crear una ahora!","invite":"\u00bfTodav\u00eda no tienes una cuenta?","failed":"Algo sali\u00f3 mal, tal vez este email ya fue registrado, intenta con el enlace 'olvid\u00e9 la contrase\u00f1a'"},"forgot_password":{"title":"Olvid\u00e9 mi Contrase\u00f1a","action":"Olvid\u00e9 mi contrase\u00f1a","invite":"Ingresa tu nombre de usuario o tu direcci\u00f3n de email, y te enviaremos un correo electr\u00f3nico para cambiar tu contrase\u00f1a.","reset":"Cambiar Contrase\u00f1a","complete":"Dentro de poco deber\u00edas estar recibiendo un email con las instrucciones para cambiar tu contrase\u00f1a."},"login":{"title":"Iniciar Sesi\u00f3n","username":"Nombre de usuario","password":"Contrase\u00f1a","email_placeholder":"direcci\u00f3n de email o nombre de usuario","error":"Error desconocido","reset_password":"Reestabler Contrase\u00f1a","logging_in":"Iniciando sesi\u00f3n...","or":"O","authenticating":"Autenticando...","awaiting_confirmation":"Tu cuenta est\u00e1 pendiente de activaci\u00f3n, usa el enlace de 'olvid\u00e9 contrase\u00f1a' para recibir otro email de activaci\u00f3n.","awaiting_approval":"Tu cuenta todav\u00eda no ha sido aprobada por un moderador. Recibir\u00e1s un email cuando sea aprobada.","not_activated":"No puedes iniciar sesi\u00f3n todav\u00eda. Anteriormente te hemos enviado un email de activaci\u00f3n a <b>{{sentTo}}</b>. Por favor sigue las instrucciones en ese email para activar tu cuenta.","resend_activation_email":"Has click aqu\u00ed para enviar el email de activaci\u00f3n nuevamente.","sent_activation_email_again":"Te hemos enviado otro email de activaci\u00f3n a <b>{{currentEmail}}</b>. Podr\u00eda tomar algunos minutos en llegar; aseg\u00farate de revisar tu carpeta de spam.","google":{"title":"con Google","message":"Autenticando con Google (aseg\u00farate de desactivar cualquier bloqueador de pop ups)"},"twitter":{"title":"con Twitter","message":"Autenticando con Twitter (aseg\u00farate de desactivar cualquier bloqueador de pop ups)"},"facebook":{"title":"con Facebook","message":"Autenticando con Facebook (aseg\u00farate de desactivar cualquier bloqueador de pop ups)"},"yahoo":{"title":"con Yahoo","message":"Autenticando con Yahoo (aseg\u00farate de desactivar cualquier bloqueador de pop ups)"},"github":{"title":"con GitHub","message":"Autenticando con GitHub (aseg\u00farate de desactivar cualquier bloqueador de pop ups)"},"persona":{"title":"con Persona","message":"Autenticando con Mozilla Persona (aseg\u00farate de desactivar cualquier bloqueador de pop ups)"}},"composer":{"posting_not_on_topic":"Estas respondiendo al tema \"{{title}}\", pero estas viendo un tema distinto.","saving_draft_tip":"guardando","saved_draft_tip":"guardado","saved_local_draft_tip":"guardado localmente","similar_topics":"Tu tema es similar a...","drafts_offline":"borradores offline","min_length":{"need_more_for_title":"{{n}} para completar el t\u00edtulo","need_more_for_reply":"{{n}} para completar la respuesta"},"save_edit":"Guardar Edici\u00f3n","reply_original":"Responder en el Tema Original","reply_here":"Responder Aqu\u00ed","reply":"Responder","cancel":"Cancelar","create_topic":"Crear Tema","create_pm":"Crear Mensaje Privado","users_placeholder":"Agregar usuario","title_placeholder":"Escribe tu t\u00edtulo aqu\u00ed. Sobre qu\u00e9 trata esta discusi\u00f3n en unas pocas palabras.","reply_placeholder":"Escribe tu respuesta aqu\u00ed. Usa Markdown o BBCode para dar formato. Arrastra o pega una imagen aqu\u00ed para subirla.","view_new_post":"Ver tu nueva publicaci\u00f3n.","saving":"Guardando...","saved":"\u00a1Guardado!","saved_draft":"Tienes en progreso un borrador de una publicaci\u00f3n. Has click en cualquier parte de este recuadro para reanudar la edici\u00f3n.","uploading":"Subiendo...","show_preview":"mostrar vista previa &raquo;","hide_preview":"&laquo; ocultar vista previa","bold_title":"Strong","bold_text":"strong text","italic_title":"Emphasis","italic_text":"emphasized text","link_title":"Hyperlink","link_description":"enter link description here","link_dialog_title":"Insert Hyperlink","link_optional_text":"optional title","quote_title":"Blockquote","quote_text":"Blockquote","code_title":"Code Sample","code_text":"enter code here","image_title":"Image","image_description":"enter image description here","image_dialog_title":"Insert Image","image_optional_text":"optional title","image_hosting_hint":"Need <a href='http://www.google.com/search?q=free+image+hosting' target='_blank'>free image hosting?</a>","olist_title":"Numbered List","ulist_title":"Bulleted List","list_item":"List item","heading_title":"Heading","heading_text":"Heading","hr_title":"Horizontal Rule","undo_title":"Undo","redo_title":"Redo","help":"Markdown Editing Help"},"notifications":{"title":"notificaciones por menciones de tu @nombre, respuestas a tus publicaciones y temas, mensajes privados, etc","none":"No tienes notificaciones por el momento.","more":"ver antiguas notificaciones","mentioned":"<span title='mencionado' class='icon'>@</span> {{username}} {{link}}","quoted":"<i title='citado' class='icon icon-quote-right'></i> {{username}} {{link}}","replied":"<i title='replicado' class='icon icon-reply'></i> {{username}} {{link}}","posted":"<i title='replicado' class='icon icon-reply'></i> {{username}} {{link}}","edited":"<i title='editado' class='icon icon-pencil'></i> {{username}} {{link}}","liked":"<i title='gustaron' class='icon icon-heart'></i> {{username}} {{link}}","private_message":"<i class='icon icon-envelope-alt' title='mensaje privado'></i> {{username}} te envi\u00f3 un mensaje privado: {{link}}","invited_to_private_message":"{{username}} te invit\u00f3 a una conversaci\u00f3n privada: {{link}}","invitee_accepted":"<i title='acept\u00f3 tu invitaci\u00f3n' class='icon icon-signin'></i> {{username}} acept\u00f3 tu invitaci\u00f3n","moved_post":"<i title='publicaci\u00f3n trasladada' class='icon icon-arrow-right'></i> {{username}} traslad\u00f3 la publicaci\u00f3n a {{link}}"},"image_selector":{"title":"Insertar Imagen","from_my_computer":"Desde M\u00ed Dispositivo","from_the_web":"Desde La Web","add_image":"Agregar Imagen","remote_tip":"ingrese una direcci\u00f3n de una imagen en la siguiente forma http://ejemplo.com/imagen.jpg","local_tip":"click para seleccionar la imagen desde su dispositivo.","upload":"Subir","uploading_image":"Subiendo imagen"},"search":{"title":"buscar por temas, publicaciones, usuarios o categor\u00edas","placeholder":"escriba su b\u00fasqueda aqu\u00ed","no_results":"No se encontraron resultados.","searching":"Buscando ...","prefer":{"user":"la b\u00fasqueda preferir\u00e1 resultados por @{{username}}","category":"la b\u00fasqueda preferir\u00e1 resultados en {{category}}"}},"site_map":"ir a otra lista de temas o categor\u00eda","go_back":"volver","current_user":"ir a tu p\u00e1gina de usuario","favorite":{"title":"Favoritos","help":"agregar este tema a tu lista de favoritos"},"topics":{"none":{"favorited":"Todav\u00eda no has marcado ning\u00fan tema como favorito. Para marcar uno como favorito, has click o toca con el dedo la estrella que est\u00e1 junto al t\u00edtulo del tema.","unread":"No existen temas que sigas y que ya no hayas le\u00eddo.","new":"No tienes temas nuevos por leer.","read":"Todav\u00eda no has le\u00eddo ning\u00fan tema.","posted":"Todav\u00eda no has publicado en ning\u00fan tema.","latest":"No hay temas populares. Eso es triste.","category":"No hay temas en la categor\u00eda {{category}}."},"bottom":{"latest":"No hay m\u00e1s temas populares para leer.","posted":"No hay m\u00e1s temas publicados para leer.","read":"No hay m\u00e1s temas le\u00eddos.","new":"No hay temas nuevos para leer.","unread":"No hay m\u00e1s temas que no hayas le\u00eddos.","favorited":"No hay m\u00e1s temas favoritos para leer.","category":"No hay m\u00e1s temas en la categor\u00eda {{category}}."}},"topic":{"create_in":"Crear Tema {{categoryName}}","create":"Crear Tema","create_long":"Crear un nuevo Tema","private_message":"Comenzar una conversaci\u00f3n privada","list":"Temas","new":"nuevo tema","title":"Tema","loading_more":"Cargando m\u00e1s Temas...","loading":"Cargando tema...","invalid_access":{"title":"Este tema es privado","description":"Lo sentimos, \u00a1no tienes acceso a este tema!"},"server_error":{"title":"El tema fall\u00f3 al intentar ser cargado","description":"Lo sentimos, no pudimos cargar el tema, posiblemente debido a problemas de conexi\u00f3n. Por favor intenta nuevamente. Si el problema persiste, por favor nos lo hace saber."},"not_found":{"title":"Tema no encontrado","description":"Lo sentimos, no pudimos encontrar ese tema. \u00bfTal vez fue removido por un moderador?"},"unread_posts":"tienes {{unread}} viejas publicaciones sin leer en este tema","new_posts":"hay {{new_posts}} nuevas publicaciones en este tema desde la \u00faltima vez que lo le\u00edste","likes":{"one":"este tema le gusta a 1 persona","other":"este tema les gusta a {{count}} personas"},"back_to_list":"Volver a la Lista de Temas","options":"Opciones del Tema","show_links":"show links within this topic","toggle_information":"toggle topic details","read_more_in_category":"Want to read more? Browse other topics in {{catLink}} or {{latestLink}}.","read_more":"Want to read more? {{catLink}} or {{latestLink}}.","browse_all_categories":"Browse all categories","view_latest_topics":"view latest topics","suggest_create_topic":"Why not create a topic?","read_position_reset":"Your read position has been reset.","jump_reply_up":"jump to earlier reply","jump_reply_down":"jump to later reply","progress":{"title":"topic progress","jump_top":"jump to first post","jump_bottom":"jump to last post","total":"total posts","current":"current post"},"notifications":{"title":"","reasons":{"3_2":"Recibir\u00e1s notificaciones porque est\u00e1s viendo este tema.","3_1":"Recibir\u00e1s notificaciones porque creaste este tema.","3":"Recibir\u00e1s notificaciones porque est\u00e1s viendo este tema.","2_4":"Recibir\u00e1s notificaciones porque has posteado una respuesta en este tema.","2_2":"Recibir\u00e1s notificaciones porque est\u00e1s siguiendo este tema.","2":"Recibir\u00e1s notificaciones porque est\u00e1s siguiendo este tema.","1":"Ser\u00e1s notificado solo si alguien menciona tu @nombre o responde a tu post.","1_2":"Ser\u00e1s notificado solo si alguien menciona tu @nombre o responde a tu post.","0":"Est\u00e1s ignorando todas las notificaciones en este tema.","0_2":"Est\u00e1s ignorando todas las notificaciones en este tema."},"watching":{"title":"Viendo","description":"igual que Siguiendo, adem\u00e1s ser\u00e1s notificado de todos los nuevos posts."},"tracking":{"title":"Siguiendo","description":"ser\u00e1s notificado de los posts sin leer, menciones a tu @nombre y respuestas a tus posts."},"regular":{"title":"Regular","description":"ser\u00e1s notificado solo si alguien menciona tu @nombre o responde a tus posts."},"muted":{"title":"Silenciado","description":"no ser\u00e1s notificado de nada en este tema, y no aparecer\u00e1 en tu pesta\u00f1a de no leidos."}},"actions":{"delete":"Delete Topic","open":"Open Topic","close":"Close Topic","unpin":"Un-Pin Topic","pin":"Pin Topic","unarchive":"Unarchive Topic","archive":"Archive Topic","invisible":"Make Invisible","visible":"Make Visible","reset_read":"Reset Read Data","multi_select":"Select for Merge/Split","convert_to_topic":"Convert to Regular Topic"},"reply":{"title":"Responder","help":"comienza a escribir una respuesta a este tema"},"clear_pin":{"title":"Eliminar pin","help":"Elimina el estado 'pinned' de este tema de manera que no aparezca m\u00e1s en lo alto de tu lista de temas"},"share":{"title":"Compartir","help":"comparte un link a este tema"},"inviting":"Invitando...","invite_private":{"title":"Invite to Private Message","email_or_username":"Invitee's Email or Username","email_or_username_placeholder":"email address or username","action":"Invite","success":"Thanks! We've invited that user to participate in this private message.","error":"Sorry there was an error inviting that user."},"invite_reply":{"title":"Invite Friends to Reply","action":"Email Invite","help":"send invitations to friends so they can reply to this topic with a single click","email":"We'll send your friend a brief email allowing them to reply to this topic by clicking a link.","email_placeholder":"email address","success":"Thanks! We mailed out an invitation to <b>{{email}}</b>. We'll let you know when they redeem your invitation. Check the invitations tab on your user page to keep track of who you've invited.","error":"Sorry we couldn't invite that person. Perhaps they are already a user?"},"login_reply":"Log In to Reply","filters":{"user":"Est\u00e1s viendo solo {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 post","other":"{{count}} posts"},"by_n_users":{"one":"hechos por 1 usuario espec\u00edfico","other":"hechos por {{count}} usuarios espec\u00edficos"},"best_of":"Est\u00e1s viendo el {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"1 mejor post","other":"{{count}} mejores posts"},"of_n_posts":{"one":"de 1 en el tema","other":"de {{count}} en el tema"},"cancel":"Mostrar todos los posts en el tema de nuevo."},"move_selected":{"title":"Move Selected Posts","topic_name":"New Topic Name:","error":"Sorry, there was an error moving those posts.","instructions":{"one":"You are about to create a new topic and populate it with the post you've selected.","other":"You are about to create a new topic and populate it with the <b>{{count}}</b> posts you've selected."}},"multi_select":{"select":"select","selected":"selected ({{count}})","delete":"delete selected","cancel":"cancel selecting","move":"move selected","description":{"one":"You have selected <b>1</b> post.","other":"You have selected <b>{{count}}</b> posts."}}},"post":{"reply":"Replying to {{link}} by {{replyAvatar}} {{username}}","reply_topic":"Reply to {{link}}","quote_reply":"quote reply","edit":"Editing {{link}} by {{replyAvatar}} {{username}}","post_number":"post {{number}}","in_reply_to":"in reply to","reply_as_new_topic":"Reply as new Topic","continue_discussion":"Continuing the discussion from {{postLink}}:","follow_quote":"go to the quoted post","deleted_by_author":"(post removed by author)","has_replies":{"one":"Respuesta","other":"Respuestas"},"errors":{"create":"Lo sentimos, hubo un error al crear tu publicaci\u00f3n. Por favor intenta de nuevo.","edit":"Lo sentimos, hubo un error al editar tu publicaci\u00f3n. Por favor intenta de nuevo.","upload":"Lo sentimos, hubo un error al subir el archivo. Por favor intenta de nuevo."},"abandon":"\u00bfEst\u00e1s seguro que deseas abandonar tu publicaci\u00f3n?","archetypes":{"save":"Grabar Opciones"},"controls":{"reply":"componer una respuesta para esta publicaci\u00f3n","like":"me gusta esta publicaci\u00f3n","edit":"edita esta publicaci\u00f3n","flag":"marca esta publicaci\u00f3n para atenci\u00f3n de los moderadores","delete":"elimina esta publicaci\u00f3n","undelete":"deshace la eliminaci\u00f3n de esta publicaci\u00f3n","share":"comparte un enlace a esta publicaci\u00f3n","bookmark":"marca esta publicaci\u00f3n como favorita en tu p\u00e1gina de usuario","more":"M\u00e1s"},"actions":{"flag":"Flag","clear_flags":{"one":"Clear flag","other":"Clear flags"},"it_too":"{{alsoName}} it too","undo":"Undo {{alsoName}}","by_you_and_others":{"zero":"You {{long_form}}","one":"You and 1 other person {{long_form}}","other":"You and {{count}} other people {{long_form}}"},"by_others":{"one":"1 person {{long_form}}","other":"{{count}} people {{long_form}}"}},"edits":{"one":"1 edit","other":"{{count}} edits","zero":"no edits"},"delete":{"confirm":{"one":"Are you sure you want to delete that post?","other":"Are you sure you want to delete all those posts?"}}},"category":{"none":"(no category)","edit":"edit","edit_long":"Edit Category","view":"View Topics in Category","delete":"Delete Category","create":"Create Category","more_posts":"view all {{posts}}...","name":"Category Name","description":"Description","topic":"category topic","color":"Color","name_placeholder":"Should be short and succinct.","color_placeholder":"Any web color","delete_confirm":"Are you sure you want to delete that category?","list":"List Categories","no_description":"There is no description for this category, edit the topic definition.","change_in_category_topic":"Edit Description"},"flagging":{"title":"Why are you flagging this post?","action":"Flag Post","cant":"Sorry, you can't flag this post at this time.","custom_placeholder":"Why does this post require moderator attention? Let us know specifically what you are concerned about, and provide relevant links where possible.","custom_message":{"at_least":"enter at least {{n}} characters","more":"{{n}} to go...","left":"{{n}} remaining"}},"topic_summary":{"title":"Topic Summary","links_shown":"show all {{totalLinks}} links..."},"topic_statuses":{"locked":{"help":"this topic is closed; it no longer accepts new replies"},"pinned":{"help":"this topic is pinned; it will display at the top of its category"},"archived":{"help":"this topic is archived; it is frozen and cannot be changed"},"invisible":{"help":"this topic is invisible; it will not be displayed in topic lists, and can only be accessed via a direct link"}},"posts":"Publicaciones","posts_long":"{{number}} publicaciones en este tema","original_post":"Publicaci\u00f3n Original","views":"Vistas","replies":"Respuestas","views_long":"este tema ha sido visto {{number}} veces","activity":"Actividad","likes":"Les gusta","top_contributors":"Participantes","category_title":"Categor\u00eda","history":"History","changed_by":"by {{author}}","categories_list":"Lista de Categor\u00edas","filters":{"latest":{"title":"Populares","help":"los temas m\u00e1s recientes m\u00e1s populares"},"favorited":{"title":"Favoritos","help":"temas que marcaste como favoritos"},"read":{"title":"Le\u00eddos","help":"temas que ya has le\u00eddo"},"categories":{"title":"Categor\u00edas","title_in":"Categor\u00eda - {{categoryName}}","help":"todos los temas agrupados por categor\u00eda"},"unread":{"title":{"zero":"No le\u00eddos","one":"No le\u00eddo (1)","other":"No le\u00eddos ({{count}})"},"help":"tracked topics with unread posts"},"new":{"title":{"zero":"Nuevos","one":"Nuevo (1)","other":"Nuevos ({{count}})"},"help":"new topics since your last visit"},"posted":{"title":"My Posts","help":"topics you have posted in"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"latest topics in the {{categoryName}} category"}},"type_to_filter":"type to filter...","admin":{"title":"Discourse Admin","dashboard":{"title":"Dashboard","welcome":"Welcome to the admin section.","version":"Installed version","up_to_date":"You are running the latest version of Discourse.","critical_available":"A critical update is available.","updates_available":"Updates are available.","please_upgrade":"Please upgrade!","latest_version":"Latest version","reports":{"today":"Today","yesterday":"Yesterday","last_7_days":"Last 7 Days","last_30_days":"Last 30 Days","all_time":"All Time","7_days_ago":"7 Days Ago","30_days_ago":"30 Days Ago"}},"flags":{"title":"Flags","old":"Old","active":"Active","clear":"Clear Flags","clear_title":"dismiss all flags on this post (will unhide hidden posts)","delete":"Delete Post","delete_title":"delete post (if its the first post delete topic)","flagged_by":"Flagged by"},"customize":{"title":"Customize","header":"Header","css":"Stylesheet","override_default":"Do not include standard style sheet","enabled":"Enabled?","preview":"preview","undo_preview":"undo preview","save":"Save","delete":"Delete","delete_confirm":"Delete this customization?"},"email":{"title":"Email","sent_at":"Sent At","email_type":"Email Type","to_address":"To Address","test_email_address":"email address to test","send_test":"send test email","sent_test":"sent!"},"impersonate":{"title":"Impersonate User","username_or_email":"Username or Email of User","help":"Use this tool to impersonate a user account for debugging purposes.","not_found":"That user can't be found.","invalid":"Sorry, you may not impersonate that user."},"users":{"title":"Users","create":"Add Admin User","last_emailed":"Last Emailed","not_found":"Sorry that username doesn't exist in our system.","new":"New","active":"Active","pending":"Pending","approved":"Approved?","approved_selected":{"one":"approve user","other":"approve users ({{count}})"}},"user":{"ban_failed":"Something went wrong banning this user {{error}}","unban_failed":"Something went wrong unbanning this user {{error}}","ban_duration":"How long would you like to ban the user for? (days)","delete_all_posts":"Delete all posts","ban":"Ban","unban":"Unban","banned":"Banned?","moderator":"Moderator?","admin":"Admin?","show_admin_profile":"Admin","refresh_browsers":"Force browser refresh","show_public_profile":"Show Public Profile","impersonate":"Impersonate","revoke_admin":"Revoke Admin","grant_admin":"Grant Admin","revoke_moderation":"Revoke Moderation","grant_moderation":"Grant Moderation","reputation":"Reputaci\u00f3n","permissions":"Permisos","activity":"Actividad","like_count":"Me gusta Recibidos","private_topics_count":"Private Topics Count","posts_read_count":"Posts Read","post_count":"Posts Created","topics_entered":"Topics Entered","flags_given_count":"Flags Given","flags_received_count":"Flags Received","approve":"Approve","approved_by":"approved by","time_read":"Read Time"},"site_settings":{"show_overriden":"S\u00f3lo mostrar lo sobreescrito","title":"Ajustes del Sitio","reset":"Reestabler los ajustes por defecto"}}}}};
I18n.locale = 'es';
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
