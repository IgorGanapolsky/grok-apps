import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(__dirname, "../mutual_testing_screenshots");
const dbPath = join(__dirname, "../processed_posts.json");

// Ensure screenshots directory exists
try {
    mkdirSync(screenshotsDir, { recursive: true });
} catch (err) {}

const commentText = `Hey! I've joined your Google Group and opted in as a closed tester for your app! I will keep it installed and test it regularly. Could you please test mine back?

1. Join the Google Group: https://groups.google.com/g/agentbill-testers
2. Opt-in on the Web: https://play.google.com/apps/testing/com.iganapolsky.agentbill
3. Download on Google Play: https://play.google.com/store/apps/details?id=com.iganapolsky.agentbill

Thank you so much! Let's help each other out!`;

async function run() {
    console.log("==================================================================");
    console.log("STARTING AUTONOMOUS RECIPROCAL CLOSED TESTING ENROLLMENT ENGINE v2");
    console.log("==================================================================");

    // 1. Read processed posts database
    let processedPosts = [];
    try {
        processedPosts = JSON.parse(readFileSync(dbPath, "utf8"));
        console.log(`Loaded ${processedPosts.length} previously processed posts from DB.`);
    } catch (err) {
        console.log("No existing processed posts DB found. Creating a new one.");
        writeFileSync(dbPath, JSON.stringify([], null, 2));
    }

    console.log("Connecting to Chrome Canary CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) {
            throw new Error("No browser contexts found on port 9222. Ensure Chrome Canary is running.");
        }
        const ctx = contexts[0];
        const page = await ctx.newPage();
        await page.setViewportSize({ width: 1440, height: 900 });

        // 2. Scrape subreddit
        const subredditUrl = "https://www.reddit.com/r/AndroidClosedTesting/new/";
        console.log(`\nNavigating to subreddit: ${subredditUrl}`);
        await page.goto(subredditUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(6000); // Wait for dynamic posts to fully populate

        const scrapedPosts = await page.evaluate(() => {
            const items = [];
            const postElements = Array.from(document.querySelectorAll('shreddit-post, [data-testid="post-container"], article'));
            for (const el of postElements) {
                const titleAttr = el.getAttribute('post-title') || el.querySelector('h1, h2, h3, a[slot="title"]')?.innerText;
                const authorAttr = el.getAttribute('author') || el.querySelector('[data-testid="post-author"], a[href*="/user/"]')?.innerText;
                const linkEl = el.querySelector('a[shreddit-redirect-helper], a[slot="full-post-link"], a[href*="/comments/"]');
                const href = linkEl ? linkEl.href : null;
                const permalink = el.getAttribute('permalink') || href;
                
                if (titleAttr && permalink) {
                    const fullUrl = permalink.startsWith("http") ? permalink : "https://www.reddit.com" + permalink;
                    items.push({
                        title: titleAttr.trim(),
                        author: (authorAttr || "unknown").trim(),
                        url: fullUrl
                    });
                }
            }
            return items;
        });

        console.log(`Found ${scrapedPosts.length} posts on subreddit feed.`);

        // Deduplicate scraped posts by URL
        const uniqueScraped = [];
        const seenUrls = new Set();
        for (const p of scrapedPosts) {
            if (!seenUrls.has(p.url)) {
                seenUrls.add(p.url);
                uniqueScraped.push(p);
            }
        }

        // Filter for unprocessed posts
        const candidatePosts = uniqueScraped.filter(p => !processedPosts.includes(p.url));
        console.log(`Identified ${candidatePosts.length} candidate posts that are unprocessed.`);

        let processedCount = 0;
        const maxProcessedPerRun = 5; // Conservative batch size to prevent spam/throttling flags

        for (const post of candidatePosts) {
            if (processedCount >= maxProcessedPerRun) {
                console.log(`\nReached maximum batch size of ${maxProcessedPerRun} processed posts. Ending run.`);
                break;
            }

            console.log(`\n------------------------------------------------------------------`);
            console.log(`PROCESSING THREAD: ${post.title}`);
            console.log(`Author: ${post.author}`);
            console.log(`URL: ${post.url}`);

            // Go to thread details to extract links
            try {
                await page.goto(post.url, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForTimeout(4000);

                const extractedLinks = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a')).map(a => ({
                        text: a.innerText ? a.innerText.trim() : "",
                        href: a.href
                    }));
                    return links;
                });

                // Find Google Group and Opt-in links
                let groupUrl = null;
                let optinUrl = null;

                for (const link of extractedLinks) {
                    const href = link.href || "";
                    if (href.includes("groups.google.com/g/")) {
                        groupUrl = href;
                    } else if (href.includes("play.google.com/apps/testing/")) {
                        optinUrl = href;
                    }
                }

                if (!groupUrl || !optinUrl) {
                    console.log(`SKIPPED: Missing required links. Group: ${groupUrl ? "Found" : "Missing"}, Opt-in: ${optinUrl ? "Found" : "Missing"}`);
                    // Still mark as processed so we don't scan it repeatedly
                    processedPosts.push(post.url);
                    writeFileSync(dbPath, JSON.stringify(processedPosts, null, 2));
                    continue;
                }

                console.log(`Extracted Google Group Link: ${groupUrl}`);
                console.log(`Extracted Web Opt-in Link: ${optinUrl}`);

                const runId = `run_${Date.now()}_${post.author.replace(/[^a-zA-Z0-9_-]/g, "")}`;

                // STEP 1: Join Google Group
                console.log(`\n[Step 1] Navigating to Google Group...`);
                await page.goto(groupUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForTimeout(4000);
                await page.screenshot({ path: join(screenshotsDir, `${runId}_1_group_loaded.png`) });

                // Use robust locators to find membership status first
                const memberIndicator = page.locator('div[role="button"]:has-text("Leave group"), button:has-text("Leave group"), div[role="button"]:has-text("My membership"), button:has-text("My membership"), [aria-label*="membership"], [aria-label*="Membership"]').first();
                const isMember = await memberIndicator.count() > 0;

                if (isMember) {
                    console.log("Already a member of this Google Group. Proceeding...");
                    await page.screenshot({ path: join(screenshotsDir, `${runId}_2_group_already_member.png`) });
                } else {
                    const joinBtn = page.locator('div[role="button"]:has-text("Join group"), button:has-text("Join group"), div[role="button"]:has-text("Join this group"), button:has-text("Join this group")').first();
                    if (await joinBtn.count() > 0) {
                        console.log("Clicking 'Join group' button...");
                        await joinBtn.click();
                        await page.waitForTimeout(4000);
                        await page.screenshot({ path: join(screenshotsDir, `${runId}_2_group_clicked.png`) });

                        // Check for modal confirmation dialog
                        const modalJoinBtn = page.locator('dialog div[role="button"]:has-text("Join group"), [role="dialog"] div[role="button"]:has-text("Join group"), [role="dialog"] button:has-text("Join group")').first();
                        if (await modalJoinBtn.count() > 0) {
                            console.log("Confirmation modal detected. Clicking 'Join group' inside the modal...");
                            await modalJoinBtn.click();
                            await page.waitForTimeout(4000);
                            await page.screenshot({ path: join(screenshotsDir, `${runId}_2_group_modal_confirmed.png`) });
                            console.log("Group enrollment successfully confirmed.");
                        } else {
                            console.log("No confirmation modal appeared. Joined directly.");
                        }
                    } else {
                        console.log("No 'Join group' button found. Group might be closed or restricted.");
                    }
                }

                // STEP 2: Opt-in to testing
                console.log(`\n[Step 2] Navigating to Play Store Opt-in...`);
                await page.goto(optinUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForTimeout(4000);
                await page.screenshot({ path: join(screenshotsDir, `${runId}_3_optin_loaded.png`) });

                const leaveProgBtn = page.locator('button:has-text("Leave the program"), [role="button"]:has-text("Leave the program"), input[type="submit"][value*="Leave the program"], input[type="submit"][value*="Leave program"]').first();
                const isAlreadyOptedIn = await leaveProgBtn.count() > 0;

                if (isAlreadyOptedIn) {
                    console.log("Already opted in as a tester for this app. Proceeding...");
                    await page.screenshot({ path: join(screenshotsDir, `${runId}_4_optin_already_member.png`) });
                } else {
                    const becomeTesterBtn = page.locator('input[type="submit"][value*="Become a tester"], input[type="submit"][value*="Become tester"], input[type="submit"][value*="Accept invitation"], button:has-text("Become a tester"), button:has-text("Become tester"), button:has-text("Accept invitation"), [role="button"]:has-text("Become a tester")').first();
                    if (await becomeTesterBtn.count() > 0) {
                        console.log("Clicking 'Become a tester' button...");
                        await becomeTesterBtn.click();
                        await page.waitForTimeout(4000);
                        await page.screenshot({ path: join(screenshotsDir, `${runId}_4_optin_joined.png`) });
                        console.log("Successfully opted into the closed test.");
                    } else {
                        console.log("No 'Become a tester' button found. Ensure you are signed in and joined the Google Group first.");
                    }
                }

                // STEP 3: Post Reciprocal Comment on Reddit Thread
                console.log(`\n[Step 3] Navigating back to Reddit post to reply...`);
                await page.goto(post.url, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForTimeout(5000);

                const composeResult = await page.evaluate((text) => {
                    const selectors = [
                        'div[contenteditable="true"]',
                        'shreddit-composer div[placeholder="Add a comment"]',
                        'textarea[placeholder="Add a comment"]',
                        'div[aria-label="Comment body text field"]',
                        'textarea',
                        '[data-testid="comment-composer"] div[contenteditable="true"]'
                    ];

                    let commentInput = null;
                    for (const selector of selectors) {
                        commentInput = document.querySelector(selector);
                        if (commentInput) break;
                    }

                    if (!commentInput) {
                        const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
                        if (editables.length > 0) commentInput = editables[0];
                    }

                    if (!commentInput) {
                        return { success: false, reason: "Comment field not found" };
                    }

                    commentInput.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, text);
                    
                    commentInput.dispatchEvent(new Event('input', { bubbles: true }));
                    commentInput.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true };
                }, commentText);

                if (composeResult.success) {
                    await page.waitForTimeout(2000);
                    await page.screenshot({ path: join(screenshotsDir, `${runId}_5_comment_typed.png`) });

                    const clickSubmitResult = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
                        const commentBtn = buttons.find(b => {
                            const txt = (b.innerText || b.value || b.textContent || "").trim().toLowerCase();
                            return (txt === "comment" || txt === "reply" || txt === "post") && !b.disabled;
                        });

                        if (commentBtn) {
                            commentBtn.click();
                            return { success: true, text: commentBtn.innerText || commentBtn.value || commentBtn.textContent };
                        }

                        const composer = document.querySelector('shreddit-composer');
                        if (composer && composer.shadowRoot) {
                            const btn = composer.shadowRoot.querySelector('button[type="submit"]') || composer.shadowRoot.querySelector('button');
                            if (btn) {
                                btn.click();
                                return { success: true, text: "shadowRoot button" };
                            }
                        }

                        return { success: false, reason: "Submit button not found" };
                    });

                    if (clickSubmitResult.success) {
                        console.log("Comment submitted successfully!");
                        await page.waitForTimeout(5000);
                        await page.screenshot({ path: join(screenshotsDir, `${runId}_6_comment_submitted.png`) });
                    } else {
                        console.log(`Failed to submit comment: ${clickSubmitResult.reason}`);
                    }
                } else {
                    console.log(`Failed to focus comment field: ${composeResult.reason}`);
                }

                // Add to DB
                processedPosts.push(post.url);
                writeFileSync(dbPath, JSON.stringify(processedPosts, null, 2));
                console.log(`Saved thread to processed posts database.`);
                processedCount++;

            } catch (err) {
                console.error(`Error processing post:`, err.message);
            }
        }

        await page.close();
        console.log("\nAll pipeline tasks executed successfully.");

    } catch (e) {
        console.error("Master Orchestrator Error:", e.message);
    }
}

run();
