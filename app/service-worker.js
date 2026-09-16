const CACHE='faisca-app-v1.4.0';
const CORE=[
  './','./index.html','./style.css','./manifest.webmanifest','./web-bridge.js',
  './curriculum.js','./core.js','./analyzer.js','./editor.js','./sync.js',
  './account.js','./account-ui.js','./classrooms.js','./classrooms-ui.js','./app.js',
  './cloud-config.json','./art/marca.svg','./art/capa.png','./art/Manrope.ttf'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('faisca-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
  })));
});
