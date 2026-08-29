// lib/browser-notification.ts
// Browser Notification API wrapper for background alerts.

import { loadChatAppSettings, saveChatAppSettings } from "./chat-storage";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

let _notifCounter = 0;
let _nativeInitialization: Promise<boolean> | null = null;

const NATIVE_CHANNEL_ID = "chat-messages";

async function createNativeMessageChannel(): Promise<void> {
    await LocalNotifications.createChannel({
        id: NATIVE_CHANNEL_ID,
        name: "角色消息",
        description: "角色主动消息、聊天提醒和现实桥提醒",
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: "#FF5C8A",
    }).catch(() => undefined);
}

/** Check if notifications are enabled in app settings. */
export function isNotificationEnabled(): boolean {
    if (typeof window === "undefined") return false;
    if (Capacitor.isNativePlatform()) return loadChatAppSettings().browserNotificationsEnabled === true;
    if (!("Notification" in window)) return false;
    const settings = loadChatAppSettings();
    return settings.browserNotificationsEnabled === true && Notification.permission === "granted";
}

/** Request notification permission from the browser. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (Capacitor.isNativePlatform()) {
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display !== "granted") return false;
        await createNativeMessageChannel();
        return true;
    }
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const result = await new Promise<NotificationPermission>((resolve) => {
        let settled = false;
        const finish = (permission: NotificationPermission) => {
            if (settled) return;
            settled = true;
            resolve(permission);
        };

        try {
            const request = Notification.requestPermission(finish);
            if (request && typeof request.then === "function") {
                request.then(finish).catch(() => finish(Notification.permission));
            }
        } catch {
            finish(Notification.permission);
        }

        window.setTimeout(() => finish(Notification.permission), 3000);
    });

    return result === "granted";
}

/**
 * Prepare Android notifications once per app process. Native builds enable the
 * existing notification setting after the user grants the Android permission,
 * so WebView's missing browser Notification API cannot switch it off again.
 */
export function initializeNativeNotifications(): Promise<boolean> {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
        return Promise.resolve(false);
    }
    if (_nativeInitialization) return _nativeInitialization;
    _nativeInitialization = (async () => {
        const granted = await requestNotificationPermission();
        if (granted) {
            const settings = loadChatAppSettings();
            if (settings.browserNotificationsEnabled !== true) {
                saveChatAppSettings({ ...settings, browserNotificationsEnabled: true });
            }
        }
        return granted;
    })();
    return _nativeInitialization;
}

function constructNotification(title: string, payload: NotificationOptions): void {
    try {
        const notification = new Notification(title, payload);
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    } catch {
        // Android Chrome/Edge: "Illegal constructor" — handled by the SW path below.
    }
}

/**
 * Send a browser notification if enabled and page is hidden.
 * Does nothing if page is visible, permission denied, or setting is off.
 *
 * Android Chrome/Edge does NOT support the `new Notification()` constructor in
 * pages (throws Illegal constructor) — notifications there must go through the
 * service worker's showNotification(). We prefer the SW path everywhere and fall
 * back to the constructor (desktop / dev where the SW isn't registered).
 */
export function sendBrowserNotification(
    title: string,
    options?: { body?: string; icon?: string },
): void {
    if (!isNotificationEnabled()) return;
    if (!document.hidden) return;

    if (Capacitor.isNativePlatform()) {
        void LocalNotifications.schedule({
            notifications: [{
                title,
                body: options?.body || "",
                id: Date.now() % 2147483647,
                channelId: NATIVE_CHANNEL_ID,
                smallIcon: "ic_stat_float",
                iconColor: "#FF5C8A",
                extra: { source: "float-chat" },
            }],
        }).catch(() => undefined);
        return;
    }

    const payload: NotificationOptions = {
        body: options?.body,
        icon: options?.icon || "/icon-192.png",
        tag: `ai-phone-${Date.now()}-${_notifCounter++}`,
    };

    if ("serviceWorker" in navigator) {
        // `ready` never rejects and may hang forever when no SW is registered
        // (dev mode) — race it with a short timeout, then fall back.
        const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 800));
        Promise.race([navigator.serviceWorker.ready, timeout])
            .then((registration) => {
                if (registration && typeof registration.showNotification === "function") {
                    return registration.showNotification(title, payload);
                }
                constructNotification(title, payload);
            })
            .catch(() => constructNotification(title, payload));
        return;
    }
    constructNotification(title, payload);
}
