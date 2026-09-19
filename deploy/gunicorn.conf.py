import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8080')}"
chdir = "/app/biomechanics"
workers = 1  # Model state and search registry belong to one process.
worker_class = "gthread"
threads = 4
worker_connections = 32
backlog = 32
timeout = 90
graceful_timeout = 45
keepalive = 5
accesslog = "-"
errorlog = "-"
access_log_format = '%(t)s "%(m)s %(U)s" %(s)s %(b)s %(L)s'
