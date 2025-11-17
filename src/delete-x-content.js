/**
 * X Content Deletion Automation Script
 *
 * This script provides functions for automating deletion of X (Twitter) content
 * using browser automation via MCP Chrome DevTools.
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
    betweenClicks: 300,      // ms between menu clicks
    afterDeletion: 800,      // ms after confirming deletion
    scrollLoad: 2000,        // ms to wait for content to load after scroll
    rateLimitSafe: 500       // ms between each tweet deletion
  },
  selectors: {
    tweet: 'article[data-testid="tweet"]',
    moreButton: '[data-testid="caret"]',
    deleteButton: '[role="menuitem"]',  // Contains "Delete" text
    confirmButton: '[data-testid="confirmationSheetConfirm"]',
    unretweetButton: '[data-testid="unretweet"]',
    unretweetConfirm: '[data-testid="unretweetConfirm"]'
  },
  scrollAmount: 150,
  logInterval: 10  // Log progress every N deletions
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
 * the MCP snapshot structure
 * @param {object} snapshot - Snapshot from mcp__chrome-devtools__take_snapshot
 * @returns {array} Array of tweet element UIDs
 */
function findTweetElements(snapshot) {
  // In actual implementation, parse snapshot.content to find elements
  // with data-testid="tweet" and extract their UIDs

  // Example structure (simplified):
  const tweets = [];
  const lines = snapshot.content ? snapshot.content.split('\n') : [];

  for (const line of lines) {
    // Look for tweet containers in snapshot
    if (line.includes('article') && line.match(/uid=["']([^"']+)["']/)) {
      const match = line.match(/uid=["']([^"']+)["']/);
      if (match) {
        tweets.push({
          uid: match[1],
          text: line
        });
      }
    }
  }

  return tweets;
}

/**
 * Find the "More" button UID within a tweet element
 * @param {object} snapshot - Current page snapshot
 * @param {object} tweet - Tweet object with UID
 * @returns {string|null} UID of more button, or null if not found
 */
function findMoreButtonInTweet(snapshot, tweet) {
  // Parse snapshot to find caret/more button within the tweet's UID context
  // This would need to parse the hierarchical structure of the snapshot

  const lines = snapshot.content ? snapshot.content.split('\n') : [];
  let inTweetContext = false;

  for (const line of lines) {
    if (line.includes(tweet.uid)) {
      inTweetContext = true;
    }

    if (inTweetContext && (line.includes('More') || line.includes('caret'))) {
      const match = line.match(/uid=["']([^"']+)["']/);
      if (match) {
        return match[1];
      }
    }

    // Exit tweet context when we hit next tweet or end of section
    if (inTweetContext && line.includes('article') && !line.includes(tweet.uid)) {
      break;
    }
  }

  return null;
}

/**
 * Find delete button in menu
 * @param {object} snapshot - Snapshot after opening menu
 * @returns {string|null} UID of delete button
 */
function findDeleteButton(snapshot) {
  const lines = snapshot.content ? snapshot.content.split('\n') : [];

  for (const line of lines) {
    if ((line.includes('Delete') || line.includes('delete')) &&
        line.match(/uid=["']([^"']+)["']/)) {
      const match = line.match(/uid=["']([^"']+)["']/);
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
 * Main deletion function using MCP Chrome DevTools
 *
 * This is pseudocode showing the pattern. In actual use, Claude Code
 * will call the MCP tools directly.
 *
 * @param {object} mcpTools - MCP Chrome DevTools tool functions
 * @param {string} username - X username
 * @param {string} contentType - Type of content to delete
 * @returns {number} Number of items deleted
 */
async function deleteContent(mcpTools, username, contentType) {
  const {
    navigate_page,
    take_snapshot,
    click,
    handle_dialog,
    evaluate_script
  } = mcpTools;

  let deletedCount = 0;
  let hasMore = true;
  let consecutiveEmptyAttempts = 0;
  const MAX_EMPTY_ATTEMPTS = 3;

  // Navigate to the correct profile tab
  const url = getProfileUrl(username, contentType);
  await navigate_page({ type: 'url', url });
  await delay(CONFIG.delays.scrollLoad);

  console.log(`Starting deletion of ${contentType} for @${username}`);
  console.log(`URL: ${url}`);

  while (hasMore) {
    // Take snapshot to find tweets
    const snapshot = await take_snapshot();
    const tweets = findTweetElements(snapshot);

    if (tweets.length === 0) {
      consecutiveEmptyAttempts++;

      if (consecutiveEmptyAttempts >= MAX_EMPTY_ATTEMPTS) {
        console.log(`No more ${contentType} found after ${MAX_EMPTY_ATTEMPTS} attempts`);
        hasMore = false;
        break;
      }

      // Try scrolling to load more
      await evaluate_script({
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
        const unretweetUid = findUnretweetButton(snapshot, tweet);
        if (unretweetUid) {
          await click({ uid: unretweetUid });
          await delay(CONFIG.delays.betweenClicks);

          // Confirm unretweet
          const confirmSnapshot = await take_snapshot();
          const confirmUid = findUnretweetConfirmButton(confirmSnapshot);
          if (confirmUid) {
            await click({ uid: confirmUid });
            await delay(CONFIG.delays.afterDeletion);
            deletedCount++;
          }
        }
      } else {
        // Regular deletion flow for posts and replies

        // Find and click More button
        const moreButtonUid = findMoreButtonInTweet(snapshot, tweet);
        if (!moreButtonUid) {
          console.log('Could not find More button, skipping tweet');
          continue;
        }

        await click({ uid: moreButtonUid });
        await delay(CONFIG.delays.betweenClicks);

        // Take new snapshot to find delete button in menu
        const menuSnapshot = await take_snapshot();
        const deleteButtonUid = findDeleteButton(menuSnapshot);

        if (!deleteButtonUid) {
          console.log('Could not find Delete button in menu, skipping');
          // Close menu by clicking elsewhere or pressing Escape
          continue;
        }

        await click({ uid: deleteButtonUid });
        await delay(CONFIG.delays.betweenClicks);

        // Handle confirmation dialog
        await handle_dialog({ action: 'accept' });
        await delay(CONFIG.delays.afterDeletion);

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
      await evaluate_script({
        function: '() => { window.scrollBy(0, 150); }'
      });
      await delay(CONFIG.delays.scrollLoad);
    }

    // Scroll to refresh and load new content
    await evaluate_script({
      function: `() => { window.scrollBy(0, ${CONFIG.scrollAmount}); }`
    });
    await delay(CONFIG.delays.scrollLoad);
  }

  console.log(`✓ Completed ${contentType}: ${deletedCount} items deleted`);
  return deletedCount;
}

/**
 * Delete all content types
 * @param {object} mcpTools - MCP Chrome DevTools tool functions
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
  const lines = snapshot.content ? snapshot.content.split('\n') : [];
  let inTweetContext = false;

  for (const line of lines) {
    if (line.includes(tweet.uid)) {
      inTweetContext = true;
    }

    if (inTweetContext && line.includes('unretweet')) {
      const match = line.match(/uid=["']([^"']+)["']/);
      if (match) {
        return match[1];
      }
    }

    if (inTweetContext && line.includes('article') && !line.includes(tweet.uid)) {
      break;
    }
  }

  return null;
}

/**
 * Utility: Find unretweet confirmation button
 */
function findUnretweetConfirmButton(snapshot) {
  const lines = snapshot.content ? snapshot.content.split('\n') : [];

  for (const line of lines) {
    if (line.includes('Undo') && line.match(/uid=["']([^"']+)["']/)) {
      const match = line.match(/uid=["']([^"']+)["']/);
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
    findDeleteButton
  };
}

/**
 * Console Usage Example with Performance Logging:
 *
 * If running directly in browser console (alternative to MCP):
 *
 * // 1. Copy this entire script
 * // 2. Paste into DevTools Console on x.com
 * // 3. Run:
 *
 * (async () => {
 *   console.log('🚀 X Content Deleter - Starting...');
 *   console.log('⚠️  This will delete ALL visible content. Press Ctrl+C to stop anytime.\n');
 *
 *   // Performance tracking
 *   const performance = {
 *     startTime: Date.now(),
 *     totalDeleted: 0,
 *     totalFailed: 0,
 *     consecutiveEmpty: 0,
 *     deletionTimes: [],
 *     errors: []
 *   };
 *
 *   const CONFIG = {
 *     delays: {
 *       betweenClicks: 300,
 *       afterDeletion: 800,
 *       scrollLoad: 2000,
 *       rateLimitSafe: 500
 *     },
 *     maxEmptyAttempts: 5,
 *     scrollAmount: 300
 *   };
 *
 *   async function delay(ms) {
 *     return new Promise(resolve => setTimeout(resolve, ms));
 *   }
 *
 *   async function deleteTweet(tweet) {
 *     const deleteStart = Date.now();
 *
 *     try {
 *       // Check if it's a repost first
 *       const unretweetBtn = tweet.querySelector('[data-testid="unretweet"]');
 *       if (unretweetBtn) {
 *         unretweetBtn.click();
 *         await delay(CONFIG.delays.betweenClicks);
 *
 *         const confirmBtn = document.querySelector('[data-testid="unretweetConfirm"]');
 *         if (confirmBtn) {
 *           confirmBtn.click();
 *           await delay(CONFIG.delays.afterDeletion);
 *
 *           const deleteTime = Date.now() - deleteStart;
 *           performance.deletionTimes.push(deleteTime);
 *           return { success: true, time: deleteTime, type: 'repost' };
 *         }
 *       }
 *
 *       // Regular post/reply deletion
 *       const moreBtn = tweet.querySelector('[data-testid="caret"]');
 *       if (!moreBtn) {
 *         return { success: false, error: 'No More button found' };
 *       }
 *
 *       moreBtn.click();
 *       await delay(CONFIG.delays.betweenClicks);
 *
 *       // Find Delete button in menu
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
 *         document.body.click(); // Close menu
 *         return { success: false, error: 'No Delete button (not your tweet?)' };
 *       }
 *
 *       deleteBtn.click();
 *       await delay(CONFIG.delays.betweenClicks);
 *
 *       // Confirm deletion
 *       const confirmBtn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
 *       if (confirmBtn) {
 *         confirmBtn.click();
 *         await delay(CONFIG.delays.afterDeletion);
 *
 *         const deleteTime = Date.now() - deleteStart;
 *         performance.deletionTimes.push(deleteTime);
 *         return { success: true, time: deleteTime, type: 'post/reply' };
 *       }
 *
 *       return { success: false, error: 'No confirmation button' };
 *
 *     } catch (error) {
 *       return { success: false, error: error.message };
 *     }
 *   }
 *
 *   // Main loop
 *   console.log('▶️  Starting deletion process...\n');
 *
 *   while (true) {
 *     const tweets = document.querySelectorAll('article[data-testid="tweet"]');
 *
 *     if (tweets.length === 0) {
 *       performance.consecutiveEmpty++;
 *       console.log(`⏳ No tweets found (attempt ${performance.consecutiveEmpty}/${CONFIG.maxEmptyAttempts})`);
 *
 *       if (performance.consecutiveEmpty >= CONFIG.maxEmptyAttempts) {
 *         break; // Stop processing
 *       }
 *
 *       // Scroll and try again
 *       window.scrollBy(0, CONFIG.scrollAmount);
 *       await delay(CONFIG.delays.scrollLoad);
 *       continue;
 *     }
 *
 *     // Reset empty counter
 *     performance.consecutiveEmpty = 0;
 *
 *     // Process first tweet
 *     const tweet = tweets[0];
 *     const result = await deleteTweet(tweet);
 *
 *     if (result.success) {
 *       performance.totalDeleted++;
 *
 *       // Log progress every 10 deletions
 *       if (performance.totalDeleted % 10 === 0) {
 *         const elapsed = (Date.now() - performance.startTime) / 1000;
 *         const rate = (performance.totalDeleted / elapsed * 60).toFixed(1);
 *         console.log(`✅ Deleted ${performance.totalDeleted} items (${rate}/min) - Last: ${result.time}ms`);
 *       }
 *     } else {
 *       performance.totalFailed++;
 *       performance.errors.push(result.error);
 *
 *       if (performance.totalFailed % 5 === 0) {
 *         console.log(`⚠️  Failed: ${performance.totalFailed} (${result.error})`);
 *       }
 *     }
 *
 *     // Rate limiting protection
 *     await delay(CONFIG.delays.rateLimitSafe);
 *
 *     // Scroll to refresh
 *     window.scrollBy(0, CONFIG.scrollAmount);
 *     await delay(CONFIG.delays.scrollLoad);
 *   }
 *
 *   // Performance Summary
 *   const totalTime = (Date.now() - performance.startTime) / 1000;
 *   const avgDeletionTime = performance.deletionTimes.length > 0
 *     ? (performance.deletionTimes.reduce((a, b) => a + b, 0) / performance.deletionTimes.length).toFixed(0)
 *     : 0;
 *   const deletionsPerMinute = (performance.totalDeleted / totalTime * 60).toFixed(1);
 *
 *   console.log('\n🎉 Deletion complete!');
 *   console.log('\n📊 Performance Summary:');
 *   console.log(`   Total deleted: ${performance.totalDeleted}`);
 *   console.log(`   Total failed: ${performance.totalFailed}`);
 *   console.log(`   Success rate: ${((performance.totalDeleted / (performance.totalDeleted + performance.totalFailed)) * 100).toFixed(1)}%`);
 *   console.log(`   Total time: ${(totalTime / 60).toFixed(1)} minutes`);
 *   console.log(`   Avg deletion time: ${avgDeletionTime}ms`);
 *   console.log(`   Deletion rate: ${deletionsPerMinute} per minute`);
 *
 *   if (performance.errors.length > 0) {
 *     console.log('\n⚠️  Common errors:');
 *     const errorCounts = {};
 *     performance.errors.forEach(err => {
 *       errorCounts[err] = (errorCounts[err] || 0) + 1;
 *     });
 *     Object.entries(errorCounts).forEach(([err, count]) => {
 *       console.log(`   ${err}: ${count}x`);
 *     });
 *   }
 *
 *   console.log('\n💡 Tips:');
 *   console.log('  - Refresh the page to load more content if needed');
 *   console.log('  - Navigate to /username/with_replies to delete replies');
 *   console.log('  - X cache may take 24-48 hours to fully clear');
 *
 * })();
 */
