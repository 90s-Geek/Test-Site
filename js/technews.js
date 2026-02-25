/**
 * technews.js
 * Fetches tech news using a cascade of strategies:
 *
 *   1. RSS feeds via allorigins.win (CORS proxy, free, no key)
 *      -> parses the raw XML client-side
 *   2. RSS feeds via corsproxy.io as a secondary fallback proxy
 *   3. Hacker News top stories via the official Firebase REST API
 *      (always works - free, no key, CORS-enabled by Google)
 *
 * Sources:
 *   The Verge    : https://www.theverge.com/rss/index.xml
 *   Ars Technica : https://feeds.arstechnica.com/arstechnica/index
 *   Wired        : https://www.wired.com/feed/rss
 *   Hacker News  : https://hacker-news.firebaseio.com (direct API)
 */

(function () {
    'use strict';

    var ITEMS_PER_FEED = 8;

    /* CORS proxy templates - %URL% replaced with encoded feed URL */
    var PROXIES = [
        'https://api.allorigins.win/get?url=%URL%',
        'https://corsproxy.io/?%URL%'
    ];

    var FEEDS = [
        {
            id:         'verge',
            label:      'The Verge',
            badgeClass: 'badge-verge',
            url:        'https://www.theverge.com/rss/index.xml',
            container:  'verge-container'
        },
        {
            id:         'ars',
            label:      'Ars Technica',
            badgeClass: 'badge-ars',
            url:        'https://feeds.arstechnica.com/arstechnica/index',
            container:  'ars-container'
        },
        {
            id:         'wired',
            label:      'Wired',
            badgeClass: 'badge-wired',
            url:        'https://www.wired.com/feed/rss',
            container:  'wired-container'
        }
    ];

    /* ---- XML Parsing -------------------------------------------------- */

    function parseXML(xmlStr) {
        var parser = new DOMParser();
        var doc    = parser.parseFromString(xmlStr, 'application/xml');

        if (doc.querySelector('parsererror')) {
            throw new Error('XML parse error');
        }

        var nodes = Array.from(doc.querySelectorAll('item, entry'));

        return nodes.map(function (node) {
            var titleEl = node.querySelector('title');
            var title   = titleEl ? (titleEl.textContent || '').trim() : 'Untitled';

            var linkEl = node.querySelector('link');
            var link   = '';
            if (linkEl) {
                link = linkEl.getAttribute('href') || linkEl.textContent || '';
                link = link.trim();
            }

            var dateEl  = node.querySelector('pubDate, published, updated');
            var pubDate = dateEl ? dateEl.textContent.trim() : '';

            return { title: title, link: link, pubDate: pubDate };
        });
    }

    /* ---- CORS Proxy Fetching ------------------------------------------ */

    function fetchViaProxy(proxyTemplate, feedUrl) {
        var url = proxyTemplate.replace('%URL%', encodeURIComponent(feedUrl));
        return fetch(url, { headers: { 'Accept': 'application/json, text/plain, */*' } })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                var ct = res.headers.get('content-type') || '';
                if (ct.indexOf('application/json') !== -1 || ct.indexOf('text/javascript') !== -1) {
                    return res.json().then(function (json) {
                        if (json && typeof json.contents === 'string') return json.contents;
                        throw new Error('Unexpected JSON shape from proxy');
                    });
                }
                return res.text();
            });
    }

    function fetchFeedWithFallback(feedUrl) {
        var chain = Promise.reject(new Error('Starting proxy chain'));

        PROXIES.forEach(function (proxy) {
            chain = chain.catch(function () {
                return fetchViaProxy(proxy, feedUrl).then(parseXML);
            });
        });

        return chain;
    }

    /* ---- Hacker News Firebase API (no key, always CORS-ok) ------------ */

    function fetchHackerNews() {
        return fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
            .then(function (res) {
                if (!res.ok) throw new Error('HN list HTTP ' + res.status);
                return res.json();
            })
            .then(function (ids) {
                var topIds = ids.slice(0, ITEMS_PER_FEED);
                return Promise.all(topIds.map(function (id) {
                    return fetch('https://hacker-news.firebaseio.com/v0/item/' + id + '.json')
                        .then(function (r) { return r.json(); })
                        .then(function (story) {
                            if (!story) return null;
                            return {
                                title:   story.title || 'Untitled',
                                link:    story.url   || ('https://news.ycombinator.com/item?id=' + story.id),
                                pubDate: story.time  ? new Date(story.time * 1000).toISOString() : ''
                            };
                        })
                        .catch(function () { return null; });
                }));
            })
            .then(function (stories) { return stories.filter(Boolean); });
    }

    /* ---- Rendering ---------------------------------------------------- */

    function fmtDate(str) {
        if (!str) return '';
        var d = new Date(str);
        if (isNaN(d)) return str;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function renderItems(container, items, label, badgeClass) {
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="text-muted">No articles found for this source.</p>';
            return;
        }

        var grid = document.createElement('div');
        grid.className = 'news-grid';

        items.slice(0, ITEMS_PER_FEED).forEach(function (item) {
            var card  = document.createElement('article');
            card.className = 'news-card';

            var badge = document.createElement('span');
            badge.className = 'source-badge ' + badgeClass;
            badge.textContent = label;

            var h3 = document.createElement('h3');
            var a  = document.createElement('a');
            a.href = item.link || '#';
            a.target = '_blank';
            a.rel    = 'noopener noreferrer';
            a.textContent = item.title;
            h3.appendChild(a);

            var meta = document.createElement('p');
            meta.className = 'news-meta';
            meta.textContent = fmtDate(item.pubDate);

            card.appendChild(badge);
            card.appendChild(h3);
            card.appendChild(meta);
            grid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(grid);
    }

    function renderError(container, msg) {
        container.innerHTML =
            '<div class="news-error">' +
            '<strong>Could not load feed.</strong> ' + msg +
            '</div>';
    }

    /* ---- Orchestration ------------------------------------------------- */

    function loadFeed(feed) {
        var container = document.getElementById(feed.container);

        return fetchFeedWithFallback(feed.url)
            .then(function (items) {
                renderItems(container, items, feed.label, feed.badgeClass);
                return items.slice(0, ITEMS_PER_FEED).map(function (item) {
                    return Object.assign({}, item, { _feed: feed });
                });
            })
            .catch(function (err) {
                renderError(container, 'Unable to reach this feed. (' + err.message + ')');
                return [];
            });
    }

    function loadHackerNews() {
        var container    = document.getElementById('hn-container');
        var hnFeedMeta   = { label: 'Hacker News', badgeClass: 'badge-hn' };

        return fetchHackerNews()
            .then(function (items) {
                renderItems(container, items, hnFeedMeta.label, hnFeedMeta.badgeClass);
                return items.map(function (item) {
                    return Object.assign({}, item, { _feed: hnFeedMeta });
                });
            })
            .catch(function (err) {
                renderError(container, 'Unable to reach Hacker News. (' + err.message + ')');
                return [];
            });
    }

    function buildAllTab(allItems) {
        var container = document.getElementById('all-news-container');

        allItems.sort(function (a, b) {
            return new Date(b.pubDate) - new Date(a.pubDate);
        });

        if (allItems.length === 0) {
            renderError(container, 'Unable to load any feeds. Please try refreshing.');
            return;
        }

        var grid = document.createElement('div');
        grid.className = 'news-grid';

        allItems.forEach(function (item) {
            var feed  = item._feed;
            var card  = document.createElement('article');
            card.className = 'news-card';

            var badge = document.createElement('span');
            badge.className = 'source-badge ' + (feed.badgeClass || 'badge-default');
            badge.textContent = feed.label;

            var h3 = document.createElement('h3');
            var a  = document.createElement('a');
            a.href = item.link || '#';
            a.target = '_blank';
            a.rel    = 'noopener noreferrer';
            a.textContent = item.title;
            h3.appendChild(a);

            var meta = document.createElement('p');
            meta.className = 'news-meta';
            meta.textContent = fmtDate(item.pubDate);

            card.appendChild(badge);
            card.appendChild(h3);
            card.appendChild(meta);
            grid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(grid);
    }

    /* ---- Entry Point --------------------------------------------------- */

    document.addEventListener('DOMContentLoaded', function () {
        var rssPromises = FEEDS.map(loadFeed);
        var hnPromise   = loadHackerNews();

        Promise.all(rssPromises.concat([hnPromise]))
            .then(function (results) {
                var allItems = results.reduce(function (acc, items) {
                    return acc.concat(items);
                }, []);
                buildAllTab(allItems);
            });
    });

}());
