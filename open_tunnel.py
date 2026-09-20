import subprocess
import re
import time
import os

proc = subprocess.Popen(
    ["cloudflared.exe", "tunnel", "--url", "http://localhost:8000"],
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
