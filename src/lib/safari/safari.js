var _safari = {
  storage: {
    read: function (id) {
      return localStorage[id] || null;
    },
    write: function (id, data) {
      localStorage[id] = data + "";
      if (id === "fullLite" || id === "startStop" || id === "allowedURLs") {
        insertContentScript();
      }
    }
  },

  timer: window,

  get: function (url, headers, data) {
    var xhr = new XMLHttpRequest();
    var deferred = new task.Deferred();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 400) {
          var e = new Error(xhr.statusText);
          e.status = xhr.status;
          deferred.reject(e);
        }
        else {
          deferred.resolve(xhr.responseText);
        }
      }
    };
    xhr.open(data ? "POST" : "GET", url, true);
    for (var id in headers) {
      xhr.setRequestHeader(id, headers[id]);
    }
    if (data) {
      var arr = [];
      for(e in data) {
        arr.push(e + "=" + data[e]);
      }
      data = arr.join("&");
    }
    xhr.send(data ? data : "");
    return deferred.promise;
  },

  popup: (function () {
    var callbacks = {};
    return {
      send: function (id, obj) {
        safari.extension.popovers[0].contentWindow.background.dispatchMessage(id, obj)
      },
      receive: function (id, callback) {
        callbacks[id] = callback;
      },
      dispatchMessage: function (id, obj) {
        if (callbacks[id]) {
          callbacks[id](obj);
        }
      }
    }
  })(),

  tab: {
    open: function (url) {
      safari.application.activeBrowserWindow.openTab().url = url;
    },
    openOptions: function () {
      safari.application.activeBrowserWindow.openTab().url = safari.extension.baseURI + "data/options/options.html";
    }
  },

  notification: function (title, text) {
    alert(text);
  },

  play: (function () {
    var canPlay = false;
    try {
      var audio = new Audio();
      canPlay = audio.canPlayType("audio/mpeg");
    } catch (e) {}
    if (!canPlay) {
      audio = document.createElement("iframe");
      document.body.appendChild(audio);
    }
    return function (url) {
      if (canPlay) {
        audio.setAttribute("src", url);
        audio.play();
      }
      else {
        audio.removeAttribute('src');
        audio.setAttribute('src', url);
      }
    }
  })(),

  version: function () {
    return safari.extension.displayVersion;
  },

  icon: function (state) {
    if (state == 'Disable') {
      safari.extension.toolbarItems[0].image = safari.extension.baseURI + 'data/icon16Disable-mac.png';
    }
    else if (state == 'Lite') {
      safari.extension.toolbarItems[0].image = safari.extension.baseURI + 'data/icon16Lite-mac.png';
    }
    else {
      safari.extension.toolbarItems[0].image = safari.extension.baseURI + 'data/icon16-mac.png';
    }
  },

  content_script: (function () {
    var callbacks = {};
    safari.application.addEventListener("message", function (e) {
      if (callbacks[e.message.id]) {
        callbacks[e.message.id](e.message.data);
      }
    }, false);
    return {
      send: function (id, data, global) {
        if (global) {
          safari.application.browserWindows.forEach(function (browserWindow) {
            browserWindow.tabs.forEach(function (tab) {
              if (tab.page) tab.page.dispatchMessage(id, data);
            });
          });
        }
        else {
          safari.application.activeBrowserWindow.activeTab.page.dispatchMessage(id, data);
        }
      },
      receive: function (id, callback) {
        callbacks[id] = callback;
      }
    }
  })(),

  context_menu: (function () {
    var onPage = [];
    var onSelection = [];
    safari.application.addEventListener("contextmenu", function (e) {
      var selected = e.userInfo && "selectedText" in e.userInfo && e.userInfo.selectedText;
      onPage.forEach(function (arr, i) {
        e.contextMenu.appendContextMenuItem("igtranslator.onPage:" + i, arr[0]);
      });
      if (selected) {
        onSelection.forEach(function (arr, i) {
          e.contextMenu.appendContextMenuItem("igtranslator.onSelection:" + i, arr[0]);
        });
      }
    }, false);
    safari.application.addEventListener("command", function (e) {
      var cmd = e.command;
      if (cmd.indexOf("igtranslator.onPage:") != -1) {
        var i = parseInt(cmd.substr(20));
        onPage[i][1]();
      }
      if (cmd.indexOf("igtranslator.onSelection:") != -1) {
        var i = parseInt(cmd.substr(25));
        onSelection[i][1]();
      }
    }, false);
    return {
      create: function (title, type, callback) {
        if (type == "page") {
          onPage.push([title, callback]);
        }
        if (type == "selection") {
          onSelection.push([title, callback]);
        }
      }
    }
  })()
}

/* * Code for injecting content_script * */
function insertContentScript() {
  safari.extension.removeContentScripts();
  safari.extension.removeContentStyleSheets();
  if (localStorage["startStop"] == "Enable") {
    var contentScript = {
      loc: safari.extension.baseURI + 'data/content_script/inject.js'
    };
    safari.extension.addContentScriptFromURL(contentScript.loc, contentScript.whitelist, contentScript.blacklist, false);
  }
}
if (localStorage["allowedURLs"]) {
  insertContentScript();
}

function handler(event) {
  var url = event.message;
  if (localStorage["startStop"] == "Enable") {
    if (event.name === "canLoad") {
      var topLevelUrl = event.target.url;
      if (url != topLevelUrl) { // top url is allowed
        var allowedURLs = JSON.parse(localStorage["allowedURLs"]);
        for (var i = 0; i < allowedURLs.length; i++) {
          if (topLevelUrl && topLevelUrl.indexOf(allowedURLs[i]) != -1) {
            return false;
          }
        }
        /*
        for (var j = 0; j < filters.blockedURLs.length; j++) {
          var flag = (new RegExp('\\b' + filters.blockedURLs[j] + '\\b')).test(url);
          if (flag) {
            // console.error("onBeforeLoad Safari: ", filters.blockedURLs[j]);
            event.message = "block";
            return;
          }
        }
        */
        event.message = {
          name: "injectCss",
          text: localStorage["highlight"]
        };
      }
      _safari.content_script.send("script-list", filters.scriptList, true);
      _safari.content_script.send("allowed-urls", filters.allowedURLs, true);
      _safari.content_script.send("adblock-list", filters.adblockList, true);
    }
  }
}
safari.application.addEventListener("message", handler, true);
/* ************************************* */
