var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/zzRouter.js
var zzRouter_exports = {};
__export(zzRouter_exports, {
  zzRouter: () => zzRouter
});
module.exports = __toCommonJS(zzRouter_exports);

// src/utils.js
var utils = {};
utils.analizeUrl = function(url, options) {
  let result = {};
  let urlParts = url.split(options.PAGE_PREFIX);
  result.prepage = urlParts[0];
  let postPath = urlParts[1] || "";
  if (result.prepage.endsWith("#")) {
    result.prepage = result.prepage.slice(0, -1);
  }
  let pathParts = postPath.split("?");
  result.page = pathParts[0];
  if (result.page == "") {
    result.page = options.PAGE_ID_HOME;
  }
  let paramsString = pathParts[1] || "";
  result.params = {};
  if (paramsString == "") {
    return result;
  }
  let vars = paramsString.split("&");
  for (let i = 0; i < vars.length; i++) {
    let pair = vars[i].split("=");
    let paramName = pair[0];
    let paramValue = pair[1];
    result.params[paramName] = paramValue;
  }
  return result;
};
utils.addEventListenerOnList = function(list, event, fn) {
  for (let i = 0, len = list.length; i < len; i++) {
    list[i].addEventListener(event, fn, false);
  }
};
utils.extend = function(out, from1, from2) {
  out = out || {};
  for (var i = 1; i < arguments.length; i++) {
    if (!arguments[i]) {
      continue;
    }
    for (var key in arguments[i]) {
      if (arguments[i].hasOwnProperty(key)) {
        out[key] = arguments[i][key];
      }
    }
  }
  return out;
};
utils.isFunction = function isFunction(obj) {
  return typeof obj === "function" && typeof obj.nodeType !== "number";
};

// src/defaultOptions.js
var defaultOptions = {
  updateOnStart: true,
  preloadPagesOnStart: false,
  // Animations
  animationOut: "slide-out-top",
  //animationOut: false,
  animationIn: "scale-in-center",
  //animationIn: false,
  animateTransitionsOnStart: false,
  // Misc
  PAGE_PREFIX: "!",
  // Special pages ids
  PAGE_ID_HOME: "[home]",
  PAGE_ID_404_ERROR: "[404]",
  // Events
  EVENT_PRE_INIT: "preInit",
  EVENT_INIT: "init",
  EVENT_PRE_REINIT: "preReinit",
  EVENT_REINIT: "reinit",
  EVENT_MOUNTED: "mounted",
  EVENT_BEFORE_OUT: "beforeOut",
  EVENT_AFTER_OUT: "afterOut",
  RUN_RENDER_BEFORE_EVENT_INIT: true,
  RUN_RENDER_BEFORE_EVENT_REINIT: false
};

// src/htmlFetcher.js
var htmlFetcher = {};
htmlFetcher.loadAllUrls = function(router, callback) {
  const routes = router.options.routes || [];
  let pending = 0;
  routes.map((routeItem) => {
    let url = routeItem.url;
    if (url) {
      ++pending;
      htmlFetcher.loadUrl(url).then(
        function(text) {
          routeItem.content = text;
          if (--pending == 0 && callback && utils.isFunction(callback)) {
            callback();
          }
        }
      );
    }
  });
};
htmlFetcher.loadUrl = async function(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const message = `Error fetching ${url} has occured: ${response.status}`;
    alert(message);
    throw new Error(message);
  }
  const text = await response.text();
  return text;
};

// src/version.js
var version = "0.1.0";

// src/zzRouter.js
var zzRouter = {};
zzRouter.utils = utils;
zzRouter.defaultOptions = defaultOptions;
zzRouter.htmlFetcher = htmlFetcher;
zzRouter.version = version;
zzRouter.start = function(userOptions) {
  this.options = {};
  this.utils.extend(this.options, this.defaultOptions, userOptions);
  this.checkOptions();
  if (this.options.preloadPagesOnStart) {
    let self = this;
    this.htmlFetcher.loadAllUrls(
      this,
      () => {
        self.init();
      }
    );
    return;
  }
  this.init();
};
zzRouter.init = function() {
  this.routesMap = this.createRoutesMap();
  this.stack = [];
  this.addEventListenersForWindow();
  this.navigateUrl(
    this.options.updateOnStart ? window.location.href : "",
    this.options.animateTransitionsOnStart
  );
};
zzRouter.checkOptions = function() {
  let errors = 0;
  let errorMessages = "";
  if (!this.options.routes) {
    ++errors;
    errorMessages += "routes must be defined. ";
  }
  if (!this.options.eventsByPage) {
    ++errors;
    errorMessages += "eventsByPage must be defined. ";
  }
  if (errors) {
    this.alertError("Unable to initalize zzRouter. " + errors + " errors found: " + errorMessages);
  }
};
zzRouter.alertError = function(message) {
  alert(message);
  throw message;
};
zzRouter.addEventListenersForWindow = function() {
  window.onpopstate = (e) => {
    this.navigateUrl(window.location.href, true);
  };
};
zzRouter.addEventListenersForLinks = function(pageId) {
  let self = this;
  this.utils.addEventListenerOnList(
    //document.getElementsByTagName( 'a' ),
    document.getElementById(pageId).getElementsByTagName("a"),
    "click",
    (e) => {
      const href = e.target.getAttribute("href");
      if (!href.startsWith(self.options.PAGE_PREFIX)) {
        return;
      }
      e.preventDefault();
      history.pushState(
        {
          "page": href
        },
        "page " + href,
        "#" + href
      );
      self.navigateUrl(href, true);
    }
  );
};
zzRouter.createRoutesMap = function() {
  const routerMap = {};
  const routes = this.options.routes || [];
  routes.map((routeItem) => {
    routerMap[routeItem.id] = routeItem;
  });
  return routerMap;
};
zzRouter.getRouteItem = function(pageId) {
  let routeItem = this.routesMap[pageId];
  if (routeItem) {
    return routeItem;
  }
  routeItem = this.routesMap[this.options.PAGE_ID_404_ERROR];
  if (routeItem) {
    return routeItem;
  }
  return {
    id: this.options.PAGE_ID_404_ERROR,
    content: "<h3>404 - Page not found: " + pageId + "</h3>"
  };
};
zzRouter.navigateUrl = function(url, mustAnimateByCode) {
  let urlObject = this.utils.analizeUrl(url, this.options);
  let currentPageId = this.updateStack(urlObject.page);
  if (currentPageId == urlObject.page) {
    return;
  }
  let content = this.getContentForPage(urlObject.page);
  let self = this;
  if (content instanceof Promise) {
    content.then(function(text) {
      let routeItem = self.getRouteItem(urlObject.page);
      routeItem.content = text;
      self.doPageTransition(text, urlObject.page, currentPageId, urlObject, mustAnimateByCode);
    });
    return;
  }
  this.doPageTransition(content, urlObject.page, currentPageId, urlObject, mustAnimateByCode);
};
zzRouter.updateStack = function(pageId) {
  let isBackward = this.stack[this.stack.length - 2] == pageId;
  if (isBackward) {
    return this.stack.pop();
  }
  var currentPageId = this.stack[this.stack.length - 1];
  this.stack.push(pageId);
  return currentPageId;
};
zzRouter.getContentForPage = function(pageId) {
  let routeItem = this.getRouteItem(pageId);
  return this.getContentForRoute(routeItem);
};
zzRouter.getContentForRoute = function(routeItem) {
  if (routeItem.keepAlive) {
    let alivePage = document.getElementById(routeItem.id);
    if (alivePage) {
      return alivePage;
    }
  }
  let content = routeItem.content;
  if (content) {
    return content;
  }
  let url = routeItem.url;
  if (url) {
    return this.htmlFetcher.loadUrl(url);
  }
  return '<div id="error">No content found for route from path ' + routeItem.id + "</div>";
};
zzRouter.doPageTransition = function(content, nextPageId, currentPageId, urlObject, mustAnimateByCode) {
  const mustAnimateOut = mustAnimateByCode && !!this.options.animationOut;
  const mustAnimateIn = mustAnimateByCode && !!this.options.animationIn;
  const initEvent = content instanceof HTMLElement ? this.defaultOptions.EVENT_REINIT : this.defaultOptions.EVENT_INIT;
  this.runEvent(this.defaultOptions.EVENT_BEFORE_OUT, currentPageId, {});
  let currentPage = document.getElementsByClassName("currentPage")[0];
  let newPage = this.addNextPage(currentPage, content, nextPageId);
  this.runRenderRelated(initEvent, nextPageId, urlObject);
  let self = this;
  let currentPageAnimationendListener = () => {
    currentPage.removeEventListener("animationend", currentPageAnimationendListener);
    newPage.classList.remove("hidden");
    if (mustAnimateIn) {
      newPage.classList.add(this.options.animationIn);
    }
    this.retireCurrentPage(currentPageId, currentPage);
    self.runEvent(this.defaultOptions.EVENT_AFTER_OUT, currentPageId, {});
    if (!mustAnimateIn) {
      newPageAnimationendListener();
    }
  };
  let newPageAnimationendListener = () => {
    newPage.removeEventListener("animationend", newPageAnimationendListener);
    newPage.classList.remove("nextPage");
    newPage.classList.add("currentPage");
    if (mustAnimateIn) {
      newPage.classList.remove(this.options.animationIn);
    }
    self.runEvent(initEvent, nextPageId, urlObject);
    self.runEvent(this.defaultOptions.EVENT_MOUNTED, nextPageId, urlObject);
  };
  if (mustAnimateOut) {
    currentPage.addEventListener("animationend", currentPageAnimationendListener);
  }
  if (mustAnimateIn) {
    newPage.addEventListener("animationend", newPageAnimationendListener);
  }
  if (mustAnimateOut) {
    currentPage.classList.add(this.options.animationOut);
  } else {
    currentPageAnimationendListener();
  }
};
zzRouter.runRenderRelated = function(initEvent, nextPageId, urlObject) {
  const preEvent = initEvent === this.options.EVENT_INIT ? this.options.EVENT_PRE_INIT : this.options.EVENT_PRE_REINIT;
  this.runEvent(preEvent, nextPageId, urlObject);
  const routeItem = this.getRouteItem(nextPageId);
  const renderOption = initEvent === this.options.EVENT_INIT ? this.options.RUN_RENDER_BEFORE_EVENT_INIT : this.options.RUN_RENDER_BEFORE_EVENT_REINIT;
  const routeProperty = initEvent === this.options.EVENT_INIT ? "runRenderBeforeInit" : "runRenderBeforeReinit";
  const mustRunRender = routeItem[routeProperty] === void 0 ? renderOption : routeItem[routeProperty];
  if (mustRunRender && this.options.renderFunction && this.utils.isFunction(this.options.renderFunction)) {
    this.options.renderFunction(
      this.buildPageInstance(nextPageId)
    );
  }
};
zzRouter.buildPageInstance = function(pageId) {
  return {
    "id": pageId,
    "el": document.getElementById(pageId)
  };
};
zzRouter.addNextPage = function(currentPage, content, nextPageId) {
  if (content instanceof HTMLElement) {
    currentPage.insertAdjacentElement(
      "afterend",
      content
    );
    content.classList.add("nextPage");
    content.classList.add("hidden");
    content.classList.remove("alive");
  } else {
    currentPage.insertAdjacentHTML(
      "afterend",
      '<div class="nextPage hidden page" id="' + nextPageId + '">' + content + "</div>"
    );
  }
  return document.getElementById(nextPageId);
};
zzRouter.retireCurrentPage = function(currentPageId, currentPage) {
  let currentRoute = this.getRouteItem(currentPageId);
  if (currentRoute && currentRoute.keepAlive) {
    currentPage.removeAttribute("class");
    currentPage.classList.add("page");
    currentPage.classList.add("alive");
    return;
  }
  currentPage.remove();
};
zzRouter.runEvent = function(eventId, pageId, urlObject) {
  if (eventId == this.defaultOptions.EVENT_INIT) {
    this.addEventListenersForLinks(pageId);
  }
  let page = this.options.eventsByPage[pageId];
  if (page) {
    let event = {
      params: urlObject.params || {}
    };
    if (page[eventId] && this.utils.isFunction(page[eventId])) {
      page[eventId](event);
    }
  }
};
