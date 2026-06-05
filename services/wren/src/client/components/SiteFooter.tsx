export default function SiteFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <div className="footer-links">
          <a href="https://github.com/realactivity/tula/tree/main/services/wren" target="_blank" rel="noopener">
            GitHub
          </a>
          <span className="footer-sep">·</span>
          <a href="https://github.com/realactivity/tula/issues" target="_blank" rel="noopener">
            Report an issue
          </a>
          <span className="footer-sep">·</span>
          <a href="https://github.com/realactivity/tula/blob/main/services/wren/README.md" target="_blank" rel="noopener">
            Documentation
          </a>
        </div>
        <p className="footer-note">
          Your health data never leaves your browser unencrypted.{' '}
          <a href="https://github.com/jmandel/health-skillz/blob/main/docs/design/DESIGN.md" target="_blank" rel="noopener">
            Learn how it works
          </a>.
        </p>
        <p className="footer-note">
          Wren by RealActivity · built on{' '}
          <a href="https://github.com/jmandel/health-skillz" target="_blank" rel="noopener">
            health-skillz
          </a>{' '}by Josh Mandel (MIT).
        </p>
      </div>
    </footer>
  );
}
