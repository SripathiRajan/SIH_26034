import subprocess
import re
import time
import os

import socket

def get_active_port():
    for port in (8001, 8000):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.5)
                if s.connect_ex(('127.0.0.1', port)) == 0:
                    return port
        except Exception:
            pass
    return 8000

active_port = get_active_port()
print(f"[open_tunnel] Tunneling backend on port {active_port}...")

proc = subprocess.Popen(
    ["cloudflared.exe", "tunnel", "--url", f"http://localhost:{active_port}"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
tunnel_url = None

for line in iter(proc.stdout.readline, ""):
    match = pattern.search(line)
    if match:
        tunnel_url = match.group(0)
        break

if tunnel_url:
    print("TUNNEL_URL=" + tunnel_url, flush=True)
    with open("tunnel_url.txt", "w") as f:
        f.write(tunnel_url)
    while True:
        time.sleep(10)
