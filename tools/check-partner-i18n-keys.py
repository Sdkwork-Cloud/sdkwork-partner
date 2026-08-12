"""Precise t() key coverage check across partner PC packages."""
import re, os

PACKAGES = ['sdkwork-partner-pc-admin-commission', 'sdkwork-partner-pc-admin-partner',
            'sdkwork-partner-pc-admin-stats', 'sdkwork-partner-pc-admin-withdrawal', 'sdkwork-partner-pc-admin-core']

used = set()
for pkg in PACKAGES:
    root = os.path.join('apps/sdkwork-partner-pc/packages', pkg, 'src')
    for dirpath, _, files in os.walk(root):
        for f in files:
            if not f.endswith(('.ts', '.tsx')):
                continue
            p = os.path.join(dirpath, f)
            if 'i18n' in p.replace('\\', '/'):
                continue
            content = open(p, encoding='utf-8').read()
            for m in re.finditer(r"(?<![A-Za-z0-9_])t\(\s*['\"]([^'\"]+)['\"]", content):
                used.add(m.group(1))

def load_keys(path):
    return set(re.findall(r"'([^']+)':", open(path, encoding='utf-8').read()))

zh, en = set(), set()
for pkg in PACKAGES:
    base = os.path.join('apps/sdkwork-partner-pc/packages', pkg, 'src', 'i18n')
    for loc, acc in [('zh-CN', zh), ('en-US', en)]:
        b = os.path.join(base, loc)
        if os.path.isdir(b):
            for dp, _, fs in os.walk(b):
                for f in fs:
                    if f.endswith('.ts'):
                        acc.update(load_keys(os.path.join(dp, f)))

missing_zh = sorted(k for k in used if k not in zh)
missing_en = sorted(k for k in used if k not in en)
print(f"used keys: {len(used)} | zh resources: {len(zh)} | en resources: {len(en)}")
print("missing zh:", missing_zh)
print("missing en:", missing_en)
