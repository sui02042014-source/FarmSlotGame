# Modal System Architecture

## 🏗️ System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Canvas (Root)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    ModalManager (Singleton)               │  │
│  │  • Manages all modals                                     │  │
│  │  • Handles modal queue                                    │  │
│  │  • Controls show/hide lifecycle                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │            ModalContainer                           │  │  │
│  │  │  (Contains instantiated modal instances)            │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌────────────────────────────────────────────┐    │  │  │
│  │  │  │  Modal Instance (e.g., WinModal)          │    │  │  │
│  │  │  │  ┌──────────────────────────────────────┐ │    │  │  │
│  │  │  │  │         Background                   │ │    │  │  │
│  │  │  │  │  • Semi-transparent overlay          │ │    │  │  │
│  │  │  │  │  • Click to close (optional)         │ │    │  │  │
│  │  │  │  └──────────────────────────────────────┘ │    │  │  │
│  │  │  │  ┌──────────────────────────────────────┐ │    │  │  │
│  │  │  │  │      ModalContent                    │ │    │  │  │
│  │  │  │  │  • Animated container                │ │    │  │  │
│  │  │  │  │  • Scale & fade effects              │ │    │  │  │
│  │  │  │  │  ┌────────────────────────────────┐  │ │    │  │  │
│  │  │  │  │  │  Labels, Buttons, UI Elements  │  │ │    │  │  │
│  │  │  │  │  └────────────────────────────────┘  │ │    │  │  │
│  │  │  │  └──────────────────────────────────────┘ │    │  │  │
│  │  │  └────────────────────────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Class Hierarchy

```
Component (Cocos Creator)
    │
    ├── ModalManager (Singleton)
    │   • getInstance()
    │   • showModal(name, data)
    │   • closeModal(name)
    │   • closeAllModals()
    │   • Modal queue management
    │
    └── BaseModal (Abstract)
        │   • show(callback)
        │   • hide()
        │   • setData(data)
        │   • playShowAnimation()
        │   • playHideAnimation()
        │   • Lifecycle hooks
        │
        ├── WinModal
        │   • Win amount display
        │   • Animated counting
        │   • Win multiplier
        │   • Collect button
        │
        ├── NotEnoughCoinsModal
        │   • Required vs current coins
        │   • Buy coins action
        │   • Watch ad action
        │   • Lower bet action
        │
        └── SettingsModal
            • Sound/Music toggles
            • Volume sliders
            • Settings persistence
```

## 📊 Data Flow

```
┌─────────────┐
│ GameManager │ (or any component)
└──────┬──────┘
       │ 1. Call showModal()
       ▼
┌──────────────┐
│ModalManager  │
│ getInstance()│
└──────┬───────┘
       │ 2. Get prefab
       │ 3. Instantiate
       ▼
┌──────────────┐
│ Modal Prefab │ ──────┐
└──────────────┘       │
       │               │
       │ 4. Set parent │
       ▼               │
┌──────────────┐       │
│ModalContainer│◄──────┘
└──────┬───────┘
       │ 5. Set data
       ▼
┌──────────────┐
│ Modal Instance│
│ (WinModal)   │
└──────┬───────┘
       │ 6. Call show()
       ▼
┌──────────────┐
│ BaseModal    │
│ show()       │
└──────┬───────┘
       │ 7. Play animation
       │ 8. Display UI
       ▼
┌──────────────┐
│ User sees    │
│ modal        │
└──────┬───────┘
       │ 9. User clicks close
       ▼
┌──────────────┐
│ BaseModal    │
│ hide()       │
└──────┬───────┘
       │ 10. Play hide animation
       ▼
┌──────────────┐
│ModalManager  │
│ onModalClosed│
└──────┬───────┘
       │ 11. Destroy instance
       │ 12. Process queue
       ▼
┌──────────────┐
│ Next modal   │
│ (if any)     │
└──────────────┘
```

## 🔀 Modal Queue System

```
Time ──────────────────────────────────────────────►

Modal 1: showWinModal()
         ┌─────────────────┐
         │   WinModal      │
         │   [SHOWING]     │
         └─────────────────┘

Modal 2: showSettingsModal() (called while WinModal is open)
         ┌─────────────┐
         │   QUEUED    │
         │  Settings   │
         └─────────────┘

         ─── User closes WinModal ───

                           ┌─────────────────┐
                           │ SettingsModal   │
                           │   [SHOWING]     │
                           └─────────────────┘

Modal 3: showNotEnoughCoinsModal() (called while Settings is open)
                           ┌─────────────┐
                           │   QUEUED    │
                           │ NotEnough   │
                           └─────────────┘

         ─── User closes SettingsModal ───

                                             ┌─────────────────┐
                                             │NotEnoughModal   │
                                             │   [SHOWING]     │
                                             └─────────────────┘
```

## 🎬 Animation Timeline

```
Show Animation (0.3s default):

Time:     0s                    0.3s
          │──────────────────────│

Background Opacity:
          0 ──────────────────► 200
          [transparent]         [semi-transparent]

Modal Content Scale:
          0.5 ─────────────────► 1.0
          [small]  backOut      [normal]
                   easing

Lifecycle:
onBeforeShow() │  playShowAnimation()  │ onAfterShow()
───────────────┴───────────────────────┴────────────►


Hide Animation (0.15s default):

Time:     0s                    0.15s
          │──────────────────────│

Background Opacity:
          200 ─────────────────► 0
          [visible]             [transparent]

Modal Content Scale:
          1.0 ──────────────────► 0.5
          [normal]  backIn       [small]
                    easing

Lifecycle:
onBeforeHide() │  playHideAnimation()  │ onAfterHide()
───────────────┴───────────────────────┴────────────►
                                                │
                                                └──► Callback
                                                └──► Destroy
```

## 🏛️ Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      ModalManager                           │
├─────────────────────────────────────────────────────────────┤
│ Properties:                                                 │
│  • modalContainer: Node                                     │
│  • winModalPrefab: Prefab                                   │
│  • notEnoughCoinsModalPrefab: Prefab                        │
│  • settingsModalPrefab: Prefab                              │
│  • activeModals: Map<string, Node>                          │
│  • modalQueue: Array<{name, data}>                          │
│  • isShowingModal: boolean                                  │
├─────────────────────────────────────────────────────────────┤
│ Methods:                                                    │
│  + getInstance(): ModalManager                              │
│  + showWinModal(winAmount, betAmount)                       │
│  + showNotEnoughCoinsModal(required, current)               │
│  + showSettingsModal()                                      │
│  + showModal(name, data)                                    │
│  + closeModal(name)                                         │
│  + closeAllModals()                                         │
│  + isModalActive(name): boolean                             │
│  + isAnyModalActive(): boolean                              │
│  - getPrefabByName(name): Prefab                            │
│  - onModalClosed(name)                                      │
│  - processQueue()                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         BaseModal                           │
├─────────────────────────────────────────────────────────────┤
│ Properties:                                                 │
│  • background: Node                                         │
│  • modalContent: Node                                       │
│  • closeButton: Node                                        │
│  • enableBackgroundClose: boolean                           │
│  • animationDuration: number                                │
│  • enableAnimation: boolean                                 │
│  # modalData: any                                           │
│  # closeCallback: () => void                                │
├─────────────────────────────────────────────────────────────┤
│ Methods:                                                    │
│  + show(callback?)                                          │
│  + hide()                                                   │
│  + setData(data)                                            │
│  # playShowAnimation(callback?)                             │
│  # playHideAnimation(callback?)                             │
│  # onCloseButtonClick()                                     │
│  # onBackgroundClick()                                      │
│  # onDataSet(data)          [Override in subclass]          │
│  # onBeforeShow()           [Override in subclass]          │
│  # onAfterShow()            [Override in subclass]          │
│  # onBeforeHide()           [Override in subclass]          │
│  # onAfterHide()            [Override in subclass]          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         WinModal                            │
│                    extends BaseModal                        │
├─────────────────────────────────────────────────────────────┤
│ Properties:                                                 │
│  • winAmountLabel: Label                                    │
│  • winMultiplierLabel: Label                                │
│  • titleLabel: Label                                        │
│  - winAmount: number                                        │
│  - betAmount: number                                        │
│  - winMultiplier: number                                    │
│  - numberCounter: NumberCounter                             │
├─────────────────────────────────────────────────────────────┤
│ Methods:                                                    │
│  # onDataSet(data)          [Override]                      │
│  # onAfterShow()            [Override]                      │
│  - updateUI()                                               │
│  - playPulseAnimation(node)                                 │
│  + onCollectButtonClick()                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   NotEnoughCoinsModal                       │
│                    extends BaseModal                        │
├─────────────────────────────────────────────────────────────┤
│ Properties:                                                 │
│  • messageLabel: Label                                      │
│  • requiredAmountLabel: Label                               │
│  • currentAmountLabel: Label                                │
│  • buyCoinsButton: Button                                   │
│  • watchAdButton: Button                                    │
│  - requiredAmount: number                                   │
│  - currentAmount: number                                    │
├─────────────────────────────────────────────────────────────┤
│ Methods:                                                    │
│  # onDataSet(data)          [Override]                      │
│  - updateUI()                                               │
│  - onBuyCoinsClick()                                        │
│  - onWatchAdClick()                                         │
│  + onLowerBetClick()                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      SettingsModal                          │
│                    extends BaseModal                        │
├─────────────────────────────────────────────────────────────┤
│ Properties:                                                 │
│  • soundToggle: Toggle                                      │
│  • musicToggle: Toggle                                      │
│  • soundVolumeSlider: Slider                                │
│  • musicVolumeSlider: Slider                                │
│  • versionLabel: Label                                      │
├─────────────────────────────────────────────────────────────┤
│ Methods:                                                    │
│  # onBeforeShow()           [Override]                      │
│  - loadSettings()                                           │
│  - onSoundToggle(toggle)                                    │
│  - onMusicToggle(toggle)                                    │
│  - onSoundVolumeChange(slider)                              │
│  - onMusicVolumeChange(slider)                              │
│  + onResetClick()                                           │
│  + onPrivacyPolicyClick()                                   │
│  + onTermsClick()                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       ModalButton                           │
├─────────────────────────────────────────────────────────────┤
│ Properties:                                                 │
│  • modalName: string                                        │
│  • customData: string (JSON)                                │
│  - button: Button                                           │
├─────────────────────────────────────────────────────────────┤
│ Methods:                                                    │
│  - onButtonClick()                                          │
│  + showModal()                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Integration Points

```
┌──────────────────────────────────────────────────────────────┐
│                        Game Flow                             │
└──────────────────────────────────────────────────────────────┘

GameManager.startSpin()
    │
    ├─► Check coins < bet?
    │   └─► YES ──► ModalManager.showNotEnoughCoinsModal()
    │                   │
    │                   ├─► Buy Coins ──► IAP System
    │                   ├─► Watch Ad ──► Ad Network
    │                   └─► Lower Bet ──► GameManager.decreaseBet()
    │
    └─► NO ──► Continue spin
                │
                └─► GameManager.onWin()
                        │
                        └─► Win multiplier >= 3?
                            └─► YES ──► ModalManager.showWinModal()
                                           │
                                           └─► Collect ──► Close modal

Button (with ModalButton component)
    │
    └─► Click ──► ModalButton.onButtonClick()
                      │
                      └─► ModalManager.showModal(modalName)

Any Component
    │
    └─► ModalManager.getInstance()
            │
            └─► showWinModal()
            └─► showNotEnoughCoinsModal()
            └─► showSettingsModal()
            └─► showModal(name, data)
```

## 📦 File Dependencies

```
ModalManager.ts
    ├── imports: cc.Component, cc.Node, cc.Prefab
    └── uses: BaseModal (indirectly via getComponent)

BaseModal.ts
    ├── imports: cc.Component, cc.Node, cc.UIOpacity, cc.tween
    └── extended by: WinModal, NotEnoughCoinsModal, SettingsModal

WinModal.ts
    ├── imports: cc.Label, cc.tween
    ├── extends: BaseModal
    └── uses: NumberCounter

NotEnoughCoinsModal.ts
    ├── imports: cc.Label, cc.Button
    ├── extends: BaseModal
    └── uses: GameManager

SettingsModal.ts
    ├── imports: cc.Label, cc.Toggle, cc.Slider
    ├── extends: BaseModal
    └── uses: AudioManager

ModalButton.ts
    ├── imports: cc.Component, cc.Button
    └── uses: ModalManager

GameManager.ts
    └── uses: ModalManager
```

## 🔐 Access Patterns

```
Public API (Anyone can access):
    ModalManager.getInstance()
        ├─► showWinModal(winAmount, betAmount)
        ├─► showNotEnoughCoinsModal(required, current)
        ├─► showSettingsModal()
        ├─► showModal(name, data)
        ├─► closeModal(name)
        ├─► closeAllModals()
        ├─► isModalActive(name)
        └─► isAnyModalActive()

    BaseModal (for subclasses):
        ├─► show(callback)
        ├─► hide()
        ├─► setData(data)
        └─► Lifecycle hooks (override these)

Protected/Private (Internal use):
    ModalManager:
        ├─► getPrefabByName(name)
        ├─► onModalClosed(name)
        └─► processQueue()

    BaseModal:
        ├─► playShowAnimation(callback)
        ├─► playHideAnimation(callback)
        ├─► onCloseButtonClick()
        └─► onBackgroundClick()
```

## 📈 Performance Considerations

```
Memory:
    • Modals instantiated on demand (not pre-loaded)
    • Destroyed immediately after closing
    • Prefabs kept in memory (small footprint)
    • Queue size typically 0-2 items

CPU:
    • Animations use Cocos Tween (optimized)
    • Singleton pattern (no repeated lookups)
    • Minimal GameObject overhead

Best Practices:
    • ✅ Instantiate on show, destroy on hide
    • ✅ Use object pooling for frequent modals (optional)
    • ✅ Keep modal prefabs lightweight
    • ✅ Avoid heavy logic in onDataSet
    • ✅ Cleanup event listeners in onDestroy
```

## 🎨 Visual Layer Structure

```
Z-Order (Bottom to Top):

Layer 0: Background (Game World)
    ├─ Slot Machine
    ├─ Reels
    └─ Symbols

Layer 1: UI Base
    ├─ Top Bar (Coins, Experience)
    └─ Bottom Bar (Bet, Spin)

Layer 2: ModalContainer
    ├─ Modal Background (Semi-transparent overlay)
    │   • Blocks interaction with lower layers
    │   • Opacity: 200 (78% dark)
    │
    └─ Modal Content (Foreground)
        • Always on top
        • Fully opaque
        • Interactive

Layer 3+: (Reserved for tooltips, notifications, debug UI)
```

---

**Legend:**
- `┌─┐ └─┘` Box/Container
- `│ ├ └ ┬` Tree structure
- `─►` Flow direction
- `•` List item
- `+` Public method
- `-` Private method
- `#` Protected method

---

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Easy to extend and maintain
- ✅ Minimal coupling between components
- ✅ Consistent API across all modals
- ✅ Professional UX with animations


