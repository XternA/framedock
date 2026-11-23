const paths = {
  moon: <path d="M20.7 14a8.8 8.8 0 0 1-10.6-10.7 9 9 0 1 0 10.6 10.7Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19" /></>,
  add: <path d="M12 5v14M5 12h14" />,
  edit: <path d="m15 5 4 4M5 19l4-1L20 7a2 2 0 0 0-3-3L6 15l-1 4Z" />,
  apple: <path fill="currentColor" stroke="none" d="M17.1 12.3c0-2 1.1-3.2 2.2-4-1.1-1.5-2.8-2.1-4.1-2.1-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7.1-3.4 1-4.3 2.5-1.8 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.5-.9 1.6 0 2.1.9 3.5.9s2.3-1.3 3.1-2.5c1-1.5 1.5-2.9 1.5-2.9-1.7-.7-2.8-2.4-2.8-4.2ZM14.2 4.8c.7-.9 1.2-2 1.1-3.2-1 .1-2.2.7-3 1.6-.7.8-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />,
  android: <>
    <path fill="currentColor" stroke="none" d="M2 17a10 10 0 0 1 20 0Z" />
    <path d="m7 9-2-3m12 3 2-3" />
    <path className="fill-white" stroke="none" d="M8 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
  </>,
  rotate: <path d="M20 5v5h-5m5 0a8 8 0 0 0-13-5M4 19v-5h5m-5 0a8 8 0 0 0 13 5M9 8h6v8H9z" />,
  zoom: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4M8 10.5h5m-2.5-2.5v5" /></>,
  touch: <path d="M9 13V5a1.5 1.5 0 0 1 3 0v5-1a1.5 1.5 0 0 1 3 0v2-1a1.5 1.5 0 0 1 3 0v2-1a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-14 2l-3-4a1.5 1.5 0 0 1 2.3-1.9L9 13Z" />,
  reload: <path d="M20 5v5h-5m5 0a8 8 0 1 0 .1 4" />,
  window: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M12 17v4m-4 0h8" /></>,
}

export default function ToolbarIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}
