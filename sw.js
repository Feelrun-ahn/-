const CACHE_NAME = 'bijeong-map-v23';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// 절대 가로채면 안 되는 것들: Firebase 실시간 데이터, 실시간 검색(Nominatim), GPS 등
function isLiveData(url) {
  return url.includes('admin.html') ||
         url.includes('firebaseio.com') ||
         url.includes('firebasedatabase.app') ||
         url.includes('googleapis.com') ||
         url.includes('nominatim.openstreetmap.org') ||
         url.includes('gstatic.com/firebasejs');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (isLiveData(req.url)) return; // 네트워크로 그대로 흘려보냄 (실시간성 보장)

  // HTML 문서: 네트워크 우선 (항상 최신 버전), 실패하면 캐시로 대체
  // cache:'no-store'로 브라우저 HTTP 캐시 자체를 건너뛰어야 진짜 최신 파일을 받아옴
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 그 외 정적 자원(지도 타일, 아이콘, 라이브러리): 캐시 우선, 없으면 네트워크
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
