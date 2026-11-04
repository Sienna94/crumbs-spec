#!/usr/bin/env python3
"""crumbs-walk.gif 생성기.

토스트가 오른쪽으로 달리며 크럼을 떨어뜨리고, 뒤따르는 테라코타 크리터가 크럼을 주워 손에 들고
머리 위 전구를 켜는 루프 GIF. 배경(땅·크럼)은 왼쪽으로 흐르고, 등장인물은 화면 안에서 제자리에 있다.
크리터 몸통은 위아래로 움직이지 않고 다리만 걷는다.

사용법:
    python make_gif.py                       # docs/assets/crumbs-walk.gif 생성
    python make_gif.py --frames-dir DIR      # 검수용 프레임 PNG도 DIR에 저장
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageSequence

OUT = Path(__file__).resolve().parent.parent / 'crumbs-walk.gif'

# ---- 상수 -------------------------------------------------------------------
BASE_W, BASE_H = 96, 24       # 논리 픽셀 캔버스
SCALE = 5                     # -> 480 x 120, Image.NEAREST
DURATION_MS = 80              # 프레임당 지연(ms)
N_FRAMES = 36                 # 3초 루프, SPAWN_EVERY의 배수여야 함
SCROLL = 1                    # 프레임당 세계가 왼쪽으로 이동하는 px (루프 이동량 = 36 px)
SPAWN_EVERY = 12              # 12프레임마다 크럼 하나가 떨어짐
GROUND_Y = 21                 # 땅 선 행 (틱은 그 아래 행 22)
TICK_PERIOD = 12              # 땅 틱 간격. 루프 이동량 36을 나눠떨어뜨려야 seamless 가 된다.

# 크리터: 몸통은 고정, 다리만 움직인다.
CRITTER_X = 12                # 스프라이트 폭 15 (몸통) / 17 (손 든 몸통) -> x 12..26 / 12..28
CRITTER_TOP = GROUND_Y - 9    # 스프라이트 맨 위 행 = 몸통 첫 행 y=12 (몸통 맨 아래 행 = GROUND_Y - 3 = 18)
BODY_ROW1 = CRITTER_TOP       # 몸통 첫 행 y=12 (스텁 없음)
CRITTER_LEG_TOP = GROUND_Y - 2  # 다리 시작 행 y=19 (2px: 19..20)
CRITTER_LEG_X = (3, 5, 10, 12)              # 스프라이트 기준 다리 x
CRITTER_LIFTED = {1: (3, 10), 3: (5, 12)}   # 걷기 단계별 들린 다리 (위쪽 1px 만, x+1)

# 빵
BREAD_X = 70                  # 스프라이트 폭 14 -> x 70..83
BREAD_TOP = GROUND_Y - 16     # 착지 시 몸통 맨 위 y=5
BREAD_LEG_X = (4, 9)          # 스프라이트 기준 다리 x
BREAD_DY = [0, -1, -2, -1]    # 4단계 점프 (step = f % 4)

# 크럼 나이 기준 타임라인 (크럼 x = BREAD_X - 2 - SCROLL*age)
HOLD_AGE = 42                 # 이 나이부터 크럼은 바닥이 아니라 크리터 손에 들려 있음
GRAB_AGE = 40                 # 이 나이부터 크리터는 손을 든 몸통(REACH)을 씀
EAT_AGE = 45                  # 이 나이부터 크럼이 사라짐
BULB_LIT_AGES = (45, 46, 49, 50)
BULB_DIM_AGES = (47, 48, 51)
BULB_END = max(BULB_LIT_AGES + BULB_DIM_AGES)     # 51: 전구 구간의 마지막 나이 (잡기 구간 40..51 = 12프레임)
BULB_X, BULB_Y = CRITTER_X + 4, 2                 # (16, 2): 베이스 아래(y=10)가 몸통 맨 위(y=12) 위 1px 띄움
HELD_DX, HELD_DY = 17, 0      # 들린 크럼 위치 = (CRITTER_X + 17, BODY_ROW1 + 0) = (29, 12)
SANITY_X0, SANITY_X1 = 40, BREAD_X                # 프레임 0 크럼 존재 검사 구간(논리 좌표)

# ---- 팔레트 (인덱스 0 = 투명) -------------------------------------------------
PAL = {
    '.': None,                 # 투명
    'T': (217, 119, 87),       # 테라코타 몸통
    'D': (31, 26, 23),         # 눈
    'P': (240, 160, 144),      # 볼
    'K': (200, 128, 63),       # 빵 껍질
    'C': (246, 226, 184),      # 빵 속
    'M': (224, 176, 112),      # 크럼(밝은)
    'Y': (242, 201, 76),       # 전구 불빛(켜짐)
    'G': (207, 198, 184),      # 땅 선
    'g': (228, 222, 212),      # 땅 틱(밝은)
    'S': (154, 154, 154),      # 전구 받침(회색)
    'W': (247, 230, 176),      # 전구 유리(꺼짐, 흐린 색)
    'O': (232, 135, 43),       # 전구 필라멘트(켜짐, 달아오른 색)
    'N': (160, 120, 80),       # 전구 필라멘트(꺼짐, 차가운 색)
}
PAL_KEYS = [k for k, v in PAL.items() if v is not None]
COLORS = [(0, 0, 0)] + [PAL[k] for k in PAL_KEYS]        # index 0 은 투명 자리표시자
IDX = {k: i + 1 for i, k in enumerate(PAL_KEYS)}

# ---- 스프라이트 ---------------------------------------------------------------
CRITTER_BODY = [                       # 15 x 7. 행 0 은 앞쪽 위 모서리의 1px 돌기. 눈은 열 5, 12 (행 2-3)
    "..TTTTTTTTTTTTT",
    "..TTTDTTTTTTDTT",
    "TTTTTDTTTTTTDTT",
    "TTTTTTTTTTTTTTT",
    "..TTTTTTTTTTTTT",
    "..TTTTTTTTTTTTT",
    "..TTTTTTTTTTTTT",
]
CRITTER_BODY_REACH = [                 # 17 x 7. 앞팔이 대각선으로 올라가 열 16, 행 2 에서 손끝
    "..TTTTTTTTTTTTT..",
    "..TTTDTTTTTTDTT.T",
    "TTTTTDTTTTTTDTTT.",
    "TTTTTTTTTTTTTTT..",
    "..TTTTTTTTTTTTT..",
    "..TTTTTTTTTTTTT..",
    "..TTTTTTTTTTTTT..",
]
BREAD = [                              # 14 x 14. 두 개의 둥근 귀 모양 윗부분, 2px 껍질, 점 눈 1x2
    "..KKKK..KKKK..",
    ".KKKKKKKKKKKK.",
    "KKKKKKKKKKKKKK",
    "KKCCCCCCCCCCKK",
    "KKCCCCCCCCCCKK",
    "KKCCDCCCCDCCKK",
    "KKCCDCCCCDCCKK",
    "KKCCCCCCCCCCKK",
    "KKCCCCCCCCCCKK",
    "KKCCCCCCCCCCKK",
    "KKCCCCCCCCCCKK",
    "KKCCCCCCCCCCKK",
    "KKKKKKKKKKKKKK",
    ".KKKKKKKKKKKK.",
]
CRUMB = [
    "KM",
    "MK",
]
BULB_LIT = [                           # 9 x 9. 켜진 상태: 가장자리 빛줄기 + 달아오른 필라멘트
    "Y...Y...Y",
    "...YYY...",
    "..YYYYY..",
    ".YYOYOYY.",
    ".YYOOOYY.",
    "Y.YYOYY.Y",
    "...YYY...",
    "...SSS...",
    "...SSS...",
]
BULB_DIM = [                           # 9 x 9. 꺼진 상태: 빛줄기 없음, 흐린 유리 + 차가운 필라멘트
    ".........",
    "...WWW...",
    "..WWWWW..",
    ".WWNWNWW.",
    ".WWNNNWW.",
    "..WWNWW..",
    "...WWW...",
    "...SSS...",
    "...SSS...",
]

# 크럼 바닥 높이 (나이별)
CRUMB_Y_BY_AGE = {0: GROUND_Y - 5, 1: GROUND_Y - 6, 2: GROUND_Y - 5, 3: GROUND_Y - 3}

# 캔버스 밖으로 나간 픽셀 기록 (검수용). 정상이라면 비어 있어야 한다.
CLIPPED = []


# ---- 그리기 헬퍼 --------------------------------------------------------------
def put(img, x, y, rgb):
    if 0 <= x < BASE_W and 0 <= y < BASE_H:
        img.putpixel((x, y), rgb + (255,))
    else:
        CLIPPED.append((x, y))


def blit(img, rows, x, y):
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            rgb = PAL[ch]
            if rgb is not None:
                put(img, x + c, y + r, rgb)


# ---- 움직임 규칙 --------------------------------------------------------------
def crumb_y(age):
    return CRUMB_Y_BY_AGE.get(age, GROUND_Y - 2)


def spawn_ages(f):
    """모든 크럼 생성 시점 t_i = SPAWN_EVERY*i 에 대해 나이 f - t_i 목록."""
    return [f - SPAWN_EVERY * i for i in range(-6, 6)]


def bulb_sprite(ages):
    if any(a in BULB_LIT_AGES for a in ages):
        return BULB_LIT
    if any(a in BULB_DIM_AGES for a in ages):
        return BULB_DIM
    return None


def draw_ground(img, f):
    for x in range(BASE_W):
        put(img, x, GROUND_Y, PAL['G'])
        if (x + SCROLL * f) % TICK_PERIOD == 0:
            put(img, x, GROUND_Y + 1, PAL['g'])


def draw_bread(img, f):
    step = f % 4                              # 4단계 점프
    dy = BREAD_DY[step]
    top = BREAD_TOP + dy
    blit(img, BREAD, BREAD_X, top)
    leg_top = top + len(BREAD)                # 다리 시작 행 = 몸통 바로 아래
    for rel in BREAD_LEG_X:
        x = BREAD_X + rel
        if step == 0:
            put(img, x, leg_top, PAL['K'])    # 착지: 2px, 바닥(GROUND_Y-1)에 닿음
            put(img, x, leg_top + 1, PAL['K'])
        else:
            put(img, x, leg_top, PAL['K'])    # 점프 중: 1px, 몸통 바로 아래


def draw_critter(img, f, reach):
    """몸통은 제자리에 그리고, 다리만 걷기 단계에 따라 움직인다."""
    body = CRITTER_BODY_REACH if reach else CRITTER_BODY
    blit(img, body, CRITTER_X, CRITTER_TOP)
    lifted = CRITTER_LIFTED.get(f % 4, ())
    for rel in CRITTER_LEG_X:
        x = CRITTER_X + rel
        if rel in lifted:
            put(img, x + 1, CRITTER_LEG_TOP, PAL['T'])     # 들린 다리: 위쪽 1px 만, x+1
        else:
            put(img, x, CRITTER_LEG_TOP, PAL['T'])
            put(img, x, CRITTER_LEG_TOP + 1, PAL['T'])


def render_base(f):
    img = Image.new('RGBA', (BASE_W, BASE_H), (0, 0, 0, 0))
    ages = spawn_ages(f)

    # 1) 땅
    draw_ground(img, f)

    # 2) 바닥에 떨어져 가는 크럼 (age 0..HOLD_AGE-1)
    for age in ages:
        if 0 <= age < HOLD_AGE:
            blit(img, CRUMB, BREAD_X - 2 - SCROLL * age, crumb_y(age))

    # 3) 전구 (고정 위치)
    bulb = bulb_sprite(ages)
    if bulb is not None:
        blit(img, bulb, BULB_X, BULB_Y)

    # 4) 빵, 5) 크리터 (잡는 동작 중에는 손 든 몸통)
    draw_bread(img, f)
    reach = any(GRAB_AGE <= age < EAT_AGE for age in ages)
    draw_critter(img, f, reach)

    # 6) 들린 크럼 (크리터 위에 그림)
    if any(HOLD_AGE <= age < EAT_AGE for age in ages):
        blit(img, CRUMB, CRITTER_X + HELD_DX, BODY_ROW1 + HELD_DY)
    return img


# ---- 렌더링 / 양자화 ----------------------------------------------------------
def to_scaled(img):
    return img.resize((BASE_W * SCALE, BASE_H * SCALE), Image.NEAREST)


def make_palette_image():
    pal = Image.new('P', (1, 1))
    flat = []
    for rgb in COLORS:
        flat.extend(rgb)
    flat += [0] * (768 - len(flat))
    pal.putpalette(flat)
    return pal


def quantize(rgba, pal_img):
    rgb = rgba.convert('RGB')
    p = rgb.quantize(palette=pal_img, dither=Image.Dither.NONE)
    alpha = rgba.getchannel('A')
    p.paste(0, mask=alpha.point(lambda a: 255 if a == 0 else 0))
    return p


def norm(img):
    """투명 픽셀의 RGB를 0으로 맞춰 비교 가능하게 만든다."""
    img = img.convert('RGBA')
    mask = img.getchannel('A').point(lambda a: 255 if a == 0 else 0)
    black = Image.new('RGBA', img.size, (0, 0, 0, 0))
    return Image.composite(black, img, mask)


# ---- 검수 ---------------------------------------------------------------------
def run_checks(rgba_frames):
    ok_all = True

    def check(name, ok, detail=''):
        nonlocal ok_all
        ok_all = ok_all and ok
        suffix = f' ({detail})' if detail else ''
        print(f"[{'OK' if ok else 'FAIL'}] {name}{suffix}")

    out_w, out_h = BASE_W * SCALE, BASE_H * SCALE

    # 루프 이동량이 틱 주기로 나눠떨어져야 땅 틱이 seamless 가 된다.
    check(f'tick period {TICK_PERIOD} divides loop shift {SCROLL * N_FRAMES}',
          (SCROLL * N_FRAMES) % TICK_PERIOD == 0)
    check(f'spawn period {SPAWN_EVERY} divides N_FRAMES {N_FRAMES}', N_FRAMES % SPAWN_EVERY == 0)
    check('sprite sizes: body 15x7, reach 17x7, bread 14x14, bulb 9x9',
          len(CRITTER_BODY) == 7 and {len(r) for r in CRITTER_BODY} == {15}
          and len(CRITTER_BODY_REACH) == 7 and {len(r) for r in CRITTER_BODY_REACH} == {17}
          and CRITTER_BODY[0].count('T') == 13 and CRITTER_BODY_REACH[0].count('T') == 13
          and len(BREAD) == 14 and {len(r) for r in BREAD} == {14}
          and len(BULB_LIT) == 9 and {len(r) for r in BULB_LIT} == {9}
          and len(BULB_DIM) == 9 and {len(r) for r in BULB_DIM} == {9})
    feet = CRITTER_TOP + len(CRITTER_BODY) - 1
    check('critter feet: body bottom row at GROUND_Y-3, legs start right below it',
          feet == GROUND_Y - 3 and CRITTER_LEG_TOP == feet + 1,
          f'body bottom y={feet}, leg top y={CRITTER_LEG_TOP}')
    check('no sprite pixel clipped by the canvas', not CLIPPED, f'{len(CLIPPED)} clipped')

    # 전구(고정 위치) 가 빵, 크리터 몸통 맨 위(스텁 행), 바닥 크럼과 겹치지 않는지
    bulb_bottom = BULB_Y + 8
    crumb_top = min(min(CRUMB_Y_BY_AGE.values()), GROUND_Y - 2)
    check('bulb clear of bread, critter top and ground crumbs',
          BULB_X + 8 < BREAD_X and bulb_bottom < CRITTER_TOP and bulb_bottom < crumb_top,
          f'bulb x {BULB_X}..{BULB_X + 8}, y {BULB_Y}..{bulb_bottom}; critter top {CRITTER_TOP}, crumb top {crumb_top}')

    check('bulb is exactly 1 px above the critter top row (no stub)',
          CRITTER_TOP - bulb_bottom - 1 == 1,
          f'gap rows={CRITTER_TOP - bulb_bottom - 1}, bulb bottom y={bulb_bottom}, body top y={CRITTER_TOP}')
    # 잡기+전구 구간 (GRAB_AGE..BULB_END) 이 같은 프레임에 두 크럼에 동시에 걸치는지 본다.
    counts = [sum(1 for a in spawn_ages(f) if GRAB_AGE <= a <= BULB_END) for f in range(N_FRAMES)]
    clash = [f for f, c in enumerate(counts) if c > 1]
    check(f'grab+bulb sequence ages {GRAB_AGE}..{BULB_END} ({BULB_END - GRAB_AGE + 1} frames) '
          f'never overlaps the next crumb (spawn period {SPAWN_EVERY})',
          not clash, f'max concurrent={max(counts)}, overlapping frames={clash}')

    size_kb = OUT.stat().st_size / 1024
    check('file exists and size < 300 KB', OUT.exists() and size_kb < 300, f'{size_kb:.1f} KB')

    with Image.open(OUT) as im:
        check(f'dimensions {out_w} x {out_h}', im.size == (out_w, out_h), f'{im.size}')
        durs, frames = [], []
        for fr in ImageSequence.Iterator(im):
            durs.append(fr.info.get('duration'))
            frames.append(fr.convert('RGBA'))
        n = len(frames)
        check(f'frame count == {N_FRAMES}', n == N_FRAMES, f'{n}')
        check(f'duration == {DURATION_MS} ms on every frame',
              all(d == DURATION_MS for d in durs), f'set={sorted(set(durs))}')
        loop = im.info.get('loop')
        check('loop == 0 (infinite)', loop == 0, f'loop={loop}')

        # 프레임 0 과 f=36 렌더 결과가 동일해야 한다 (seamless loop)
        f36 = norm(to_scaled(render_base(N_FRAMES)))
        gif0 = norm(frames[0])
        same = gif0.tobytes() == f36.tobytes()
        check('seamless: GIF frame 0 == render(f=36)', same, 'identical' if same else 'differs')

        # 참고: GIF 인코딩 왕복 무손실 확인 (프레임 0 렌더 vs GIF 프레임 0)
        rt = norm(rgba_frames[0]).tobytes() == gif0.tobytes()
        check('round trip: render(f=0) == GIF frame 0', rt)

        # 프레임 0 에는 SANITY_X0..SANITY_X1 구간에 크럼 픽셀이 있어야 한다 (스케일 좌표)
        crumb_rgb = {PAL['K'], PAL['M']}
        px = frames[0].load()
        hit = False
        for x in range(SANITY_X0 * SCALE, SANITY_X1 * SCALE):
            for y in range(out_h):
                r, g, b, a = px[x, y]
                if a and (r, g, b) in crumb_rgb:
                    hit = True
                    break
            if hit:
                break
        check(f'sanity: crumb pixels in x={SANITY_X0}..{SANITY_X1 - 1} (logical) at frame 0', hit)

    print(f"ALL CHECKS {'PASSED' if ok_all else 'FAILED'}")
    return ok_all


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--frames-dir', type=Path, default=None,
                    help='검수용 프레임 PNG(흰 배경, 스케일 적용)를 저장할 디렉터리')
    args = ap.parse_args()

    rgba_frames = [to_scaled(render_base(f)) for f in range(N_FRAMES)]
    pal_img = make_palette_image()
    p_frames = [quantize(fr, pal_img) for fr in rgba_frames]

    p_frames[0].save(OUT, save_all=True, append_images=p_frames[1:], loop=0,
                     duration=DURATION_MS, disposal=2, transparency=0, optimize=False)
    print(f'wrote {OUT}')

    if args.frames_dir is not None:
        args.frames_dir.mkdir(parents=True, exist_ok=True)
        for i, fr in enumerate(rgba_frames):
            bg = Image.new('RGBA', fr.size, (255, 255, 255, 255))
            bg.alpha_composite(fr)
            path = args.frames_dir / f'frame_{i:02d}.png'
            bg.convert('RGB').save(path)
        print(f'debug frames: {args.frames_dir} ({len(rgba_frames)} files)')

    ok = run_checks(rgba_frames)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
