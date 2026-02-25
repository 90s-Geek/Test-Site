/**
 * technews.js
 * Fetches RSS feeds from popular tech news sources via the rss2json.com public API
 * and renders them as Bootstrap-compatible card grids inside the tab panes.
 *
 * Sources:
 *   - The Verge      : https://www.theverge.com/rss/index.xml
 *   - Ars Technica   : https://feeds.arstechnica.com/arstechnica/index
 *   - Wired          : https://www.wired.com/feed/rss
 *   - Hacker News    : https://hnrss.org/frontpage
 */

(function () {
    'use strict';

    // ── Configuration ──────────────────────────────────────────────────────
    const API_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';
    const ITEMS_PER_FEED = 8; // articles pulled per source

    const FEEDS = [
        {
            id: 'verge',
            label: 'The Verge',
            badgeClass: 'badge-verge',
            url: 'https://www.theverge.com/rss/index.xml',
            container: 'verge-container'
        },
        {
            id: 'ars',
            label: 'Ars Technica',
            badgeClass: 'badge-ars',
            url: 'https://feeds.arstechnica.com/arstechnica/index',
            container: 'ars-container'
        },
        {
            id: 'wired',
            label: 'Wired',
            badgeClass: 'badge-wired',
            url: 'https://www.wired.com/feed/rss',
            container: 'wired-container'
        },
        {
            id: 'hn',
            label: 'Hacker News',
            badgeClass: 'badge-hn',
            url: 'https://hnrss.org/frontpage',
            container: 'hn-container'
        }
    ];

    // ── Helpers ────────────────────────────────────────────────────────────

    /**
     * Format an ISO/RFC date string into a readable short date.
     * @param {string} dateStr
     * @returns {string}
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    /**
     * Render an array of feed items into a target container element.
     * @param {HTMLElement} container
     * @param {Array}       items
     * @param {string}      label
     * @param {string}      badgeClass
     */
    function renderItems(container, items, label, badgeClass) {
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="text-muted">No articles found.</p>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'news-grid';

        items.slice(0, ITEMS_PER_FEED).forEach(function (item) {
            const card = document.createElement('article');
            card.className = 'news-card';

            const badge = document.createElement('span');
            badge.className = 'source-badge ' + badgeClass;
            badge.textContent = label;

            const heading = document.createElement('h3');
            const link = document.createElement('a');
            link.href = item.link || '#';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = item.title || 'Untitled';
            heading.appendChild(link);

            const meta = document.createElement('p');
            meta.className = 'news-meta';
            meta.textContent = formatDate(item.pubDate);

            card.appendChild(badge);
            card.appendChild(heading);
            card.appendChild(meta);
            grid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(grid);
    }

    /**
     * Show an error message inside a container.
     * @param {HTMLElement} container
     * @param {string}      message
     */
    function renderError(container, message) {
        container.innerHTML =
            '<div class="news-error">' +
            '<strong>Could not load feed.</strong> ' + message +
            ' Please try refreshing or visit the source directly.' +
            '</div>';
    }

    /**
     * Fetch a single RSS feed and render it.
     * @param {Object} feed  — an entry from FEEDS[]
     * @returns {Promise<Array>}  resolved items (for "All" aggregation)
     */
    function fetchFeed(feed) {
        const url = API_BASE + encodeURIComponent(feed.url) + '&count=' + ITEMS_PER_FEED;
        const container = document.getElementById(feed.container);

        return fetch(url)
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (data.status !== 'ok') throw new Error(data.message || 'Feed error');
                renderItems(container, data.items, feed.label, feed.badgeClass);
                // Attach source metadata for "All" tab aggregation
                return (data.items || []).slice(0, ITEMS_PER_FEED).map(function (item) {
                    return Object.assign({}, item, { _feed: feed });
                });
            })
            .catch(function (err) {
                renderError(container, err.message);
                return [];
            });
    }

    /**
     * Build the "All Sources" tab by merging and sorting all feed items by date.
     * @param {Array} allItems
     */
    function buildAllTab(allItems) {
        const container = document.getElementById('all-news-container');

        // Sort newest-first
        allItems.sort(function (a, b) {
            return new Date(b.pubDate) - new Date(a.pubDate);
        });

        if (allItems.length === 0) {
            renderError(container, 'Unable to load any feeds at this time.');
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'news-grid';

        allItems.forEach(function (item) {
            const feed = item._feed;

            const card = document.createElement('article');
            card.className = 'news-card';

            const badge = document.createElement('span');
            badge.className = 'source-badge ' + feed.badgeClass;
            badge.textContent = feed.label;

            const heading = document.createElement('h3');
            const link = document.createElement('a');
            link.href = item.link || '#';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = item.title || 'Untitled';
            heading.appendChild(link);

            const meta = document.createElement('p');
            meta.className = 'news-meta';
            meta.textContent = formatDate(item.pubDate);

            card.appendChild(badge);
            card.appendChild(heading);
            card.appendChild(meta);
            grid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(grid);
    }

    // ── Init ───────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        const feedPromises = FEEDS.map(fetchFeed);

        Promise.all(feedPromises).then(function (results) {
            // Flatten all returned item arrays
            const allItems = results.reduce(function (acc, items) {
                return acc.concat(items);
            }, []);
            buildAllTab(allItems);
        });
    });

}());
