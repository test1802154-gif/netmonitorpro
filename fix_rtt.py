"""Reset all response times for fresh start with icmplib"""
import sys
sys.path.insert(0, '.')
from app import app
from models import db, Node

with app.app_context():
    nodes = Node.query.all()
    for node in nodes:
        node.response_time = 0.0
        node.packet_loss = 0.0
    db.session.commit()
    print(f"✅ Reset {len(nodes)} nodes - ready for icmplib (fast mode)")
    print(f"💡 icmplib will ping all 290 nodes in ~3-5 seconds!")
