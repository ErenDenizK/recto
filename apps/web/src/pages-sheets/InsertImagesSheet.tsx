/**
 * S18 Insert images as pages (`components/07-sheets.md` §19): after choosing images in Insert
 * images… (or dropping them on a section), how big their pages are. A task sheet that is a
 * question: `askImageSizing` (`stage/operation-dialogs-store.ts`) resolves with the answer, or
 * undefined when the sheet closes without one.
 *
 * - **Page size:** Fit to A4 width (the default; wider images scale down, the aspect ratio
 *   kept) · Original size (one pixel is one point at 72 dpi), each with the largest page it
 *   makes. The primary says how many pages it inserts. Guard `pages` is asked by the command
 *   that inserts; the question changes nothing itself.
 */
import { A4, type ImageSizing, imagePageSize } from '../files/images';
import { formatNumber, m } from '../i18n';
import { RadioGroup } from '../ui/RadioGroup';
import { Sheet, SheetGroup, useSheetDraft } from '../ui/sheet';
import styles from './PagesSheets.module.css';

export const INSERT_IMAGES_SHEET = 'insert-images';

export function InsertImagesSheet({
  count,
  largest,
  open,
  onAnswer,
  onClose,
}: {
  readonly count: number;
  /** The largest image in points at 72 dpi, for the hints. */
  readonly largest: { readonly width: number; readonly height: number };
  readonly open: boolean;
  readonly onAnswer: (choice: ImageSizing) => void;
  readonly onClose: () => void;
}) {
  const [choice, setChoice, , restored] = useSheetDraft<ImageSizing>(
    INSERT_IMAGES_SHEET,
    null,
    'fit-a4',
  );
  const fitted = imagePageSize(largest.width, largest.height, 'fit-a4');
  const cm = (points: number) => formatNumber(Math.round((points / 72) * 2.54 * 10) / 10);

  return (
    <Sheet
      id={INSERT_IMAGES_SHEET}
      kind="task"
      open={open}
      onClose={onClose}
      title={m.image_size_title({ count })}
      description={m.image_size_description()}
      restored={restored}
      initialFocus="primary"
      primary={{
        label: m.insert_images_primary({ count }),
        onPress: () => onAnswer(choice),
      }}
      testId="image-size-dialog"
    >
      <SheetGroup label={m.image_size_label()}>
        <RadioGroup<ImageSizing>
          className={styles.choices}
          label={m.image_size_label()}
          value={choice}
          onValueChange={setChoice}
          options={[
            {
              value: 'fit-a4',
              label: m.image_size_fit(),
              description: m.image_size_fit_hint({
                width: cm(Math.min(fitted.width, A4.width)),
                height: cm(fitted.height),
              }),
            },
            {
              value: 'original',
              label: m.image_size_original(),
              description: m.image_size_original_hint({
                width: cm(largest.width),
                height: cm(largest.height),
              }),
            },
          ]}
        />
      </SheetGroup>
    </Sheet>
  );
}
