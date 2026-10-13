// 정통 감정서 분석표 — 원국 상세(십성·지장간·12운성·신살) · 오행/십성 분포 · 신강약·용신 · 합충 · 대운표 · 세운표 · 월운표
// 서버 감정서(content.reports)가 있으면 그것을, 없으면(예시) 화면에서 같은 엔진으로 계산한 값을 보여 준다.
import type { SajuReport } from '@naman/engine';

// 한 덩어리(예: "계(겁재)", "시주·일주 천간합(정임)")는 중간에서 줄이 바뀌지 않게
const nbJoin = (xs: string[], sep: string) => xs.map((x, i) => <span key={i}>{i > 0 && sep}<span className="nb">{x}</span></span>);
const EL: Record<string, string> = { 목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water' };

export function ReportTables({ r, name, birth }: { r: SajuReport; name: string; birth?: string }) {
  const ORDER = ['목', '화', '토', '금', '수'];
  const counts = Object.entries(r.elements.counts as Record<string, number>).sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  const max = Math.max(1, ...counts.map(([, n]) => n));
  const rows = r.rows as any[];
  const hz = (x: any, part: 'stem' | 'branch') => x.empty
    ? <td key={x.key} className="hz none">?</td>
    : <td key={x.key} className={`hz el-${EL[x[part].element]}${x.key === 'day' ? ' me' : ''}`}>{x[part].hanja}<small>{x[part].char}·{x[part].element}</small></td>;
  return (
    <section className="rep4" aria-label={`${name} 님 정통 분석표`}>
      <h2 className="rh">{name} 님의 사주 원국{birth && <small>{birth}</small>}</h2>
      <div className="tscroll">
        <table className="won4" aria-label="사주 원국 상세표">
          <thead><tr><th />{rows.map((x) => <th key={x.key} className={x.key === 'day' ? 'me' : ''}>{x.label}{x.key === 'day' && ' (나)'}</th>)}</tr></thead>
          <tbody>
            <tr><th>십성</th>{rows.map((x) => <td key={x.key} className="ss">{x.empty ? '-' : x.stem.sipsin}</td>)}</tr>
            <tr><th>천간</th>{rows.map((x) => hz(x, 'stem'))}</tr>
            <tr><th>지지</th>{rows.map((x) => hz(x, 'branch'))}</tr>
            <tr><th>십성</th>{rows.map((x) => <td key={x.key} className="ss">{x.empty ? '-' : x.branch.sipsin}</td>)}</tr>
            <tr><th>지장간</th>{rows.map((x) => <td key={x.key} className="sm">{x.empty ? '-' : nbJoin(x.hidden, ' ')}</td>)}</tr>
            <tr><th>12운성</th>{rows.map((x) => <td key={x.key}>{x.empty ? '-' : x.stage}</td>)}</tr>
            <tr><th>신살</th>{rows.map((x) => <td key={x.key} className="sm">{x.empty || !x.shinsal.length ? '-' : nbJoin(x.shinsal, ' ')}</td>)}</tr>
          </tbody>
        </table>
      </div>

      <div className="rgrid">
        <div className="rbox">
          <h3>오행 분포</h3>
          {counts.map(([e, n]) => <div key={e} className="rbar"><span className="lb"><i className={`el-${EL[e]}`} />{e}</span><span className="tr"><b className={`el-${EL[e]}`} style={{ width: `${(n / max) * 100}%` }} /></span><span className="n">{n}</span></div>)}
          <p className="sm">강한 기운 <b>{r.elements.strongest}</b> · 약한 기운 <b>{r.elements.weakest}</b>{r.elements.missing.length > 0 && <> · 없는 기운 <b>{r.elements.missing.join('·')}</b></>}</p>
        </div>
        <div className="rbox">
          <h3>십성 분포</h3>
          <div className="rtg">{Object.entries(r.tenGodCounts as Record<string, number>).map(([k, v]) => <span key={k} className={v ? '' : 'off'}>{k} <b>{v}</b></span>)}</div>
          <p className="sm">월지(사회 무대)의 십성 <b>{r.monthSipsin}</b></p>
        </div>
        <div className="rbox">
          <h3>신강·신약</h3>
          <p className="big">{r.strength.label}</p>
          <span className="tr wide"><b style={{ width: `${r.strength.score}%` }} /></span>
          <p className="sm">일간을 돕는 힘 {r.strength.score}% (월지 가중 · 억부 기준)</p>
        </div>
        <div className="rbox">
          <h3>용신 <small>억부 참고</small></h3>
          <p className="chips"><span className={`el-${EL[r.yongsin.yong]}`}>용신 {r.yongsin.yong}</span><span className={`el-${EL[r.yongsin.hee]}`}>희신 {r.yongsin.hee}</span><span className="gi">기신 {r.yongsin.gi}</span></p>
          <p className="sm">행운의 색 {r.yongsin.luck.color} · 방향 {r.yongsin.luck.dir} · 숫자 {r.yongsin.luck.num}</p>
        </div>
      </div>
      <div className="rbox"><h3>원국의 합·충·형·파·해</h3><p className="sm">{r.relations.length ? nbJoin(r.relations, ' · ') : '두드러진 합·충이 없는 안정된 원국'}{r.special.length > 0 && <> · {nbJoin(r.special, ' · ')}</>}</p></div>

      <h2 className="rh">대운표<small>{r.daewoonStart ?? ''}세부터 10년마다 · {r.daewoonDirection === 'forward' ? '순행' : '역행'}</small></h2>
      <div className="tscroll">
        <table className="dw4"><tbody><tr>{r.daewoon.map((d) => (
          <td key={d.order} className={d.current ? 'cur' : ''}>
            <small>{d.fromAge}~{d.toAge}세</small><b>{d.hanja[0]}<br />{d.hanja[1]}</b><small>{d.stemSipsin}<br />{d.branchSipsin}</small><small>{d.stage}</small>{d.current && <em>지금</em>}
          </td>
        ))}</tr></tbody></table>
      </div>

      <h2 className="rh">세운표<small>앞으로 10년</small></h2>
      <div className="tscroll">
        <table className="list4">
          <thead><tr><th>해</th><th>나이</th><th>간지</th><th>천간</th><th>지지</th><th>12운성</th><th>일지와</th></tr></thead>
          <tbody>{r.seun.map((y) => <tr key={y.year}><td>{y.year}</td><td>{y.age}</td><td><b>{y.text}</b> {y.hanja}</td><td>{y.stemSipsin}</td><td>{y.branchSipsin}</td><td>{y.stage}</td><td>{y.withDay.join('·') || '-'}</td></tr>)}</tbody>
        </table>
      </div>

      <h2 className="rh">{r.targetYear}년 월운표</h2>
      <div className="tscroll">
        <table className="list4">
          <thead><tr><th>달</th><th>간지</th><th>천간</th><th>지지</th><th>12운성</th><th>일지와</th></tr></thead>
          <tbody>{r.months.map((m) => <tr key={m.label}><td>{m.label.replace('양력 ', '')}</td><td><b>{m.text}</b> {m.hanja}</td><td>{m.stemSipsin}</td><td>{m.branchSipsin}</td><td>{m.stage}</td><td>{m.withDay.join('·') || '-'}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
