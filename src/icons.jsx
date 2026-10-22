const paths = {
  Today: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  Pipeline: <><path d="M4 6h16M4 12h11M4 18h6"/><circle cx="18" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></>,
  Money: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  More: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  Search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  Back: <><path d="m14 5-7 7 7 7M7 12h14"/></>,
  Close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  Sync: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 12-2L20 12M4 12l2.5 5a7 7 0 0 0 12-2"/></>,
  Plus: <><path d="M12 5v14M5 12h14"/></>,
  Edit: <><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></>,
  Trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"/></>,
  Print: <><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></>,
  Pause: <><path d="M8 5v14M16 5v14"/></>,
  Merge: <><path d="M6 4v3a5 5 0 0 0 5 5h2a5 5 0 0 1 5 5v3M18 4v3a5 5 0 0 1-5 5h-2a5 5 0 0 0-5 5v3M3 7h6M15 17h6"/></>,
  Check: <><path d="m5 12 4 4L19 6"/></>,
  ChevronRight: <><path d="m9 18 6-6-6-6"/></>,
};

export function Icon({ name, size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}

export const Today = (props) => <Icon name="Today" {...props} />;
export const Pipeline = (props) => <Icon name="Pipeline" {...props} />;
export const Money = (props) => <Icon name="Money" {...props} />;
export const More = (props) => <Icon name="More" {...props} />;
export const Search = (props) => <Icon name="Search" {...props} />;
export const Back = (props) => <Icon name="Back" {...props} />;
export const Close = (props) => <Icon name="Close" {...props} />;
export const Sync = (props) => <Icon name="Sync" {...props} />;
export const Plus = (props) => <Icon name="Plus" {...props} />;
export const Edit = (props) => <Icon name="Edit" {...props} />;
export const Trash = (props) => <Icon name="Trash" {...props} />;
export const Print = (props) => <Icon name="Print" {...props} />;
export const Pause = (props) => <Icon name="Pause" {...props} />;
export const Merge = (props) => <Icon name="Merge" {...props} />;
export const Check = (props) => <Icon name="Check" {...props} />;
export const ChevronRight = (props) => <Icon name="ChevronRight" {...props} />;
