import Script from 'next/script';
import Link from 'next/link';
import { MCP_ANNOUNCEMENT_URL, MCP_GITHUB_URL, MCP_REGISTRY_URL } from '@/lib/config/links';

export default function McpCallout() {
  return (
    <>
      <aside className="callout callout--mcp" role="note" aria-labelledby="mcp-callout-title">
        <div className="callout__body">
          <h2 id="mcp-callout-title">Try the MCP server for AIStatusDashboard</h2>
          <p>Install from GitHub, and see the announcement for more details.</p>
          <ul className="callout__links">
            <li><a href={MCP_GITHUB_URL}>Install from GitHub</a></li>
            <li><a href={MCP_ANNOUNCEMENT_URL}>See the announcement</a></li>
            <li><a href={MCP_REGISTRY_URL}>View in MCP Registry</a></li>
            <li><Link href="/docs/agent/mcp-quickstart">MCP Quickstart</Link></li>
          </ul>
          <div className="callout__endpoint" aria-label="MCP server endpoint">
            <span>MCP endpoint:</span>
            <code id="mcp-endpoint">https://aistatusdashboard.com/mcp</code>
            <button type="button" id="copy-mcp-endpoint" aria-label="Copy MCP endpoint">Copy</button>
          </div>
        </div>
      </aside>
      <Script id="mcp-callout-script" strategy="afterInteractive">
        {`
  (function () {
    var btn = document.getElementById("copy-mcp-endpoint");
    var code = document.getElementById("mcp-endpoint");
    if (!btn || !code) return;
    btn.addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(code.textContent.trim());
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 1200);
      } catch (e) {
        var range = document.createRange();
        range.selectNodeContents(code);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  })();
        `}
      </Script>
    </>
  );
}
