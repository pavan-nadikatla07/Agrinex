/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "7b8a309d33fa53fde912f18eda935d79"
  }, {
    "url": "pwa-512x512.png",
    "revision": "7b8a309d33fa53fde912f18eda935d79"
  }, {
    "url": "pwa-192x192.png",
    "revision": "ca8bc9acbea1dd91b833afd083b3d086"
  }, {
    "url": "index.html",
    "revision": "1074ef78f3ea39b627c8a2cad8e8806a"
  }, {
    "url": "icon.svg",
    "revision": "3b7dfad31e587e7c0674a8d1579a580c"
  }, {
    "url": "favicon.ico",
    "revision": "e3e92d2b5296d9daaa14a1958d32cb17"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "81be05ae1ce4979542e6e5f488bf181d"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/index-_DRJZRrB.css",
    "revision": null
  }, {
    "url": "assets/index-yWsET01R.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "81be05ae1ce4979542e6e5f488bf181d"
  }, {
    "url": "favicon.ico",
    "revision": "e3e92d2b5296d9daaa14a1958d32cb17"
  }, {
    "url": "icon.svg",
    "revision": "3b7dfad31e587e7c0674a8d1579a580c"
  }, {
    "url": "pwa-192x192.png",
    "revision": "ca8bc9acbea1dd91b833afd083b3d086"
  }, {
    "url": "pwa-512x512.png",
    "revision": "7b8a309d33fa53fde912f18eda935d79"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "7b8a309d33fa53fde912f18eda935d79"
  }, {
    "url": "manifest.webmanifest",
    "revision": "dbd90afdf4af17296cfe4e71b1e81a75"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
