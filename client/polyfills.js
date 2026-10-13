!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.ES6Promise=e()}(this,function(){"use strict";function t(t){var e=typeof t;return null!==t&&("object"===e||"function"===e)}function e(t){return"function"==typeof t}function n(t){W=t}function r(t){z=t}function o(){return function(){return process.nextTick(a)}}function i(){return"undefined"!=typeof U?function(){U(a)}:c()}function s(){var t=0,e=new H(a),n=document.createTextNode("");return e.observe(n,{characterData:!0}),function(){n.data=t=++t%2}}function u(){var t=new MessageChannel;return t.port1.onmessage=a,function(){return t.port2.postMessage(0)}}function c(){var t=setTimeout;return function(){return t(a,1)}}function a(){for(var t=0;t<N;t+=2){var e=Q[t],n=Q[t+1];e(n),Q[t]=void 0,Q[t+1]=void 0}N=0}function f(){try{var t=Function("return this")().require("vertx");return U=t.runOnLoop||t.runOnContext,i()}catch(e){return c()}}function l(t,e){var n=this,r=new this.constructor(p);void 0===r[V]&&x(r);var o=n._state;if(o){var i=arguments[o-1];z(function(){return T(o,r,i,n._result)})}else j(n,r,t,e);return r}function h(t){var e=this;if(t&&"object"==typeof t&&t.constructor===e)return t;var n=new e(p);return w(n,t),n}function p(){}function v(){return new TypeError("You cannot resolve a promise with itself")}function d(){return new TypeError("A promises callback cannot return that same promise.")}function _(t,e,n,r){try{t.call(e,n,r)}catch(o){return o}}function y(t,e,n){z(function(t){var r=!1,o=_(n,e,function(n){r||(r=!0,e!==n?w(t,n):A(t,n))},function(e){r||(r=!0,S(t,e))},"Settle: "+(t._label||" unknown promise"));!r&&o&&(r=!0,S(t,o))},t)}function m(t,e){e._state===Z?A(t,e._result):e._state===$?S(t,e._result):j(e,void 0,function(e){return w(t,e)},function(e){return S(t,e)})}function b(t,n,r){n.constructor===t.constructor&&r===l&&n.constructor.resolve===h?m(t,n):void 0===r?A(t,n):e(r)?y(t,n,r):A(t,n)}function w(e,n){if(e===n)S(e,v());else if(t(n)){var r=void 0;try{r=n.then}catch(o){return void S(e,o)}b(e,n,r)}else A(e,n)}function g(t){t._onerror&&t._onerror(t._result),E(t)}function A(t,e){t._state===X&&(t._result=e,t._state=Z,0!==t._subscribers.length&&z(E,t))}function S(t,e){t._state===X&&(t._state=$,t._result=e,z(g,t))}function j(t,e,n,r){var o=t._subscribers,i=o.length;t._onerror=null,o[i]=e,o[i+Z]=n,o[i+$]=r,0===i&&t._state&&z(E,t)}function E(t){var e=t._subscribers,n=t._state;if(0!==e.length){for(var r=void 0,o=void 0,i=t._result,s=0;s<e.length;s+=3)r=e[s],o=e[s+n],r?T(n,r,o,i):o(i);t._subscribers.length=0}}function T(t,n,r,o){var i=e(r),s=void 0,u=void 0,c=!0;if(i){try{s=r(o)}catch(a){c=!1,u=a}if(n===s)return void S(n,d())}else s=o;n._state!==X||(i&&c?w(n,s):c===!1?S(n,u):t===Z?A(n,s):t===$&&S(n,s))}function M(t,e){try{e(function(e){w(t,e)},function(e){S(t,e)})}catch(n){S(t,n)}}function P(){return tt++}function x(t){t[V]=tt++,t._state=void 0,t._result=void 0,t._subscribers=[]}function C(){return new Error("Array Methods must be provided an Array")}function O(t){return new et(this,t).promise}function k(t){var e=this;return new e(L(t)?function(n,r){for(var o=t.length,i=0;i<o;i++)e.resolve(t[i]).then(n,r)}:function(t,e){return e(new TypeError("You must pass an array to race."))})}function F(t){var e=this,n=new e(p);return S(n,t),n}function Y(){throw new TypeError("You must pass a resolver function as the first argument to the promise constructor")}function q(){throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.")}function D(){var t=void 0;if("undefined"!=typeof global)t=global;else if("undefined"!=typeof self)t=self;else try{t=Function("return this")()}catch(e){throw new Error("polyfill failed because global object is unavailable in this environment")}var n=t.Promise;if(n){var r=null;try{r=Object.prototype.toString.call(n.resolve())}catch(e){}if("[object Promise]"===r&&!n.cast)return}t.Promise=nt}var K=void 0;K=Array.isArray?Array.isArray:function(t){return"[object Array]"===Object.prototype.toString.call(t)};var L=K,N=0,U=void 0,W=void 0,z=function(t,e){Q[N]=t,Q[N+1]=e,N+=2,2===N&&(W?W(a):R())},B="undefined"!=typeof window?window:void 0,G=B||{},H=G.MutationObserver||G.WebKitMutationObserver,I="undefined"==typeof self&&"undefined"!=typeof process&&"[object process]"==={}.toString.call(process),J="undefined"!=typeof Uint8ClampedArray&&"undefined"!=typeof importScripts&&"undefined"!=typeof MessageChannel,Q=new Array(1e3),R=void 0;R=I?o():H?s():J?u():void 0===B&&"function"==typeof require?f():c();var V=Math.random().toString(36).substring(2),X=void 0,Z=1,$=2,tt=0,et=function(){function t(t,e){this._instanceConstructor=t,this.promise=new t(p),this.promise[V]||x(this.promise),L(e)?(this.length=e.length,this._remaining=e.length,this._result=new Array(this.length),0===this.length?A(this.promise,this._result):(this.length=this.length||0,this._enumerate(e),0===this._remaining&&A(this.promise,this._result))):S(this.promise,C())}return t.prototype._enumerate=function(t){for(var e=0;this._state===X&&e<t.length;e++)this._eachEntry(t[e],e)},t.prototype._eachEntry=function(t,e){var n=this._instanceConstructor,r=n.resolve;if(r===h){var o=void 0,i=void 0,s=!1;try{o=t.then}catch(u){s=!0,i=u}if(o===l&&t._state!==X)this._settledAt(t._state,e,t._result);else if("function"!=typeof o)this._remaining--,this._result[e]=t;else if(n===nt){var c=new n(p);s?S(c,i):b(c,t,o),this._willSettleAt(c,e)}else this._willSettleAt(new n(function(e){return e(t)}),e)}else this._willSettleAt(r(t),e)},t.prototype._settledAt=function(t,e,n){var r=this.promise;r._state===X&&(this._remaining--,t===$?S(r,n):this._result[e]=n),0===this._remaining&&A(r,this._result)},t.prototype._willSettleAt=function(t,e){var n=this;j(t,void 0,function(t){return n._settledAt(Z,e,t)},function(t){return n._settledAt($,e,t)})},t}(),nt=function(){function t(e){this[V]=P(),this._result=this._state=void 0,this._subscribers=[],p!==e&&("function"!=typeof e&&Y(),this instanceof t?M(this,e):q())}return t.prototype["catch"]=function(t){return this.then(null,t)},t.prototype["finally"]=function(t){var n=this,r=n.constructor;return e(t)?n.then(function(e){return r.resolve(t()).then(function(){return e})},function(e){return r.resolve(t()).then(function(){throw e})}):n.then(t,t)},t}();return nt.prototype.then=l,nt.all=O,nt.race=k,nt.resolve=h,nt.reject=F,nt._setScheduler=n,nt._setAsap=r,nt._asap=z,nt.polyfill=D,nt.Promise=nt,nt.polyfill(),nt});
// ---- Letschat polyfills for very old phones (Android 4.x WebView / Chrome < 50, iOS 10). Plain ES5. Each one only runs if missing. ----
(function (w) {
  "use strict";
  var d = w.document, AP = Array.prototype, SP = String.prototype;
  function def(o, k, v) { if (!o[k]) try { Object.defineProperty(o, k, { configurable: true, writable: true, value: v }); } catch (e) { o[k] = v; } }

  // Symbol (minimal: strings that behave as unique keys; enough for React and for-of over arrays/Map/Set)
  if (typeof w.Symbol === "undefined") {
    var sid = 0, reg = {};
    var S = function Symbol(desc) { return "@@lcsym_" + (desc === undefined ? "" : desc) + "_" + (++sid); };
    S.iterator = "@@iterator"; S.asyncIterator = "@@asyncIterator"; S.hasInstance = "@@hasInstance"; S.toPrimitive = "@@toPrimitive"; S.toStringTag = "@@toStringTag";
    S["for"] = function (k) { return reg[k] || (reg[k] = "@@lcfor_" + k); };
    S.keyFor = function (s) { for (var k in reg) if (reg[k] === s) return k; };
    w.Symbol = S;
  }
  var IT = w.Symbol.iterator;

  def(Object, "assign", function (t) {
    if (t == null) throw new TypeError("Cannot convert undefined or null to object");
    var o = Object(t);
    for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s != null) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) o[k] = s[k]; }
    return o;
  });
  def(Object, "is", function (a, b) { return a === b ? (a !== 0 || 1 / a === 1 / b) : (a !== a && b !== b); });
  def(Object, "setPrototypeOf", function (o, p) { o.__proto__ = p; return o; });

  function isIter(o) { return o != null && typeof o !== "string" && typeof o[IT] === "function"; }
  function toArr(it) {
    if (it == null) return [];
    if (typeof it === "string") return it.split("");
    if (isIter(it) && typeof it.length !== "number") { var out = [], i = it[IT](), n; while (!(n = i.next()).done) out.push(n.value); return out; }
    return AP.slice.call(it);
  }
  function arrIter(a) { var i = 0, o = { next: function () { return i < a.length ? { value: a[i++], done: false } : { value: undefined, done: true }; } }; o[IT] = function () { return this; }; return o; }

  def(Array, "from", function (src, fn, th) { var a = toArr(src); return fn ? a.map(fn, th) : a; });
  def(Array, "of", function () { return AP.slice.call(arguments); });
  def(AP, "includes", function (x, from) { var n = this.length >>> 0; for (var i = from < 0 ? Math.max(0, n + from) : (from || 0); i < n; i++) { var v = this[i]; if (v === x || (v !== v && x !== x)) return true; } return false; });
  def(AP, "find", function (f, t) { for (var i = 0; i < this.length; i++) if (f.call(t, this[i], i, this)) return this[i]; });
  def(AP, "findIndex", function (f, t) { for (var i = 0; i < this.length; i++) if (f.call(t, this[i], i, this)) return i; return -1; });
  def(AP, "fill", function (v, s, e) { var n = this.length >>> 0, i = s == null ? 0 : s < 0 ? Math.max(0, n + s) : Math.min(s, n), j = e == null ? n : e < 0 ? Math.max(0, n + e) : Math.min(e, n); for (; i < j; i++) this[i] = v; return this; });
  def(AP, "keys", function () { var a = []; for (var i = 0; i < this.length; i++) a.push(i); return arrIter(a); });
  def(AP, "entries", function () { var a = []; for (var i = 0; i < this.length; i++) a.push([i, this[i]]); return arrIter(a); });
  def(AP, "values", function () { return arrIter(this); });
  def(AP, "forEach", AP.forEach); // exists since Android 2.2; keeps def() symmetrical
  def(SP, "includes", function (s, p) { return this.indexOf(s, p || 0) !== -1; });
  def(SP, "startsWith", function (s, p) { p = p || 0; return this.substr(p, String(s).length) === String(s); });
  def(SP, "endsWith", function (s, e) { var str = String(this); if (e === undefined || e > str.length) e = str.length; return str.substring(e - String(s).length, e) === String(s); });
  def(SP, "repeat", function (n) { var s = String(this), o = ""; n = Math.floor(n) || 0; while (n-- > 0) o += s; return o; });
  def(SP, "trimStart", function () { return this.replace(/^\s+/, ""); });
  def(SP, "trimEnd", function () { return this.replace(/\s+$/, ""); });
  def(Number, "isFinite", function (v) { return typeof v === "number" && isFinite(v); });
  def(Number, "isNaN", function (v) { return typeof v === "number" && v !== v; });
  def(Number, "isInteger", function (v) { return typeof v === "number" && isFinite(v) && Math.floor(v) === v; });
  def(Number, "isSafeInteger", function (v) { return Number.isInteger(v) && Math.abs(v) <= 9007199254740991; });
  def(Number, "parseFloat", parseFloat); def(Number, "parseInt", parseInt);
  def(Math, "trunc", function (x) { return x < 0 ? Math.ceil(x) : Math.floor(x); });
  def(Math, "sign", function (x) { x = +x; return x === 0 || x !== x ? x : x > 0 ? 1 : -1; });
  def(Math, "log2", function (x) { return Math.log(x) / Math.LN2; });
  def(Math, "log10", function (x) { return Math.log(x) / Math.LN10; });
  def(Math, "hypot", function () { var s = 0; for (var i = 0; i < arguments.length; i++) s += arguments[i] * arguments[i]; return Math.sqrt(s); });
  def(Math, "cbrt", function (x) { return x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3); });

  // Map / Set / WeakMap / WeakSet (simple arrays; fine for the sizes this app uses)
  function idx(keys, k) { if (k === k) return keys.indexOf(k); for (var i = 0; i < keys.length; i++) if (keys[i] !== keys[i]) return i; return -1; }
  if (typeof w.Map === "undefined" || !w.Map.prototype.forEach) {
    var M = function Map(it) { this._k = []; this._v = []; var a = toArr(it); for (var i = 0; i < a.length; i++) this.set(a[i][0], a[i][1]); };
    M.prototype = {
      get size() { return this._k.length; },
      get: function (k) { var i = idx(this._k, k); return i < 0 ? undefined : this._v[i]; },
      set: function (k, v) { var i = idx(this._k, k); if (i < 0) { this._k.push(k); this._v.push(v); } else this._v[i] = v; return this; },
      has: function (k) { return idx(this._k, k) >= 0; },
      "delete": function (k) { var i = idx(this._k, k); if (i < 0) return false; this._k.splice(i, 1); this._v.splice(i, 1); return true; },
      clear: function () { this._k.length = 0; this._v.length = 0; },
      forEach: function (f, t) { for (var i = 0; i < this._k.length; i++) f.call(t, this._v[i], this._k[i], this); },
      keys: function () { return arrIter(this._k.slice()); },
      values: function () { return arrIter(this._v.slice()); },
      entries: function () { var a = []; for (var i = 0; i < this._k.length; i++) a.push([this._k[i], this._v[i]]); return arrIter(a); }
    };
    M.prototype[IT] = M.prototype.entries;
    w.Map = M;
  }
  if (typeof w.Set === "undefined" || !w.Set.prototype.forEach) {
    var St = function Set(it) { this._k = []; var a = toArr(it); for (var i = 0; i < a.length; i++) this.add(a[i]); };
    St.prototype = {
      get size() { return this._k.length; },
      add: function (k) { if (idx(this._k, k) < 0) this._k.push(k); return this; },
      has: function (k) { return idx(this._k, k) >= 0; },
      "delete": function (k) { var i = idx(this._k, k); if (i < 0) return false; this._k.splice(i, 1); return true; },
      clear: function () { this._k.length = 0; },
      forEach: function (f, t) { for (var i = 0; i < this._k.length; i++) f.call(t, this._k[i], this._k[i], this); },
      values: function () { return arrIter(this._k.slice()); },
      entries: function () { var a = []; for (var i = 0; i < this._k.length; i++) a.push([this._k[i], this._k[i]]); return arrIter(a); }
    };
    St.prototype.keys = St.prototype.values; St.prototype[IT] = St.prototype.values;
    w.Set = St;
  }
  var wid = 0;
  function weak(kind) {
    var key = "__lcweak" + (++wid) + "_";
    var C = function (it) { var a = toArr(it); for (var i = 0; i < a.length; i++) kind === "map" ? this.set(a[i][0], a[i][1]) : this.add(a[i]); };
    function put(o, v) { if (o === null || (typeof o !== "object" && typeof o !== "function")) throw new TypeError("Invalid value used as weak key"); try { Object.defineProperty(o, key, { value: [v], configurable: true, writable: true }); } catch (e) { o[key] = [v]; } }
    C.prototype.has = function (o) { return !!o && !!o[key]; };
    C.prototype["delete"] = function (o) { if (!this.has(o)) return false; o[key] = undefined; return true; };
    if (kind === "map") { C.prototype.get = function (o) { return o && o[key] ? o[key][0] : undefined; }; C.prototype.set = function (o, v) { put(o, v); return this; }; }
    else C.prototype.add = function (o) { put(o, true); return this; };
    return C;
  }
  if (typeof w.WeakMap === "undefined") w.WeakMap = weak("map");
  if (typeof w.WeakSet === "undefined") w.WeakSet = weak("set");

  // DOM helpers
  var EP = w.Element && w.Element.prototype;
  if (EP) {
    def(EP, "matches", EP.webkitMatchesSelector || EP.mozMatchesSelector || EP.msMatchesSelector || function (s) { var l = (this.document || this.ownerDocument).querySelectorAll(s), i = l.length; while (--i >= 0 && l.item(i) !== this) {} return i > -1; });
    def(EP, "closest", function (s) { var e = this; while (e && e.nodeType === 1) { if (e.matches(s)) return e; e = e.parentNode; } return null; });
    def(EP, "remove", function () { if (this.parentNode) this.parentNode.removeChild(this); });
  }
  if (w.CharacterData) def(w.CharacterData.prototype, "remove", function () { if (this.parentNode) this.parentNode.removeChild(this); });
  if (!w.performance) w.performance = {};
  if (!w.performance.now) { var t0 = Date.now(); w.performance.now = function () { return Date.now() - t0; }; }
  if (!Date.now) Date.now = function () { return new Date().getTime(); };
  if (!w.MessageChannel && !w.__lcNoMC) { /* React falls back to setTimeout when MessageChannel is missing */ }

  // URLSearchParams (Chrome < 49, Safari < 10.1)
  if (!w.URLSearchParams) {
    var USP = function URLSearchParams(init) {
      this._p = [];
      if (typeof init === "string") { init = init.replace(/^\?/, ""); if (init) { var parts = init.split("&"); for (var i = 0; i < parts.length; i++) { var kv = parts[i].split("="); this._p.push([decodeURIComponent((kv[0] || "").replace(/\+/g, " ")), decodeURIComponent((kv[1] || "").replace(/\+/g, " "))]); } } }
      else if (init && typeof init === "object") for (var k in init) this._p.push([k, String(init[k])]);
    };
    USP.prototype = {
      append: function (k, v) { this._p.push([k, String(v)]); },
      set: function (k, v) { this["delete"](k); this._p.push([k, String(v)]); },
      get: function (k) { for (var i = 0; i < this._p.length; i++) if (this._p[i][0] === k) return this._p[i][1]; return null; },
      has: function (k) { return this.get(k) !== null; },
      "delete": function (k) { this._p = this._p.filter(function (e) { return e[0] !== k; }); },
      forEach: function (f, t) { for (var i = 0; i < this._p.length; i++) f.call(t, this._p[i][1], this._p[i][0], this); },
      toString: function () { return this._p.map(function (e) { return encodeURIComponent(e[0]) + "=" + encodeURIComponent(e[1]); }).join("&"); }
    };
    w.URLSearchParams = USP;
  }

  // fetch (XMLHttpRequest based): Android 4.x, iOS 10.0-10.2
  if (!w.fetch) {
    var Resp = function (xhr, url) {
      this.status = xhr.status; this.ok = xhr.status >= 200 && xhr.status < 300; this.statusText = xhr.statusText; this.url = xhr.responseURL || url; this._x = xhr;
      var hs = {}; (xhr.getAllResponseHeaders() || "").split(/\r?\n/).forEach(function (l) { var i = l.indexOf(":"); if (i > 0) hs[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
      this.headers = { get: function (k) { var v = hs[String(k).toLowerCase()]; return v === undefined ? null : v; }, has: function (k) { return hs[String(k).toLowerCase()] !== undefined; } };
    };
    Resp.prototype.text = function () { var x = this._x; return Promise.resolve(typeof x.response === "string" || x.responseType === "" || x.responseType === "text" ? x.responseText : ""); };
    Resp.prototype.json = function () { return this.text().then(function (t) { return JSON.parse(t); }); };
    Resp.prototype.blob = function () { return Promise.resolve(this._x.response instanceof Blob ? this._x.response : new Blob([this._x.responseText])); };
    Resp.prototype.arrayBuffer = function () { return Promise.resolve(this._x.response); };
    Resp.prototype.clone = function () { return this; };
    w.fetch = function (input, init) {
      init = init || {};
      return new Promise(function (ok, no) {
        var xhr = new XMLHttpRequest(), url = typeof input === "string" ? input : input.url, h = init.headers || {};
        xhr.open(init.method || "GET", url, true);
        var wantBin = /\.(mp3|wav|webp|png|jpg)(\?|$)/i.test(url);
        if (wantBin) xhr.responseType = "arraybuffer";
        for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) xhr.setRequestHeader(k, h[k]);
        if (init.credentials === "include") xhr.withCredentials = true;
        xhr.onload = function () { ok(new Resp(xhr, url)); };
        xhr.onerror = xhr.ontimeout = function () { no(new TypeError("Network request failed")); };
        xhr.send(init.body == null ? null : init.body);
      });
    };
  }
})(window);
