import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'network-monitor-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'nodes.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

    # ============ POLLING SETTINGS ============
    PING_INTERVAL = 15         # 15 seconds (enough time for 290+ nodes)
    PING_TIMEOUT = 1
    PING_COUNT = 2             # 2 pings (fast + reliable)
    PING_PRIVILEGED = True
    MAX_CONCURRENT_PINGS = 350 # 350 concurrent (enough for 290+ devices in one batch)

    # ============ FLAP PROTECTION ============
    FAIL_THRESHOLD = 3         # 3 fails = DOWN (30 seconds)
    SUCCESS_THRESHOLD = 2      # 2 successes = UP (20 seconds)

    # Warning thresholds (need consecutive checks too)
    WARNING_PACKET_LOSS = 75   # >75% loss = Warning
    WARNING_THRESHOLD = 3      # Need 3 consecutive high-loss checks for Warning

    SCHEDULER_API_ENABLED = True

    # ============ DATABASE SETTINGS ============
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 20,
        'max_overflow': 30,
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'connect_args': {
            'timeout': 30,
            'check_same_thread': False
        }
    }
