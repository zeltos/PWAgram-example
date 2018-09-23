var deferredPrompt;
var enableNotificationsButtons = document.querySelectorAll('.enable-notifications');


// check browser who user use is support service worker, mainly navigator is the declare of browser
// means if service worker available in browser
if ('serviceWorker' in navigator) {
  // if browser support, register the service serviceWorker
  navigator.serviceWorker
    .register('/sw.js') // promise function need then function async, scope just a option .register('/sw.js', {scope: '/'})
    .then(function(){
      // if the register function has done
      console.log('service worker is registered');
    });
}

var deferredPrompt;
// handling manage promp bannet add to home screen
window.addEventListener('beforeinstallprompt', function(event) {
  console.log('before install prompt banner');
  event.preventDefault(); // dont launch the prompt
  deferredPrompt = event; //  but we store to variable to manage in somewhere function
  return false; // return none
});

function displayConfirmNotification() {
  if ('serviceWorker' in navigator) {
    var options = {
      body: 'Thanks for subscribe notification!',
      icon: '/src/images/icons/app-icon-96x96.png',
      image: '/src/images/sf-boat.jpg',
      dir: 'ltr', // direction text left to right
      lang: 'en-US', // BCP 47
      vibrate: [100, 50, 200],
      badge:'/src/images/icons/app-icon-96x96.png',
      tag: 'confirm-notification', // group notif not stack
      renotify: true,
      actions:[
        {action: 'confirm', title: 'Okay',icon: '/src/images/icons/app-icon-96x96.png' },
        {action: 'cancel', title: 'Cancel',icon: '/src/images/icons/app-icon-96x96.png' }
      ]
    };

    navigator.serviceWorker.ready
      .then(function(swreg){
        swreg.showNotification('Successfuly subscribe!', options);
      });
  }
  // Notification for normal javascript
  // new Notification('Successfuly subscribe!', options);
}


function configurePushSub() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  var reg;
  navigator.serviceWorker.ready
    .then(function(swreg) {
      reg = swreg;
      return swreg.pushManager.getSubscription();
    })
    .then(function(sub) {
      if (sub === null) {
        // Create a new subscription
        var vapidPublicKey = 'BH6ZQK72uu8xexHWsAvWB1dA0AxQoxaRuJiWzn-7tGdCzC3x9xQknwI9aOPgpLzJ-g4vL3br4iaIjaOTB5IejBo';
        var convertedVapidPublicKey = urlBase64ToUint8Array(vapidPublicKey);
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidPublicKey
        });
      } else {
        // We have a subscription
        return sub;
      }
    })
    .then(function(newSub) {
      return fetch('https://pwacourse-mezeltos.firebaseio.com/subscriptions.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(newSub)
      })
    })
    .then(function(res) {
      if (res.ok) {
        displayConfirmNotification();
      }
    })
    .catch(function(err) {
      console.log(err);
    });
}

function askForNotificationPermission() {
  Notification.requestPermission(function(result) {
    console.log('User Choice', result);
    if (result !== 'granted') {
      console.log('No notification permission granted!');
    } else {
      configurePushSub();
    }
  });
}

if ('Notification' in window && 'serviceWorker' in navigator) {
  for (var i = 0; i < enableNotificationsButtons.length; i++) {
    enableNotificationsButtons[i].style.display = 'inline-block';
    enableNotificationsButtons[i].addEventListener('click', askForNotificationPermission);
  }
}
