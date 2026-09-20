"""Build extension PNG icons from the simple Routinely mark; stdlib only."""
import math
import struct
import zlib
from pathlib import Path

def segment_distance(x, y, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx * dx + dy * dy < 1e-10:
        return math.hypot(x - a[0], y - a[1])
    t = max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)

paths = [[(42, 85), (42, 48)] + [(62 + 20 * math.cos(math.pi + i * math.pi / 40), 48 + 20 * math.sin(math.pi + i * math.pi / 40)) for i in range(41)] + [(82, 52)], [(86, 44), (86, 80)] + [(66 + 20 * math.cos(i * math.pi / 40), 80 + 20 * math.sin(i * math.pi / 40)) for i in range(41)] + [(46, 76)]]
segments = [pair for path in paths for pair in zip(path, path[1:])]
out = Path(__file__).resolve().parents[1] / 'public' / 'icon'
out.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    rows = bytearray()
    for j in range(size):
        rows.append(0)
        for i in range(size):
            samples = []
            for sy in (.25, .75):
                for sx in (.25, .75):
                    x, y = (i + sx) * 128 / size, (j + sy) * 128 / size
                    dx, dy = max(40 - x, 0, x - 88), max(40 - y, 0, y - 88)
                    inside = dx * dx + dy * dy <= 36 * 36
                    mark = inside and min(segment_distance(x, y, a, b) for a, b in segments) < 5.5
                    samples.append((255, 254, 248, 255) if mark else (72, 110, 80, 255) if inside else (72, 110, 80, 0))
            rows.extend(round(sum(p[c] for p in samples) / 4) for c in range(4))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
    (out / f'{size}.png').write_bytes(png)
