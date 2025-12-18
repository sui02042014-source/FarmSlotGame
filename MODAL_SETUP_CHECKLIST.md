# Modal System Setup Checklist

Use this checklist to set up the modal system in Cocos Creator.

## ✅ Phase 1: ModalManager Setup (5 minutes)

### Step 1: Add ModalManager to Scene
- [x] Open `GameScene` in Cocos Creator
- [x] Select the `Canvas` node
- [x] Click `Add Component` → Search for `ModalManager`
- [x] Add the component

### Step 2: Create Modal Container
- [x] Right-click `Canvas` → `Create Empty Node`
- [x] Rename to `ModalContainer`
- [x] Drag `ModalContainer` to ModalManager's `modalContainer` field
- [x] Move `ModalContainer` to bottom of Canvas children (top render order)

**Verify:** ModalManager component shows green checkmark in Inspector

---

## ✅ Phase 2: Win Modal Prefab (10 minutes)

### Step 1: Create Win Modal Structure
- [ ] Create new Node: `WinModal`
- [ ] Add component `WinModal` to root node

### Step 2: Create Background
- [ ] Create child Sprite: `Background`
- [ ] Set sprite to solid color (black)
- [ ] Add `UIOpacity` component
- [ ] Add `Button` component (for click-to-close)
- [ ] Set size to full screen (use Widget: stretch all)

### Step 3: Create Modal Content
- [ ] Create child Node: `Content`
- [ ] Set anchor to center (0.5, 0.5)
- [ ] Add background sprite (rounded rectangle)

### Step 4: Add UI Elements to Content
- [ ] Create child Button: `CloseButton` (X icon, top-right)
- [ ] Create child Label: `TitleLabel` (text: "YOU WIN!")
- [ ] Create child Label: `WinAmountLabel` (text: "$0.00")
- [ ] Create child Label: `WinMultiplierLabel` (text: "0.0x")
- [ ] Create child Button: `CollectButton` (text: "COLLECT")

### Step 5: Assign References
Select `WinModal` root node, in Inspector:
- [ ] Drag `Background` to `background` field
- [ ] Drag `Content` to `modalContent` field
- [ ] Drag `CloseButton` to `closeButton` field
- [ ] Drag `TitleLabel` to `titleLabel` field
- [ ] Drag `WinAmountLabel` to `winAmountLabel` field
- [ ] Drag `WinMultiplierLabel` to `winMultiplierLabel` field

### Step 6: Configure Button Events
- [ ] Select `CollectButton`
- [ ] Add Click Event → Target: `WinModal`, Component: `WinModal`, Method: `onCollectButtonClick`

### Step 7: Save as Prefab
- [ ] Drag `WinModal` from Hierarchy to Assets folder
- [ ] Delete `WinModal` from scene
- [ ] Verify prefab exists in Assets

**Verify:** Open prefab, check all references are assigned (no "None" values)

---

## ✅ Phase 3: Not Enough Coins Modal (10 minutes)

### Step 1: Create Modal Structure
- [ ] Create new Node: `NotEnoughCoinsModal`
- [ ] Add component `NotEnoughCoinsModal`

### Step 2: Create Background
- [ ] Create child Sprite: `Background`
- [ ] Set sprite to solid color (black)
- [ ] Add `UIOpacity` component
- [ ] Add `Button` component
- [ ] Set size to full screen (Widget: stretch all)

### Step 3: Create Modal Content
- [ ] Create child Node: `Content`
- [ ] Set anchor to center (0.5, 0.5)
- [ ] Add background sprite

### Step 4: Add UI Elements
- [ ] Create child Button: `CloseButton` (X icon)
- [ ] Create child Label: `MessageLabel` (text: "Not enough coins!")
- [ ] Create child Label: `RequiredAmountLabel` (text: "Required: $0.00")
- [ ] Create child Label: `CurrentAmountLabel` (text: "Your coins: $0.00")
- [ ] Create child Button: `BuyCoinsButton` (text: "BUY COINS")
- [ ] Create child Button: `WatchAdButton` (text: "WATCH AD")
- [ ] Create child Button: `LowerBetButton` (text: "LOWER BET")

### Step 5: Assign References
Select `NotEnoughCoinsModal` root:
- [ ] Drag `Background` to `background` field
- [ ] Drag `Content` to `modalContent` field
- [ ] Drag `CloseButton` to `closeButton` field
- [ ] Drag `MessageLabel` to `messageLabel` field
- [ ] Drag `RequiredAmountLabel` to `requiredAmountLabel` field
- [ ] Drag `CurrentAmountLabel` to `currentAmountLabel` field
- [ ] Drag `BuyCoinsButton` to `buyCoinsButton` field
- [ ] Drag `WatchAdButton` to `watchAdButton` field

### Step 6: Configure Button Events
- [ ] `BuyCoinsButton` → Click Event → `onBuyCoinsClick`
- [ ] `WatchAdButton` → Click Event → `onWatchAdClick`
- [ ] `LowerBetButton` → Click Event → `onLowerBetClick`

### Step 7: Save as Prefab
- [ ] Drag to Assets folder
- [ ] Delete from scene
- [ ] Verify prefab

**Verify:** All button events configured, no console errors

---

## ✅ Phase 4: Settings Modal (10 minutes)

### Step 1: Create Modal Structure
- [ ] Create new Node: `SettingsModal`
- [ ] Add component `SettingsModal`

### Step 2: Create Background
- [ ] Create child Sprite: `Background`
- [ ] Setup same as other modals

### Step 3: Create Modal Content
- [ ] Create child Node: `Content`
- [ ] Add background sprite

### Step 4: Add UI Elements
- [ ] Create child Button: `CloseButton`
- [ ] Create child Label: `TitleLabel` (text: "SETTINGS")
- [ ] Create child Toggle: `SoundToggle` (text: "Sound")
- [ ] Create child Toggle: `MusicToggle` (text: "Music")
- [ ] Create child Slider: `SoundVolumeSlider`
- [ ] Create child Slider: `MusicVolumeSlider`
- [ ] Create child Label: `VersionLabel` (text: "Version 1.0.0")
- [ ] Create child Button: `ResetButton` (text: "RESET")
- [ ] Create child Button: `PrivacyPolicyButton` (text: "PRIVACY")
- [ ] Create child Button: `TermsButton` (text: "TERMS")

### Step 5: Assign References
Select `SettingsModal` root:
- [ ] Drag all elements to corresponding fields
- [ ] Verify all references assigned

### Step 6: Configure Button Events
- [ ] `ResetButton` → `onResetClick`
- [ ] `PrivacyPolicyButton` → `onPrivacyPolicyClick`
- [ ] `TermsButton` → `onTermsClick`

### Step 7: Save as Prefab
- [ ] Save to Assets
- [ ] Delete from scene

**Verify:** Toggles and sliders respond in preview

---

## ✅ Phase 5: Link Prefabs to ModalManager (2 minutes)

- [ ] Select `Canvas` node
- [ ] Find `ModalManager` component in Inspector
- [ ] Drag `WinModal` prefab to `winModalPrefab` field
- [ ] Drag `NotEnoughCoinsModal` prefab to `notEnoughCoinsModalPrefab` field
- [ ] Drag `SettingsModal` prefab to `settingsModalPrefab` field

**Verify:** All three prefab fields have assignments (not "None")

---

## ✅ Phase 6: Testing (10 minutes)

### Test 1: Win Modal
- [ ] Click Play in Cocos Creator
- [ ] Open Console (Ctrl/Cmd + Shift + J)
- [ ] Type: `cc.director.getScene().getChildByName("Canvas").getComponent("ModalManager").showWinModal(100, 10)`
- [ ] Press Enter
- [ ] **Expected:** Win modal appears with animation
- [ ] Click background → Modal closes
- [ ] Click Collect button → Modal closes
- [ ] Check console for no errors

### Test 2: Not Enough Coins Modal
- [ ] Type: `cc.director.getScene().getChildByName("Canvas").getComponent("ModalManager").showNotEnoughCoinsModal(10, 5)`
- [ ] **Expected:** Not enough coins modal appears
- [ ] Test all three buttons (Buy, Watch, Lower)
- [ ] Each should close modal and log to console

### Test 3: Settings Modal
- [ ] Type: `cc.director.getScene().getChildByName("Canvas").getComponent("ModalManager").showSettingsModal()`
- [ ] **Expected:** Settings modal appears
- [ ] Toggle sound/music switches
- [ ] Adjust volume sliders
- [ ] Click Reset button
- [ ] Close modal

### Test 4: Modal Queue
- [ ] Call `showWinModal()` 
- [ ] Immediately call `showSettingsModal()`
- [ ] **Expected:** Win modal shows first, Settings queued
- [ ] Close Win modal
- [ ] **Expected:** Settings modal automatically appears

### Test 5: In-Game Integration
- [ ] Play the game normally
- [ ] Try to spin without enough coins
- [ ] **Expected:** Not enough coins modal appears
- [ ] Get a big win (3x or more)
- [ ] **Expected:** Win modal appears

**Verify:** All tests pass, no console errors

---

## ✅ Phase 7: Styling & Polish (15 minutes)

### Background Overlay
- [ ] Set opacity to 200 (78%)
- [ ] Color: Black (#000000)
- [ ] Full screen coverage

### Modal Content
- [ ] Add rounded corners (9-slice sprite)
- [ ] Background color: White or light color
- [ ] Add drop shadow (optional)
- [ ] Padding: 20-30 pixels

### Typography
- [ ] Title: Large, bold font (32-48pt)
- [ ] Body text: Medium font (20-24pt)
- [ ] Win amount: Extra large (48-64pt)
- [ ] Colors: High contrast

### Buttons
- [ ] Minimum size: 120x50 pixels
- [ ] Add hover/pressed states
- [ ] Primary button: Bright color (green, blue)
- [ ] Secondary button: Gray or outline
- [ ] Add ButtonController for animations

### Icons
- [ ] Close button: X icon (white on dark circle)
- [ ] Add coin icons near coin amounts
- [ ] Add settings gear icon

**Verify:** Modals look professional and match game theme

---

## ✅ Phase 8: Optimization (5 minutes)

### Performance
- [ ] Test on mobile device (if targeting mobile)
- [ ] Check animation smoothness
- [ ] Verify no memory leaks (open/close modals 10+ times)

### Configuration
- [ ] Adjust `animationDuration` if needed (default: 0.3s)
- [ ] Set `enableBackgroundClose` based on UX preference
- [ ] Enable/disable animations for slower devices

### Debug Mode
- [ ] In ModalManager, set `debugLogs: true` (temporarily)
- [ ] Test all modals
- [ ] Check console logs for proper lifecycle
- [ ] Set back to `false` for production

**Verify:** Smooth 60fps, no lag or stuttering

---

## ✅ Phase 9: Optional Enhancements

### Sound Effects
- [ ] Add sound to modal open
- [ ] Add sound to modal close
- [ ] Add sound to button clicks
- [ ] Hook up to AudioManager

### Additional Modals
- [ ] Create Daily Bonus modal
- [ ] Create Level Up modal
- [ ] Create Shop modal
- [ ] Create Leaderboard modal

### Advanced Features
- [ ] Add modal transitions (slide, bounce)
- [ ] Implement modal stacking (multiple visible)
- [ ] Add blur effect to background
- [ ] Particle effects on win modal

---

## 🎯 Final Verification Checklist

- [ ] All modal prefabs created and saved
- [ ] All references assigned in Inspector
- [ ] All button events configured
- [ ] Prefabs linked to ModalManager
- [ ] All modals tested individually
- [ ] Modal queue tested
- [ ] In-game integration verified
- [ ] No console errors or warnings
- [ ] Styling looks professional
- [ ] Animations smooth and polished
- [ ] Mobile performance acceptable (if applicable)
- [ ] Documentation read and understood

---

## 📊 Progress Summary

- **Phase 1:** ModalManager Setup → ⏱️ 5 min
- **Phase 2:** Win Modal → ⏱️ 10 min
- **Phase 3:** Not Enough Coins Modal → ⏱️ 10 min
- **Phase 4:** Settings Modal → ⏱️ 10 min
- **Phase 5:** Link Prefabs → ⏱️ 2 min
- **Phase 6:** Testing → ⏱️ 10 min
- **Phase 7:** Styling → ⏱️ 15 min
- **Phase 8:** Optimization → ⏱️ 5 min

**Total Time:** ~70 minutes

---

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Modal doesn't appear | Check prefab is assigned in ModalManager |
| Animation stutters | Reduce `animationDuration` or disable animations |
| Background doesn't cover screen | Add Widget component, set to stretch all sides |
| Button clicks don't work | Check Button component exists and event is configured |
| Multiple modals show at once | Check `isShowingModal` flag in ModalManager (bug if true) |
| Modal appears behind UI | Move ModalContainer to bottom of Canvas children list |
| Labels don't update | Check references are assigned in Inspector |
| Close button doesn't work | Check `closeButton` reference is assigned |
| TypeScript errors | Run `npm install` and restart Cocos Creator |
| Prefab changes don't apply | Delete prefab instance, re-instantiate from prefab |

---

## 📞 Need Help?

1. Check console for error messages
2. Read `MODAL_QUICK_START.md` for quick reference
3. Read `MODAL_SYSTEM_GUIDE.md` for detailed docs
4. Check `MODAL_ARCHITECTURE.md` for system design
5. Enable `debugLogs: true` in ModalManager for detailed logging

---

**Setup Complete! 🎉**

Your modal system is now ready to use. Test thoroughly and enjoy your professional modal UI!

---

**Last Updated:** December 18, 2025
**Version:** 1.0.0


