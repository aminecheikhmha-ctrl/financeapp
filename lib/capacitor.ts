export const isNative = (): boolean => {
  if (typeof window === "undefined") return false
  return (window as any).Capacitor?.isNativePlatform?.() ?? false
}

export const isIOS = (): boolean => {
  if (typeof window === "undefined") return false
  return (window as any).Capacitor?.getPlatform?.() === "ios"
}

export const isAndroid = (): boolean => {
  if (typeof window === "undefined") return false
  return (window as any).Capacitor?.getPlatform?.() === "android"
}

export async function haptic(
  type: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "light"
) {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics")
    if (type === "success") {
      await Haptics.notification({ type: NotificationType.Success })
    } else if (type === "error") {
      await Haptics.notification({ type: NotificationType.Error })
    } else if (type === "warning") {
      await Haptics.notification({ type: NotificationType.Warning })
    } else {
      const style =
        type === "heavy" ? ImpactStyle.Heavy :
        type === "medium" ? ImpactStyle.Medium :
        ImpactStyle.Light
      await Haptics.impact({ style })
    }
  } catch {}
}

export async function shareNative(title: string, text: string, url: string) {
  if (!isNative()) {
    if (navigator.share) {
      await navigator.share({ title, text, url })
    } else {
      await navigator.clipboard.writeText(url)
    }
    return
  }
  try {
    const { Share } = await import("@capacitor/share")
    await Share.share({ title, text, url, dialogTitle: title })
  } catch {}
}

export async function copyToClipboard(text: string) {
  if (!isNative()) {
    await navigator.clipboard.writeText(text)
    return
  }
  try {
    const { Clipboard } = await import("@capacitor/clipboard")
    await Clipboard.write({ string: text })
  } catch {}
}

export async function openExternalUrl(url: string) {
  if (!isNative()) {
    window.open(url, "_blank")
    return
  }
  try {
    const { Browser } = await import("@capacitor/browser")
    await Browser.open({ url, presentationStyle: "popover" })
  } catch {
    window.open(url, "_blank")
  }
}

export async function setStatusBarDark() {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: "#050505" })
  } catch {}
}
