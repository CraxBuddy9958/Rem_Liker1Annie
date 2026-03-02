// userscripts/step1_V3.js - Step 1: Fetch Link from Firebase & Redirect
(function() {
    'use strict';

    // Prevent multiple executions
    if (window.__step1Running) {
        console.log('[Step1] Already running, skipping');
        return;
    }
    window.__step1Running = true;

    console.log('[Step1] 🚀 Starting fetch & redirect process...');

    // ============================================
    // CONFIGURATION
    // ============================================
    const DB_URL = "https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json";
    const REDIRECT_DELAY = 3000;  // 3 seconds before redirect

    // Store used links in sessionStorage to avoid repeats
    function getUsedLinks() {
        try {
            const stored = sessionStorage.getItem('__usedLinks');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    function saveUsedLink(link) {
        try {
            const used = getUsedLinks();
            used.push(link);
            sessionStorage.setItem('__usedLinks', JSON.stringify(used));
        } catch (e) {
            console.error('[Step1] Error saving used link:', e);
        }
    }

    // ============================================
    // FETCH LINK FROM FIREBASE
    // ============================================
    async function fetchAndRedirect() {
        try {
            console.log('[Step1] 📡 Fetching links from Firebase...');

            const response = await fetch(DB_URL, {
                cache: 'no-cache',
                headers: {
                    'Accept': 'text/plain,*/*'
                }
            });

            if (!response.ok) {
                console.error('[Step1] ❌ Failed to fetch DB. Status:', response.status);
                return;
            }

            const data = await response.text();
            console.log('[Step1] 📥 Raw data received');

            // Parse data - handle both string and JSON formats
            let links = [];
            try {
                const parsed = JSON.parse(data);
                if (typeof parsed === 'string') {
                    links = parsed.trim().split(/\s+/);
                } else if (Array.isArray(parsed)) {
                    links = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    // Handle object format {link1: true, link2: true}
                    links = Object.keys(parsed).map(key => {
                        // If value is the link itself
                        if (typeof parsed[key] === 'string') {
                            return parsed[key];
                        }
                        // If key is the link
                        return key;
                    }).filter(link => link.startsWith('http'));
                }
            } catch (e) {
                // If not JSON, treat as whitespace-separated string
                links = data.trim().split(/\s+/);
            }

            if (!links || links.length === 0) {
                console.log('[Step1] ⚠️ No links found in DB');
                return;
            }

            console.log(`[Step1] 📋 Found ${links.length} total links`);

            // Get used links
            const usedLinks = getUsedLinks();
            console.log(`[Step1] 📝 ${usedLinks.length} links already used this session`);

            // Find first unused link
            let targetLink = null;
            for (const link of links) {
                if (!link || usedLinks.includes(link)) {
                    continue;
                }
                targetLink = link;
                break;
            }

            if (!targetLink) {
                console.log('[Step1] ⚠️ No unused links available - all links processed');
                console.log('[Step1] ℹ️ Clearing used links history for fresh start...');
                sessionStorage.removeItem('__usedLinks');
                return;
            }

            console.log(`[Step1] ✅ Found target link: ${targetLink}`);

            // Mark as used locally
            saveUsedLink(targetLink);

            // ============================================
            // DELETE LINK FROM FIREBASE
            // ============================================
            try {
                console.log('[Step1] 🗑️ Removing link from Firebase...');
                
                const deleteResponse = await fetch(DB_URL);
                if (deleteResponse.ok) {
                    const dbData = await deleteResponse.json();
                    
                    if (dbData && typeof dbData === 'object' && !Array.isArray(dbData)) {
                        // Find and delete the specific key
                        for (const [key, value] of Object.entries(dbData)) {
                            if (value === targetLink || 
                                (typeof value === 'object' && value.url === targetLink) ||
                                (typeof value === 'string' && value.includes(targetLink))) {
                                await fetch(`https://craxlinks-bb690-default-rtdb.firebaseio.com/links/${key}.json`, {
                                    method: 'DELETE'
                                });
                                console.log(`[Step1] 🗑️ Deleted key: ${key}`);
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[Step1] ⚠️ Could not delete from Firebase:', e);
            }

            // ============================================
            // REDIRECT TO LINK
            // ============================================
            console.log(`[Step1] ⏳ Redirecting in ${REDIRECT_DELAY/1000} seconds...`);
            
            setTimeout(() => {
                console.log(`[Step1] → Redirecting to: ${targetLink}`);
                window.location.href = targetLink;
            }, REDIRECT_DELAY);

        } catch (error) {
            console.error('[Step1] 💥 Error:', error.message);
        }
    }

    // ============================================
    // START EXECUTION
    // ============================================
    setTimeout(fetchAndRedirect, 1000);

})();
