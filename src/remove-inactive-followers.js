/**
 * Remove Inactive Followers Script
 *
 * Removes followers who haven't tweeted in a specified period
 * using X's "Remove this follower" feature.
 *
 * Uses popup windows to check profiles while keeping main script running.
 *
 * Usage: Paste in browser console while on your X followers page
 * URL: https://x.com/yourusername/followers
 */

(async () => {
  console.log('🚀 Remove Inactive Followers - Starting...');
  console.log('⚠️  This will remove followers who haven\'t tweeted in 6+ months.');
  console.log('⚠️  They can re-follow you later if they want.');
  console.log('⚠️  Allow popups if prompted!\n');

  // Configuration
  const CONFIG = {
    inactiveDays: 180,           // 6 months
    delays: {
      popupLoad: 4000,           // Wait for popup to load
      betweenClicks: 1000,       // Between menu clicks
      afterAction: 3000,         // After removal action
      scrollLoad: 3000,          // Wait for list to load after scroll
      betweenFollowers: 6000     // Rate limiting between followers (avoid 429)
    },
    maxEmptyAttempts: 3,
    scrollAmount: 300
  };

  // Performance tracking
  const performance = {
    startTime: Date.now(),
    totalChecked: 0,
    totalRemoved: 0,
    totalSkipped: 0,
    totalFailed: 0,
    errors: [],
    removedUsers: []
  };

  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isInactive(lastTweetDate) {
    if (!lastTweetDate) return false; // Can't determine, skip

    const now = new Date();
    const diffMs = now - lastTweetDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return diffDays > CONFIG.inactiveDays;
  }

  async function getFollowerElements() {
    // Find follower cells in the list
    const cells = document.querySelectorAll('[data-testid="cellInnerDiv"]');
    const followers = [];

    for (const cell of cells) {
      const userLink = cell.querySelector('a[href^="/"][role="link"]');
      if (userLink) {
        const href = userLink.getAttribute('href');
        if (href && href.match(/^\/[^\/]+$/) && !href.includes('/status/')) {
          const username = href.substring(1);
          if (username && !['home', 'explore', 'notifications', 'messages', 'settings', 'i'].includes(username)) {
            followers.push({
              element: cell,
              username: username
            });
          }
        }
      }
    }

    // Deduplicate by username
    const seen = new Set();
    return followers.filter(f => {
      if (seen.has(f.username)) return false;
      seen.add(f.username);
      return true;
    });
  }

  async function waitForPopupLoad(popup, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      await delay(500);
      try {
        // Check if popup has loaded and has content
        if (popup.document && popup.document.readyState === 'complete') {
          // Wait a bit more for dynamic content
          await delay(CONFIG.delays.popupLoad);
          return true;
        }
      } catch (e) {
        // Cross-origin or closed - continue waiting
      }
    }
    return false;
  }

  async function checkUserActivity(popup, username) {
    try {
      const doc = popup.document;

      // Check if account is protected
      const pageText = doc.body?.innerText || '';
      if (pageText.includes('These posts are protected') ||
          pageText.includes('posts are protected')) {
        return { hasActivity: true, reason: 'protected_account', skip: true };
      }

      // Find the latest tweet timestamp
      const tweets = doc.querySelectorAll('article[data-testid="tweet"]');

      if (tweets.length === 0) {
        // No tweets visible - could be private or no tweets
        return { hasActivity: false, reason: 'no_tweets_visible' };
      }

      // Get timestamp from first tweet
      const firstTweet = tweets[0];
      const timeElement = firstTweet.querySelector('time');

      if (!timeElement) {
        return { hasActivity: false, reason: 'no_timestamp' };
      }

      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        const lastTweetDate = new Date(datetime);
        const inactive = isInactive(lastTweetDate);

        return {
          hasActivity: !inactive,
          lastTweetDate: lastTweetDate,
          inactive: inactive
        };
      }

      return { hasActivity: false, reason: 'parse_error' };
    } catch (e) {
      return { hasActivity: false, reason: 'error: ' + e.message };
    }
  }

  async function removeFollower(followerElement, username) {
    try {
      // Find the "..." button on the follower's card
      const moreButton = followerElement.querySelector('[data-testid="userActions"]') ||
                         followerElement.querySelector('button[aria-label*="More"]') ||
                         followerElement.querySelector('[role="button"][aria-haspopup="menu"]');

      if (!moreButton) {
        return { success: false, error: 'No more button on card' };
      }

      moreButton.click();
      await delay(CONFIG.delays.betweenClicks);

      // Find and click "Remove this follower"
      const menuItems = document.querySelectorAll('[role="menuitem"]');
      let removeButton = null;

      for (const item of menuItems) {
        if (item.textContent.includes('Remove this follower')) {
          removeButton = item;
          break;
        }
      }

      if (!removeButton) {
        document.body.click(); // Close menu
        return { success: false, error: 'No remove button found' };
      }

      removeButton.click();
      await delay(CONFIG.delays.betweenClicks);

      // Confirm removal
      const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
      if (confirmButton) {
        confirmButton.click();
        await delay(CONFIG.delays.afterAction);
        return { success: true };
      }

      return { success: false, error: 'No confirm button' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Check we're on followers page
  const currentUrl = window.location.href;
  if (!currentUrl.includes('/followers')) {
    console.error('❌ Please run this script on your followers page!');
    console.log('   Go to: https://x.com/yourusername/followers');
    return;
  }

  console.log('▶️  Starting to check followers...\n');

  let processedUsernames = new Set();
  let consecutiveEmpty = 0;

  while (true) {
    // Get current followers on page
    const followers = await getFollowerElements();

    // Filter out already processed
    const newFollowers = followers.filter(f => !processedUsernames.has(f.username));

    if (newFollowers.length === 0) {
      consecutiveEmpty++;
      console.log(`⏳ No new followers found (attempt ${consecutiveEmpty}/${CONFIG.maxEmptyAttempts})`);

      if (consecutiveEmpty >= CONFIG.maxEmptyAttempts) {
        break;
      }

      // Scroll to load more
      window.scrollBy(0, CONFIG.scrollAmount);
      await delay(CONFIG.delays.scrollLoad);
      continue;
    }

    consecutiveEmpty = 0;

    // Process first new follower
    const follower = newFollowers[0];
    processedUsernames.add(follower.username);
    performance.totalChecked++;

    console.log(`📋 Checking @${follower.username}...`);

    let popup = null;
    try {
      // Open profile in popup
      const profileUrl = `https://x.com/${follower.username}`;
      popup = window.open(profileUrl, 'followerCheck', 'width=800,height=600');

      if (!popup) {
        console.log(`   ❌ Popup blocked! Please allow popups for x.com`);
        performance.totalFailed++;
        performance.errors.push(`Popup blocked: ${follower.username}`);
        continue;
      }

      // Wait for popup to load
      const loaded = await waitForPopupLoad(popup);
      if (!loaded) {
        console.log(`   ❌ Popup failed to load`);
        performance.totalFailed++;
        performance.errors.push(`Load failed: ${follower.username}`);
        popup.close();
        continue;
      }

      // Check user activity
      const activity = await checkUserActivity(popup, follower.username);

      // Close popup first
      popup.close();

      // Skip protected accounts
      if (activity.skip) {
        performance.totalSkipped++;
        console.log(`   🔒 Skipped (${activity.reason || 'protected account'})`);
      } else if (activity.inactive) {
        console.log(`   ⏰ Inactive since ${activity.lastTweetDate?.toLocaleDateString() || 'unknown'}`);

        // Remove follower using the menu on the followers page
        const removeResult = await removeFollower(follower.element, follower.username);

        if (removeResult.success) {
          performance.totalRemoved++;
          performance.removedUsers.push(follower.username);
          console.log(`   ✅ Removed @${follower.username}`);
        } else {
          performance.totalFailed++;
          performance.errors.push(`Remove failed: ${follower.username} - ${removeResult.error}`);
          console.log(`   ❌ Failed to remove @${follower.username}: ${removeResult.error}`);
        }
      } else {
        performance.totalSkipped++;
        if (activity.lastTweetDate) {
          console.log(`   ✓ Active (last tweet: ${activity.lastTweetDate.toLocaleDateString()})`);
        } else {
          console.log(`   ✓ Skipped (${activity.reason || 'could not determine activity'})`);
        }
      }

      // Log progress every 10 checks
      if (performance.totalChecked % 10 === 0) {
        const elapsed = (Date.now() - performance.startTime) / 1000;
        const rate = (performance.totalChecked / elapsed * 60).toFixed(1);
        console.log(`\n📊 Progress: ${performance.totalChecked} checked, ${performance.totalRemoved} removed (${rate}/min)\n`);
      }

    } catch (error) {
      performance.totalFailed++;
      performance.errors.push(`Error: ${follower.username} - ${error.message}`);
      console.log(`   ❌ Error checking @${follower.username}: ${error.message}`);

      // Close popup if still open
      if (popup && !popup.closed) {
        popup.close();
      }
    }

    // Rate limiting
    await delay(CONFIG.delays.betweenFollowers);
  }

  // Performance Summary
  const totalTime = (Date.now() - performance.startTime) / 1000;
  const checkRate = (performance.totalChecked / totalTime * 60).toFixed(1);

  console.log('\n🎉 Process complete!');
  console.log('\n📊 Summary:');
  console.log(`   Total checked: ${performance.totalChecked}`);
  console.log(`   Removed (inactive): ${performance.totalRemoved}`);
  console.log(`   Skipped (active): ${performance.totalSkipped}`);
  console.log(`   Failed: ${performance.totalFailed}`);
  console.log(`   Total time: ${(totalTime / 60).toFixed(1)} minutes`);
  console.log(`   Check rate: ${checkRate} per minute`);

  if (performance.removedUsers.length > 0) {
    console.log('\n👋 Removed users:');
    performance.removedUsers.forEach(u => console.log(`   @${u}`));
  }

  if (performance.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    performance.errors.slice(0, 10).forEach(e => console.log(`   ${e}`));
    if (performance.errors.length > 10) {
      console.log(`   ... and ${performance.errors.length - 10} more`);
    }
  }

})();
