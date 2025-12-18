# Modal System - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Add ModalManager to Canvas (1 min)

1. Select your **Canvas** node in Cocos Creator
2. Click **Add Component** → **ModalManager**
3. Create child node: Right-click Canvas → **Create Empty Node** → Name it `ModalContainer`
4. Drag `ModalContainer` to ModalManager's `modalContainer` field

### Step 2: Create Modal Prefabs (2 min per modal)

#### Win Modal:
```
Create Node → Name: "WinModal"
  └─ Add Component → WinModal
  └─ Create structure:
     ├─ Background (Sprite, add UIOpacity)
     └─ Content
        ├─ Title (Label)
        ├─ WinAmount (Label)
        ├─ Multiplier (Label)
        ├─ CloseButton (Button)
        └─ CollectButton (Button)
```

#### Not Enough Coins Modal:
```
Create Node → Name: "NotEnoughCoinsModal"
  └─ Add Component → NotEnoughCoinsModal
  └─ Create structure:
     ├─ Background (Sprite, add UIOpacity)
     └─ Content
        ├─ Message (Label)
        ├─ RequiredAmount (Label)
        ├─ CurrentAmount (Label)
        ├─ CloseButton (Button)
        ├─ BuyCoinsButton (Button)
        └─ WatchAdButton (Button)
```

### Step 3: Assign References (1 min)

For each modal:
1. Select the modal root node
2. In Inspector, find the modal component
3. Drag nodes to their respective fields:
   - `background` → Background node
   - `modalContent` → Content node
   - `closeButton` → Close button
   - All labels and buttons to their fields

### Step 4: Save as Prefabs and Link (1 min)

1. Drag each modal node to Assets to create prefab
2. Select Canvas → Find ModalManager component
3. Drag prefabs to:
   - WinModal prefab → `winModalPrefab`
   - NotEnoughCoinsModal prefab → `notEnoughCoinsModalPrefab`

### Step 5: Use in Code (Already Done! ✅)

The modals are already integrated with GameManager:
- **Not enough coins** → Shows automatically when spinning without funds
- **Win modal** → Shows automatically for 3x+ wins

## 🎮 Usage Examples

### Show Win Modal
```typescript
const modalManager = ModalManager.getInstance();
modalManager.showWinModal(100.50, 10.00);
```

### Show Not Enough Coins
```typescript
const modalManager = ModalManager.getInstance();
modalManager.showNotEnoughCoinsModal(10.00, 5.50);
```

### Show Settings
```typescript
const modalManager = ModalManager.getInstance();
modalManager.showSettingsModal();
```

## 🎨 Quick Styling Tips

### Background Overlay
- Color: Black (#000000)
- Opacity: 200 (78%)
- Size: Full screen (use Widget component)

### Modal Content
- Add drop shadow for depth
- Use white or bright colors
- Scale: Start at 1, 1, 1
- Anchor: Center (0.5, 0.5)

### Buttons
- Add ButtonController for click effects
- Use bright colors for primary actions
- Size: At least 120x50 for touch targets

## 🔧 Common Customizations

### Change Win Modal Title Thresholds
In `WinModal.ts`:
```typescript
if (this.winMultiplier >= 20) {
  this.titleLabel.string = "MEGA WIN!";
} else if (this.winMultiplier >= 10) {
  this.titleLabel.string = "BIG WIN!";
}
```

### Change Animation Speed
In modal prefab Inspector:
- `animationDuration`: 0.3 (default) → 0.5 (slower) or 0.15 (faster)

### Disable Background Click to Close
In modal prefab Inspector:
- `enableBackgroundClose`: uncheck

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Modal doesn't show | Check prefab is assigned in ModalManager |
| No animation | Check `enableAnimation` is checked |
| Background click doesn't work | Add Button component to Background node |
| Modal appears behind UI | Move ModalContainer to bottom of Canvas children |

## 📁 Created Files

```
assets/scripts/ui/
├── ModalManager.ts          ✅ Central controller
├── BaseModal.ts            ✅ Base class
├── WinModal.ts            ✅ Win results
├── NotEnoughCoinsModal.ts ✅ Insufficient funds
├── SettingsModal.ts       ✅ Game settings
└── ModalButton.ts         ✅ Button helper

GameManager.ts              ✅ Integrated
MODAL_SYSTEM_GUIDE.md      ✅ Full documentation
```

## 🎯 Next Steps

1. ✅ Setup ModalManager on Canvas
2. ✅ Create modal prefabs
3. ✅ Assign references
4. ✅ Link prefabs to ModalManager
5. 🎮 Test in play mode!
6. 🎨 Customize styling
7. ➕ Add more modals as needed

## 💡 Pro Tips

- Use **ModalButton** component for easy button integration
- Test modals individually before integrating
- Keep modal content centered and readable
- Use icons in addition to text for clarity
- Consider different screen sizes/aspect ratios
- Add sound effects to button clicks

---

Need more help? Check **MODAL_SYSTEM_GUIDE.md** for detailed documentation!


