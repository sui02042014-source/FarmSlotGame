# Asset Bundles Structure

Cấu trúc Asset Bundles được tổ chức để tối ưu hóa việc load và quản lý tài nguyên.

## Cấu trúc Bundles

### 1. `main/` - Core Game Assets
Chứa các tài nguyên cần thiết ngay khi game khởi động:
- Scene files (`GameScene.scene`)
- UI chính (buttons, labels, panels)
- Background images
- Fonts
- Critical scripts references

**Load:** Ngay khi game start

### 2. `symbols/` - Symbol Assets
Chứa tất cả assets liên quan đến symbols:
- Symbol atlas (sprite sheet chứa tất cả symbols)
- Symbol animations (nếu có)
- Reel effects

**Load:** Trước khi bắt đầu spin đầu tiên

### 3. `audio/` - Audio Assets
Chứa tất cả file âm thanh:
- Sound effects (`spin.wav`, `win.mp3`, `lose.mp3`)
- Background music (nếu có)

**Load:** Lazy load khi cần phát âm thanh

### 4. `win_fx/` - Win Effects
Chứa các hiệu ứng và prefabs liên quan đến win:
- `WinModal.prefab`
- Win particle effects
- Win animations
- Coin fly effects assets

**Load:** Lazy load khi có win lớn

## Cách sử dụng trong Cocos Creator

### Bước 1: Tạo Bundles trong Cocos Creator
1. Mở Cocos Creator
2. Vào **Project Settings > Asset Manager**
3. Thêm các bundles:
   - `main`
   - `symbols`
   - `audio`
   - `win_fx`

### Bước 2: Di chuyển assets vào bundles
1. Di chuyển assets từ `assets/resources/` vào các bundle tương ứng:
   - `scene/` → `bundles/main/scene/`
   - `symbols/` → `bundles/symbols/`
   - `sounds/` → `bundles/audio/`
   - `win/` và `prefabs/WinModal.prefab` → `bundles/win_fx/`

### Bước 3: Sử dụng AssetBundleManager
```typescript
import { AssetBundleManager } from "../utils/AssetBundleManager";

// Load critical bundles khi game start
const bundleManager = AssetBundleManager.getInstance();
await bundleManager.preloadCriticalBundles(); // Loads main + symbols

// Load bundle khi cần
await bundleManager.loadBundle("audio");

// Load asset từ bundle
const spriteFrame = await bundleManager.load("symbols", "symbols_atlas/pig", SpriteFrame);
```

## Lợi ích

1. **Giảm thời gian load ban đầu**: Chỉ load `main` bundle khi start
2. **Lazy loading**: Load các bundle khác khi cần thiết
3. **Dễ quản lý**: Tổ chức assets theo chức năng
4. **Hỗ trợ hot update**: Có thể update từng bundle độc lập

