import { SubHeader } from '../components/layout';
import { Button } from '../components/ui';

export default function Placeholder() {
  return (
    <>
      <SubHeader title="준비 중" />
      <div className="screen">
        <p className="muted">이 화면은 곧 열려요.</p>
        <Button to="/">홈으로</Button>
      </div>
    </>
  );
}
