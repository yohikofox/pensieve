# CompletionAnimation - Device Testing Checklist

**Story**: 5.1 - Affichage Inline des Todos dans le Feed
**Task**: 8.7 - Verify CompletionAnimation on real devices (Issue #11)
**Component**: `src/contexts/action/ui/CompletionAnimation.tsx`

## Purpose

This checklist ensures the CompletionAnimation component performs correctly on real devices with different:
- Screen sizes and resolutions
- OS versions (iOS/Android)
- Performance characteristics (low-end vs high-end devices)
- Battery modes (low power mode, battery saver)

## Test Devices

**Minimum Coverage**:
- [ ] 1x iOS device (iPhone 12 or newer recommended)
- [ ] 1x Android device (Pixel 5 or newer recommended)
- [ ] 1x Low-end device (budget Android or older iPhone)

**Recommended Coverage**:
- [ ] iOS - Latest version (iOS 18+)
- [ ] iOS - Previous version (iOS 17)
- [ ] Android - Latest version (Android 15+)
- [ ] Android - Previous version (Android 14)
- [ ] Android - Low-end device (Android 13 on budget hardware)

---

## Functional Tests

### FT-1: Animation Triggers Correctly

**Test**: Verify animation only plays when checking a todo (not unchecking)

**Steps**:
1. Open feed with active todos
2. Tap checkbox on active todo → Should trigger animation
3. Verify animation plays immediately
4. Tap checkbox on completed todo (uncheck) → Should NOT trigger animation
5. Verify no animation when unchecking

**Expected Result**:
- ✅ Animation plays ONLY when marking todo as completed
- ✅ NO animation when unchecking (reverting to active)

**Tested on**:
- [ ] iOS Device: ___________ (model/version)
- [ ] Android Device: ___________ (model/version)
- [ ] Low-end Device: ___________ (model/version)

**Issues found**: _____________________________

---

### FT-2: Animation Timing

**Test**: Verify animation duration matches spec (~400ms)

**Steps**:
1. Open feed with active todos
2. Tap checkbox to trigger animation
3. Use stopwatch to measure animation duration
4. Repeat 5 times and average

**Expected Result**:
- ✅ Animation duration: 350-450ms (target: 400ms)
- ✅ Consistent timing across multiple triggers

**Measured Results**:
- iOS Device: _____ ms (avg of 5)
- Android Device: _____ ms (avg of 5)
- Low-end Device: _____ ms (avg of 5)

**Issues found**: _____________________________

---

### FT-3: Multiple Rapid Toggles

**Test**: Verify animation handles rapid checkbox taps gracefully

**Steps**:
1. Open feed with 5+ active todos
2. Rapidly tap checkboxes on multiple todos (< 1 second between taps)
3. Verify each animation plays correctly
4. Check for animation conflicts or glitches

**Expected Result**:
- ✅ Each todo shows animation independently
- ✅ No animation conflicts or overlaps
- ✅ No visual glitches or stuttering
- ✅ All todos update status correctly

**Tested on**:
- [ ] iOS Device: ___________ (model/version)
- [ ] Android Device: ___________ (model/version)
- [ ] Low-end Device: ___________ (model/version)

**Issues found**: _____________________________

---

## Performance Tests

### PT-1: Frame Rate (60fps)

**Test**: Verify animation runs at 60fps without drops

**Setup**:
- Enable Developer Options → Profile GPU Rendering (Android)
- Enable Debug → Core Animation Frame Rate (iOS Xcode Instruments)

**Steps**:
1. Open feed with active todos
2. Start profiling
3. Tap checkbox to trigger animation
4. Monitor frame rate during animation
5. Record results

**Expected Result**:
- ✅ Consistent 60fps throughout animation
- ✅ No frame drops below 55fps
- ✅ Smooth visual appearance

**Measured Results**:
- iOS Device: _____ fps (min/avg)
- Android Device: _____ fps (min/avg)
- Low-end Device: _____ fps (min/avg)

**Issues found**: _____________________________

---

### PT-2: Battery Impact

**Test**: Verify animation doesn't significantly drain battery

**Steps**:
1. Charge device to 100%
2. Run animation 50 times (toggle 50 todos)
3. Measure battery drain
4. Compare to baseline (50 regular UI interactions)

**Expected Result**:
- ✅ Battery drain < 2% for 50 animations
- ✅ No excessive CPU usage
- ✅ No device heating

**Measured Results**:
- iOS Device: _____ % battery drain
- Android Device: _____ % battery drain
- Low-end Device: _____ % battery drain

**Issues found**: _____________________________

---

### PT-3: Low Power Mode

**Test**: Verify animation behaves correctly in battery saver modes

**Steps**:
1. Enable Low Power Mode (iOS) or Battery Saver (Android)
2. Trigger animation by checking todos
3. Verify animation still plays smoothly
4. Check if animation is degraded or disabled

**Expected Result**:
- ✅ Animation plays correctly in low power mode
- ✅ Performance remains acceptable (may be slightly reduced)
- ✅ No crashes or errors

**Tested on**:
- [ ] iOS Device (Low Power Mode): ___________
- [ ] Android Device (Battery Saver): ___________

**Issues found**: _____________________________

---

### PT-4: Background/Foreground Transitions

**Test**: Verify animation handles app state transitions

**Steps**:
1. Trigger animation by checking todo
2. Immediately background app (swipe up or home button)
3. Return to app quickly (< 1 second)
4. Observe animation state
5. Repeat with longer background time (> 5 seconds)

**Expected Result**:
- ✅ Animation completes correctly if app backgrounded during animation
- ✅ No visual glitches on foreground return
- ✅ Todo status updates persist correctly

**Tested on**:
- [ ] iOS Device: ___________
- [ ] Android Device: ___________

**Issues found**: _____________________________

---

## Visual Tests

### VT-1: Animation Effects

**Test**: Verify all visual effects are visible and correct

**Effects to Verify**:
- [ ] Scale pulse (grows slightly larger)
- [ ] Glow effect around checkbox
- [ ] Checkmark appears smoothly
- [ ] Color transition (if any)
- [ ] Opacity changes

**Steps**:
1. Trigger animation in well-lit environment
2. Observe each effect closely
3. Verify effects are clearly visible
4. Test in dark mode as well

**Expected Result**:
- ✅ All effects visible and smooth
- ✅ Effects work in both light and dark mode
- ✅ No jarring or abrupt transitions

**Tested on**:
- [ ] iOS Device (Light Mode): ___________
- [ ] iOS Device (Dark Mode): ___________
- [ ] Android Device (Light Mode): ___________
- [ ] Android Device (Dark Mode): ___________

**Issues found**: _____________________________

---

### VT-2: Screen Size Variations

**Test**: Verify animation scales correctly on different screen sizes

**Devices to Test**:
- [ ] Small screen (< 5.5 inches): iPhone SE, small Android
- [ ] Medium screen (5.5 - 6.5 inches): iPhone 13, Pixel 5
- [ ] Large screen (> 6.5 inches): iPhone 15 Pro Max, Galaxy S23 Ultra

**Expected Result**:
- ✅ Animation scales proportionally to screen size
- ✅ Effects remain visible on small screens
- ✅ Effects don't appear too large on big screens

**Tested on**:
- [ ] Small: ___________
- [ ] Medium: ___________
- [ ] Large: ___________

**Issues found**: _____________________________

---

### VT-3: Orientation Changes

**Test**: Verify animation handles rotation gracefully

**Steps**:
1. Open feed in portrait mode
2. Trigger animation
3. Rotate device to landscape during animation
4. Verify animation completes correctly
5. Repeat: rotate before animation starts

**Expected Result**:
- ✅ Animation adapts to orientation change
- ✅ No visual glitches during rotation
- ✅ Todo layout updates correctly

**Tested on**:
- [ ] iOS Device: ___________
- [ ] Android Device: ___________

**Issues found**: _____________________________

---

## Edge Cases

### EC-1: Very Long Todo Descriptions

**Test**: Verify animation works with truncated todos

**Steps**:
1. Create todo with 200+ character description
2. Verify description is truncated with "...plus"
3. Trigger animation by checking todo
4. Verify animation doesn't affect truncation
5. Verify animation area doesn't clip text

**Expected Result**:
- ✅ Animation plays correctly with long text
- ✅ Text truncation remains correct
- ✅ No text overflow during animation

**Tested on**:
- [ ] iOS Device: ___________
- [ ] Android Device: ___________

**Issues found**: _____________________________

---

### EC-2: Many Todos in View

**Test**: Verify animation performs with many visible todos

**Steps**:
1. Create idea with 20+ todos
2. Scroll to view 5-10 todos on screen
3. Trigger animation on todo at top
4. Trigger animation on todo at bottom
5. Trigger animation on middle todo

**Expected Result**:
- ✅ Animation performs consistently regardless of position
- ✅ No performance degradation with many todos
- ✅ Scrolling remains smooth during animation

**Tested on**:
- [ ] iOS Device: ___________
- [ ] Android Device: ___________
- [ ] Low-end Device: ___________

**Issues found**: _____________________________

---

### EC-3: Slow Network Conditions

**Test**: Verify animation doesn't wait for network response

**Setup**:
- Enable Developer Options → Throttle Network (slow 3G)

**Steps**:
1. Enable network throttling
2. Trigger animation by checking todo
3. Verify animation plays immediately (optimistic update)
4. Verify animation doesn't wait for server response

**Expected Result**:
- ✅ Animation plays immediately without network dependency
- ✅ Todo status updates optimistically
- ✅ If network fails, todo reverts with error message

**Tested on**:
- [ ] iOS Device: ___________
- [ ] Android Device: ___________

**Issues found**: _____________________________

---

## Accessibility Tests

### AT-1: Reduced Motion Preference

**Test**: Verify animation respects system accessibility settings

**Steps**:
1. Enable Reduce Motion (iOS Settings → Accessibility → Motion)
2. Or enable Remove Animations (Android Settings → Accessibility)
3. Trigger animation by checking todo
4. Verify animation is disabled or simplified

**Expected Result**:
- ✅ Animation respects reduced motion setting
- ✅ Todo still updates correctly without animation
- ✅ Haptic feedback still works (if available)

**Tested on**:
- [ ] iOS Device (Reduce Motion ON): ___________
- [ ] Android Device (Remove Animations ON): ___________

**Issues found**: _____________________________

---

## Summary

**Total Issues Found**: _____

**Critical Issues (blocking release)**: _____
- List critical issues here

**Non-Critical Issues (can defer)**: _____
- List non-critical issues here

**Device Compatibility**:
- [ ] iOS devices: PASS / FAIL
- [ ] Android devices: PASS / FAIL
- [ ] Low-end devices: PASS / FAIL

**Overall Verdict**:
- [ ] ✅ PASS - Ready for production
- [ ] ⚠️ PASS WITH CONCERNS - Minor issues, non-blocking
- [ ] ❌ FAIL - Critical issues found, needs fixes

**Tested by**: _____________
**Date**: _____________
**Notes**: _____________________________

---

## Issue Reporting

If issues are found during testing, report them with:

1. **Device Details**: Model, OS version, screen size
2. **Reproduction Steps**: Exact steps to reproduce
3. **Expected vs Actual**: What should happen vs what happens
4. **Screenshots/Video**: Visual evidence of issue
5. **Frequency**: Always / Sometimes / Rare
6. **Severity**: Critical / High / Medium / Low

Create GitHub issues with label `bug:animation` and reference this checklist.
