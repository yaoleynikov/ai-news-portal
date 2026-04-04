export default function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav style={{ fontSize: '13px', color: 'var(--text-d)', marginBottom: '16px' }}>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span style={{ margin: '0 6px', color: 'var(--text-d)' }}>›</span>}
          {item.href ? (
            <a href={item.href} style={{ color: 'var(--text-s)' }}>{item.label}</a>
          ) : (
            <span style={{ color: 'var(--text)' }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
