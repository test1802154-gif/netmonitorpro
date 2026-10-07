"""Fix: Delete old wrong-timestamp logs and re-seed"""
import sys
sys.path.insert(0, '.')

from app import app
from models import db, Node, DowntimeLog
from datetime import datetime

with app.app_context():
    # Delete all old logs (wrong timestamps)
    count = DowntimeLog.query.delete()
    db.session.commit()
    print(f"🗑️ Deleted {count} old logs with wrong timestamps")

    # Re-seed for currently down nodes
    down_nodes = Node.query.filter(Node.status.in_(['Node Down', 'Warning'])).all()
    created = 0

    for node in down_nodes:
        log = DowntimeLog(
            node_id=node.id,
            node_name=node.node_name,
            ip_address=node.ip_address,
            status_change=node.status,
            previous_status=node.previous_status or 'Unknown',
            timestamp=node.last_status_change or datetime.utcnow(),
            is_resolved=False
        )
        db.session.add(log)
        created += 1

    db.session.commit()
    print(f"✅ Created {created} fresh logs with correct time (UTC)")
    print(f"📋 Display will auto-convert UTC → BD time (UTC+6)")
