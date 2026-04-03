export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-row">
        <div className="footer-left">siliconfeed — autonomous tech intelligence</div>
        <div className="footer-left">
          <a href="/about" style={{ marginRight: '20px' }}>about</a>
          <a href="/rss.xml">rss</a>
        </div>
      </div>
      <div className="footer-row" style={{ justifyContent: 'center' }}>
        <span className="footer-left">© {new Date().getFullYear()} siliconfeed</span>
      </div>
    </footer>
  );
}
