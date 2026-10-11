"use client";

import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icon";
import { Sheet } from "./sheet";

const Close = createContext<() => void>(() => {});

/** Closes the sheet a form sits in. */
export function useCloseSheet() {
  return useContext(Close);
}

/** Closes the sheet once a form reports a new save. */
export function useCloseOnSave(savedAt: number | undefined) {
  const close = useCloseSheet();
  const first = useRef(savedAt);
  useEffect(() => {
    if (savedAt && savedAt !== first.current) close();
  }, [savedAt, close]);
}

/** The Close button at the foot of a sheet that only shows things. */
export function SheetClose() {
  const close = useCloseSheet();
  return (
    <button type="button" className="btn btn-secondary" onClick={close}>
      Close
    </button>
  );
}

/** A quiet link that opens a sheet, such as "Add a note", or "All 8 weights" with a chevron after it. */
export function SheetLink({
  label,
  title = label,
  icon,
  after,
  className = "lnk",
  trigger,
  intro,
  children,
}: {
  label: string;
  /** The button's own content in place of the label, such as a whole row of the care plan. */
  trigger?: ReactNode;
  title?: string;
  icon?: IconName;
  after?: IconName;
  className?: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? (
        <button className={className} type="button" onClick={() => setOpen(true)}>
          {trigger}
        </button>
      ) : (
        <button className={className} type="button" onClick={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>
          {icon && <Icon name={icon} size={20} />}
          {label}
          {after && <Icon name={after} size={20} />}
        </button>
      )}
      {open && (
        <Sheet label={title} onClose={() => setOpen(false)}>
          <Close value={() => setOpen(false)}>
            <h2 className="ty-page">{title}</h2>
            {intro && <p className="hint">{intro}</p>}
            {children}
          </Close>
        </Sheet>
      )}
    </>
  );
}
