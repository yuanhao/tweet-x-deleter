/**
 * X Content Deletion Automation Script
 *
 * This script provides functions for automating deletion of X (Twitter) content
 * using browser automation via Playwright MCP.
 *
 * Usage: This is a reference implementation showing the automation pattern.
 * In practice, Claude Code will use MCP tools directly, but this serves as
 * a blueprint and can also be adapted for other automation frameworks.
 */

/**
 * Configuration
 */
const CONFIG = {
  delays: {
    betweenClicks: 150,      // ms between menu clicks (optimized from 300)
    afterDeletion: 200,      // ms after confirming deletion (optimized from 800)
    scrollLoad: 600,         // ms to wait for content to load after scroll (optimized from 2000)
    rateLimitSafe: 200       // ms between each tweet deletion (optimized from 500)
  },
  selectors: {
    tweet: 'article[data-testid="tweet"]',
    moreButton: '[data-testid="caret"]',
    deleteButton: '[role="menuitem"]',  // Contains "Delete" text
    confirmButton: '[data-testid="confirmationSheetConfirm"]',
    unretweetButton: '[data-testid="unretweet"]',
    unretweetConfirm: '[data-testid="unretweetConfirm"]'
  },
  scrollAmount: 500,         // Scroll more to load more tweets at once
  logInterval: 50            // Log progress every N deletions (less spam for large accounts)
};

/**
 * Content types and their URLs
 */
const CONTENT_TYPES = {
  POSTS: '',                    // /username
  REPLIES: '/with_replies',     // /username/with_replies
  REPOSTS: ''                   // Handled differently - same as posts but detect repost icon
};

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Navigate to a specific content type tab
 * @param {string} username - X username (without @)
 * @param {string} contentType - One of: 'POSTS', 'REPLIES', 'REPOSTS'
 */
function getProfileUrl(username, contentType) {
  const baseUrl = `https://x.com/${username}`;
  const suffix = CONTENT_TYPES[contentType] || '';
  return baseUrl + suffix;
}

/**
 * Parse snapshot to find tweet elements
 * This is a simplified version - actual implementation would parse
 * the Playwright MCP snapshot structure
 * @param {object} snapshot - Snapshot from mcp__playwright__browser_snapshot
 * @returns {array} Array of tweet element refs
 */
function findTweetElements(snapshot) {
  // In actual implementation, parse snapshot content to find elements
  // that represent tweets and extract their refs
  // Playwright snapshots use 'ref' attributes instead of 'uid'

  // Example structure (simplified):
  const tweets = [];
  const content = snapshot.content || snapshot || '';
  const lines = typeof content === 'string' ? content.split('\n') : [];

  for (const line of lines) {
    // Look for tweet containers in snapshot (article elements)
    // Playwright uses ref="X" format where X is the element reference
    if (line.includes('article') && line.match(/ref="([^"]+)"/)) {
      const match = line.match(/ref="([^"]+)"/);
      if (match) {
        tweets.push({
          ref: match[1],
          text: line
        });
      }
    }
  }

  return tweets;
}

/**
 * Find the "More" button ref within a tweet element
 * @param {object} snapshot - Current page snapshot
 * @param {object} tweet - Tweet object with ref
 * @returns {string|null} ref of more button, or null if not found
 */
function findMoreButtonInTweet(snapshot, tweet) {
  // Parse snapshot to find caret/more button within the tweet's ref context
  // This would need to parse the hierarchical structure of the snapshot

  const content = snapshot.content || snapshot || '';
  const lines = typeof content === 'string' ? content.split('\n') : [];
  let inTweetContext = false;

  for (const line of lines) {
    if (line.includes(tweet.ref)) {
      inTweetContext = true;
    }

    if (inTweetContext && (line.includes('More') || line.includes('caret'))) {
      const match = line.match(/ref="([^"]+)"/);
      if (match) {
        return match[1];
      }
    }

    // Exit tweet context when we hit next tweet or end of section
    if (inTweetContext && line.includes('article') && !line.includes(tweet.ref)) {
      break;
    }
  }

  return null;
}

/**
 * Find delete button in menu
 * @param {object} snapshot - Snapshot after opening menu
 * @returns {string|null} ref of delete button
 */
function findDeleteButton(snapshot) {
  const content = snapshot.content || snapshot || '';
  const lines = typeof content === 'string' ? content.split('\n') : [];

  for (const line of lines) {
    if ((line.includes('Delete') || line.includes('delete')) &&
        line.match(/ref="([^"]+)"/)) {
      const match = line.match(/ref="([^"]+)"/);
      if (match) {
        return match[1];
      }
    }
  }

  return null;
}

/**
 * Check if a tweet is a repost
 * @param {object} tweet - Tweet element data
 * @returns {boolean}
 */
function isRepost(tweet) {
  // Check if tweet contains repost/retweet indicator
  return tweet.text && (
    tweet.text.includes('Reposted') ||
    tweet.text.includes('retweeted') ||
    tweet.text.includes('repost')
  );
}

/**
 * Main deletion function using Playwright MCP
 *
 * This is pseudocode showing the pattern. In actual use, Claude Code
 * will call the MCP tools directly.
 *
 * @param {object} mcpTools - Playwright MCP tool functions
 * @param {string} username - X username
 * @param {string} contentType - Type of content to delete
 * @returns {number} Number of items deleted
 */
async function deleteContent(mcpTools, username, contentType) {
  const {
    browser_navigate,
    browser_snapshot,
    browser_click,
    browser_handle_dialog,
    browser_evaluate
  } = mcpTools;

  let deletedCount = 0;
  let hasMore = true;
  let consecutiveEmptyAttempts = 0;
  const MAX_EMPTY_ATTEMPTS = 3;

  // Navigate to the correct profile tab
  const url = getProfileUrl(username, contentType);
  await browser_navigate({ url });
  await delay(CONFIG.delays.scrollLoad);

  console.log(`Starting deletion of ${contentType} for @${username}`);
  console.log(`URL: ${url}`);

  while (hasMore) {
    // Take snapshot to find tweets
    const snapshot = await browser_snapshot();
    const tweets = findTweetElements(snapshot);

    if (tweets.length === 0) {
      consecutiveEmptyAttempts++;

      if (consecutiveEmptyAttempts >= MAX_EMPTY_ATTEMPTS) {
        console.log(`No more ${contentType} found after ${MAX_EMPTY_ATTEMPTS} attempts`);
        hasMore = false;
        break;
      }

      // Try scrolling to load more
      await browser_evaluate({
        function: '() => { window.scrollBy(0, 300); }'
      });
      await delay(CONFIG.delays.scrollLoad);
      continue;
    }

    // Reset empty attempt counter
    consecutiveEmptyAttempts = 0;

    // Process first tweet (others will load after deletion)
    const tweet = tweets[0];

    try {
      // Handle reposts differently
      if (isRepost(tweet)) {
        // For reposts, look for unretweet button
        const unretweetRef = findUnretweetButton(snapshot, tweet);
        if (unretweetRef) {
          await browser_click({ element: 'Unretweet button', ref: unretweetRef });
          await delay(CONFIG.delays.betweenClicks);

          // Confirm unretweet
          const confirmSnapshot = await browser_snapshot();
          const confirmRef = findUnretweetConfirmButton(confirmSnapshot);
          if (confirmRef) {
            await browser_click({ element: 'Confirm unretweet', ref: confirmRef });
            await delay(CONFIG.delays.afterDeletion);
            deletedCount++;
          }
        }
      } else {
        // Regular deletion flow for posts and replies

        // Find and click More button
        const moreButtonRef = findMoreButtonInTweet(snapshot, tweet);
        if (!moreButtonRef) {
          console.log('Could not find More button, skipping tweet');
          continue;
        }

        await browser_click({ element: 'More options', ref: moreButtonRef });
        await delay(CONFIG.delays.betweenClicks);

        // Take new snapshot to find delete button in menu
        const menuSnapshot = await browser_snapshot();
        const deleteButtonRef = findDeleteButton(menuSnapshot);

        if (!deleteButtonRef) {
          console.log('Could not find Delete button in menu, skipping');
          // Close menu by clicking elsewhere or pressing Escape
          continue;
        }

        await browser_click({ element: 'Delete', ref: deleteButtonRef });
        await delay(CONFIG.delays.betweenClicks);

        // Take snapshot to find confirmation button
        const confirmSnapshot = await browser_snapshot();
        const confirmButtonRef = findConfirmButton(confirmSnapshot);

        if (confirmButtonRef) {
          await browser_click({ element: 'Confirm deletion', ref: confirmButtonRef });
          await delay(CONFIG.delays.afterDeletion);
        }

        deletedCount++;
      }

      // Log progress
      if (deletedCount % CONFIG.logInterval === 0) {
        console.log(`✓ Deleted ${deletedCount} ${contentType}...`);
      }

      // Rate limiting protection
      await delay(CONFIG.delays.rateLimitSafe);

    } catch (error) {
      console.error(`Error deleting tweet: ${error.message}`);
      // Continue to next iteration

      // Scroll a bit to move past problematic tweet
      await browser_evaluate({
        function: '() => { window.scrollBy(0, 150); }'
      });
      await delay(CONFIG.delays.scrollLoad);
    }

    // Scroll to refresh and load new content
    await browser_evaluate({
      function: `() => { window.scrollBy(0, ${CONFIG.scrollAmount}); }`
    });
    await delay(CONFIG.delays.scrollLoad);
  }

  console.log(`✓ Completed ${contentType}: ${deletedCount} items deleted`);
  return deletedCount;
}

/**
 * Find confirmation button for deletion
 * @param {object} snapshot - Snapshot after clicking delete
 * @returns {string|null} ref of confirm button
 */
function findConfirmButton(snapshot) {
  const content = snapshot.content || snapshot || '';
  const lines = typeof content === 'string' ? content.split('\n') : [];

  for (const line of lines) {
    // Look for confirmation button - usually "Delete" in a dialog
    if ((line.includes('confirmationSheetConfirm') ||
         (line.includes('Delete') && line.includes('button'))) &&
        line.match(/ref="([^"]+)"/)) {
      const match = line.match(/ref="([^"]+)"/);
      if (match) {
        return match[1];
      }
    }
  }

  return null;
}

/**
 * Delete all content types
 * @param {object} mcpTools - Playwright MCP tool functions
 * @param {string} username - X username (without @)
 * @returns {object} Summary of deletions
 */
async function deleteAllContent(mcpTools, username) {
  console.log(`Starting deletion process for @${username}`);
  console.log('This may take 20-60 minutes for 1,000 items\n');

  const summary = {
    posts: 0,
    replies: 0,
    reposts: 0,
    total: 0
  };

  // Delete posts (includes reposts)
  console.log('\n=== Processing Posts ===');
  summary.posts = await deleteContent(mcpTools, username, 'POSTS');

  // Delete replies
  console.log('\n=== Processing Replies ===');
  summary.replies = await deleteContent(mcpTools, username, 'REPLIES');

  summary.total = summary.posts + summary.replies;

  console.log('\n=== Deletion Complete ===');
  console.log(`Posts deleted: ${summary.posts}`);
  console.log(`Replies deleted: ${summary.replies}`);
  console.log(`Total deleted: ${summary.total}`);

  return summary;
}

/**
 * Utility: Find unretweet button for reposts
 */
function findUnretweetButton(snapshot, tweet) {
  const content = snapshot.content || snapshot || '';
  const lines = typeof content === 'string' ? content.split('\n') : [];
  let inTweetContext = false;

  for (const line of lines) {
    if (line.includes(tweet.ref)) {
      inTweetContext = true;
    }

    if (inTweetContext && line.includes('unretweet')) {
      const match = line.match(/ref="([^"]+)"/);
      if (match) {
        return match[1];
      }
    }

    if (inTweetContext && line.includes('article') && !line.includes(tweet.ref)) {
      break;
    }
  }

  return null;
}

/**
 * Utility: Find unretweet confirmation button
 */
function findUnretweetConfirmButton(snapshot) {
  const content = snapshot.content || snapshot || '';
  const lines = typeof content === 'string' ? content.split('\n') : [];

  for (const line of lines) {
    if ((line.includes('Undo') || line.includes('unretweetConfirm')) &&
        line.match(/ref="([^"]+)"/)) {
      const match = line.match(/ref="([^"]+)"/);
      if (match) {
        return match[1];
      }
    }
  }

  return null;
}

/**
 * Export for use in modules
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deleteContent,
    deleteAllContent,
    CONFIG,
    getProfileUrl,
    findTweetElements,
    findMoreButtonInTweet,
    findDeleteButton,
    findConfirmButton
  };
}

/**
 * Console Usage Example - OPTIMIZED for large accounts (10k+ posts):
 *
 * If running directly in browser console (alternative to MCP):
 *
 * // 1. Navigate to your X profile (x.com/yourusername)
 * // 2. Open DevTools Console (F12 or Cmd+Option+J)
 * // 3. Paste and run this script:
 *
 * (async () => {
 *   console.log('🚀 X Content Deleter - OPTIMIZED');
 *   console.log('⚠️  Press Ctrl+C to stop anytime.\n');
 *
 *   const perf = {
 *     startTime: Date.now(),
 *     totalDeleted: 0,
 *     totalFailed: 0,
 *     consecutiveEmpty: 0
 *   };
 *
 *   // OPTIMIZED delays - 3-4x faster than conservative settings
 *   const CONFIG = {
 *     delays: {
 *       betweenClicks: 150,    // UI response time
 *       afterDeletion: 200,    // Wait for DOM update
 *       scrollLoad: 600,       // Content load time
 *       rateLimitSafe: 200     // Between deletions
 *     },
 *     maxEmptyAttempts: 5,
 *     scrollAmount: 500        // Scroll more to load more tweets
 *   };
 *
 *   const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
 *
 *   async function deleteTweet(tweet) {
 *     try {
 *       // Check if it's a repost first
 *       const unretweetBtn = tweet.querySelector('[data-testid="unretweet"]');
 *       if (unretweetBtn) {
 *         unretweetBtn.click();
 *         await delay(CONFIG.delays.betweenClicks);
 *         const confirmBtn = document.querySelector('[data-testid="unretweetConfirm"]');
 *         if (confirmBtn) {
 *           confirmBtn.click();
 *           await delay(CONFIG.delays.afterDeletion);
 *           return { success: true, type: 'repost' };
 *         }
 *       }
 *
 *       // Regular post/reply deletion
 *       const moreBtn = tweet.querySelector('[data-testid="caret"]');
 *       if (!moreBtn) return { success: false, error: 'No More button' };
 *
 *       moreBtn.click();
 *       await delay(CONFIG.delays.betweenClicks);
 *
 *       const menuItems = document.querySelectorAll('[role="menuitem"]');
 *       let deleteBtn = null;
 *       for (const item of menuItems) {
 *         if (item.textContent.includes('Delete')) {
 *           deleteBtn = item;
 *           break;
 *         }
 *       }
 *
 *       if (!deleteBtn) {
 *         document.body.click();
 *         await delay(50);
 *         return { success: false, error: 'Not your tweet' };
 *       }
 *
 *       deleteBtn.click();
 *       await delay(CONFIG.delays.betweenClicks);
 *
 *       const confirmBtn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
 *       if (confirmBtn) {
 *         confirmBtn.click();
 *         await delay(CONFIG.delays.afterDeletion);
 *         return { success: true, type: 'post' };
 *       }
 *       return { success: false, error: 'No confirm' };
 *     } catch (error) {
 *       return { success: false, error: error.message };
 *     }
 *   }
 *
 *   while (true) {
 *     const tweets = document.querySelectorAll('article[data-testid="tweet"]');
 *
 *     if (tweets.length === 0) {
 *       perf.consecutiveEmpty++;
 *       console.log(`⏳ No tweets visible (${perf.consecutiveEmpty}/${CONFIG.maxEmptyAttempts})`);
 *       if (perf.consecutiveEmpty >= CONFIG.maxEmptyAttempts) break;
 *       window.scrollBy(0, CONFIG.scrollAmount);
 *       await delay(CONFIG.delays.scrollLoad);
 *       continue;
 *     }
 *
 *     perf.consecutiveEmpty = 0;
 *
 *     // OPTIMIZATION: Process ALL visible tweets before scrolling
 *     for (const tweet of tweets) {
 *       const result = await deleteTweet(tweet);
 *
 *       if (result.success) {
 *         perf.totalDeleted++;
 *         if (perf.totalDeleted % 50 === 0) {
 *           const elapsed = (Date.now() - perf.startTime) / 1000 / 60;
 *           const rate = (perf.totalDeleted / elapsed).toFixed(1);
 *           console.log(`✅ ${perf.totalDeleted} deleted | ${rate}/min`);
 *         }
 *       } else {
 *         perf.totalFailed++;
 *       }
 *
 *       await delay(CONFIG.delays.rateLimitSafe);
 *
 *       // Check if tweet was removed from DOM
 *       if (document.contains(tweet)) break;
 *     }
 *
 *     // Only scroll after processing visible batch
 *     window.scrollBy(0, CONFIG.scrollAmount);
 *     await delay(CONFIG.delays.scrollLoad);
 *   }
 *
 *   const totalTime = ((Date.now() - perf.startTime) / 1000 / 60).toFixed(1);
 *   console.log(`\n🎉 Done! Deleted: ${perf.totalDeleted} | Failed: ${perf.totalFailed} | Time: ${totalTime} min`);
 *
 *   // If rate limited, increase rateLimitSafe to 300-400ms and re-run
 * })();
 */
