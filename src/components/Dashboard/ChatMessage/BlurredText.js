import { Fragment } from 'react';
import { segmentsForBlur } from '../../../helpers/badWords';

export default function BlurredText({ text }) {
  const segments = segmentsForBlur(text);
  if (segments.length === 0) return null;
  return segments.map((seg, i) =>
    seg.bad ? (
      <span key={i} className="msg-blurred-word">
        {seg.text}
      </span>
    ) : (
      <Fragment key={i}>{seg.text}</Fragment>
    )
  );
}
