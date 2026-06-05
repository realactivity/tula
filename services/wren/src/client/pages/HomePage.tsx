import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import RecordsHeaderBar from '../components/RecordsHeaderBar';

const SKILL_URL = window.location.origin + '/skill.zip';
const BASE_DOMAIN = window.location.hostname;

const AI_MESSAGE = `Please download the Health Record Assistant skill from ${SKILL_URL} and then help me access my health records.`;

export default function HomePage() {
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copyFlashCount, setCopyFlashCount] = useState(0);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(AI_MESSAGE).then(() => {
      setCopyFlashCount((prev) => prev + 1);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="page-top with-records-nav">
      <RecordsHeaderBar current="about" />
      <div className="home-header">
        <h1>Wren</h1>
        <p>Connect, collect, and securely share your health records with AI.</p>
        <div className="home-quick-actions">
          <Link to="/records" className="btn btn-primary">Go to My Records</Link>
          <Link to="/records/add" className="btn btn-secondary">Connect to new provider</Link>
        </div>
      </div>

      <div className="container home-container">
        {/* Getting Started */}
        <div className="card home-section">
          <h2>Get started</h2>

          <div className="step-row">
            <span className="step-badge">1</span>
            <div className="step-text">
              <strong>Collect your records</strong> - Sign into your patient portal(s) and save
              health data to this browser.
            </div>
          </div>

          <div className="step-row">
            <span className="step-badge">2</span>
            <div className="step-text">
              <strong>Choose how to load data into AI</strong>
              <div className="transfer-options">
                <section className="transfer-card">
                  <div className="transfer-title">Option A: Download and share directly</div>
                  <p>
                    Download a skill zip from <Link to="/records">My Records</Link> and share it with your AI tool,
                    either by web upload or by passing a local file path in CLI-based workflows.
                  </p>
                </section>

                <section className="transfer-card">
                  <div className="transfer-title">Option B: AI loads over web</div>
                  <p className="transfer-copy-intro">
                    Paste this into your AI. This avoids manual transfer and can bypass some upload-size limits.
                  </p>
                  <div
                    className={`copy-box copy-box-quote ${
                      copyFlashCount === 0
                        ? ''
                        : copyFlashCount % 2 === 0
                          ? 'copy-box-quote-flash-a'
                          : 'copy-box-quote-flash-b'
                    }`}
                    onClick={handleCopy}
                  >
                    {AI_MESSAGE}
                  </div>
                  <div className="copy-box-hint" onClick={handleCopy} style={{ cursor: 'pointer' }}>
                    {copied ? '✓ Copied!' : 'Click to copy'}
                  </div>
                  <button className="help-toggle" style={{ marginTop: 10 }} onClick={() => setShowHelp(!showHelp)}>
                    {showHelp ? '▾' : '▸'} Setup notes for specific AI tools
                  </button>
                  {showHelp && (
                    <div className="help-detail">
                      <div className="help-cards">
                        <section className="help-card">
                          <h4>Claude.ai (web app)</h4>
                          <p>
                            Open <a href="https://claude.ai/settings/capabilities" target="_blank" rel="noopener"><strong>Settings → Capabilities</strong></a>.
                            Turn on <strong>Code execution and file creation</strong>, then turn on{' '}
                            <strong>Allow network egress</strong>.
                          </p>
                          <p>
                            For <strong>Domain allowlist</strong>, choose <strong>All domains</strong>.
                            Alternatively, choose the option that allows <strong>package managers</strong> and
                            add <code>{BASE_DOMAIN}</code> under <strong>Additional allowed domains</strong>.
                          </p>
                        </section>

                        <section className="help-card">
                          <h4>Claude Code (CLI)</h4>
                          <p>
                            Network access is allowed by default. Paste the message and follow prompts.
                            Requires <a href="https://bun.sh" target="_blank" rel="noopener">Bun</a>.
                          </p>
                        </section>

                        <section className="help-card">
                          <h4>Codex CLI</h4>
                          <p>
                            Same model as Claude Code: full shell + network.
                            Paste the message or point it at <code>SKILL.md</code>. Requires Bun.
                          </p>
                        </section>

                        <section className="help-card">
                          <h4>Any other AI tool</h4>
                          <p>
                            Needs web access, code execution/local shell access, and the intro message above.
                            Without web access, use Option A.
                          </p>
                        </section>
                      </div>
                    </div>
                  )}
                  <p className="transfer-next-step">
                    <strong>Then:</strong> the AI will send you a link. Click it, choose which records to share,
                    and they’re encrypted end-to-end before sending.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
