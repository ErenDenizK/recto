/**
 * The Labs section of Settings (DSN-82): every flag of the registry with a switch (or a segmented
 * control for a flag with several values), its one-line description, its status and edition,
 * and "Reload to apply" once a choice differs from what this page started with. Reset all
 * clears every toggle and everything a flag kept itself. Hidden until revealed (`store.ts`).
 *
 * Built on the Settings rows and the `Switch` and `Segmented` primitives, so touch targets
 * (44 px coarse), focus rings and keys are theirs. A flag the address sets shows that, disabled:
 * the address wins (`flags.ts`).
 */

import { m } from "../i18n";
import { Row, Section, Line } from "../settings/rows";
import styles from "../settings/Settings.module.css";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Segmented";
import { Switch } from "../ui/Switch";
import { LABS_FLAGS, type LabsEdition, type LabsFlag, resolveAll } from "./flags";
import { LABS_TEXT, LABS_VALUE } from "./labs-text";
import { resetLabs, setLabsFlag, useLabsState } from "./store";
import { readLabs } from "./stored";

const EDITION: Record<LabsEdition, () => string> = {
  full: m.labs_edition_full,
  compact: m.labs_edition_compact,
  all: m.labs_edition_all,
};

/** "Prototype · Desktop and tablet", then what must happen next. */
function describe(flag: LabsFlag, address: boolean, reload: boolean): string {
  const status = flag.status === "soon" ? m.labs_status_soon() : m.labs_status_prototype();
  return [
    LABS_TEXT[flag.key].hint(),
    `${status} ${EDITION[flag.edition]()}`,
    address ? m.labs_by_address() : null,
    reload ? m.labs_reload() : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** What each flag was when this page started (read with the panel's code, before any toggle). */
const started = resolveAll(location.search, readLabs().flags);

export function LabsSection() {
  const state = useLabsState();
  const now = resolveAll(location.search, state.flags);
  return (
    <Section id="labs" title={m.labs_title()}>
      {LABS_FLAGS.map((flag) => {
        const here = now.get(flag.key);
        if (!here) return null;
        const address = here.source === "url";
        const reload = here.value !== started.get(flag.key)?.value;
        const hint = describe(flag, address, reload);
        const title = LABS_TEXT[flag.key].title();
        return flag.kind === "switch" ? (
          <Row key={flag.key} id={`labs-${flag.key}`}>
            <Switch
              className={styles.switch}
              label={title}
              description={hint}
              checked={here.value === "1"}
              disabled={address}
              onCheckedChange={(on) => setLabsFlag(flag.key, on ? "1" : "0")}
            />
          </Row>
        ) : (
          <Row key={flag.key} id={`labs-${flag.key}`} bar>
            <Line label={title} description={hint}>
              <div className={styles.segmented} data-values={flag.values.length}>
                <Segmented
                  label={title}
                  value={here.value}
                  onValueChange={(next) => setLabsFlag(flag.key, next)}
                  options={flag.values.map((value) => ({
                    value,
                    label: LABS_VALUE[value]?.() ?? value,
                    disabled: address,
                  }))}
                />
              </div>
            </Line>
          </Row>
        );
      })}
      <Row id="labs-reset" bar>
        <Line label={m.labs_reset_label()} description={m.labs_reset_hint()}>
          <Button variant="standard" onClick={resetLabs}>
            {m.labs_reset()}
          </Button>
        </Line>
      </Row>
    </Section>
  );
}
