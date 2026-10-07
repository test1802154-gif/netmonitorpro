"""
Windows Desktop Notification Module
Sends real Windows toast notifications with sound when nodes go DOWN/UP
"""
import platform
import threading

IS_WINDOWS = platform.system().lower() == 'windows'


def _play_alert_sound():
    """Play Windows system sound for alerts."""
    if not IS_WINDOWS:
        return
    try:
        import winsound
        # Windows Exclamation sound
        winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
    except Exception:
        pass


def _play_up_sound():
    """Play Windows system sound for recovery."""
    if not IS_WINDOWS:
        return
    try:
        import winsound
        # Windows Asterisk sound (positive)
        winsound.MessageBeep(winsound.MB_ICONASTERISK)
    except Exception:
        pass


def send_windows_notification(title, message):
    """Send a Windows desktop notification (toast)."""
    if not IS_WINDOWS:
        return

    def _notify():
        try:
            from plyer import notification
            notification.notify(
                title=title,
                message=message,
                app_name='NetMonitor Pro',
                timeout=10
            )
        except Exception as e:
            print(f"[WINDOWS NOTIFY] Error: {e}")

    t = threading.Thread(target=_notify, daemon=True)
    t.start()


def notify_node_down(node_name, ip_address):
    """Send DOWN notification with alert sound."""
    send_windows_notification(
        title='🔴 Node DOWN - NetMonitor Pro',
        message=f'{node_name} ({ip_address}) is DOWN!'
    )
    # Play alert sound in separate thread
    threading.Thread(target=_play_alert_sound, daemon=True).start()


def notify_node_up(node_name, ip_address, duration_str=None):
    """Send UP notification with recovery sound."""
    duration_info = f' | Down for: {duration_str}' if duration_str else ''
    send_windows_notification(
        title='🟢 Node UP - NetMonitor Pro',
        message=f'{node_name} ({ip_address}) is back UP!{duration_info}'
    )
    # Play recovery sound
    threading.Thread(target=_play_up_sound, daemon=True).start()


def notify_warning(node_name, ip_address):
    """Send Warning notification with sound."""
    send_windows_notification(
        title='🟡 Warning - NetMonitor Pro',
        message=f'{node_name} ({ip_address}) - High packet loss/latency'
    )
    threading.Thread(target=_play_alert_sound, daemon=True).start()
