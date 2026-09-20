"""
PRAMAN v4 — 1-Click Public Cloud Server
Launches local backend with unlimited RAM and creates a secure Cloudflare HTTPS tunnel.
Zero credit card, zero subscriptions, 100% free forever.
"""

import sys
import time
import subprocess
import re
import os

def main():
    print("=" * 60)
    print("  PRAMAN v4 — Starting Public Cloud Backend (No Card Needed)")
    print("=" * 60)

    cloudflared_exe = os.path.join(os.path.dirname(__file__), "cloudflared.exe")
    if not os.path.exists(cloudflared_exe):
        print("Error: cloudflared.exe not found in project directory.")
        sys.exit(1)

    # Clean up any lingering processes
    try:
        subprocess.run(["powershell", "-Command", "Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force"], capture_output=True)
    except Exception:
        pass

    print("\n[1/2] Starting local FastAPI backend (Uvicorn)...")
    backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    backend_proc = subprocess.Popen(backend_cmd)

    # Give backend a moment to boot
    time.sleep(2)

    print("[2/2] Opening Cloudflare HTTPS Tunnel to the world...")
    tunnel_cmd = [cloudflared_exe, "tunnel", "--url", "http://localhost:8000"]
    tunnel_proc = subprocess.Popen(
        tunnel_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    public_url = None
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    for line in iter(tunnel_proc.stdout.readline, ""):
        match = url_pattern.search(line)
        if match:
            public_url = match.group(0)
            break
        if "error" in line.lower() and "failed" in line.lower():
            print(line.strip())

    if public_url:
        print("\n" + "=" * 60)
        print("SUCCESS! YOUR PUBLIC CLOUD API IS LIVE:")
        print(f"URL: {public_url}")
        print("=" * 60)
        print(f"\nAPI Docs: {public_url}/docs\n")
        with open("public_url.txt", "w", encoding="utf-8") as f:
            f.write(public_url + "\n")
        print("URL also saved to public_url.txt")
        print("Press Ctrl+C at any time to stop the server.\n")
    else:
        print("Failed to detect Cloudflare URL. Please check your internet connection.")

    try:
        # Keep both running
        backend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping services...")
        tunnel_proc.terminate()
        backend_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    main()
