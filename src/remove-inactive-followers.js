/**
 * Remove Inactive Followers Script
 *
 * Removes followers who haven't tweeted in a specified period
 * using the block/unblock method (X's only way to remove followers).
 *
 * Usage: Paste in browser console while on your X followers page
 * URL: https://x.com/yourusername/followers
 */

(async () => {
  console.log('🚀 Remove Inactive Followers - Starting...');
  console.log('⚠️  This will remove followers who haven\'t tweeted in 6+ months.');
  console.log('⚠️  They can re-follow you later if they want.\n');

  // Configuration
  const CONFIG = {
    inactiveDays: 180,           // 6 months
    delays: {
      profileLoad: 2000,         // Wait for profile to load
      betweenClicks: 500,        // Between menu clicks
      afterAction: 1000,         // After block/unblock
      scrollLoad: 2000,          // Wait for list to load after scroll
      betweenFollowers: 1000     // Rate limiting between followers
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

  // Parse relative time strings like "2h", "3d", "Apr 15", "Dec 2023"
  function parseLastTweetDate(timeText) {
    if (!timeText) return null;

    const now = new Date();

    // Handle relative times: "2h", "5m", "3d"
    if (timeText.match(/^\d+[smh]$/)) {
      return now; // Very recent, within hours
    }

    // Handle "Xd" for days
    const daysMatch = timeText.match(/^(\d+)d$/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      return new Date(now - days * 24 * 60 * 60 * 1000);
    }

    // Handle month + day: "Apr 15", "Dec 3"
    const monthDayMatch = timeText.match(/^([A-Z][a-z]{2})\s+(\d{1,2})$/);
    if (monthDayMatch) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = months.indexOf(monthDayMatch[1]);
      const day = parseInt(monthDayMatch[2]);

      if (monthIndex >= 0) {
        let year = now.getFullYear();
        const date = new Date(year, monthIndex, day);

        // If date is in future, it's from last year
        if (date > now) {
          date.setFullYear(year - 1);
        }
        return date;
      }
    }

    // Handle month + year: "Dec 2023", "Jan 2022"
    const monthYearMatch = timeText.match(/^([A-Z][a-z]{2})\s+(\d{4})$/);
    if (monthYearMatch) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = months.indexOf(monthYearMatch[1]);
      const year = parseInt(monthYearMatch[2]);

      if (monthIndex >= 0) {
        return new Date(year, monthIndex, 15); // Mid-month estimate
      }
    }

    return null;
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
          if (username && !['home', 'explore', 'notifications', 'messages', 'settings'].includes(username)) {
            followers.push({
              element: cell,
              username: username
            });
          }
        }
      }
    }

    return followers;
  }

  async function checkUserActivity(username) {
    // Navigate to user profile
    const profileUrl = `https://x.com/${username}`;

    // Open profile in same tab
    window.location.href = profileUrl;
    await delay(CONFIG.delays.profileLoad);

    // Wait for page to load
    let attempts = 0;
    while (attempts < 5) {
      if (window.location.pathname === `/${username}`) {
        break;
      }
      await delay(500);
      attempts++;
    }

    // Find the latest tweet timestamp
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');

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
  }

  async function blockUser(username) {
    // Click More button (three dots)
    const moreButton = document.querySelector('[data-testid="userActions"]');
    if (!moreButton) {
      return { success: false, error: 'No user actions button' };
    }

    moreButton.click();
    await delay(CONFIG.delays.betweenClicks);

    // Find and click Block
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    let blockButton = null;

    for (const item of menuItems) {
      if (item.textContent.includes('Block')) {
        blockButton = item;
        break;
      }
    }

    if (!blockButton) {
      document.body.click(); // Close menu
      return { success: false, error: 'No block button found' };
    }

    blockButton.click();
    await delay(CONFIG.delays.betweenClicks);

    // Confirm block
    const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
    if (confirmButton) {
      confirmButton.click();
      await delay(CONFIG.delays.afterAction);
      return { success: true };
    }

    return { success: false, error: 'No confirm button' };
  }

  async function unblockUser(username) {
    // Click the Blocked button or More button
    const blockedButton = document.querySelector('[data-testid="placementTracking"] [role="button"]');

    if (blockedButton && blockedButton.textContent.includes('Blocked')) {
      blockedButton.click();
      await delay(CONFIG.delays.betweenClicks);

      // Confirm unblock
      const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
      if (confirmButton) {
        confirmButton.click();
        await delay(CONFIG.delays.afterAction);
        return { success: true };
      }
    }

    // Alternative: use More menu
    const moreButton = document.querySelector('[data-testid="userActions"]');
    if (moreButton) {
      moreButton.click();
      await delay(CONFIG.delays.betweenClicks);

      const menuItems = document.querySelectorAll('[role="menuitem"]');
      for (const item of menuItems) {
        if (item.textContent.includes('Unblock')) {
          item.click();
          await delay(CONFIG.delays.afterAction);
          return { success: true };
        }
      }
    }

    return { success: false, error: 'Could not unblock' };
  }

  // Store original URL to return to
  const followersUrl = window.location.href;

  if (!followersUrl.includes('/followers')) {
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

    try {
      // Check user activity
      const activity = await checkUserActivity(follower.username);

      if (activity.inactive) {
        console.log(`   ⏰ Inactive since ${activity.lastTweetDate?.toLocaleDateString() || 'unknown'}`);

        // Block then unblock
        const blockResult = await blockUser(follower.username);

        if (blockResult.success) {
          const unblockResult = await unblockUser(follower.username);

          if (unblockResult.success) {
            performance.totalRemoved++;
            performance.removedUsers.push(follower.username);
            console.log(`   ✅ Removed @${follower.username}`);
          } else {
            performance.totalFailed++;
            performance.errors.push(`Unblock failed: ${follower.username}`);
            console.log(`   ⚠️  Blocked but failed to unblock @${follower.username}`);
          }
        } else {
          performance.totalFailed++;
          performance.errors.push(`Block failed: ${follower.username} - ${blockResult.error}`);
          console.log(`   ❌ Failed to block @${follower.username}: ${blockResult.error}`);
        }
      } else {
        performance.totalSkipped++;
        if (activity.lastTweetDate) {
          console.log(`   ✓ Active (last tweet: ${activity.lastTweetDate.toLocaleDateString()})`);
        } else {
          console.log(`   ✓ Skipped (${activity.reason || 'could not determine activity'})`);
        }
      }

      // Navigate back to followers list
      window.location.href = followersUrl;
      await delay(CONFIG.delays.profileLoad);

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

      // Try to get back to followers list
      window.location.href = followersUrl;
      await delay(CONFIG.delays.profileLoad);
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
