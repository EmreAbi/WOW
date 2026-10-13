export default function AtlasLink({ page, onNavigate, children, ...props }) {
  return (
    <a
      {...props}
      href={`#atlas/${page}`}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        onNavigate(page);
      }}
    >
      {children}
    </a>
  );
}
