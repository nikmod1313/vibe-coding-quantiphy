const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const PlusIcon = () => (<svg {...base}><path d="M12 5v14M5 12h14" /></svg>);
export const SendIcon = () => (<svg {...base} width={18} height={18}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>);
export const StopIcon = () => (<svg {...base} width={14} height={14} fill="currentColor" stroke="none"><rect x="5" y="5" width="14" height="14" rx="3" /></svg>);
export const TrashIcon = () => (<svg {...base} width={14} height={14}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>);
export const EditIcon = () => (<svg {...base} width={14} height={14}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>);
export const CopyIcon = () => (<svg {...base} width={14} height={14}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>);
export const RefreshIcon = () => (<svg {...base} width={14} height={14}><path d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" /></svg>);
export const CheckIcon = () => (<svg {...base} width={14} height={14}><path d="M20 6L9 17l-5-5" /></svg>);
export const SearchIcon = () => (<svg {...base} width={14} height={14}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>);
export const ArrowDownIcon = () => (<svg {...base} width={14} height={14}><path d="M12 5v14M5 12l7 7 7-7" /></svg>);
export const DownloadIcon = () => (<svg {...base} width={15} height={15}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>);
