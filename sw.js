self.addEventListener('install', e => {
  e.waitUntil(caches.open('gym-cache-v4').then(c => c.addAll([
    './','./index.html','./app.js','./plan.json','./manifest.json'
  ])));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
