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
    betweenClicks: 500,      // ms between menu clicks
    afterDeletion: 1000,     // ms after confirming deletion
    scrollLoad: 3000,        // ms to wait for content to load after scroll
    rateLimitSafe: 1000      // ms between each tweet deletion
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
 * Console Usage Example:
 *
 * If running directly in browser console (alternative to MCP):
 *
 * // 1. Copy this entire script
 * // 2. Paste into DevTools Console on x.com
 * // 3. Run:
 *
 * (async () => {
 *   // Manual browser-based deletion (no MCP)
 *   const tweets = document.querySelectorAll('article[data-testid="tweet"]');
 *
 *   for (let i = 0; i < tweets.length; i++) {
 *     const tweet = tweets[i];
 *
 *     // Click More button
 *     const moreBtn = tweet.querySelector('[data-testid="caret"]');
 *     if (moreBtn) {
 *       moreBtn.click();
 *       await new Promise(r => setTimeout(r, 500));
 *
 *       // Click Delete
 *       const deleteBtn = document.querySelector('[role="menuitem"]');
 *       if (deleteBtn && deleteBtn.textContent.includes('Delete')) {
 *         deleteBtn.click();
 *         await new Promise(r => setTimeout(r, 500));
 *
 *         // Confirm
 *         const confirmBtn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
 *         if (confirmBtn) {
 *           confirmBtn.click();
 *           await new Promise(r => setTimeout(r, 1000));
 *           console.log(`Deleted ${i + 1}`);
 *         }
 *       }
 *     }
 *
 *     // Scroll to load more
 *     window.scrollBy(0, 150);
 *     await new Promise(r => setTimeout(r, 3000));
 *   }
 * })();
 */
