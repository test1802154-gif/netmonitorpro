"""Reset all response times - let next ping cycle fill fresh data"""
import sys
sys.path.insert(0, '.')
from app import app
from models import db, Node

with app.app_context():
    # Reset ALL nodes response times
    nodes = Node.query.all()
    for node in nodes:
        node.response_time = 0.0
        node.packet_loss = 0.0

    db.session.commit()
    print(f"✅ Reset response times for {len(nodes)} nodes")
    print(f"💡 Next ping cycle (10s) will fill fresh correct data")
    print(f"   Now run: python app.py")
