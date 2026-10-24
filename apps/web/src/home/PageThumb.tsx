/**
 * A page through the shared thumbnail renderer, fitted into a box: the Library card's cover
 * (`LibraryCard`) and the page the Continue card shows (`ContinueCard`, DSN-66). The caller's
 * `className` draws the sheet (the page's own colours and hairline).
 */
import type { VirtualPage, Workspace } from '@pdf-editor/document-model';
import type { ReactNode } from 'react';

import { RENDER_PRIORITY } from '../engine/engine-service';
import { PageCanvas } from '../pages/PageCanvas';
import { displaySize, fitInBox } from '../pages/page-geometry';
import { contentFrame, ResizedContent } from '../stage/ResizedContent';

export function PageThumb({
  workspace,
  page,
  box,
  className,
  children,
}: {
  readonly workspace: Workspace;
  readonly page: VirtualPage;
  readonly box: { readonly width: number; readonly height: number };
  readonly className: string | undefined;
  readonly children?: ReactNode;
}) {
  const size = displaySize(workspace, page);
  const fitted = fitInBox(size, box.width, box.height);
  const frame = contentFrame(workspace, page);
  return (
    <div
      className={className}
      data-library-sheet=""
      style={{ width: fitted.width, height: fitted.height }}
    >
      <ResizedContent frame={frame}>
        <PageCanvas
          sourceId={page.ref.kind === 'source' ? page.ref.source : undefined}
          blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
          index={page.ref.kind === 'source' ? page.ref.index : 0}
          rotation={page.rotation}
          widthPt={frame?.widthPt ?? size.width}
          heightPt={frame?.heightPt ?? size.height}
          cssWidth={fitted.width * (frame?.width ?? 1)}
          priority={RENDER_PRIORITY.visible}
        />
      </ResizedContent>
      {children}
    </div>
  );
}
