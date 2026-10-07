"""
Diagnostic Script - Find out why nodes aren't updating
Run: python diagnose.py
"""

import sys
import platform
import subprocess
import os

sys.path.insert(0, '.')

print("=" * 60)
print("🔍 NETWORK MONITOR DIAGNOSTIC")
print("=" * 60)

# 1. System Info
print(f"\n[1] System Info:")
print(f"    OS: {platform.system()} {platform.release()}")
print(f"    Python: {sys.version}")

# 2. Test system ping
print(f"\n[2] Testing System Ping:")
test_ips = ['127.0.0.1', '8.8.8.8', '192.168.99.99']

for ip in test_ips:
    try:
        if platform.system().lower() == 'windows':
            cmd = ['ping', '-n', '2', '-w', '1000', ip]
        else:
            cmd = ['ping', '-c', '2', '-W', '1', ip]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        output = result.stdout

        # Parse loss
        import re
        if platform.system().lower() == 'windows':
            loss_match = re.search(r'\((\d+)% loss\)', output)
            time_match = re.search(r'Average = (\d+)ms', output)
        else:
            loss_match = re.search(r'(\d+)% packet loss', output)
            time_match = re.search(r'rtt min/avg/max/mdev = [\d.]+/([\d.]+)/', output)

        loss = loss_match.group(1) if loss_match else '?'
        rtt = time_match.group(1) if time_match else '?'

        status = "🟢 ALIVE" if result.returncode == 0 else "🔴 DEAD"
        print(f"    {ip:18} -> {status} | Loss: {loss}% | RTT: {rtt}ms")

    except Exception as e:
        print(f"    {ip:18} -> ❌ ERROR: {e}")

# 3. Test icmplib
print(f"\n[3] Testing icmplib:")
try:
    from icmplib import ping as sync_ping
    try:
        result = sync_ping('127.0.0.1', count=1, timeout=1, privileged=True)
        print(f"    Privileged: {'✅ Works' if result.is_alive else '❌ Not alive'}")
    except Exception as e:
        print(f"    Privileged: ❌ Failed: {e}")

    try:
        result = sync_ping('127.0.0.1', count=1, timeout=1, privileged=False)
        print(f"    Non-privileged: {'✅ Works' if result.is_alive else '❌ Not alive'}")
    except Exception as e:
        print(f"    Non-privileged: ❌ Failed: {e}")
except ImportError:
    print("    ❌ icmplib not installed!")

# 4. Check database
print(f"\n[4] Database Check:")
try:
    from app import app
    from models import db, Node, DowntimeLog

    with app.app_context():
        total = Node.query.count()
        up = Node.query.filter_by(status='Node Up').count()
        down = Node.query.filter_by(status='Node Down').count()
        unknown = Node.query.filter_by(status='Unknown').count()
        warning = Node.query.filter_by(status='Warning').count()
        logs = DowntimeLog.query.count()

        print(f"    Total nodes: {total}")
        print(f"    🟢 Up: {up}")
        print(f"    🔴 Down: {down}")
        print(f"    🟡 Warning: {warning}")
        print(f"    ⚪ Unknown: {unknown}")
        print(f"    📋 Downtime Logs: {logs}")

        # Show some nodes
        print(f"\n    First 5 nodes:")
        nodes = Node.query.limit(5).all()
        for n in nodes:
            emoji = "🟢" if n.status == 'Node Up' else "🔴" if n.status == 'Node Down' else "⚪"
            print(f"      {emoji} {n.node_name:30} | {n.ip_address:18} | {n.status} | enabled={n.enabled}")

        # Show recent logs
        if logs > 0:
            print(f"\n    Recent 5 logs:")
            recent = DowntimeLog.query.order_by(DowntimeLog.timestamp.desc()).limit(5).all()
            for l in recent:
                emoji = "🔴" if l.status_change == 'Node Down' else "🟢" if l.status_change == 'Node Up' else "🟡"
                print(f"      {emoji} {l.node_name:20} | {l.status_change:12} | {l.timestamp.strftime('%H:%M:%S')} | resolved={l.is_resolved}")

        # Check if nodes are enabled
        disabled = Node.query.filter_by(enabled=False).count()
        if disabled > 0:
            print(f"\n    ⚠️ WARNING: {disabled} nodes are DISABLED! They won't be monitored.")

        # Check if all nodes are Unknown (never been pinged)
        if unknown == total:
            print(f"\n    ⚠️ WARNING: ALL nodes are 'Unknown'. Monitoring may not be running!")

except Exception as e:
    print(f"    ❌ Database error: {e}")
    import traceback
    traceback.print_exc()

# 5. Check scheduler
print(f"\n[5] Scheduler Check:")
try:
    from flask_apscheduler import APScheduler
    print("    ✅ flask-apscheduler installed")
except ImportError:
    print("    ❌ flask-apscheduler NOT installed!")

# 6. Recommendations
print(f"\n" + "=" * 60)
print("📋 RECOMMENDATIONS:")
print("=" * 60)

if platform.system().lower() == 'windows':
    print("""
    ⚠️ WINDOWS DETECTED:
    - Run CMD as Administrator for best results
    - icmplib may not work on Windows without admin rights
    - System ping will be used as fallback (this is normal)
    - To start monitoring: python app.py
    """)

print("    To manually trigger a ping cycle:")
print("    python -c \"from app import app; from monitor import monitor; monitor.monitor_all_nodes()\"")
print()
print("    To test with a fake node:")
print("    python test_downtime.py")
print()
