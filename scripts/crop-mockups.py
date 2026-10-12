# 2차 시안(docs/대표님자료/2차시안, 대표님 HWP 첨부 이미지)에서 화면용 이미지를 잘라 만든다.
# 실행: python3 scripts/crop-mockups.py  → web/public/img/thumb·v4 에 webp 저장 + web/src/assets/thumbs.ts 갱신
# 대표님 원본(낱장) 이미지가 오면 web/public/img/_incoming/ 에 같은 이름으로 넣고 npm run make:images (원본 우선)
import cv2, numpy as np, os, json, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'docs/대표님자료/2차시안')
PUB = os.path.join(R, 'web/public/img')
os.makedirs(os.path.join(PUB, 'thumb'), exist_ok=True)
os.makedirs(os.path.join(PUB, 'v4'), exist_ok=True)
cache = {}
def img(n):
    if n not in cache:
        cache[n] = cv2.imread(os.path.join(SRC, n), cv2.IMREAD_COLOR)
    return cache[n]

def refine(im, box, pad=14):
    x0, y0, x1, y1 = box
    H, W = im.shape[:2]
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    win = im[Y0:Y1, X0:X1].astype(int)
    border = np.concatenate([win[:3].reshape(-1, 3), win[-3:].reshape(-1, 3), win[:, :3].reshape(-1, 3), win[:, -3:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    d = np.abs(win - bg).sum(2) > 45
    rows = np.where(d.mean(1) > 0.55)[0]
    cols = np.where(d.mean(0) > 0.55)[0]
    if len(rows) < 10 or len(cols) < 10:
        return box
    return (X0 + cols[0], Y0 + rows[0], X0 + cols[-1] + 1, Y0 + rows[-1] + 1)

def badge_mask(crop, area):
    # 왼쪽 위 배지(빨간 알약 HOT·NEW·인기 / 먹색 알약 BEST) 한 덩어리만 찾아 그 사각형을 지운다
    h, w = crop.shape[:2]
    ax, ay = int(w * area[0]), int(h * area[1])
    reg = crop[:ay, :ax].astype(int)
    b, g, r = reg[..., 0], reg[..., 1], reg[..., 2]
    best = None
    for sel in [((r > 190) & (g < 60) & (b < 70)), ((r > 165) & (g < 95) & (b < 100)), ((r > 105) & (g < 55) & (b < 55)), ((r < 50) & (g < 45) & (b < 40))]:
        sel = cv2.morphologyEx(sel.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        if best is not None: break
        n, lab, st, _ = cv2.connectedComponentsWithStats(sel)
        for i in range(1, n):
            x, y, ww, hh, a = st[i]
            if x < w * 0.12 and y < h * 0.2 and ww > w * 0.12 and 0.15 * h > hh > h * 0.06 or (x < w * 0.12 and y < h * 0.2 and ww > w * 0.12 and hh > h * 0.06 and ww / max(hh, 1) > 1.6):
                if best is None or a > best[4]:
                    best = (x, y, ww, hh, a)
    if best is None:
        return None
    x, y, ww, hh, _ = best
    m = np.zeros((h, w), np.uint8)
    m[max(0, y - 4):y + hh + 5, max(0, x - 4):x + ww + 5] = 255
    return m

def save(arr, name, w=None, h=None, q=84, folder='thumb'):
    if w:
        hh = h or round(arr.shape[0] * w / arr.shape[1])
        interp = cv2.INTER_AREA if w < arr.shape[1] else cv2.INTER_LANCZOS4
        arr = cv2.resize(arr, (w, hh), interpolation=interp)
        if interp == cv2.INTER_LANCZOS4:  # 키운 이미지는 살짝 선명하게
            blur = cv2.GaussianBlur(arr, (0, 0), 1.0)
            arr = cv2.addWeighted(arr, 1.35, blur, -0.35, 0)
    p = os.path.join(PUB, folder, name + '.webp')
    cv2.imwrite(p, arr, [cv2.IMWRITE_WEBP_QUALITY, q])
    return '/img/%s/%s.webp' % (folder, name)

def cut(n, box, inset=5, badge=None, refine_box=True):
    im = img(n)
    b = refine(im, box) if refine_box else box
    x0, y0, x1, y1 = b
    c = im[y0 + inset:y1 - inset, x0 + inset:x1 - inset].copy()
    if badge:
        m = badge_mask(c, badge)
        if m is not None:
            c = cv2.inpaint(c, m, 15, cv2.INPAINT_NS)
    return c

def clone_fill(c, m):
    # 배지 자리를 바로 오른쪽 그림으로 덮고(하늘·꽃 배경이 이어지게) 가장자리를 부드럽게 섞는다
    ys, xs = np.where(m > 0)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    w = x1 - x0
    sx = min(x1 + 6, c.shape[1] - w)
    patch = c[y0:y1, sx:sx + w].astype(np.float32)
    feather = np.zeros(c.shape[:2], np.float32)
    feather[y0:y1, x0:x1] = 1
    feather = cv2.GaussianBlur(feather, (0, 0), 6)
    feather[y0:y1, x0:x1] = np.maximum(feather[y0:y1, x0:x1], 0.0)
    out = c.astype(np.float32)
    region = out[y0:y1, x0:x1]
    f = np.clip(feather[y0:y1, x0:x1] * 1.6, 0, 1)[..., None]
    out[y0:y1, x0:x1] = region * (1 - f) + patch * f
    # 남은 경계는 살짝 보정
    ring = ((cv2.dilate(m, np.ones((7, 7), np.uint8)) > 0) & (feather < 0.9) & (feather > 0.05)).astype(np.uint8) * 255
    res = out.astype(np.uint8)
    return cv2.inpaint(res, ring, 3, cv2.INPAINT_TELEA) if ring.any() else res

def fit(c, ratio):
    # 가운데 기준으로 가로:세로 비율 맞추기
    h, w = c.shape[:2]
    if w / h > ratio:
        nw = int(h * ratio); x = (w - nw) // 2
        return c[:, x:x + nw]
    nh = int(w / ratio); y = (h - nh) // 2
    return c[y:y + nh]

S = 1 / 0.5859375  # 미리보기(900px) → 원본
def P(x0, y0, x1, y1):
    return tuple(int(round(v * S)) for v in (x0, y0, x1, y1))

out = {}
BADGE = (0.55, 0.36)
# 운명·사주 (BIN000A: 정통·평생·대운·사주오행·재물·직장, BIN0004: 사업·창업·시험·이사·문서·신년·토정·월별)
lists = [
    ('BIN000A.png', (25, 183), [(157, 258), (272, 378), (392, 497), (512, 617), (632, 738), (752, 858)],
     ['jeongtong', 'pyeongsaeng', 'daewoon', 'ohaeng', 'wealth', 'career'], {'jeongtong', 'daewoon', 'wealth'}),
    ('BIN0004.png', (27, 190), [(8, 103), (117, 212), (227, 322), (337, 432), (448, 543), (558, 653), (670, 765), (781, 876)],
     ['business', 'startup', 'exam', 'moving', 'contract', 'newyear', 'tojeong', 'monthly'], set()),
    ('BIN0008.png', (27, 190), [(140, 235), (248, 343), (358, 453), (470, 565), (582, 677), (692, 787), (798, 893)],
     ['love', 'inyeon', 'marriage', 'lifelove', 'gunghap', 'couple', 'spouse'], {'love', 'inyeon', 'gunghap'}),
    ('BIN0006.png', (28, 226), [(28, 180), (196, 345), (362, 515), (530, 685), (700, 855)],
     ['reunion', 'crush', 'solo', 'meeting', 'loveyear'], {'reunion'}),
]
for n, (xa, xb), rows, ids, badged in lists:
    for (ya, yb), pid in zip(rows, ids):
        c = cut(n, P(xa, ya, xb, yb), badge=BADGE if pid in badged else None)
        out[pid] = save(fit(c, 3 / 2), 'thumb_' + pid, 360, 240)

# 사진운세 (BIN000B, 가로 1536)
for (ya, yb), pid in zip([(118, 255), (272, 410), (428, 575)], ['palm', 'face', 'baby']):
    c = cut('BIN000B.png', P(40, ya, 307, yb), badge=BADGE)
    out[pid] = save(fit(c, 3 / 2), 'thumb_' + pid, 420, 280)

# 타로 목록 (BIN0003, 어두운 배경) — 가로로 긴 띠
for (ya, yb), pid in zip([(460, 517), (522, 579), (585, 642), (648, 705), (757, 812), (820, 875)],
                         ['tarot_love', 'tarot_money', 'tarot_work', 'tarot_reunion', 'tarot_spread3', 'tarot_celtic']):
    x0, y0, x1, y1 = P(35, ya, 188, yb)
    c = img('BIN0003.png')[y0 + 6:y1 - 6, x0 + 6:x1 - 6]
    out[pid] = save(fit(c, 2.4), 'thumb_' + pid, 420, 175)

# 인기풀이 6 (BIN0010, 1338×1176 / 미리보기 900)
s10 = 1338 / 900
def P10(x0, y0, x1, y1): return tuple(int(round(v * s10)) for v in (x0, y0, x1, y1))
for (box, pid) in [((28, 102, 305, 290), 'newyear'), ((320, 102, 583, 290), 'jeongtong'), ((598, 102, 875, 290), 'wealth'),
                   ((28, 452, 305, 625), 'gunghap'), ((320, 452, 583, 625), 'daewoon'), ((598, 452, 875, 625), 'pyeongsaeng')]:
    c = cut('BIN0010.png', P10(*box), badge=(0.5, 0.3))
    save(fit(c, 4 / 3), 'pop_' + pid, 480, 360, folder='v4')

# 재미로 보는 운세 8 (BIN000F 1024×1536, 원본 좌표)
fun = [((38, 192, 500, 423), 'zodiac'), ((526, 192, 988, 423), 'star'), ((38, 545, 500, 762), 'blood'), ((526, 545, 988, 762), 'mbti'),
       ((38, 881, 500, 1097), 'factbomb'), ((526, 881, 988, 1097), 'dream'), ((38, 1214, 500, 1406), 'small'), ((526, 1214, 988, 1406), 'oneline')]
for box, fid in fun:
    c = cut('BIN000F.png', box, inset=3)
    out['fun_' + fid] = save(fit(c, 2 / 1), 'thumb_fun_' + fid, 480, 240)

# 지금 많이 찾는 풀이 10 (BIN000E 1536×1024) — 글자 없는 오른쪽 그림만 + 1/10 표시 지우기
s0e = 1536 / 900
ban = [((15, 42, 445, 140), 'love'), ((458, 42, 885, 140), 'wealth'), ((15, 150, 445, 250), 'daewoon'), ((458, 150, 885, 250), 'jeongtong'),
       ((15, 260, 445, 360), 'newyear'), ((458, 260, 885, 360), 'gunghap'), ((15, 368, 445, 467), 'tojeong'), ((458, 368, 885, 467), 'talisman'),
       ((15, 476, 445, 576), 'pyeongsaeng'), ((458, 476, 885, 576), 'tarot')]
for box, bid in ban:
    x0, y0, x1, y1 = [int(round(v * s0e)) for v in box]
    im = img('BIN000E.png')
    b = refine(im, (x0, y0, x1, y1))
    c = im[b[1] + 6:b[3] - 6, b[0] + 6:b[2] - 6].copy()
    h, w = c.shape[:2]
    c = c[6:h - 8, int(w * 0.46):int(w * 0.82)]  # 왼쪽 글자·오른쪽 1/10 표시·화살표 영역 버림
    save(c, 'banner_' + bid, 640, folder='v4')

# 오늘의 타로 위젯 그림(BIN0011 오른쪽 카드 3장), 부적 배너 그림(BIN0012 오른쪽)
im = img('BIN0011.png'); s = 1860 / 900
c = im[int(40 * s):int(372 * s), int(440 * s):int(865 * s)]
save(c, 'home_tarot', 640, folder='v4')
im = img('BIN0012.bmp'); s = 798 / 900
c = im[int(40 * s):int(340 * s), int(420 * s):int(855 * s)]
save(c, 'home_talisman', 480, folder='v4')

# 타로 탭 머리 그림(BIN0003 위쪽 — 제목 글자 포함), 부적 상세 머리 그림(BIN0009 왼쪽 부적·촛불)
im = img('BIN0003.png'); s = 1024 / 600
save(im[0:int(212 * s), :], 'tarot_header', 900, folder='v4')
im = img('BIN0009.png'); s = 887 / 450
save(im[int(36 * s):int(300 * s), 0:int(236 * s)], 'talisman_hero', 560, folder='v4')
# 타로 상세 머리(BIN0002 왼쪽 위 여인 그림 — 글자 위쪽만)
im = img('BIN0002.png'); s = 883 / 446
save(im[int(0 * s):int(130 * s), int(0 * s):int(215 * s)], 'tarot_detail_hero', 640, folder='v4')
# 운세함 MY LIBRARY 배경(BIN0001 왼쪽 시안 위 배너 — 오른쪽 그림만)
im = img('BIN0001.png'); s = 1024 / 600
save(im[int(46 * s):int(138 * s), int(168 * s):int(286 * s)], 'library_bg', 600, folder='v4')
# 사진운세 머리 장식(BIN000B 오른쪽 위 카메라)
im = img('BIN000B.png'); s = 1536 / 900
save(im[int(0 * s):int(108 * s), int(600 * s):int(900 * s)], 'photo_header', 600, folder='v4')

# 탭·분류 아이콘: 배경(한지색)을 투명하게 → png
def keyed(c, name, dark_bg=False):
    c = c.astype(np.float32)
    if dark_bg:
        lum = c.mean(2)
        a = np.clip((lum - 40) / 90, 0, 1)
    else:
        bg = np.median(np.concatenate([c[:3].reshape(-1, 3), c[-3:].reshape(-1, 3)]), axis=0)
        dist = np.abs(c - bg).sum(2)
        a = np.clip((dist - 18) / 60, 0, 1)
    rgba = np.dstack([c, a * 255]).astype(np.uint8)
    ys, xs = np.where(a > 0.1)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    cv2.imwrite(os.path.join(PUB, 'v4', name + '.png'), rgba)

im = img('BIN0013.png'); s = 2172 / 900
tab = {'tab_unse': (215, 85, 315, 185), 'tab_tarot': (375, 85, 520, 175), 'tab_talisman': (590, 85, 650, 190), 'tab_box': (740, 95, 850, 185)}
for k, b in tab.items():
    keyed(im[int(b[1] * s):int(b[3] * s), int(b[0] * s):int(b[2] * s)], k)
keyed(im[int(104 * s):int(166 * s), int(63 * s):int(141 * s)], 'tab_home', dark_bg=True)
im = img('BIN0007.png'); s = 2172 / 900
for k, b in {'cat_all': (38, 118, 98, 180), 'cat_fate': (233, 114, 299, 182), 'cat_love': (462, 110, 538, 186), 'cat_photo': (690, 116, 768, 182)}.items():
    keyed(im[int(b[1] * s):int(b[3] * s), int(b[0] * s):int(b[2] * s)], k, dark_bg=(k == 'cat_all'))

ts = os.path.join(R, 'web/src/assets/thumbs.ts')
with open(ts, 'w') as f:
    f.write('// scripts/crop-mockups.py 가 만드는 파일 — 상품 id → 썸네일(2차 시안에서 자름). 대표님 원본이 오면 _incoming 으로 교체. 직접 고치지 말 것.\n')
    f.write('export const THUMBS: Partial<Record<string, string>> = ' + json.dumps(out, indent=2, ensure_ascii=False) + ';\n')
print(len(out), 'thumbs')

# 프리미엄 팝업 시안(대표님 2026-10-12, premium_popup_a.png 1024×1536)
im = img('premium_popup_a.png')
save(im[30:430, 34:990], 'premium_head', 900, folder='v4')
for i, (x0, x1) in enumerate([(66, 272), (296, 502), (524, 730), (754, 960)]):
    save(im[446:600, x0:x1], 'premium_f%d' % (i + 1), 300, folder='v4')
for i, (y0, y1) in enumerate([(745, 808), (815, 885), (893, 962), (968, 1045)]):
    save(im[y0:y1, 140:250], 'premium_b%d' % (i + 1), 160, folder='v4')

# 부적 썸네일 배경(촛불 탁자, 흐리게) — 그 위에 부적별 글자를 새긴 부적을 코드로 올린다
im = img('BIN0012.bmp'); s = 798 / 900
c = im[int(40 * s):int(340 * s), int(420 * s):int(855 * s)]
c = cv2.resize(c, (320, int(c.shape[0] * 320 / c.shape[1])))
c = cv2.convertScaleAbs(cv2.GaussianBlur(c, (0, 0), 7), alpha=0.8, beta=0)
cv2.imwrite(os.path.join(PUB, 'v4', 'talisman_bg.webp'), c, [cv2.IMWRITE_WEBP_QUALITY, 70])
# 프리미엄 상세 화면용 머리 그림 — 시안의 닫기(X) 동그라미를 지운 것
im = img('premium_popup_a.png')
h = im[30:430, 34:990].copy()
m = np.zeros(h.shape[:2], np.uint8)
cv2.circle(m, (906, 52), 42, 255, -1)
save(cv2.inpaint(h, m, 21, cv2.INPAINT_TELEA), 'premium_head_page', 900, folder='v4')
