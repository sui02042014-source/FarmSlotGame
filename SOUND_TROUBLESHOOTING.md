# Khắc phục sự cố Sound không phát

## 🔍 Các bước kiểm tra

### 1. Kiểm tra AudioManager có được thêm vào Scene không

**Vấn đề**: AudioManager là một Component, cần được thêm vào scene để hoạt động.

**Cách kiểm tra**:
1. Mở scene chính trong Cocos Creator
2. Tìm node có component `AudioManager`
3. Nếu không có, cần thêm:
   - Tạo một Node mới (ví dụ: "AudioManager")
   - Thêm component `AudioManager` vào node đó
   - Đảm bảo node này không bị destroy khi load scene

**Cách thêm**:
```
1. Trong Hierarchy, click chuột phải → Create → Empty Node
2. Đặt tên node là "AudioManager"
3. Chọn node → Inspector → Add Component → AudioManager
4. Đảm bảo node này tồn tại trong scene chính
```

### 2. Kiểm tra file sound có đúng vị trí không

**Vị trí đúng**: `assets/resources/sounds/`

**Cấu trúc thư mục**:
```
assets/
  └── resources/
      └── sounds/
          ├── spin.mp3 (hoặc .wav, .ogg)
          ├── win.mp3
          └── lose.mp3
```

**Lưu ý**:
- File phải nằm trong thư mục `resources` (không phải `assets` trực tiếp)
- Tên file phải khớp chính xác: `spin`, `win`, `lose` (không có extension trong code)
- Cocos Creator sẽ tự động import file khi đặt vào thư mục

### 3. Kiểm tra Console Logs

Đã bật debug logs, kiểm tra Console trong Cocos Creator:

**Logs mong đợi khi spin**:
```
[GameManager] Playing spin sound: sounds/spin
[AudioManager] playSFX called: sounds/spin
[AudioManager] Loading audio: sounds/spin
[AudioManager] Successfully loaded audio: sounds/spin
[AudioManager] Playing SFX: sounds/spin, volume: 0.8
```

**Nếu thấy lỗi**:
- `AudioManager not found!` → AudioManager chưa được thêm vào scene
- `Failed to load audio: sounds/spin` → File sound không tìm thấy hoặc đường dẫn sai
- `Sound is muted` → Audio bị tắt trong Settings

### 4. Kiểm tra Settings Modal

1. Mở Settings Modal trong game
2. Kiểm tra:
   - Sound toggle có bật không?
   - Sound volume slider có > 0 không?
3. Nếu bị tắt, bật lại và test

### 5. Kiểm tra file sound có được import đúng không

1. Trong Cocos Creator, vào `assets/resources/sounds/`
2. Chọn file sound (ví dụ: `spin.mp3`)
3. Trong Inspector, kiểm tra:
   - Type phải là `AudioClip`
   - Không có lỗi import (màu đỏ)
   - File size > 0

### 6. Kiểm tra định dạng file

Cocos Creator hỗ trợ:
- `.mp3` (khuyến nghị)
- `.wav`
- `.ogg`

**Lưu ý**: Một số codec MP3 có thể không được hỗ trợ. Nếu file MP3 không phát, thử chuyển sang `.wav` hoặc `.ogg`.

## 🛠️ Các lỗi thường gặp

### Lỗi 1: "AudioManager not found!"
**Nguyên nhân**: AudioManager component chưa được thêm vào scene

**Giải pháp**: Thêm AudioManager component vào scene (xem bước 1)

### Lỗi 2: "Failed to load audio: sounds/spin" hoặc "Bundle resources doesn't contain sounds/spin"
**Nguyên nhân**: 
- File không ở đúng vị trí (phải ở `assets/resources/sounds/`, không phải `assets/sounds/`)
- File chưa được Cocos Creator import vào bundle
- Đường dẫn sai

**Giải pháp**:
1. **Kiểm tra vị trí file**: File phải ở `assets/resources/sounds/` (KHÔNG phải `assets/sounds/`)
   - ✅ Đúng: `assets/resources/sounds/spin.mp3`
   - ❌ Sai: `assets/sounds/spin.mp3`

2. **Mở Cocos Creator** để nó tự động import file:
   - Mở project trong Cocos Creator
   - Cocos Creator sẽ tự động detect và import file mới
   - Đợi cho đến khi thấy file trong Assets panel (không có icon cảnh báo)

3. **Kiểm tra file đã được import**:
   - Vào `assets/resources/sounds/` trong Cocos Creator
   - Chọn file sound (ví dụ: `spin.wav` hoặc `spin.mp3`)
   - Trong Inspector, kiểm tra Type phải là `AudioClip`
   - Không có lỗi (màu đỏ)

4. **Build lại project** nếu cần:
   - Menu: Project → Build
   - Hoặc đơn giản là chạy Preview để Cocos Creator build lại

5. **Kiểm tra tên file**:
   - File có thể là `.mp3`, `.wav`, hoặc `.ogg`
   - Code sẽ tự động thử các extension nếu không tìm thấy
   - Nhưng tốt nhất là đảm bảo file được import đúng trong Cocos Creator

### Lỗi 3: Sound bị mute
**Nguyên nhân**: Audio bị tắt trong Settings hoặc localStorage

**Giải pháp**:
1. Mở Settings Modal
2. Bật Sound toggle
3. Tăng Sound volume slider
4. Hoặc xóa localStorage và test lại:
   ```javascript
   // Trong Console của browser
   localStorage.removeItem('audioMuted');
   localStorage.removeItem('sfxVolume');
   ```

### Lỗi 4: Sound phát nhưng không nghe thấy
**Nguyên nhân**:
- Volume = 0
- System volume thấp
- AudioSource chưa được khởi tạo

**Giải pháp**:
1. Kiểm tra volume trong Settings
2. Kiểm tra system volume
3. Kiểm tra AudioManager có được khởi tạo đúng không (xem logs)

## ✅ Checklist khắc phục

- [ ] AudioManager component đã được thêm vào scene
- [ ] File sound đã được đặt vào `assets/resources/sounds/`
- [ ] Tên file đúng: `spin.mp3`, `win.mp3`, `lose.mp3`
- [ ] File sound đã được import thành công (không có lỗi trong Inspector)
- [ ] Sound toggle trong Settings đã bật
- [ ] Sound volume > 0
- [ ] Console logs hiển thị đúng (không có lỗi)
- [ ] Định dạng file được hỗ trợ (.mp3, .wav, .ogg)

## 🧪 Test nhanh

1. Mở Console trong Cocos Creator hoặc Browser
2. Chạy game và click spin
3. Kiểm tra logs:
   - Nếu thấy `[AudioManager] Playing SFX` → Sound đang được phát
   - Nếu thấy `Failed to load` → File không tìm thấy
   - Nếu thấy `AudioManager not found` → Component chưa được thêm

## 📞 Nếu vẫn không hoạt động

1. Kiểm tra lại tất cả các bước trên
2. Xem Console logs để xác định lỗi cụ thể
3. Thử với file sound mới (đảm bảo file không bị hỏng)
4. Kiểm tra Cocos Creator version (có thể cần update)

