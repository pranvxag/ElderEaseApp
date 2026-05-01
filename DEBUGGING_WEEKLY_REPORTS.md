/**
 * WEEKLY REPORT DEBUGGING GUIDE
 * 
 * This guide helps you verify that weekly reports are being saved to Firestore.
 * Follow these steps to debug the issue.
 */

// ============================================
// STEP 1: CHECK CONSOLE LOGS
// ============================================
/*
Open your browser's Developer Tools (F12) or Xcode console and look for these logs:

On App Startup:
✅ Expected: "🔄 Initializing weekly report for user: xjbCgWjzmnYQubalFccljPCt9QQ2"
✅ Expected: "📊 Fetched data: { medsCount: X, sugarsCount: X }"
✅ Expected: "💾 About to save weekly report..."
✅ Expected: "📝 Saving report to: users/xjbCgWjzmnYQubalFccljPCt9QQ2/weeklyReports/Week18"
✅ Expected: "✅ Saved weekly report: uid=xjbCgWjzmnYQubalFccljPCt9QQ2, week=Week18"

If you see:
❌ "⏳ No uid yet, skipping weekly report init" - User is not logged in yet
❌ "❌ Weekly report save skipped: { uid: false, hasFirebaseConfig: false }" - Firebase not configured
❌ "❌ Weekly report save failed for..." - Firestore write error
*/

// ============================================
// STEP 2: CHECK FIRESTORE CONSOLE
// ============================================
/*
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project
3. Go to Firestore Database
4. Navigate to: users > {your_uid} > weeklyReports

Expected structure:
users/
  xjbCgWjzmnYQubalFccljPCt9QQ2/
    weeklyReports/
      Week18/   <-- This document should exist
        weekKey: "Week 18"
        weekNumber: 18
        year: 2026
        startDate: "2026-04-30"
        endDate: "2026-05-06"
        generatedAt: "2026-05-01T10:30:00.000Z"
        lastUpdatedAt: "2026-05-01T10:30:00.000Z"  <-- Updates daily
        medicines:
          adherence: 85
          perDay: [...]
        sugar: [...]

If Week18 doesn't exist:
- The Firestore write is failing silently
- Check browser console for error messages
- Check Firestore security rules
*/

// ============================================
// STEP 3: VERIFY TRIGGERS
// ============================================
/*
Weekly reports should save automatically when:

1. App starts (automatic initialization)
   - Check logs for: "🔄 Initializing weekly report..."

2. Sugar reading added
   - Go to Scan tab > Daily Sugar Report
   - Enter fasting reading: "92"
   - Click "Save"
   - Check logs for: "💾 Auto-saving weekly report after sugar entry..."
   - Check Firestore: lastUpdatedAt should change

3. Medicine marked
   - Go to Medications tab
   - Mark any medicine as "Taken"
   - Check logs for: "💾 Auto-saving weekly report after update..."
   - Check Firestore: medicines.adherence should change

4. View Weekly Report
   - Go to Scan tab > "View Weekly Report" button
   - Check logs for: "💾 About to save weekly report..."
*/

// ============================================
// STEP 4: CHECK FIREBASE AUTHENTICATION
// ============================================
/*
Weekly reports require:
1. User to be authenticated (logged in)
2. Firebase configuration to be available
3. Proper Firestore rules

Check if user is authenticated:
- Console should show: "xjbCgWjzmnYQubalFccljPCt9QQ2" as uid
- If you see "⏳ No uid yet", the user is not logged in

Check Firebase config:
- Look for: "❌ Weekly report save skipped: { uid: false, hasFirebaseConfig: false }"
- This means environment variables are not set properly
*/

// ============================================
// STEP 5: FIRESTORE SECURITY RULES
// ============================================
/*
Make sure your Firestore rules allow writing to weeklyReports:

Required rules in Firestore:
match /users/{uid}/weeklyReports/{document=**} {
  allow read, write: if request.auth.uid == uid;
}

Without this rule, saves will fail with:
"Missing or insufficient permissions"
*/

// ============================================
// COMMON ISSUES & SOLUTIONS
// ============================================
/*
Issue 1: No logs appearing
Solution:
- Check if console is open (F12)
- Try adding a sugar reading to trigger auto-save
- Check the Network tab in DevTools for failed Firestore requests

Issue 2: "Missing or insufficient permissions" error
Solution:
- Go to Firestore Security Rules
- Add the weekly reports rule shown in STEP 5
- Wait for rules to deploy (usually instant)

Issue 3: "uid is empty" error
Solution:
- Sign out and sign back in
- Make sure you're using Google Sign-In
- Check that useAuth() is properly initialized

Issue 4: Can't find weeklyReports collection
Solution:
- Make sure app has run for at least 5 seconds
- Try adding a sugar reading to force a save
- Refresh the Firestore Console (F5)
- Collections are created automatically when first document is saved
*/

// ============================================
// EXPECTED CONSOLE OUTPUT
// ============================================
/*
Full successful flow:

1. User logs in
   ✅ useAuth returns user object with uid

2. App loads Scan tab
   ✅ "⏳ No uid yet, skipping weekly report init" (if loading)
   ✅ "🔄 Initializing weekly report for user: xjbCgWjzmnYQubalFccljPCt9QQ2"
   ✅ "📊 Fetched data: { medsCount: 0, sugarsCount: 0 }"
   ✅ "💾 About to save weekly report..."
   ✅ "📝 Saving report to: users/xjbCgWjzmnYQubalFccljPCt9QQ2/weeklyReports/Week18"
   ✅ "✅ Saved weekly report: uid=xjbCgWjzmnYQubalFccljPCt9QQ2, week=Week18"

3. User adds sugar reading
   ✅ "💾 Auto-saving weekly report after sugar entry..."
   ✅ "📝 Saving report to: users/xjbCgWjzmnYQubalFccljPCt9QQ2/weeklyReports/Week18"
   ✅ "✅ Saved weekly report: uid=xjbCgWjzmnYQubalFccljPCt9QQ2, week=Week18"

4. Check Firestore
   ✅ weeklyReports/Week18 document exists
   ✅ lastUpdatedAt timestamp is recent
   ✅ sugar array contains your reading
*/

export const DEBUGGING_CHECKLIST = {
  step1: 'Check console logs for 📝, ✅, ❌ markers',
  step2: 'Navigate to Firestore weeklyReports collection',
  step3: 'Verify triggers are working (sugar, medicine, app startup)',
  step4: 'Confirm user is authenticated with correct uid',
  step5: 'Verify Firestore security rules allow weeklyReports writes',
};
