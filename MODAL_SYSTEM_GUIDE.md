# Modal System Implementation Guide

This guide explains how to use the modal system in your Farm Slot Game.

## Overview

The modal system consists of the following components:

1. **ModalManager** - Central controller for all modals (Singleton)
2. **BaseModal** - Base class with animations and common functionality
3. **WinModal** - Shows win results with animated counting
4. **NotEnoughCoinsModal** - Shows when player lacks coins
5. **SettingsModal** - Game settings and preferences

## Architecture

```
ModalManager (Singleton)
    ├── Manages modal lifecycle
    ├── Handles modal queue
    └── Controls show/hide animations

BaseModal (Abstract Base Class)
    ├── Background overlay
    ├── Show/Hide animations
    ├── Close button handling
    └── Lifecycle hooks

Specific Modals (WinModal, NotEnoughCoinsModal, etc.)
    └── Inherit from BaseModal
    └── Implement specific UI and logic
```

## Setup in Cocos Creator

### 1. Create ModalManager Node

1. In your Canvas or a persistent node, add a new empty Node named `ModalManager`
2. Add the `ModalManager` component to this node
3. Create a child node named `ModalContainer` (or it will be auto-created)
4. Assign the `ModalContainer` to the ModalManager's `modalContainer` property

### 2. Create Modal Prefabs

For each modal (WinModal, NotEnoughCoinsModal, SettingsModal):

#### Win Modal Structure:
```
WinModal (Root Node)
├── Background (Sprite with UIOpacity)
└── ModalContent (Container with animations)
    ├── CloseButton
    ├── TitleLabel (Label) - "YOU WIN!", "BIG WIN!", etc.
    ├── WinAmountLabel (Label) - Shows win amount
    ├── WinMultiplierLabel (Label) - Shows multiplier
    └── CollectButton (Button)
```

#### Not Enough Coins Modal Structure:
```
NotEnoughCoinsModal (Root Node)
├── Background (Sprite with UIOpacity)
└── ModalContent (Container with animations)
    ├── CloseButton
    ├── MessageLabel (Label) - "Not enough coins!"
    ├── RequiredAmountLabel (Label) - Shows required amount
    ├── CurrentAmountLabel (Label) - Shows current coins
    ├── BuyCoinsButton (Button)
    ├── WatchAdButton (Button)
    └── LowerBetButton (Button)
```

#### Settings Modal Structure:
```
SettingsModal (Root Node)
├── Background (Sprite with UIOpacity)
└── ModalContent (Container with animations)
    ├── CloseButton
    ├── SoundToggle (Toggle)
    ├── MusicToggle (Toggle)
    ├── SoundVolumeSlider (Slider)
    ├── MusicVolumeSlider (Slider)
    ├── VersionLabel (Label)
    ├── ResetButton (Button)
    ├── PrivacyPolicyButton (Button)
    └── TermsButton (Button)
```

### 3. Configure Modal Components

For each modal prefab:

1. Add the appropriate modal component to the root node:
   - `WinModal` for Win Modal
   - `NotEnoughCoinsModal` for Not Enough Coins Modal
   - `SettingsModal` for Settings Modal

2. Assign all the node references in the inspector:
   - `background` - The semi-transparent background node
   - `modalContent` - The main content container
   - `closeButton` - The X close button
   - Other UI elements specific to each modal

3. Configure animation settings:
   - `enableAnimation` - Enable/disable show/hide animations (default: true)
   - `animationDuration` - Duration of animations in seconds (default: 0.3)
   - `enableBackgroundClose` - Allow clicking background to close (default: true)

### 4. Assign Prefabs to ModalManager

In the ModalManager component inspector:
- Drag the WinModal prefab to `winModalPrefab`
- Drag the NotEnoughCoinsModal prefab to `notEnoughCoinsModalPrefab`
- Drag the SettingsModal prefab to `settingsModalPrefab`

## Usage in Code

### Show Win Modal

```typescript
const modalManager = ModalManager.getInstance();
if (modalManager) {
  modalManager.showWinModal(winAmount, betAmount);
}
```

### Show Not Enough Coins Modal

```typescript
const modalManager = ModalManager.getInstance();
if (modalManager) {
  modalManager.showNotEnoughCoinsModal(requiredAmount, currentAmount);
}
```

### Show Settings Modal

```typescript
const modalManager = ModalManager.getInstance();
if (modalManager) {
  modalManager.showSettingsModal();
}
```

### Show Custom Modal

```typescript
const modalManager = ModalManager.getInstance();
if (modalManager) {
  modalManager.showModal("ModalName", { customData: "value" });
}
```

### Close Specific Modal

```typescript
const modalManager = ModalManager.getInstance();
if (modalManager) {
  modalManager.closeModal("WinModal");
}
```

### Close All Modals

```typescript
const modalManager = ModalManager.getInstance();
if (modalManager) {
  modalManager.closeAllModals();
}
```

### Check if Modal is Active

```typescript
const modalManager = ModalManager.getInstance();
if (modalManager) {
  const isWinModalActive = modalManager.isModalActive("WinModal");
  const isAnyModalActive = modalManager.isAnyModalActive();
}
```

## Creating Custom Modals

To create a new custom modal:

### 1. Create Modal Class

```typescript
import { _decorator, Label } from "cc";
import { BaseModal } from "./BaseModal";
const { ccclass, property } = _decorator;

@ccclass("MyCustomModal")
export class MyCustomModal extends BaseModal {
  @property(Label)
  titleLabel: Label = null!;

  @property(Label)
  messageLabel: Label = null!;

  protected onDataSet(data: any): void {
    // Called when modal data is set
    if (this.titleLabel) {
      this.titleLabel.string = data.title || "Title";
    }
    if (this.messageLabel) {
      this.messageLabel.string = data.message || "Message";
    }
  }

  protected onBeforeShow(): void {
    // Called before modal is shown
    console.log("Modal is about to show");
  }

  protected onAfterShow(): void {
    // Called after show animation completes
    console.log("Modal is now visible");
  }

  protected onBeforeHide(): void {
    // Called before modal is hidden
    console.log("Modal is about to hide");
  }

  protected onAfterHide(): void {
    // Called after hide animation completes
    console.log("Modal is now hidden");
  }

  // Custom button handlers
  public onConfirmClick(): void {
    console.log("Confirm clicked");
    this.hide();
  }
}
```

### 2. Add to ModalManager

```typescript
// In ModalManager.ts
@property(Prefab)
myCustomModalPrefab: Prefab = null!;

// In getPrefabByName method
private getPrefabByName(modalName: string): Prefab | null {
  switch (modalName) {
    case "MyCustomModal":
      return this.myCustomModalPrefab;
    // ... other cases
  }
}

// Add convenience method
public showMyCustomModal(title: string, message: string): void {
  this.showModal("MyCustomModal", { title, message });
}
```

## Features

### Modal Queue System
- Modals are automatically queued if another modal is showing
- Modals show one at a time in order
- Queue is processed automatically

### Animations
- Smooth fade-in/out for background overlay
- Scale animation for modal content (with backOut/backIn easing)
- Customizable animation duration
- Can be disabled if needed

### Background Overlay
- Semi-transparent dark background
- Optional click-to-close functionality
- Prevents interaction with game while modal is open

### Base Modal Features
- Close button handling
- Background click-to-close
- Show/Hide with callbacks
- Lifecycle hooks for customization
- Data passing system

## Integration with GameManager

The modal system is already integrated with GameManager:

1. **Not Enough Coins**: Automatically shown when player tries to spin without enough coins
2. **Win Modal**: Automatically shown for wins with 3x multiplier or higher

To customize when modals appear, edit the GameManager code:

```typescript
// In GameManager.ts

// Show not enough coins modal
if (this.playerCoins < this.currentBet) {
  const modalManager = ModalManager.getInstance();
  if (modalManager) {
    modalManager.showNotEnoughCoinsModal(this.currentBet, this.playerCoins);
  }
  return;
}

// Show win modal for significant wins
const winMultiplier = this.currentBet > 0 ? amount / this.currentBet : 0;
if (winMultiplier >= 3) {
  const modalManager = ModalManager.getInstance();
  if (modalManager) {
    modalManager.showWinModal(amount, this.currentBet);
  }
}
```

## Best Practices

1. **Always check getInstance()**: ModalManager uses singleton pattern
2. **Use modal queue**: System handles multiple modals automatically
3. **Customize lifecycle hooks**: Override onDataSet, onBeforeShow, etc.
4. **Clean up resources**: Always call super.onDestroy() in custom modals
5. **Handle button clicks**: Add button handlers in modal classes
6. **Test animations**: Adjust animationDuration for best feel
7. **Use prefabs**: All modals should be prefabs for reusability

## Troubleshooting

### Modal doesn't show
- Check if ModalManager is properly initialized
- Verify prefab is assigned in ModalManager
- Check console for warnings

### Animation looks wrong
- Adjust `animationDuration` property
- Check that `modalContent` node is properly assigned
- Verify UIOpacity component is on background

### Background click doesn't close modal
- Ensure `enableBackgroundClose` is true
- Check that background has Button component
- Verify background covers full screen

### Modal appears behind other UI
- Ensure ModalContainer is at top of hierarchy
- Check z-order and layer settings
- Verify Canvas render mode

## File Structure

```
assets/scripts/ui/
├── ModalManager.ts          # Central modal controller
├── BaseModal.ts            # Base modal class
├── WinModal.ts            # Win result modal
├── NotEnoughCoinsModal.ts # Insufficient coins modal
└── SettingsModal.ts       # Game settings modal
```

## Next Steps

1. Create modal prefabs in Cocos Creator
2. Design modal UI with sprites and fonts
3. Assign references in inspector
4. Test modals in-game
5. Customize animations and timing
6. Add more modals as needed

## Additional Resources

- Cocos Creator UI System: https://docs.cocos.com/creator/manual/en/ui-system/
- Tween Animation: https://docs.cocos.com/creator/manual/en/tween/
- Component System: https://docs.cocos.com/creator/manual/en/scripting/

---

**Created**: December 18, 2025
**Version**: 1.0
**Game**: Farm Slot Game


