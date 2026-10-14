// 소리 버튼 2개 — 배경음악(♪) · 효과음(스피커). 타로 테이블·부적 의식에서 함께 쓴다. 설정은 이 기기에 기억.
import { useState } from 'react';
import { Icon } from './Icon';
import { musicOff, setMusicOff, setSoundOff, soundOff } from '../lib/sound';

export function SoundToggle() {
  const [off, setOff] = useState(soundOff());
  const [mOff, setMOff] = useState(musicOff());
  return (
    <div className="tsound-box">
      <button className={`tsound${mOff ? ' off' : ''}`} onClick={() => { setMusicOff(!mOff); setMOff(!mOff); }} aria-label={mOff ? '배경음악 켜기' : '배경음악 끄기'} aria-pressed={!mOff}>
        <Icon name="music" size={19} />
      </button>
      <button className="tsound" onClick={() => { setSoundOff(!off); setOff(!off); }} aria-label={off ? '효과음 켜기' : '효과음 끄기'} aria-pressed={!off}>
        <Icon name={off ? 'volume-x' : 'volume-2'} size={20} />
      </button>
    </div>
  );
}

