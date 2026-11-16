import re

with open('src/screens.js', 'rb') as f:
    d = f.read().decode('utf-8')

total = 0
for eol in ['\r\n', '\n']:
    pattern = re.escape('<<<<<<< HEAD') + eol + r'(.*?)' + re.escape('=======') + eol + r'.*?' + re.escape('>>>>>>>') + r'[^\r\n]+' + eol
    for _ in range(10):
        before = d.count('<<<<<<< HEAD')
        if before == 0:
            break
        d = re.sub(pattern, lambda m: m.group(1), d, flags=re.DOTALL)
        after = d.count('<<<<<<< HEAD')
        resolved = before - after
        total += resolved
        print(f'eol={repr(eol)} pass: resolved {resolved}, remaining {after}')
        if resolved == 0:
            break

with open('src/screens.js', 'wb') as f:
    f.write(d.encode('utf-8'))

print(f'Done. Total resolved: {total}, remaining: {d.count("<<<<<<< HEAD")}')
