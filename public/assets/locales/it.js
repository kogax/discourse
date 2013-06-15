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
MessageFormat.locale.it = function ( n ) {
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
    })({});I18n.translations = {"it":{"js":{"share":{"topic":"condividi un link a questo topic","post":"condividi un link a questo post","close":"chiudi","twitter":"condividi link su Twitter","facebook":"condividi link su Facebook","google+":"condividi link su Google+","email":"invia link via email"},"edit":"modifica titolo e categoria di questo topic","not_implemented":"Spiacenti, questa funzione non \u00e8 ancora stata implementata!","no_value":"No","yes_value":"Si","of_value":"di","generic_error":"Spiacenti, si \u00e8 verificato un errore.","log_in":"Log In","age":"Et\u00e0","last_post":"Ultimo post","admin_title":"Amministrazione","flags_title":"Segnalazioni","show_more":"mostra tutto","links":"Link","faq":"FAQ","you":"Tu","or":"o","now":"adesso","read_more":"continua a leggere","in_n_seconds":{"one":"in 1 secondo","other":"in {{count}} secondi"},"in_n_minutes":{"one":"in 1 minuto","other":"in {{count}} minuti"},"in_n_hours":{"one":"in 1 ora","other":"in {{count}} ore"},"in_n_days":{"one":"in 1 giorno","other":"in {{count}} giorni"},"suggested_topics":{"title":"Topic suggeriti"},"bookmarks":{"not_logged_in":"Spiacenti, devi essere loggato per fare il bookmark del post.","created":"Post salvato nei bookmark.","not_bookmarked":"Hai letto questo post; clicca per salvarlo tra i bookmark.","last_read":"Questo \u00e8 l'ultimo post che hai letto."},"new_topics_inserted":"{{count}} nuovi topic.","show_new_topics":"Clicca per mostrare.","preview":"anteprima","cancel":"cancella","save":"Salva Modifiche","saving":"Salvataggio...","saved":"Salvato!","choose_topic":{"none_found":"Nessun topic trovato.","title":{"search":"Cerca un Topic:","placeholder":"scrivi qui il titolo del topic"}},"user_action":{"user_posted_topic":"<a href='{{userUrl}}'>{{user}}</a> ha pubblicato <a href='{{topicUrl}}'>il topic</a>","you_posted_topic":"<a href='{{userUrl}}'>Tu</a> hai pubblicato <a href='{{topicUrl}}'>il topic</a>","user_replied_to_post":"<a href='{{userUrl}}'>{{user}}</a> ha risposto a <a href='{{postUrl}}'>{{post_number}}</a>","you_replied_to_post":"<a href='{{userUrl}}'>Tu</a> hai risposto a <a href='{{postUrl}}'>{{post_number}}</a>","user_replied_to_topic":"<a href='{{userUrl}}'>{{user}}</a> ha risposto <a href='{{topicUrl}}'>al topic</a>","you_replied_to_topic":"<a href='{{userUrl}}'>Tu</a> hai risposto <a href='{{topicUrl}}'>al topic</a>","user_mentioned_user":"<a href='{{user1Url}}'>{{user}}</a> ha menzionato <a href='{{user2Url}}'>{{another_user}}</a>","user_mentioned_you":"<a href='{{user1Url}}'>{{user}}</a> ha menzionato <a href='{{user2Url}}'>te</a>","you_mentioned_user":"<a href='{{user1Url}}'>Tu</a> hai menzionato <a href='{{user2Url}}'>{{user}}</a>","posted_by_user":"Pubblicato da <a href='{{userUrl}}'>{{user}}</a>","posted_by_you":"Pubblicato da <a href='{{userUrl}}'>te</a>","sent_by_user":"Inviato da <a href='{{userUrl}}'>{{user}}</a>","sent_by_you":"Inviato da <a href='{{userUrl}}'>te</a>"},"user_action_groups":{"1":"Like","2":"Like ricevuti","3":"Bookmark","4":"Topic","5":"Risposte","6":"Risposte","7":"Menzioni","9":"Citazioni","10":"Preferiti","11":"Modifiche","12":"Oggetti inviati","13":"Inbox"},"user":{"profile":"Profilo","title":"Utente","mute":"Ignora","edit":"Modifica Preferenze","download_archive":"scarica archivio dei miei post","private_message":"Messaggio Privato","private_messages":"Messaggi","activity_stream":"Attivit\u00e0","preferences":"Preferenze","bio":"Su di me","invited_by":"Invitato Da","trust_level":"Trust Level","external_links_in_new_tab":"Apri tutti i link esterni in una nuova tab","enable_quoting":"Abilita risposta con citazione su testo selezionato","moderator":"{{user}} \u00e8 un moderatore","admin":"{{user}} \u00e8 un amministratore","change_password":{"action":"cambia","success":"(email inviata)","in_progress":"(invio email)","error":"(errore)"},"change_username":{"action":"cambia","title":"Cambia Username","confirm":"Possono esserci consequenze modificando il tuo username. Sei veramente sicuro di volerlo fare?","taken":"Spiacenti, questo username \u00e8 gi\u00e0 utilizzato.","error":"Si \u00e8 verificato un errore modificando il tuo username.","invalid":"Questo username non \u00e8 valido. Deve contenere solo lettere e numeri."},"change_email":{"action":"cambia","title":"Cambia Email","taken":"Spiacenti, questa email non \u00e8 disponibile.","error":"Si \u00e8 verificato un errore modificando la tua email. Forse l'indirizzo \u00e8 gi\u00e0 utilizzato?","success":"Abbiamo inviato una email a questo indirizzo. Segui le istruzioni per confermare la modifica."},"email":{"title":"Email","instructions":"La tua email non verr\u00e0 mai mostrata in pubblico.","ok":"Sembra buona. Ti invieremo una email per confermare.","invalid":"Per favore inserisci un indirizzo email valido.","authenticated":"La tua email \u00e8 stata autenticata da {{provider}}.","frequency":"Ti invieremo una email solo se non ti abbiamo visto di recente e non hai letto ci\u00f2 che ti abbiamo inviato per email."},"name":{"title":"Nome","instructions":"La versione estesa del tuo nome, non deve necessariamente essere unica. Viene usata per agevolare la ricerca tramite menzione @name e mostrata solo nel tuo profilo.","too_short":"Il tuo nome \u00e8 troppo breve.","ok":"Il tuo nome sembra valido."},"username":{"title":"Username","instructions":"Deve essere unico, niente spazi. Gli altri utenti possono menzionarti con @username.","short_instructions":"Gli altri utenti possono menzionarti con @{{username}}.","available":"Il tuo username \u00e8 disponibile.","global_match":"L'email corrisponde allo username registrato.","global_mismatch":"Gi\u00e0 registrato. Prova {{suggestion}}?","not_available":"Non disponibile. Prova {{suggestion}}?","too_short":"Il tuo username \u00e8 troppo corto.","too_long":"Il tuo username \u00e8 troppo lungo.","checking":"Controllo disponibilit\u00e0 username...","enter_email":"Username trovato. Inserisci l'email corrispondente"},"password_confirmation":{"title":"Conferma Password"},"last_posted":"Ultimo Post","last_emailed":"Ultimo via Email","last_seen":"Ultima Visita","created":"Creato il","log_out":"Log Out","website":"Sito web","email_settings":"Email","email_digests":{"title":"Quando non visito il sito, mandami una email riassuntiva degli ultimi aggiornamenti","daily":"quotidiana","weekly":"settimanale","bi_weekly":"ogni due settimane"},"email_direct":"Ricevi un'email quando qualcuno ti cita, risponde ad un tuo post oppure menziona il tuo @username","email_private_messages":"Ricevi un'email quando qualcuno ti invia un messaggio privato","other_settings":"Altro","new_topic_duration":{"label":"Considera i topic come nuovi quando","not_viewed":"Non li ho ancora letti","last_here":"sono stati creati dopo la mia ultima visita","after_n_days":{"one":"sono stati postati nell'ultimo giorno","other":"sono stati postati negli ultimi {{count}} giorni"},"after_n_weeks":{"one":"sono stati postati nell'ultima settimana","other":"sono stati postati nelle ultime {{count}} settimane"}},"auto_track_topics":"Traccia automaticamente i topic in cui entro","auto_track_options":{"never":"mai","always":"sempre","after_n_seconds":{"one":"dopo 1 secondo","other":"dopo {{count}} secondi"},"after_n_minutes":{"one":"dopo 1 minuto","other":"dopo {{count}} minuti"}},"invited":{"title":"Inviti","user":"Utenti Invitati","none":"{{username}} non ha invitato alcun utente al sito.","redeemed":"Inviti riscattati","redeemed_at":"Riscattato il","pending":"Inviti in corso","topics_entered":"Topic Visti","posts_read_count":"Post Letti","rescind":"Rimuovi Invito","rescinded":"Invito rimosso","time_read":"Tempo di Lettura","days_visited":"Giornate di visita","account_age_days":"Et\u00e0 account in giorni"},"password":{"title":"Password","too_short":"La tua password \u00e8 troppo corta.","ok":"La tua password sembra ok."},"ip_address":{"title":"Ultimo indirizzo IP"},"avatar":{"title":"Avatar","instructions":"Usiamo <a href='https://gravatar.com' target='_blank'>Gravatar</a> per gli avatar basandoci sulla tua email"},"filters":{"all":"Tutti"},"stream":{"posted_by":"Pubblicato da da","sent_by":"Inviato da","private_message":"messaggio privato","the_topic":"il topic"}},"loading":"Caricamento...","close":"Chiudi","learn_more":"di pi\u00f9...","year":"anno","year_desc":"topic postati negli ultimi 365 giorni","month":"month","month_desc":"topic postati negli ultimi 30 giorni","week":"week","week_desc":"topic postati negli ultimi 7 giorni","first_post":"Primo post","mute":"Ignora","unmute":"Annulla ignora","best_of":{"title":"Best Of","enabled_description":"Stai guardando il \"Best Of\" di questo topic.","description":"Ci sono <b>{{count}}</b> post in questo topic. Sono tanti! Vuoi risparmiare tempo leggendo solo i post con pi\u00f9 interazioni e risposte?","enable":"Passa a \"Best Of\"","disable":"Annulla \"Best Of\""},"private_message_info":{"title":"Conversazione Privata","invite":"Invita altri utenti..."},"email":"Email","username":"Username","last_seen":"Ultima visita","created":"Registrato","trust_level":"Trust Level","create_account":{"title":"Crea Account","action":"Creane uno adesso!","invite":"Non hai ancora un account?","failed":"Qualcosa \u00e8 andato storto, forse questa email \u00e8 gi\u00e0 registrata, prova il link Password Dimenticata"},"forgot_password":{"title":"Password Dimenticata","action":"Ho dimenticato la mia password","invite":"Inserisci il tuo username ed il tuo indirizzo email, ti invieremo le istruzioni per resettare la tua password.","reset":"Password Reset","complete":"A breve dovresti ricevere un'email con le istruzioni per resettare la tua password."},"login":{"title":"Log In","username":"Login","password":"Password","email_placeholder":"indirizzo email o username","error":"Errore sconosciuto","reset_password":"Resetta Password","logging_in":"Login in corso...","or":"O","authenticating":"Autenticazione in corso...","awaiting_confirmation":"Il tuo account \u00e8 in attesa di attivazione, usa il link Password Dimenticata per ricevere una nuova mail di attivazione.","awaiting_approval":"Il tuo account non \u00e8 ancora stato approvato da un moderatore. Riceverai un'email non appena verr\u00e0 approvato.","not_activated":"Non puoi ancora effettuare il log in. Ti abbiamo mandato un'email con il link di attivazione all'indirizzo <b>{{sentTo}}</b>. Per favore segui le istruzioni in quell'email per attivare il tuo account.","resend_activation_email":"Clicca qui per ricevere nuovamente la mail di attivazione.","sent_activation_email_again":"Ti abbiamo mandato un altro link di attivazione all'indirizzo<b>{{currentEmail}}</b>. Potrebbe volerci qualche minuto prima che arrivi; controlla anche fra lo spam.","google":{"title":"con Google","message":"Autenticazione con Google (l'apertura di pop up deve essere permessa dal browser)"},"twitter":{"title":"con Twitter","message":"Autenticazione con Twitter (l'apertura di pop up deve essere permessa dal browser)"},"facebook":{"title":"con Facebook","message":"Autenticazione con Facebook (l'apertura di pop up deve essere permessa dal browser)"},"yahoo":{"title":"con Yahoo","message":"Autenticazione con Yahoo (l'apertura di pop up deve essere permessa dal browser)"},"github":{"title":"con GitHub","message":"Autenticazione con GitHub (l'apertura di pop up deve essere permessa dal browser)"},"persona":{"title":"con Persona","message":"Autenticazione con Mozilla Persona (l'apertura di pop up deve essere permessa dal browser)"}},"composer":{"posting_not_on_topic":"Stai rispondendo al topic \"{{title}}\", ma al momento stai visualizzando un topic diverso.","saving_draft_tip":"salvataggio","saved_draft_tip":"salvato","saved_local_draft_tip":"salvato in locale","similar_topics":"Il tuo topic \u00e8 simile a...","drafts_offline":"bozze offline","min_length":{"need_more_for_title":"ancora {{n}} caratteri per il titolo","need_more_for_reply":"ancora {{n}} caratteri per il post"},"save_edit":"Salva Modifica","reply_original":"Rispondi al topic originale","reply_here":"Rispondi Qui","reply":"Rispondi","cancel":"Cancella","create_topic":"Crea Topic","create_pm":"Crea Messaggio Privato","users_placeholder":"Aggiungi Utente","title_placeholder":"Scrivi il titolo qui. Qual \u00e8 l'argomento di discussione (si breve)?","reply_placeholder":"Scrivi la tua risposta qui. Usa Markdown o BBCode per formattare. Trascina o incolla un'immagine qui per caricarla.","view_new_post":"Guarda il tuo nuovo post.","saving":"Salvataggio...","saved":"Salvato!","saved_draft":"Hai una bozza di un post in corso. Clicca questo box per riprendere la scrittura.","uploading":"Uploading...","show_preview":"mostra anteprima &raquo;","hide_preview":"&laquo; nascondi anteprima","quote_post_title":"Cita l'intero post","bold_title":"Grassetto","bold_text":"testo grassetto","italic_title":"Corsivo","italic_text":"testo in corsivo","link_title":"Hyperlink","link_description":"descrizione del link","link_dialog_title":"Inserisci Link","link_optional_text":"titolo facoltativo","quote_title":"Blockquote","quote_text":"Blockquote","code_title":"Esempio di codice","code_text":"inserisci il codice qui","image_title":"Immagine","image_description":"descrizione dell'immagine","image_dialog_title":"Inserisci Immagine","image_optional_text":"titolo facoltativo","image_hosting_hint":"Hai bisogno di <a href='http://www.google.com/search?q=free+image+hosting' target='_blank'>free image hosting?</a>","olist_title":"Lista Numerata","ulist_title":"Lista non Numerata","list_item":"Elemento della lista","heading_title":"Intestazione","heading_text":"Intestazione","hr_title":"Riga Orizzontale","undo_title":"Annulla","redo_title":"Ripeti","help":"Aiuto Markdown","toggler":"nascondi o mostra il pannello di composizione","admin_options_title":"Impostazioni opzionali per lo staff","auto_close_label":"Chiusura automatica topic dopo:","auto_close_units":"giorni"},"notifications":{"title":"notifiche di menzioni @name, risposte ai tuoi post e topic, messaggi privati, etc","none":"Non hai notifiche in questo momento.","more":"guarda notifiche pi\u00f9 vecchie","mentioned":"<span title='menzionato' class='icon'>@</span> {{username}} {{link}}","quoted":"<i title='citato' class='icon icon-quote-right'></i> {{username}} {{link}}","replied":"<i title='risposto' class='icon icon-reply'></i> {{username}} {{link}}","posted":"<i title='risposto' class='icon icon-reply'></i> {{username}} {{link}}","edited":"<i title='modificato' class='icon icon-pencil'></i> {{username}} {{link}}","liked":"<i title='liked' class='icon icon-heart'></i> {{username}} {{link}}","private_message":"<i class='icon icon-envelope-alt' title='messaggio privato'></i> {{username}} ti ha mandato un messaggio privato: {{link}}","invited_to_private_message":"{{username}} ti ha invitato ad una conversazione privata: {{link}}","invitee_accepted":"<i title='ha accettato il tuo invito' class='icon icon-signin'></i> {{username}} ha accettato il tuo invito","moved_post":"<i title='post spostato' class='icon icon-arrow-right'></i> {{username}} ha spostato il post qui {{link}}","total_flagged":"totale post segnalati"},"image_selector":{"title":"Inserisci Immagine","from_my_computer":"Dal mio dispositivo","from_the_web":"Dal Web","add_image":"Aggiungi Immagine","remote_title":"immagine remota","remote_tip":"inserisci l'indirizzo dell'immagine (es. http://example.com/image.jpg)","local_title":"immagine locale","local_tip":"clicca per selezionare un'immagine dal tuo dispositivo.","upload":"Upload","uploading_image":"Carico l'immagine"},"search":{"title":"cerca topic, post, utenti o categorie","placeholder":"scrivi i termini di ricerca","no_results":"Nessun risultato.","searching":"Cerco ..."},"site_map":"vai in un'altra lista topic o categoria","go_back":"torna indietro","current_user":"vai alla tua pagina utente","favorite":{"title":"Preferito","help":{"star":"aggiungi questo topic nella tua lista dei preferiti","unstar":"rimuovi questo topic dalla tua lista dei preferiti"}},"topics":{"none":{"favorited":"Non hai alcun topic preferito. Per rendere un topic preferito, clicca la stella di fianco al titolo.","unread":"Non hai alcun topic non letto da leggere.","new":"Non hai nuovi topic da leggere.","read":"Non hai ancora letto alcun topic.","posted":"Non hai ancora postato in nessun topic.","latest":"Non ci sono post popolari. \u00c8 molto triste.","hot":"Non ci sono topic caldi.","category":"Non ci sono topic nella categoria {{category}}."},"bottom":{"latest":"Non ci sono altri topic da leggere.","hot":"Non ci sono altri topic caldi da leggere.","posted":"Non ci sono altri post da leggere.","read":"Non ci sono altri topic da leggere.","new":"Non ci sono altri nuovi topic da leggere.","unread":"Non ci sono altri topic non letti da leggere.","favorited":"Non ci sono altri topic preferiti da leggere.","category":"Non ci sono altri topic nella categoria {{category}} da leggere."}},"rank_details":{"toggle":"attica dettaglio classifica topic","show":"mostra dettaglio classifica topic","title":"Dettaglio Classifica Topic"},"topic":{"create_in":"Crea Topic in {{categoryName}}","create":"Crea Topic","create_long":"Crea un nuovo Topic","private_message":"Inizia una conversazione privata","list":"Topic","new":"nuovo topic","title":"Topic","loading_more":"Carico altri Topic...","loading":"Carico topic...","invalid_access":{"title":"Il Topic \u00e8 privato","description":"Spiacenti, non hai accesso a quel topic!"},"server_error":{"title":"Caricamento Topic fallito","description":"Spiacenti, non \u00e8 stato possibile caricare il topic, probabilmente per un problema di connessione. Per favore prova ancora. Facci sapere se il problema persiste."},"not_found":{"title":"Topic non trovato","description":"Spiacenti, il topic non \u00e8 stato trovato. Forse \u00e8 stato eliminato da un moderatore?"},"unread_posts":"hai {{unread}} vecchi post non letti in questo topic","new_posts":"ci sono {{new_posts}} nuovi post in questo topic dalla tua ultima visita","likes":{"one":"c'\u00e8 1 like in questo topic","other":"ci sono {{count}} like in questo topic"},"back_to_list":"Torna all'Elenco dei Topic","options":"Opzioni Topic","show_links":"mostra i link in questo topic","toggle_information":"informazioni sul topic","read_more_in_category":"Vuoi leggere di pi\u00f9? Guarda altri topic nella categoria {{catLink}} o {{latestLink}}.","read_more":"Vuoi leggere di pi\u00f9? {{catLink}} o {{latestLink}}.","browse_all_categories":"Guarda tutte le categorie","view_latest_topics":"guarda gli ultimi topic","suggest_create_topic":"Perch\u00e9 non creare un topic?","read_position_reset":"La tua posizione di lettura \u00e8 stata reimpostata.","jump_reply_up":"vai alla risposta precedente","jump_reply_down":"vai alla risposta successiva","deleted":"Il Topic \u00e8 stato eliminato","auto_close_notice":"Questo topic verr\u00e0 automaticamente chiuso in %{timeLeft}.","auto_close_title":"Impostazioni Auto-Chiusura","auto_close_save":"Salva","auto_close_cancel":"Cancella","auto_close_remove":"Non Auto-Chiudere questo Topic","progress":{"title":"topic progress","jump_top":"vai al primo post","jump_bottom":"vai all'ultimo post","total":"totale post","current":"post corrente"},"notifications":{"title":"","reasons":{"3_2":"Riceverai notifiche perch\u00e9 sei iscritto a questo topic.","3_1":"Riceverai notifiche perch\u00e9 hai creato questo topic.","3":"Riceverai notifiche perch\u00e9 sei iscritto a questo topic.","2_4":"Riceverai notifiche perch\u00e9 hai risposto a questo topic.","2_2":"Riceverai notifiche perch\u00e9 stai tracciando questo topic.","2":"Riceverai notifiche perch\u00e9 <a href=\"/users/{{username}}/preferences\">hai letto questo topic</a>.","1":"Verrai notificato solo se qualcuno menziona il tuo @nome o risponde ad un tuo post.","1_2":"Verrai notificato solo se qualcuno menziona il tuo @nome o risponde ad un tuo post.","0":"Stai ignorando tutte le notifiche a questo topic.","0_2":"Stai ignorando tutte le notifiche a questo topic."},"watching":{"title":"Iscritto","description":"come il Tracking, ma verrai anche notificato ad ogni nuova risposta."},"tracking":{"title":"Tracking","description":"verrai notificato dei post non letti, delle menzioni @nome, risposte ai tuoi post."},"regular":{"title":"Normale","description":"verrai notificato solo se qualcuno menziona il tuo @nome o risponde ad un tuo post."},"muted":{"title":"Ignora","description":"non riceverai nessuna notifica su questo topic e non apparir\u00e0 nel tuo tab non letti."}},"actions":{"delete":"Elimina Topic","open":"Apri Topic","close":"Chiudi Topic","auto_close":"Auto Chiusura","unpin":"Un-Pin Topic","pin":"Pin Topic","unarchive":"Togli dall'archivio il Topic","archive":"Archivia Topic","invisible":"Rendi Invisibile","visible":"Rendi Visibile","reset_read":"Reset Read Data","multi_select":"Unisci/Dividi Post","convert_to_topic":"Converti in un Topic Normale"},"reply":{"title":"Rispondi","help":"scrivi una risposta a questo topic"},"clear_pin":{"title":"Cancella pin","help":"Il topic non sar\u00e0 pi\u00f9 pinnato e non apparir\u00e0 in cima alla lista dei topic"},"share":{"title":"Condividi","help":"condividi questo topic"},"inviting":"Sto invitando...","invite_private":{"title":"Invita a Conversazione Privata","email_or_username":"L'Email o l'Username dell'invitato","email_or_username_placeholder":"indirizzo email o username","action":"Invita","success":"Grazie! Abbiamo invitato quell'utente a partecipare in questa conversazione privata.","error":"Spiacenti, si \u00e8 verificato un errore nell'invitare l'utente."},"invite_reply":{"title":"Invita gli amici a partecipare","action":"Invito Email","help":"spedisci un invito agli amici in modo che possano partecipare a questo topic","email":"Manderemo ai tuoi amici una breve mail dove potranno rispondere a questo topic cliccando su un semplice link.","email_placeholder":"indirizzo email","success":"Grazie! Abbiamo mandato un invito a <b>{{email}}</b>. Ti faremo sapere quando accetteranno l'invito. Controlla il tab inviti nella tua pagina utente per tenere traccia di chi hai invitato.","error":"Spiacenti, non abbiamo potuto invitare quella persona. Forse \u00e8 gi\u00e0 un utente iscritto?"},"login_reply":"Log In per Rispondere","filters":{"user":"Stai vedendo solo {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 post","other":"{{count}} post"},"by_n_users":{"one":"da 1 utente specifico","other":"da {{count}} utenti specifici"},"best_of":"Stai vedendo i {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"1 best post","other":"{{count}} best post"},"of_n_posts":{"one":"di 1 nel topic","other":"di {{count}} nel topic"},"cancel":"Mostra nuovamente tutti i post di questo topic."},"split_topic":{"title":"Dividi Topic","action":"dividi topic","topic_name":"Nuovo nome topic:","error":"Si \u00e8 verificato un errore nella divisione del topic","instructions":{"one":"Stai per creare un nuovo topic per popolarlo con i post che hai selezionato","other":"Stai per creare un nuovo topic per popolarlo con i <b>{{count}}</b> post che hai selezionato"}},"merge_topic":{"title":"Unisci Topic","action":"unisci topic","error":"Si \u00e8 verificato un errore unendo questo topic.","instructions":{"one":"Seleziona il topic in cui desideri spostare questo post.","other":"Seleziona il topic in cui desideri spostare questi <b>{{count}}</b> post."}},"multi_select":{"select":"seleziona","selected":"selezionati ({{count}})","delete":"elimina selezionati","cancel":"annulla selezione","description":{"one":"Hai selezionato <b>1</b> post.","other":"Hai selezionato <b>{{count}}</b> post."}}},"post":{"reply":"Rispondendo a {{link}} di {{replyAvatar}} {{username}}","reply_topic":"Rispondi a {{link}}","quote_reply":"cita risposta","edit":"Modificando {{link}} di {{replyAvatar}} {{username}}","post_number":"post {{number}}","in_reply_to":"in risposta a","reply_as_new_topic":"Rispondi come Nuovo Topic","continue_discussion":"La discussione continua da {{postLink}}:","follow_quote":"vai al post quotato","deleted_by_author":"(post eliminato dall'autore)","expand_collapse":"espandi/chiudi","has_replies":{"one":"Risposta","other":"Risposte"},"errors":{"create":"Spiacenti, si \u00e8 verificato un errore durante la creazione del tuo post. Per favore, prova di nuovo.","edit":"Spiacenti, si \u00e8 verificato un errore durante la modifica del tuo post. Per favore, prova di nuovo.","upload":"Spiacenti, si \u00e8 verificato un errore durante il caricamento del file. Per favore, prova di nuovo.","upload_too_large":"Spiacenti, il file che stai cercando di caricare \u00e8 troppo grande (la dimensione massima \u00e8 {{max_size_kb}}kb), per favore ridimensionalo e prova di nuovo.","upload_too_many_images":"Spiacenti, puoi caricare un'immagine per volta.","only_images_are_supported":"Spiacenti, puoi caricare solo immagini."},"abandon":"Sei sicuro di voler abbandonare il tuo post?","archetypes":{"save":"Opzioni di Salvataggio"},"controls":{"reply":"inizia a scrivere una risposta a questo post","like":"like","edit":"modifica post","flag":"segnala questo post all'attezione dei moderatori","delete":"elimina post","undelete":"annulla eliminazione post","share":"condividi questo post","bookmark":"aggiungilo ai tuoi segnalibri","more":"Di pi\u00f9"},"actions":{"flag":"Segnala","clear_flags":{"one":"Annulla segnalazione","other":"Annulla segnalazioni"},"it_too":{"off_topic":"Segnala anche","spam":"Segnala anche","inappropriate":"Segnala anche","custom_flag":"Segnala anche","bookmark":"Anche nei segnalibri","like":"Like anche","vote":"Vota anche"},"undo":{"off_topic":"Annulla segnalazione","spam":"Annulla segnalazione","inappropriate":"Annulla segnalazione","bookmark":"Annulla segnalibro","like":"Annulla like","vote":"Annulla voto"},"people":{"off_topic":"{{icons}} segnato questo come off-topic","spam":"{{icons}} segnato questo come spam","inappropriate":"{{icons}} segnato questo come inappropriato","notify_moderators":"{{icons}} moderatori notificati","notify_moderators_with_url":"{{icons}} <a href='{{postUrl}}'>moderatori notificati</a>","notify_user":"{{icons}} ha inviato un messaggio privato","notify_user_with_url":"{{icons}} ha inviato un <a href='{{postUrl}}'>messaggio privato</a>","bookmark":"{{icons}} inserito nei segnalibri","like":"{{icons}} piaciuto","vote":"{{icons}} votato"},"by_you":{"off_topic":"Hai segnalato questo come off-topic","spam":"Hai segnalato questo come spam","inappropriate":"Hai segnalato questo come inappropriato","notify_moderators":"Hai segnalato questo all'attenzione di moderazione","notify_user":"Hai inviato un messaggio privato a questo utente","bookmark":"Hai inserito questo post nei segnalibri","like":"Hai messo Like","vote":"Hai votato per questo post"},"by_you_and_others":{"off_topic":{"one":"Tu e un altro lo avete segnalato come off-topic","other":"Tu e altre {{count}} persone lo avete segnalato come off-topic"},"spam":{"one":"Tu e un altro lo avete segnalato come spam","other":"Tu e altre {{count}} persone lo avete segnalato come spam"},"inappropriate":{"one":"Tu e un altro lo avete segnalato come inappropriato","other":"Tu e altre {{count}} persone lo avete segnalato come inappropriato"},"notify_moderators":{"one":"Tu e un altro lo avete segnalato alla moderazione","other":"Tu e altre {{count}} persone lo avete segnalato alla moderazione"},"notify_user":{"one":"Tu e un altro avete inviato un messaggio privato a questo utente","other":"Tu e altre {{count}} persone avete inviato un messaggio privato a questo utente"},"bookmark":{"one":"Tu e un altro avete messo nei segnalibri questo post","other":"Tu e altre {{count}} persone avete messo nei segnalibri questo post"},"like":{"one":"A te e un altro piace questo","other":"A te e ad altre {{count}} persone piace questo"},"vote":{"one":"Tu e un altro avete votato per questo post","other":"Tu e altre {{count}} persone avete votato per questo post"}},"by_others":{"off_topic":{"one":"1 persona lo ha segnalato come off-topic","other":"{{count}} persone hanno segnalato questo come off-topic"},"spam":{"one":"1 persona lo ha segnalato come spam","other":"{{count}} persone hanno segnalato questo come spam"},"inappropriate":{"one":"1 persona lo ha segnalato come inappropriato","other":"{{count}} persone hanno segnalato questo come inappropriato"},"notify_moderators":{"one":"1 persona lo ha segnalato per la moderazione","other":"{{count}} persone hanno segnalato questo per la moderazione"},"notify_user":{"one":"1 persona ha inviato un messaggio privato a questo utente","other":"{{count}} persone hanno inviato un messaggio privato a questo utente"},"bookmark":{"one":"1 persona ha messo nei segnalibri questo post","other":"{{count}} persone hanno messo nei segnalibri questo post"},"like":{"one":"Ad 1 persona \u00e8 piaciuto questo","other":"A {{count}} persone \u00e8 piaciuto questo"},"vote":{"one":"1 persona ha votato questo post","other":"{{count}} persone hanno votato questo post"}}},"edits":{"one":"1 modifica","other":"{{count}} modifiche","zero":"nessuna modifica"},"delete":{"confirm":{"one":"Sei sicuro di voler eliminare quel post?","other":"Sei sicuro di voler eliminare tutti quei post?"}}},"category":{"none":"(nessuna categoria)","edit":"modifica","edit_long":"Modifica Categoria","edit_uncategorized":"Modifica Non categorizzata","view":"Mostra Topic nella Categoria","general":"Generale","settings":"Impostazioni","delete":"Elimina Categoria","create":"Crea Categoria","save":"Salva Categoria","creation_error":"Si \u00e8 verificato un errore durante la creazione della categoria.","save_error":"Si \u00e8 verificato un errore durante il salvataggio della categoria..","more_posts":"guarda tutti i {{posts}} post...","name":"Nome Categoria","description":"Descrizione","topic":"topic categoria","badge_colors":"colori Badge","background_color":"colore Sfondo","foreground_color":"colore Testo","name_placeholder":"Breve e Succinto.","color_placeholder":"Qualsiasi colore web","delete_confirm":"Sei sicuro di voler eliminare quella categoria?","delete_error":"Si \u00e8 verificato un errore durante la cancellazione della categoria.","list":"Lista Categorie","no_description":"Nessuna descrizione per questa categoria.","change_in_category_topic":"Modifica Descrizione","hotness":"Hotness","already_used":"Questo colore \u00e8 gi\u00e0 in uso da un'altra categoria","is_secure":"Categoria protetta?","add_group":"Aggiungi Gruppo","security":"Protezione","allowed_groups":"Gruppi Ammessi:","auto_close_label":"Auto-chiusura topic dopo:"},"flagging":{"title":"Perch\u00e9 stai segnalando questo post?","action":"Segnala Post","notify_action":"Notifica","cant":"Spiacenti, non puoi segnalare questo post al momento.","custom_placeholder_notify_user":"Perch\u00e9 vuoi contattare privatamente o direttamente questo utente? Si specifico, costruttivo e cortese.","custom_placeholder_notify_moderators":"Perch\u00e9 questo post richiede l'attenzione di un moderatore? Facci sapere nello specifico cosa non va e fornisci opportuni link se possibile.","custom_message":{"at_least":"inserisci almeno {{n}} caratteri","more":"ancora {{n}}...","left":"{{n}} rimanenti"}},"topic_summary":{"title":"Riepilogo del Topic","links_shown":"mostra tutti i {{totalLinks}} link...","clicks":"click","topic_link":"topic link"},"topic_statuses":{"locked":{"help":"questo topic \u00e8 chiuso; non \u00e8 possibile postare nuove risposte"},"pinned":{"help":"questo topic \u00e8 pinned; sar\u00e0 mostrato in cima alla lista dei topic"},"archived":{"help":"questo topic \u00e8 archiviato; \u00e8 congelato e non pu\u00f2 essere modificato"},"invisible":{"help":"questo topic \u00e8 invisibile; non sar\u00e0 mostrato nella lista dei topic, pu\u00f2 essere raggiunto solo tramite link diretto"}},"posts":"Post","posts_long":"{{number}} post in questo topic","original_post":"Post Originale","views":"Visite","replies":"Risposte","views_long":"questo topic \u00e8 stato visto {{number}} volte","activity":"Attivit\u00e0","likes":"Like","top_contributors":"Partecipanti","category_title":"Categoria","history":"Cronologia","changed_by":"di {{author}}","categories_list":"Elenco Categorie","filters":{"latest":{"title":"Ultimi","help":"topic pi\u00f9 recenti"},"hot":{"title":"Hot","help":"una selezione dei topic pi\u00f9 attivi"},"favorited":{"title":"Preferiti","help":"topic preferiti"},"read":{"title":"Letti","help":"topic che hai letto"},"categories":{"title":"Categorie","title_in":"Categoria - {{categoryName}}","help":"tutti i topic raggruppati per categoria"},"unread":{"title":{"zero":"Non Letti","one":"Non Letti (1)","other":"Non Letti ({{count}})"},"help":"topic tracciati con post non letti"},"new":{"title":{"zero":"Nuovi","one":"Nuovi (1)","other":"Nuovi ({{count}})"},"help":"nuovi topic dall'ultima tua visita"},"posted":{"title":"Miei Post","help":"topic in cui hai postato"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"ultimi topic nella categoria {{categoryName}}"}},"browser_update":"Purtroppo, <a href=\"http://www.discourse.org/faq/#browser\">la versione del browser \u00e8 data per supportare questo forum Discourse</a>. Per favore <a href=\"http://browsehappy.com\">aggiorna il tuo browser</a>.","type_to_filter":"scrivi per filtrare...","admin":{"title":"Amministrazione Discourse","moderator":"Moderatore","dashboard":{"title":"Dashboard","version":"Versione","up_to_date":"Sei aggiornato!","critical_available":"Un aggiornamento critico \u00e8 disponibile.","updates_available":"Aggiornamenti disponibili.","please_upgrade":"Per favore aggiorna!","installed_version":"Installata","latest_version":"Ultima","problems_found":"Sono stati trovati alcuni problemi con la tua installazione di Discourse:","last_checked":"Ultimo controllo","refresh_problems":"Aggiorna","no_problems":"Nessun problema trovato.","moderators":"Moderatori:","admins":"Amministratori:","private_messages_short":"PMs","private_messages_title":"Messaggi Privati","reports":{"today":"Oggi","yesterday":"Ieri","last_7_days":"Ultimi 7 Giorni","last_30_days":"Ultimi 30 Giorni","all_time":"Sempre","7_days_ago":"7 Giorni fa","30_days_ago":"30 Giorni fa","all":"Tutti","view_table":"Vedi come Tabella","view_chart":"Vedi come Grafico a Barre"}},"commits":{"latest_changes":"Ultime modifiche: ricorda di aggiorna spesso!","by":"da"},"flags":{"title":"Segnalazioni","old":"Vecchie","active":"Attive","clear":"Annulla Segnala","clear_title":"annulla tutte le segnalazioni su questo post (i post nascosti diventeranno visibili)","delete":"Cancella Post","delete_title":"cancella post (se \u00e8 il primo post il topic verr\u00e0 cancellato)","flagged_by":"Segnalato da","error":"Qualcosa \u00e8 andato storto","view_message":"view message"},"groups":{"title":"Gruppi","edit":"Modifica Gruppi","selector_placeholder":"aggiungi utenti","name_placeholder":"Nome gruppo, no spazi, come lo username"},"api":{"title":"API","long_title":"Informazioni API","key":"Key","generate":"Genera API Key","regenerate":"Rigenera API Key","info_html":"La API Key ti permetter\u00e0 di creare e aggiornare topic usando chiamate JSON.","note_html":"Conserva <strong>in modo sicuro</strong> questa chiave. Tutti gli utenti con questa chiave possono creare arbitrariamente post."},"customize":{"title":"Personalizza","long_title":"Personalizzazioni Sito","header":"Header","css":"Stylesheet","override_default":"Sovrascrivi default?","enabled":"Attivo?","preview":"anteprima","undo_preview":"annulla anteprima","save":"Salva","new":"Nuovo","new_style":"Nuovo Stile","delete":"Elimina","delete_confirm":"Elimina questa personalizzazione?","about":"La Personalizzazione del Sito di permette di modificare i fogli di stile e le testate del sito."},"email":{"title":"Log Email","sent_at":"Visto il","email_type":"Tipo Email","to_address":"Indirizzo destinatario","test_email_address":"indirizzo email da testare","send_test":"manda email di test","sent_test":"spedita!"},"impersonate":{"title":"Impersona Utente","username_or_email":"Username o Email dell'Utente","help":"Usa questo strumento per impersonare un account Utente per ragioni di debug.","not_found":"Quell'utente non pu\u00f2 essere trovato.","invalid":"Spiacente, non puoi impersonare quell'utente."},"users":{"title":"Utenti","create":"Aggiungi Amministratore","last_emailed":"Ultima Email","not_found":"Spiacenti quell'username non esiste nel sistema.","new":"Nuovi","active":"Attivi","pending":"In Sospeso","approved":"Approvare?","approved_selected":{"one":"approva utente","other":"approva utenti ({{count}})"},"titles":{"active":"Utenti Attivi","new":"Nuovi Utenti","pending":"Utenti in attesa di verifica","newuser":"Utenti Trust Level 0 (New User)","basic":"Utenti Trust Level 1 (Basic User)","regular":"Utenti Trust Level 2 (Regular User)","leader":"Utenti Trust Level 3 (Leader)","elder":"Utenti Trust Level 4 (Elder)","admins":"Amministratori","moderators":"Moderatori"}},"user":{"ban_failed":"Qualcosa \u00e8 andato storto nel bannare questo utente {{error}}","unban_failed":"Qualcosa \u00e8 andato rimuovendo il ban a questo utente {{error}}","ban_duration":"Per quanto tempo vuoi bannare l'utente? (giorni)","delete_all_posts":"Cancella tutti i post","ban":"Ban","unban":"Rimuovi Ban","banned":"Bannato?","moderator":"Moderatore?","admin":"Amministratore?","show_admin_profile":"Amministratore","refresh_browsers":"Forza refresh del browser","show_public_profile":"Mostra profilo pubblico","impersonate":"Impersona","revoke_admin":"Revoca Amministratore","grant_admin":"Garantisci Amministratore","revoke_moderation":"Revoca Moderatore","grant_moderation":"Garantisci Moderatore","reputation":"Reputazione","permissions":"Permessi","activity":"Attivit\u00e0","like_count":"Like Ricevuti","private_topics_count":"Topic Privati","posts_read_count":"Post Letti","post_count":"Post Creati","topics_entered":"Topic Visitati","flags_given_count":"Segnalazioni Fatte","flags_received_count":"Segnalazioni Ricevute","approve":"Approva","approved_by":"approvato da","time_read":"Tempo di Lettura","delete":"Cancella Utente","delete_forbidden":"Questo utente non pu\u00f2 essere cancellato poich\u00e9 ci sono altri post. Cancella i suoi post prima di eliminarlo.","delete_confirm":"Sei sicuro di voler cancellare definitivamente questo utente? Questa azione \u00e8 irreversibile!","deleted":"L'utente \u00e8 stato cancellato.","delete_failed":"Si sono verificati degli errori nella cancellazione dell'utente. Assicurati che tutti i suoi post sono stati cancellati.","send_activation_email":"Invia Email di Attivazione","activation_email_sent":"Una email di attivazione \u00e8 stata inviata.","send_activation_email_failed":"Si sono verificati dei problemi durante l'invio dell'email di attivazione.","activate":"Attiva Account","activate_failed":"Si sono verificati dei problemi durante l'attivazione dell'account.","deactivate_account":"Disattiva Account","deactivate_failed":"Si sono verificati dei problemi durante la disattivazione dell'account."},"site_content":{"none":"Scegli un tipo di contenuto da modificare.","title":"Contento","edit":"Modifica Contenuto Sito"},"site_settings":{"show_overriden":"Mostra solo modificati","title":"Impostazioni Sito","reset":"resetta al default"}}}}};
I18n.locale = 'it';
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
