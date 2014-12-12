var isDefined = angular.isDefined,
    isFunction = angular.isFunction,
    isString = angular.isString,
    isObject = angular.isObject,
    isArray = angular.isArray,
    forEach = angular.forEach,
    extend = angular.extend,
    copy = angular.copy;

function I18nUrlMatcher(patterns, config, $urlMatcherFactoryProvider) {
  config = angular.isObject(config) ? config : {};
  this.rootLocale = config.rootLocale;
  this.urlMatchers = [];
  this.params = {};
  this.values = {};
  
  Object.keys(patterns).forEach(function(locale) {
    var pattern = patterns[locale];
    var urlMatcher = $urlMatcherFactoryProvider.compile(pattern, config);
    this.urlMatchers[locale] = urlMatcher;
    this.params = extend({}, urlMatcher.params, this.params);
    if (this.rootLocale == locale) {
      this.params.rootLocale;
    }
    if (!this.params.locale) {
      if (!this.rootLocale) {
        throw new Error("Missing ':locale' parameter in url '"+locale+": "+pattern+"'. If you still want to use it, you must set default locale by $I18nUrlMatcherFactory.rootLocale(rootLocale).");
      } else if (this.rootLocale != locale) {
        throw new Error("Missing ':locale' parameter in url '"+locale+": "+pattern+"'. Only urls of default locale, which is '"+this.rootLocale+"', can be without ':locale' parameter.");
      } else {
//        this.params.push('locale');
      }
    }
  }.bind(this));
}

I18nUrlMatcher.prototype.format = function (values) {
  // console.log('format...', values);
  this.values = angular.extend({}, values);
  // Remove root locale from values
  if (values.locale == this.rootLocale) delete values.locale;
  return this.urlMatchers[this.values.locale] ? this.urlMatchers[this.values.locale].format(values) : null;
};

I18nUrlMatcher.prototype.concat = function (pattern) {
  return this.urlMatchers[this.values.locale] ? this.urlMatchers[this.values.locale].concat(pattern) : null;
};

/**
 * @ngdoc function
 * @name ui.router.util.type:UrlMatcher#validate
 * @methodOf ui.router.util.type:UrlMatcher
 *
 * @description
 * Checks an object hash of parameters to validate their correctness according to the parameter
 * types of this `UrlMatcher`.
 *
 * @param {Object} params The object hash of parameters to validate.
 * @returns {boolean} Returns `true` if `params` validates, otherwise `false`.
 */
I18nUrlMatcher.prototype.validates = function (params) {
  // console.log('Validates ...', params);
  return params.locale && this.urlMatchers[params.locale].validates(params);
};

I18nUrlMatcher.prototype.exec = function (path, searchParams) {
  // console.log('exexc...');
  var values;
  Object.keys(this.urlMatchers).some(function(locale) {
    var urlMatcherValues = this.urlMatchers[locale].exec(path, searchParams) || {};
    // Inject root locale
    if (this.rootLocale && urlMatcherValues.hasOwnProperty('rootLocale')) urlMatcherValues.locale = this.rootLocale;
    if (urlMatcherValues.locale == locale) {
      values = urlMatcherValues;
      return true;
    }
  }.bind(this));
  return values;
};

I18nUrlMatcher.prototype.parameters = function () {
  // console.log('params...');
  return this.params;
};


I18nUrlMatcher.prototype.toString = function () {
  return this.source;
};

/**
 * @ngdoc object
 * @name ui.router.util.$i18nUrlMatcherFactory
 *
 * @description
 * Factory for {@link ui.router.util.type:I18nUrlMatcher} instances. The factory is also available to providers
 * under the name `$i18nUrlMatcherFactoryProvider`.
 */
function $I18nUrlMatcherFactory($urlMatcherFactoryProvider) {

  var rootLocale, isCaseInsensitive = false, isStrictMode = true;

  var enqueue = true, typeQueue = [], injector, defaultTypes = {
    int: {
      decode: function(val) {
        return parseInt(val, 10);
      },
      is: function(val) {
        if (!isDefined(val)) return false;
        return this.decode(val.toString()) === val;
      },
      pattern: /\d+/
    },
    bool: {
      encode: function(val) {
        return val ? 1 : 0;
      },
      decode: function(val) {
        return parseInt(val, 10) === 0 ? false : true;
      },
      is: function(val) {
        return val === true || val === false;
      },
      pattern: /0|1/
    },
    string: {
      pattern: /[^\/]*/
    },
    date: {
      equals: function (a, b) {
        return a.toISOString() === b.toISOString();
      },
      decode: function (val) {
        return new Date(val);
      },
      encode: function (val) {
        return [
          val.getFullYear(),
          ('0' + (val.getMonth() + 1)).slice(-2),
          ('0' + val.getDate()).slice(-2)
        ].join("-");
      },
      pattern: /[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])/
    }
  };

  function getDefaultConfig() {
    return {
      strict: isStrictMode,
      caseInsensitive: isCaseInsensitive,
      rootLocale: rootLocale
    };
  }

  function isInjectable(value) {
    return (isFunction(value) || (isArray(value) && isFunction(value[value.length - 1])));
  }

  /**
   * [Internal] Get the default value of a parameter, which may be an injectable function.
   */
  $I18nUrlMatcherFactory.$$getDefaultValue = function(config) {
    if (!isInjectable(config.value)) return config.value;
    if (!injector) throw new Error("Injectable functions cannot be called at configuration time");
    return injector.invoke(config.value);
  };

  this.rootLocale = function(value) {
    if (value == null) return rootLocale;
    rootLocale = value;
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#caseInsensitive
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Defines whether URL matching should be case sensitive (the default behavior), or not.
   *
   * @param {boolean} value `false` to match URL in a case sensitive manner; otherwise `true`;
   */
  this.caseInsensitive = function(value) {
    isCaseInsensitive = value;
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#strictMode
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Defines whether URLs should match trailing slashes, or not (the default behavior).
   *
   * @param {boolean} value `false` to match trailing slashes in URLs, otherwise `true`.
   */
  this.strictMode = function(value) {
    isStrictMode = value;
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#compile
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Creates a {@link ui.router.util.type:UrlMatcher `UrlMatcher`} for the specified pattern.
   *   
   * @param {string} pattern  The URL pattern.
   * @param {Object} config  The config object hash.
   * @returns {UrlMatcher}  The UrlMatcher.
   */
  this.compile = function (patterns, config) {
    return new I18nUrlMatcher(patterns, extend(getDefaultConfig(), config), $urlMatcherFactoryProvider);
  };

  /**
   * @ngdoc function
   * @name ui.router.util.$urlMatcherFactory#isMatcher
   * @methodOf ui.router.util.$urlMatcherFactory
   *
   * @description
   * Returns true if the specified object is a `UrlMatcher`, or false otherwise.
   *
   * @param {Object} object  The object to perform the type check against.
   * @returns {Boolean}  Returns `true` if the object matches the `UrlMatcher` interface, by
   *          implementing all the same methods.
   */
  this.isMatcher = function (o) {
    if (!isObject(o)) return false;
    var result = true;

    forEach(I18nUrlMatcher.prototype, function(val, name) {
      if (isFunction(val)) {
        result = result && (isDefined(o[name]) && isFunction(o[name]));
      }
    });
    return result;
  };

  this.type = function (name, def) {
    if (!isDefined(def)) return I18nUrlMatcher.prototype.$types[name];
    typeQueue.push({ name: name, def: def });
    if (!enqueue) flushTypeQueue();
    return this;
  };

  /* No need to document $get, since it returns this */
  this.$get = ['$injector', function ($injector) {
    injector = $injector;
    enqueue = false;
    I18nUrlMatcher.prototype.$types = {};
    flushTypeQueue();

    forEach(defaultTypes, function(type, name) {
      if (!I18nUrlMatcher.prototype.$types[name]) I18nUrlMatcher.prototype.$types[name] = new Type(type);
    });
    return this;
  }];

  // To ensure proper order of operations in object configuration, and to allow internal
  // types to be overridden, `flushTypeQueue()` waits until `$urlMatcherFactory` is injected
  // before actually wiring up and assigning type definitions
  function flushTypeQueue() {
    forEach(typeQueue, function(type) {
      if (I18nUrlMatcher.prototype.$types[type.name]) {
        throw new Error("A type named '" + type.name + "' has already been defined.");
      }
      var def = new Type(isInjectable(type.def) ? injector.invoke(type.def) : type.def);
      I18nUrlMatcher.prototype.$types[type.name] = def;
    });
  }
}

// Register as a provider so it's available to other providers
angular.module('ui.router.util').provider('$i18nUrlMatcherFactory', ['$urlMatcherFactoryProvider', $I18nUrlMatcherFactory]);
