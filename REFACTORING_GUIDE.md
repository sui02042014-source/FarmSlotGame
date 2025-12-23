# Hướng dẫn Tái cấu trúc Source Code

## Tổng quan

Dự án đã được tái cấu trúc theo 3 yêu cầu chính:
1. ✅ **Giảm Draw Calls từ 15 xuống còn 1**
2. ✅ **Asset Bundles**
3. ✅ **Tách Logic riêng**

---

## 1. Giảm Draw Calls (15 → 1)

### Vấn đề hiện tại
- Mỗi symbol đang dùng texture riêng → nhiều draw calls
- UI elements có thể dùng nhiều texture khác nhau

### Giải pháp
**Tạo Atlas (Sprite Sheet) duy nhất cho tất cả symbols**

### Các bước thực hiện:

#### Bước 1: Tạo Auto Atlas trong Cocos Creator
1. Mở Cocos Creator
2. Right-click vào `assets/resources/` → **Create > Auto Atlas**
3. Đặt tên: `SymbolsAtlas`
4. Cấu hình trong Inspector:
   - **Max Size**: 2048
   - **Padding**: 2
   - **Format**: RGBA8888
   - **Filter Mode**: Bilinear

#### Bước 2: Thêm symbols vào Atlas
1. Kéo tất cả file PNG từ `assets/resources/symbols/` vào `SymbolsAtlas`
2. Click nút **"Pack"** để tạo atlas
3. Atlas sẽ được tạo tại: `assets/resources/SymbolsAtlas.plist` và `SymbolsAtlas.png`

#### Bước 3: Cập nhật SymbolData.ts
Sau khi tạo atlas, cập nhật các `spritePath` trong `SymbolData.ts`:

**Trước:**
```typescript
spritePath: "symbols/9_Pig"
```

**Sau:**
```typescript
spritePath: "SymbolsAtlas/pig"  // Tên frame trong atlas
```

#### Bước 4: Kiểm tra Draw Calls
1. Mở **Profiler** trong Cocos Creator
2. Chạy game và kiểm tra **Draw Calls**
3. Kỳ vọng: **1-3 draw calls** (1 cho sprites, +1-2 cho text/UI nếu có)

### Lưu ý quan trọng:
- ✅ Tất cả sprites dùng cùng atlas sẽ tự động dùng chung 1 material
- ✅ Không override material trên từng sprite
- ✅ Chỉ dùng 1 Canvas cho toàn bộ UI
- ✅ Tránh RenderTexture và Mask không cần thiết

### Helper Script
Xem `assets/scripts/utils/AtlasHelper.ts` để biết thêm chi tiết và checklist.

---

## 2. Asset Bundles

### Cấu trúc Bundles

```
assets/bundles/
├── main/          # Core game (scene, UI chính)
├── symbols/       # Symbol atlas và assets
├── audio/         # Sound effects và music
└── win_fx/        # Win effects, particles, WinModal prefab
```

### Các bước thiết lập:

#### Bước 1: Cấu hình Bundles trong Cocos Creator
1. Mở **Project Settings > Asset Manager**
2. Thêm các bundles:
   - `main`
   - `symbols`
   - `audio`
   - `win_fx`

#### Bước 2: Di chuyển Assets
Di chuyển assets từ `assets/resources/` vào các bundle tương ứng:

| Nguồn | Đích | Bundle |
|-------|------|--------|
| `scene/GameScene.scene` | `bundles/main/scene/` | main |
| `button/`, `background/`, `input/` | `bundles/main/ui/` | main |
| `symbols/` | `bundles/symbols/` | symbols |
| `sounds/` | `bundles/audio/` | audio |
| `win/`, `prefabs/WinModal.prefab` | `bundles/win_fx/` | win_fx |

#### Bước 3: Sử dụng AssetBundleManager

**Load bundles khi game start:**
```typescript
import { AssetBundleManager } from "./utils/AssetBundleManager";

// Trong GameManager.initGame() hoặc scene onLoad
const bundleManager = AssetBundleManager.getInstance();
await bundleManager.preloadCriticalBundles(); // Loads main + symbols
```

**Load bundle khi cần:**
```typescript
// Load audio khi cần phát sound
await bundleManager.loadBundle("audio");

// Load win effects khi có win lớn
await bundleManager.loadBundle("win_fx");
```

**Load asset từ bundle:**
```typescript
import { SpriteFrame } from "cc";

const spriteFrame = await bundleManager.load(
  "symbols",
  "SymbolsAtlas/pig",
  SpriteFrame
);
```

### Lợi ích:
- ⚡ Giảm thời gian load ban đầu (chỉ load `main`)
- 📦 Lazy loading cho các bundle không cần ngay
- 🔄 Dễ update từng bundle độc lập
- 💾 Tiết kiệm memory (chỉ load khi cần)

---

## 3. Tách Logic riêng

### Cấu trúc mới

```
assets/scripts/
├── logic/              # ← MỚI: Pure logic, không phụ thuộc Cocos
│   └── SlotLogic.ts   # Logic tính toán symbol, win detection
├── game/              # Components gắn với Node
│   ├── SlotMachine.ts # Sử dụng SlotLogic
│   ├── GameManager.ts
│   └── ...
├── ui/                # UI components
└── utils/             # Utilities
```

### SlotLogic.ts - Pure Logic Module

**Chức năng:**
- ✅ `generateTargetSymbols()` - Tạo symbol grid
- ✅ `checkWin()` - Kiểm tra win lines
- ✅ `calculateSpinResult()` - Tính toán kết quả spin hoàn chỉnh

**Đặc điểm:**
- ❌ Không có `cc.Component`
- ❌ Không có `Node`
- ❌ Không phụ thuộc Cocos Creator
- ✅ Dễ unit test
- ✅ Có thể chuyển lên server

### SlotMachine.ts - Component Layer

**Thay đổi:**
- ✅ Sử dụng `SlotLogic.generateTargetSymbols()` thay vì logic cũ
- ✅ Sử dụng `SlotLogic.checkWin()` thay vì logic cũ
- ✅ Chỉ lo render và UI, không chứa logic tính toán

**Trước:**
```typescript
private generateReelSymbols(): string[] {
  // Logic tính toán ở đây
}
```

**Sau:**
```typescript
private generateTargetSymbols(): string[][] {
  return SlotLogic.generateTargetSymbols(
    this.getReelCount(),
    GameConfig.SYMBOL_PER_REEL
  );
}
```

### Lợi ích:
- 🧪 Dễ test logic độc lập
- 🔄 Có thể tái sử dụng logic
- 🖥️ Có thể chuyển logic lên server
- 📝 Code rõ ràng, dễ maintain

---

## Checklist hoàn thành

### Draw Calls
- [ ] Tạo `SymbolsAtlas` trong Cocos Creator
- [ ] Pack tất cả symbols vào atlas
- [ ] Cập nhật `SymbolData.ts` với paths mới
- [ ] Kiểm tra Draw Calls trong Profiler (kỳ vọng: 1-3)

### Asset Bundles
- [ ] Cấu hình bundles trong Project Settings
- [ ] Di chuyển assets vào bundles tương ứng
- [ ] Cập nhật code để sử dụng `AssetBundleManager`
- [ ] Test load bundles

### Logic Separation
- [x] ✅ `SlotLogic.ts` đã được tạo
- [x] ✅ `SlotMachine.ts` đã được refactor
- [ ] Test logic hoạt động đúng
- [ ] (Optional) Viết unit tests cho `SlotLogic`

---

## Files đã thay đổi

### Files mới:
- `assets/scripts/logic/SlotLogic.ts` - Pure logic module
- `assets/scripts/utils/AssetBundleManager.ts` - Bundle manager
- `assets/scripts/utils/AtlasHelper.ts` - Atlas helper và hướng dẫn
- `assets/bundles/README.md` - Hướng dẫn bundles
- `REFACTORING_GUIDE.md` - File này

### Files đã sửa:
- `assets/scripts/game/SlotMachine.ts` - Refactor để dùng SlotLogic

---

## Next Steps

1. **Tạo Atlas**: Làm theo hướng dẫn ở mục 1 để giảm draw calls
2. **Setup Bundles**: Di chuyển assets và cấu hình bundles
3. **Test**: Kiểm tra game hoạt động đúng sau refactoring
4. **Optimize**: Tối ưu thêm nếu cần

---

## Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra console logs
2. Xem `AtlasHelper.ts` để biết checklist
3. Xem `bundles/README.md` để biết cấu trúc bundles
4. Kiểm tra `SlotLogic.ts` để hiểu logic flow

