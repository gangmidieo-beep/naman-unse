# 무료 운세 그림: 대표님 3차 시안(GPT) 이미지에서 잘라 web/public/img/fun 에 저장
import cv2, numpy as np, os, sys
from PIL import Image
# 사용: python3 scripts/fun-art-from-mockup.py <시안 HWP 이미지 폴더(BIN00xx.png)> web/public/img/fun
SRC=sys.argv[1].rstrip('/')+'/'; OUT=sys.argv[2]; os.makedirs(OUT,exist_ok=True)
def rd(n): return cv2.imread(SRC+n)
def save(arr,name,q=86,alpha=None):
    im=Image.fromarray(cv2.cvtColor(arr,cv2.COLOR_BGR2RGB))
    if alpha is not None:
        im=im.convert('RGBA'); im.putalpha(Image.fromarray(alpha))
    im.save(f'{OUT}/{name}.webp',quality=q,method=6)
def inpaint_text(img,box,thr=150,dil=7,extra=()):
    g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY); m=np.zeros(g.shape,np.uint8)
    x0,y0,x1,y1=box; sub=g[y0:y1,x0:x1]
    m[y0:y1,x0:x1]=cv2.dilate((sub<thr).astype(np.uint8)*255,np.ones((dil,dil),np.uint8))
    for (a,b,c,d) in extra: m[b:d,a:c]=255
    return cv2.inpaint(img,m,11,cv2.INPAINT_TELEA)
up=lambda a,f=2: cv2.resize(a,None,fx=f,fy=f,interpolation=cv2.INTER_LANCZOS4)
# 띠 12
keys=['rat','ox','tiger','rabbit','dragon','snake','horse','sheep','monkey','rooster','dog','pig']
z=rd('BIN0013.png'); xs=[27,403,777,1153]; ys=[505,662,822]
for i,k in enumerate(keys):
    if k=='rat': continue
    x=xs[i%4]; y=ys[i//4]; w={'monkey':174,'tiger':176}.get(k,184)
    save(up(z[y+6:y+140,x+8:x+8+w]),f'zodiac_{k}')
r=rd('BIN0014.png')[150:410,0:290]
m=np.zeros(r.shape[:2],np.uint8); m[34:90,190:236]=255
r=cv2.inpaint(r,m,9,cv2.INPAINT_TELEA)
save(up(r[30:252,20:262]),'zodiac_rat')
# 별자리 12 (마스크: 선만 남김)
stars=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']
s=rd('BIN0016.png'); xs=[98,406,730,1054]; ys=[165,257,350]
for i,k in enumerate(stars):
    x=xs[i%4]; y=ys[i//4]
    for nm,(a,b) in {'star':(10,126),'starc':(220,288)}.items():
        c=s[y+4:y+84,x+a:x+b]; L=cv2.cvtColor(c,cv2.COLOR_BGR2GRAY).astype(float)
        if k=='sagittarius': al=np.clip((L-55)/110,0,1)
        else: al=np.clip((238-L)/90,0,1)
        al=(al*255).astype(np.uint8)
        # 가장자리 카드 테두리 제거
        al[:3,:]=0; al[-3:,:]=0
        if nm=='starc': al[:,:9]=0
        gold=np.zeros_like(c); gold[:]=(58,128,176)
        save(up(gold,3),f'{nm}_{k}',q=90,alpha=up(al,3))
# 꿈 8
cats=['animal','person','money','nature','body','place','event','object']
d=rd('BIN000B.png'); xs=[72,458,843,1229]; ys=[420,635]
for i,k in enumerate(cats):
    x=xs[i%4]; y=ys[i//4]; c=d[y+3:y+197,x+4:x+367].copy()
    c=inpaint_text(c,(8,140,150,190),thr=120,extra=((296,140,356,190),))
    save(c,f'dream_{k}')
h=d[72:245,:].copy()
h=inpaint_text(h,(645,25,1000,140),extra=((648,50,740,95),(945,50,1000,95),(58,18,140,100)))
save(h[4:162],'dream_hero',q=84)
# 팩폭·스몰·한줄·MBTI·혈액형 장식
save(rd('BIN0007.png')[165:358,660:1418],'fact_hero')
save(rd('BIN0008.png')[214:470,700:1390],'small_hero')
o=rd('BIN000C.png'); save(o[548:686,52:560],'oneline_land'); save(o[106:238,1320:1536],'oneline_pine')
save(rd('BIN000E.png')[566:772,1050:1336],'mbti_land')
save(rd('BIN0011.png')[742:884,92:412],'blood_land')
save(rd('BIN0013.png')[0:250,980:1536],'fun_deco')
print('ok')
