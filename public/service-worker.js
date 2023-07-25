self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open('page-cache').then((cache) => {
			return cache.addAll([
				'/',
				'/styles.css',
				'/main.js',
			]);
		})
	);
});

// Fetch event to respond with cached page HTML
self.addEventListener('fetch', (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			return response || fetch(event.request);
	  	})
	);
});
