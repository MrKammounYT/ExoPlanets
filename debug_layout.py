import socket
import json
import subprocess
import time
import urllib.request
import re

# Launch Edge headless with remote debugging
proc = subprocess.Popen([
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '--headless',
    '--remote-debugging-port=9222',
    '--window-size=1440,900',
    'http://localhost:5173/'
])
time.sleep(3)

try:
    tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read())
    ws_url = tabs[0]['webSocketDebuggerUrl']
    m = re.match(r'ws://([^/]+)(/.*)', ws_url)
    host, path = m.group(1), m.group(2)
    host_ip, port = host.split(':')
    
    s = socket.create_connection((host_ip, int(port)))
    # Handshake
    req = (f"GET {path} HTTP/1.1\r\n"
           f"Host: {host}\r\n"
           f"Upgrade: websocket\r\n"
           f"Connection: Upgrade\r\n"
           f"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
           f"Sec-WebSocket-Version: 13\r\n\r\n")
    s.sendall(req.encode())
    res = s.recv(4096)
    
    # Send frame
    msg = json.dumps({
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {
            "expression": """(() => {
                const el = document.querySelector('#analyzer');
                const head = document.querySelector('#analyzer .section-head');
                const p = document.querySelector('#analyzer .section-head p');
                const h2 = document.querySelector('#analyzer-title');
                const panel = document.querySelector('.analyzer-panel');
                return {
                    analyzer: el ? { top: el.offsetTop, height: el.offsetHeight } : null,
                    head: head ? { top: head.offsetTop, height: head.offsetHeight, compHeight: getComputedStyle(head).height, compAlign: getComputedStyle(head).alignItems } : null,
                    h2: h2 ? { top: h2.offsetTop, height: h2.offsetHeight } : null,
                    p: p ? { top: p.offsetTop, height: p.offsetHeight, compMargin: getComputedStyle(p).margin } : null,
                    panel: panel ? { top: panel.offsetTop, height: panel.offsetHeight, compMargin: getComputedStyle(panel).margin } : null
                };
            })()""",
            "returnByValue": True
        }
    }).encode('utf-8')
    
    # Simple WS frame
    frame = bytearray([0x81])
    length = len(msg)
    if length <= 125:
        frame.append(0x80 | length)
    elif length <= 65535:
        frame.extend([0x80 | 126, (length >> 8) & 0xFF, length & 0xFF])
    else:
        frame.extend([0x80 | 127] + [(length >> (8 * i)) & 0xFF for i in range(7, -1, -1)])
    
    mask = [0x12, 0x34, 0x56, 0x78]
    frame.extend(mask)
    masked_msg = bytearray(b ^ mask[i % 4] for i, b in enumerate(msg))
    frame.extend(masked_msg)
    
    s.sendall(frame)
    
    # Read response frame
    data = bytearray()
    while True:
        chunk = s.recv(65536)
        if not chunk: break
        data.extend(chunk)
        if len(data) > 2:
            # Check payload length
            b2 = data[1] & 0x7F
            offset = 2
            if b2 == 126: offset = 4
            elif b2 == 127: offset = 10
            # If we received the whole payload, stop
            if len(data) >= offset:
                break
    
    # Unpack text payload
    b2 = data[1] & 0x7F
    offset = 2
    if b2 == 126:
        payload_len = (data[2] << 8) | data[3]
        offset = 4
    elif b2 == 127:
        payload_len = 0
        for i in range(8): payload_len = (payload_len << 8) | data[2+i]
        offset = 10
    else:
        payload_len = b2
        
    while len(data) < offset + payload_len:
        data.extend(s.recv(65536))
        
    payload = data[offset:offset+payload_len].decode('utf-8', errors='ignore')
    parsed = json.loads(payload)
    print(json.dumps(parsed.get('result', {}).get('result', {}).get('value', []), indent=2))
finally:
    proc.terminate()
