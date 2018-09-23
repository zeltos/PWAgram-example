// this is service worker file
// self to access to service worker

importScripts('/src/js/idb.js');
importScripts('/src/js/utility.js');

var CACHE_STATIC = 'static-v2';
var CACHE_DYNAMIC = 'dynamic-v2';
var STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/src/js/app.js',
  '/src/js/feed.js',
  '/src/js/material.min.js',
  '/src/css/app.css',
  '/src/css/feed.css',
  '/src/images/main-image.jpg',
  'https://fonts.googleapis.com/css?family=Roboto:400,700',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
];


self.addEventListener('install', function(event) {
  //
  console.log('[Service Worker] installing service worker...' ,  event);

  // cache API
  event.waitUntil(
    caches.open(CACHE_STATIC) // store the asstes to cache
      .then(function(cache){
        console.log('[Service Worker] Caching Core Assest...');
        //cache.add('/src/js/app.js'); // add single asset to cache
        // cache multiple assest
        // set precache of core assets
        cache.addAll(STATIC_FILES)
      })
  )
});

self.addEventListener('activate', function(event) {
  //
  console.log('[Service Worker] Activate service worker...' ,  event);
  // clean up the old version caches
  event.waitUntil(
    caches.keys() // to store the list of cache in the storage
      .then(function(keyList){
        return Promise.all(keyList.map(function(key){ // convert list array to promise wait untul all list is get
          if (key !== CACHE_STATIC && key !== CACHE_DYNAMIC) { // check if the name of list cache not the current our assets
            console.log('[Service Worker] Removing Old Cache', key);
            return caches.delete(key);
          }
        }));
      })
  )
  return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // when get asster from htpp request , html, css , jss, image (asset)
  //define the url that want to be cleared in online mode
  var url = 'https://pwacourse-mezeltos.firebaseio.com/post';

  if (event.request.url.indexOf(url) > -1) { // if the url that want to exclude from cache in online match with current request
  // get from network
  event.respondWith(
    caches.open(CACHE_DYNAMIC)
      .then(function(cache){
        return fetch(event.request)
          .then(function (res) {
            // trimCache(CACHE_DYNAMIC, 10);
            // Store the dynamic data (JSON) to IDB
            var clonedRes = res.clone();
            clearAllData('posts') // call the function clear IDB before we put to idb
              .then(function(){
                return clonedRes.json();
              })
              .then(function(data){
                for (var key in data) {
                  writeData('posts', data[key]); // call the function at utility.js
                }
              });
            return res;
          });
      })
  );
} else if(isInArray(event.request.url, STATIC_FILES)) { // check if request url match with static file list
    // cache only
    event.respondWith(
     caches.match(event.request)
   );
  } else {
    // get from cache anything not to be cleared even network is on
    event.respondWith(
      caches.match(event.request) // retrive assest in cache storage if match
        .then(function(response) {
          if (response) {
            return response;
          } else {
            return fetch(event.request)
              .then(function(res) {
                return caches.open(CACHE_DYNAMIC) // make new store cache with name dynamic
                  .then(function(cache){
                    // trimCache(CACHE_DYNAMIC, 10);
                    cache.put(event.request.url, res.clone()) // put the request http to cache storage dynamic string response (caching everthing we got request)
                    return res; // must be return if respon to give back original reques
                  })
              })
              .catch(function(err){
                // to clear error in sw console
                // return fallvack to offline page
                return caches.open(CACHE_STATIC) // open cache store static to get offline.html
                  .then(function(cache){
                    // (specifiec url want to replace with offline if cache not found)
                    // if (event.request.url.indexOf('/help')) {
                    //   return cache.match('/offline.html');
                    // }

                    // show offline if request url html also
                    if (event.request.headers.get('accept').includes('text/html')) {
                        return cache.match('/offline.html');
                    }
                    //return cache.match('/offline.html'); // return offline.html page if user not yet cache the page in offline mode (in all page that not can be reach)
                  })
              });
          }
        })
    );
  }
});

self.addEventListener('sync', function(event) {
  console.log('[Service Worker] Background syncing', event);
  if (event.tag === 'sync-new-posts') { // check if in sync manager has tag register sync-new-post
    console.log('[Service Worker] Syncing new Posts');
    event.waitUntil( // wait until this inide function finished
      readAllData('sync-posts') // get data wanna to post in indexedDB
        .then(function(data) {
          for (var dt of data) { // array must be in loop
            fetch('https://us-central1-pwacourse-mezeltos.cloudfunctions.net/storePostData', { // trigger fetch event to send data via wfetch post
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                id: dt.id,
                title: dt.title,
                location: dt.location,
                image: 'https://firebasestorage.googleapis.com/v0/b/pwacourse-mezeltos.appspot.com/o/sf-boat.jpg?alt=media&token=298bb7f5-a072-4f63-8d38-f24ed2fff20c'
              })
            })
              .then(function(res) {
                console.log('Sent data', res);
                if (res.ok) { // if the send was successfuly clear the sync-post indexed db
                  res.json()
                    .then(function(resData){
                      deleteItem('sync-posts', resData.id); // Isn't working correctly!
                    });
                }
              })
              .catch(function(err) {
                console.log('Error while sending data', err);
              });
          }

        })
    );
  }
});

self.addEventListener('notificationclick', function(event){
  var notification = event.notification;
  var action = event.action;

  console.log(notification);

  if (action === 'confirm') {
    console.log('COnfirm was choosen');
    notification.close();
  } else {
    console.log(action);
    event.waitUntil(
      clients.matchAll()
        .then(function(clis){
          var client = clis.find(function(c) {
            return c.visibilityState === 'visible';
          });

          if (client !== undefined) {
            client.navigate(notification.data.url);
            client.focus();
          } else {
            clients.openWindow(notification.data.url);
          }
          notification.close();
        })
    )
  }
});


self.addEventListener('notificationclose', function(event){
  console.log('Notification was close', event);
});


self.addEventListener('push', function(event) {
  console.log('Push Notification Received', event);

  var data = {title:'New!', content: 'Something new happened!'}; // for dummy

  if (event.data) { //if get data from server push
    data = JSON.parse(event.data.text());
  }

  var options = {
    body: data.content,
    icon: '/src/images/icons/app-icon-96x96.png',
    badge: '/src/images/icons/app-icon-96x96.png',
    data: {
      url: data.openUrl
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});




// helper function to check string in array keyList
function isInArray(string, array) {
  var cachePath;
  if (string.indexOf(self.origin) === 0) { // request targets domain where we serve the page from (i.e. NOT a CDN)
    console.log('matched ', string);
    cachePath = string.substring(self.origin.length); // take the part of the URL AFTER the domain (e.g. after localhost:8080)
  } else {
    cachePath = string; // store the full request (for CDNs)
  }
  return array.indexOf(cachePath) > -1;
}

// helper limit number of storage
// function trimCache(cacheName, maxItems) {
//   caches.open(cacheName)
//     .then(function(cache){
//       return cache.keys()
//         .then(function(keys) {
//           if (keys.length > maxItems) {
//             cache.delete(keys[0])
//               .then(trimCache(cacheName, maxItems));
//           }
//         })
//     })
// }


// Unregister / deleted service Worker
// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.getRegistrations()
//   .then(function(registrations){
//     for (var i = 0; i < registrations.length; i++) {
//       registrations[i].unregister();
//     }
//   });
// }

// old strategy
// self.addEventListener('fetch', function(event) {
//   // when get asster from htpp request , html, css , jss, image (asset)
//   // console.log('[Service Worker] Fetching ...' ,  event);
//   event.respondWith(
//     caches.match(event.request) // retrive assest in cache storage if match
//       .then(function(response) {
//         if (response) {
//           return response;
//         } else {
//           return fetch(event.request)
//             .then(function(res) {
//               return caches.open(CACHE_DYNAMIC) // make new store cache with name dynamic
//                 .then(function(cache){
//                   cache.put(event.request.url, res.clone()) // put the request http to cache storage dynamic string response (caching everthing we got request)
//                   return res; // must be return if respon to give back original reques
//                 })
//             })
//             .catch(function(err){
//               // to clear error in sw console
//               // return fallvack to offline page
//               return caches.open(CACHE_STATIC) // open cache store static to get offline.html
//                 .then(function(cache){
//                   return cache.match('/offline.html'); // return offline.html page if user not yet cache the page in offline mode
//                 })
//             });
//         }
//       })
//   ); // response
// });
