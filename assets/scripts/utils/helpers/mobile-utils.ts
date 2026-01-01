import {
  _decorator,
  Component,
  sys,
  screen,
  view,
  Vec2,
  Node,
  Widget,
  UITransform,
} from "cc";

const { ccclass } = _decorator;

export enum DeviceOrientation {
  PORTRAIT = "portrait",
  LANDSCAPE = "landscape",
  AUTO = "auto",
}

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * MobileUtils - Utilities for mobile device optimizations
 *
 * Features:
 * - Orientation locking
 * - Safe area handling (notch, home indicator)
 * - Device detection
 * - Screen resolution management
 */
@ccclass("MobileUtils")
export class MobileUtils extends Component {
  private static _instance: MobileUtils;
  private _safeAreaInsets: SafeAreaInsets = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  private _currentOrientation: DeviceOrientation = DeviceOrientation.AUTO;

  public static getInstance(): MobileUtils {
    return this._instance;
  }

  protected onLoad(): void {
    if (MobileUtils._instance) {
      this.node.destroy();
      return;
    }
    MobileUtils._instance = this;

    this.detectSafeArea();
    this.setupOrientationListener();
  }

  protected onDestroy(): void {
    if (MobileUtils._instance === this) {
      MobileUtils._instance = null!;
    }
  }

  // ==========================================
  // Device Detection
  // ==========================================

  /**
   * Check if running on mobile device
   */
  public static isMobile(): boolean {
    return sys.isMobile;
  }

  /**
   * Check if running on iOS
   */
  public static isIOS(): boolean {
    return sys.platform === sys.Platform.IOS || sys.os === sys.OS.IOS;
  }

  /**
   * Check if running on Android
   */
  public static isAndroid(): boolean {
    return sys.platform === sys.Platform.ANDROID || sys.os === sys.OS.ANDROID;
  }

  /**
   * Check if running in browser
   */
  public static isBrowser(): boolean {
    return sys.isBrowser;
  }

  /**
   * Check if device has notch/safe area
   */
  public static hasNotch(): boolean {
    // iOS devices with notch typically have top safe area > 20
    if (this.isIOS()) {
      const safeArea = this.getSafeAreaInsets();
      return safeArea.top > 20;
    }
    // Android devices might report safe area differently
    return false;
  }

  // ==========================================
  // Safe Area Handling
  // ==========================================

  /**
   * Detect and cache safe area insets
   */
  private detectSafeArea(): void {
    if (sys.isBrowser) {
      this._safeAreaInsets = this.getSafeAreaFromCSS();
    } else {
      this._safeAreaInsets = this.getNativeSafeArea();
    }
  }

  private getSafeAreaFromCSS(): SafeAreaInsets {
    if (typeof window === "undefined") {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    // Try to read CSS safe area environment variables
    const computedStyle = window.getComputedStyle(document.documentElement);

    const top = parseInt(
      computedStyle.getPropertyValue("--safe-area-inset-top") || "0"
    );
    const bottom = parseInt(
      computedStyle.getPropertyValue("--safe-area-inset-bottom") || "0"
    );
    const left = parseInt(
      computedStyle.getPropertyValue("--safe-area-inset-left") || "0"
    );
    const right = parseInt(
      computedStyle.getPropertyValue("--safe-area-inset-right") || "0"
    );

    return { top, bottom, left, right };
  }

  private getNativeSafeArea(): SafeAreaInsets {
    // On native platforms, safe area might be available through native APIs
    // For Cocos Creator, this would typically be accessed through JSB

    // Default values for common devices
    if (MobileUtils.isIOS()) {
      // iPhone X and newer have top notch (44px) and bottom indicator (34px)
      const screenHeight = screen.windowSize.height;
      if (screenHeight >= 812) {
        // Likely iPhone X or newer
        return { top: 44, bottom: 34, left: 0, right: 0 };
      }
    }

    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  /**
   * Get current safe area insets
   */
  public static getSafeAreaInsets(): SafeAreaInsets {
    const instance = this.getInstance();
    return instance
      ? instance._safeAreaInsets
      : { top: 0, bottom: 0, left: 0, right: 0 };
  }

  /**
   * Apply safe area to a node using Widget
   */
  public static applySafeArea(
    node: Node,
    edges: {
      top?: boolean;
      bottom?: boolean;
      left?: boolean;
      right?: boolean;
    } = {}
  ): void {
    const widget = node.getComponent(Widget) || node.addComponent(Widget);
    const insets = this.getSafeAreaInsets();

    if (edges.top) {
      widget.isAlignTop = true;
      widget.top = insets.top;
    }

    if (edges.bottom) {
      widget.isAlignBottom = true;
      widget.bottom = insets.bottom;
    }

    if (edges.left) {
      widget.isAlignLeft = true;
      widget.left = insets.left;
    }

    if (edges.right) {
      widget.isAlignRight = true;
      widget.right = insets.right;
    }

    widget.updateAlignment();
  }

  /**
   * Adjust node position to avoid notch/safe areas
   */
  public static adjustForSafeArea(
    node: Node,
    avoidTop: boolean = true,
    avoidBottom: boolean = false
  ): void {
    const insets = this.getSafeAreaInsets();
    const pos = node.position.clone();

    if (avoidTop && insets.top > 0) {
      pos.y -= insets.top / 2;
    }

    if (avoidBottom && insets.bottom > 0) {
      pos.y += insets.bottom / 2;
    }

    node.setPosition(pos);
  }

  // ==========================================
  // Orientation Management
  // ==========================================

  /**
   * Set device orientation
   */
  public static setOrientation(orientation: DeviceOrientation): void {
    const instance = this.getInstance();
    if (instance) {
      instance._currentOrientation = orientation;
    }

    switch (orientation) {
      case DeviceOrientation.PORTRAIT:
        screen.requestFullScreen().catch(() => {});
        break;

      case DeviceOrientation.LANDSCAPE:
        screen.requestFullScreen().catch(() => {});
        break;

      case DeviceOrientation.AUTO:
        break;
    }
  }

  /**
   * Lock to landscape orientation (common for slot games)
   */
  public static lockToLandscape(): void {
    this.setOrientation(DeviceOrientation.LANDSCAPE);
  }

  /**
   * Lock to portrait orientation
   */
  public static lockToPortrait(): void {
    this.setOrientation(DeviceOrientation.PORTRAIT);
  }

  /**
   * Get current orientation
   */
  public static getCurrentOrientation(): "portrait" | "landscape" {
    const size = screen.windowSize;
    return size.width > size.height ? "landscape" : "portrait";
  }

  private setupOrientationListener(): void {
    view.on("canvas-resize", this.onOrientationChange, this);
  }

  private onOrientationChange(): void {
    this.detectSafeArea();
  }

  // ==========================================
  // Performance Optimizations
  // ==========================================

  /**
   * Get device performance tier (low/medium/high)
   */
  public static getPerformanceTier(): "low" | "medium" | "high" {
    if (!sys.isMobile) {
      return "high"; // Assume desktop is high performance
    }

    // On mobile, use heuristics based on memory and platform
    if (MobileUtils.isIOS()) {
      // iOS devices generally have good performance
      return "high";
    }

    // For Android, this is a rough estimate
    // In a real app, you'd measure actual FPS and adjust
    const memory = (sys as any).getSafeAreaRect?.()?.memorySize || 0;
    if (memory > 4096) return "high";
    if (memory > 2048) return "medium";
    return "low";
  }

  /**
   * Check if device supports high-quality graphics
   */
  public static supportsHighQuality(): boolean {
    return this.getPerformanceTier() === "high";
  }

  // ==========================================
  // Screen Management
  // ==========================================

  /**
   * Enter fullscreen mode
   */
  public static enterFullscreen(): void {
    screen.requestFullScreen().catch(() => {});
  }

  /**
   * Exit fullscreen mode
   */
  public static exitFullscreen(): void {
    screen.exitFullScreen().catch(() => {});
  }

  /**
   * Get screen size in pixels
   */
  public static getScreenSize(): Vec2 {
    const size = screen.windowSize;
    return new Vec2(size.width, size.height);
  }

  /**
   * Get screen resolution
   */
  public static getScreenResolution(): Vec2 {
    const resolution = view.getVisibleSize();
    return new Vec2(resolution.width, resolution.height);
  }

  /**
   * Check if screen is wide enough for landscape gameplay
   */
  public static isWideScreen(): boolean {
    const size = screen.windowSize;
    const aspectRatio = size.width / size.height;
    return aspectRatio >= 1.5; // 16:9 or wider
  }
}
