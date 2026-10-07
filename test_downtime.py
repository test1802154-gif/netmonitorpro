"""
Test Desktop Notification - Create fake DOWN then UP
Run: python test_notification.py
"""

import sys
import time
sys.path.insert(0, '.')

from datetime import datetime
from app import app
from models import db, Node, DowntimeLog

with app.app_context():
    print("=" * 60)
    print("🔔 DESKTOP NOTIFICATION TEST")
    print("=" * 60)

    # Clean old test data
    old = Node.query.filter_by(ip_address='10.88.88.88').first()
    if old:
        DowntimeLog.query.filter_by(ip_address='10.88.88.88').delete()
        db.session.delete(old)
        db.session.commit()
        print("   🗑️ Old test data cleaned")

    # Step 1: Create test node as UP
    node = Node(
        node_name="TEST-Notify-Node",
        ip_address="10.88.88.88",
        status='Node Up',
        last_status_change=datetime.utcnow()
    )
    db.session.add(node)
    db.session.commit()
    print(f"\n[1] ✅ Created TEST-Notify-Node - Node Up")
    print(f"    📋 Open browser: http://192.168.102.47:3000/")
    print(f"    🔔 Click 🔔 bell icon → Allow notifications")
    print(f"    🔊 Click 🔊 speaker icon → Test sound")

    input("\n    ⏳ Press ENTER when browser is ready...")

    # Step 2: Simulate DOWN
    node.status = 'Node Down'
    node.previous_status = 'Node Up'
    node.last_status_change = datetime.utcnow()

    log_down = DowntimeLog(
        node_id=node.id,
        node_name=node.node_name,
        ip_address=node.ip_address,
        status_change='Node Down',
        previous_status='Node Up',
        timestamp=datetime.utcnow(),
        is_resolved=False
    )
    db.session.add(log_down)
    db.session.commit()
    print(f"\n[2] 🔴 Node set to DOWN!")
    print(f"    🔔 You should see:")
    print(f"       - Desktop popup notification (Windows)")
    print(f"       - In-app notification (right side)")
    print(f"       - 🔴 DOWN alert sound")

    # Wait for user to check
    input("\n    ⏳ Did you see the notification? Press ENTER to continue...")

    # Step 3: Wait and simulate UP
    print(f"\n[3] ⏳ Simulating recovery in 3 seconds...")
    time.sleep(3)

    node.status = 'Node Up'
    node.previous_status = 'Node Down'
    node.last_status_change = datetime.utcnow()

    unresolved = DowntimeLog.query.filter_by(node_id=node.id, is_resolved=False).first()
    if unresolved:
        duration = (datetime.utcnow() - unresolved.timestamp).total_seconds()
        unresolved.is_resolved = True
        unresolved.downtime_duration = duration

    log_up = DowntimeLog(
        node_id=node.id,
        node_name=node.node_name,
        ip_address=node.ip_address,
        status_change='Node Up',
        previous_status='Node Down',
        timestamp=datetime.utcnow(),
        downtime_duration=duration,
        is_resolved=True
    )
    db.session.add(log_up)
    db.session.commit()

    print(f"\n[4] 🟢 Node set to UP!")
    print(f"    🔔 You should see:")
    print(f"       - Desktop popup: 🟢 Node UP")
    print(f"       - In-app notification (right side)")
    print(f"       - 🟢 UP recovery sound")

    input("\n    ⏳ Did you see the UP notification? Press ENTER...")

    # Clean up
    print(f"\n[5] 🧹 Cleaning up test node...")
    DowntimeLog.query.filter_by(ip_address='10.88.88.88').delete()
    db.session.delete(node)
    db.session.commit()
    print(f"    ✅ Test node deleted")

    print(f"\n{'=' * 60}")
    print(f"✅ NOTIFICATION TEST COMPLETE!")
    print(f"{'=' * 60}")
    print(f"\n💡 Tips:")
    print(f"   - 🔔 Bell button = Toggle desktop notifications")
    print(f"   - 🔊 Speaker button = Toggle sound")
    print(f"   - 🌙 Moon button = Toggle dark/light theme")
    print(f"   - Minimize browser → still get notifications!")
