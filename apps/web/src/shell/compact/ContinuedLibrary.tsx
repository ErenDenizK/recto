/**
 * The Library with Continue on (DSN-66, EDN-10): the card above the intro, and the one-lime swap
 * (`useContinueShown`) the dock and Recents follow. A lazy chunk of `CompactLibrary`, loaded only
 * behind `?home=continue`, so the phone's first load carries none of it.
 */
import ContinueCard from '../../home/ContinueCard';
import { useContinueShown } from '../../home/continue-shown';
import { LibraryScreen } from './CompactLibrary';

export default function ContinuedLibrary() {
  const continued = useContinueShown((s) => s.shown);
  return (
    <LibraryScreen
      continued={continued}
      slot={
        <ContinueCard
          variant="phone"
          onResume={(id, point) =>
            void import('./compact-resume').then((v) => v.resumeCompact(id, point))
          }
        />
      }
    />
  );
}
