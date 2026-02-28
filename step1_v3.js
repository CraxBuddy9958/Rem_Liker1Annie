// userscripts/step1_v3.js - Step 1: Fetch Link, Remove, Redirect
(function() {
    'use strict';

    // Prevent multiple executions
    if (window.__step1Running) {
        console.log('[Step1] Already running, skipping');
        return;
    }
    window.__step1Running = true;

    const DB_URL = "https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json";

    // Only run on pages that are NOT craxpro thread pages
    if (window.location.href.includes("craxpro.to/threads/")) {
        console.log("[Step1] On thread page — Step 1 will NOT run here.");
        window.__step1Running = false;
        return;
    }

    // Also skip if we're on the post-thread page (that's for creating threads)
    if (window.location.href.includes("craxpro.to/forums/") && window.location.href.includes("post-thread")) {
        console.log("[Step1] On post-thread page — Step 1 will NOT run here.");
        window.__step1Running = false;
        return;
    }

    console.log("[Step1] Running Step-1 script…");

    // Fetch with fallback for Puppeteer context (handles CORS issues)
    async function fetchWithFallback(url, options = {}) {
        // Try regular fetch first
        try {
            const r = await fetch(url, options);
            return r;
        } catch (e) {
            console.log('[Step1] Regular fetch failed, trying __FETCH_PROXY');
        }

        // Fallback to Puppeteer's exposed function
        if (typeof window.__FETCH_PROXY === 'function') {
            try {
                const text = await window.__FETCH_PROXY(url);
                
                // Handle PUT requests
                if (options.method === 'PUT') {
                    return {
                        ok: true,
                        json: async () => JSON.parse(text)
                    };
                }
                
                return {
                    ok: true,
                    text: async () => text,
                    json: async () => JSON.parse(text)
                };
            } catch (e) {
                console.error('[Step1] __FETCH_PROXY failed:', e);
            }
        }

        throw new Error('No fetch method available');
    }

    async function processLink() {
        try {
            console.log("[Step1] Fetching link list from Firebase…");

            let response = await fetchWithFallback(DB_URL);
            let textData = await response.json();

            if (!textData || textData.trim() === "") {
                console.log("[Step1] ❌ No links found in database.");
                return;
            }

            console.log("[Step1] Raw data:", textData);

            // Split by spaces (DB uses space-separated links)
            let links = textData.trim().split(/\s+/);

            if (links.length === 0) {
                console.log("[Step1] ❌ No links parsed.");
                return;
            }

            let firstLink = links[0];
            console.log("[Step1] First link:", firstLink);

            // Validate the link
            if (!firstLink.startsWith('http')) {
                console.log("[Step1] ❌ Invalid link format:", firstLink);
                return;
            }

            // Remove ONLY the first link
            links.shift();
            let updatedText = links.join(" ");

            console.log("[Step1] Updating Firebase… removing first link…");

            await fetchWithFallback(DB_URL, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedText)
            });

            console.log("[Step1] ✔ Link removed from Firebase.");
            console.log("[Step1] ✔ Remaining links count:", links.length);

            console.log("[Step1] Redirecting in 3 seconds…");
            setTimeout(() => {
                console.log("[Step1] Redirecting now →", firstLink);
                window.location.href = firstLink;
            }, 3000);

        } catch (err) {
            console.error("[Step1] ERROR:", err);
            // Retry after 5 seconds on error
            setTimeout(() => {
                window.__step1Running = false;
            }, 5000);
        }
    }

    // Run Step-1 with small delay for page to settle
    setTimeout(processLink, 1000);

})();
