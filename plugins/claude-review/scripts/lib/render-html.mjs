import { randomUUID } from 'node:crypto';

const SEVERITY_CONFIG = {
  P0: { color: '#dc2626', bg: '#fef2f2', label: 'P0 Critical', emoji: '🔴', defaultAction: 'fix' },
  P1: { color: '#ea580c', bg: '#fff7ed', label: 'P1 Major', emoji: '🟠', defaultAction: 'fix' },
  P2: { color: '#ca8a04', bg: '#fefce8', label: 'P2 Minor', emoji: '🟡', defaultAction: 'fix' },
  P3: { color: '#16a34a', bg: '#f0fdf4', label: 'P3 Suggestion', emoji: '🟢', defaultAction: 'skip' },
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderOverviewCard(data) {
  const total = data.findings?.length ?? 0;
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of data.findings ?? []) {
    const sev = f.severity?.toUpperCase();
    if (sev in counts) counts[sev]++;
  }

  return `
    <div class="overview-card">
      <h2>Review Overview</h2>
      <div class="stats">
        <div class="stat total">
          <span class="stat-number">${total}</span>
          <span class="stat-label">Total Findings</span>
        </div>
        ${Object.entries(counts).map(([sev, count]) => `
          <div class="stat" style="border-left: 3px solid ${SEVERITY_CONFIG[sev].color}">
            <span class="stat-number">${count}</span>
            <span class="stat-label">${SEVERITY_CONFIG[sev].emoji} ${sev}</span>
          </div>
        `).join('')}
      </div>
      <div class="target-info">
        <strong>Target:</strong> ${escapeHtml(data.targetLabel ?? 'Unknown')}
      </div>
    </div>
  `;
}

function renderFindingRow(finding) {
  const sev = finding.severity?.toUpperCase() ?? 'P3';
  const config = SEVERITY_CONFIG[sev] ?? SEVERITY_CONFIG.P3;
  const id = escapeHtml(finding.id ?? randomUUID());

  return `
    <tr class="finding-row" data-id="${id}" data-severity="${sev}">
      <td class="severity-cell">
        <span class="severity-badge" style="background: ${config.color}">${sev}</span>
      </td>
      <td class="file-cell">
        <code>${escapeHtml(finding.file ?? '-')}</code>
      </td>
      <td class="title-cell">
        <div class="finding-title">${escapeHtml(finding.title ?? '-')}</div>
        <div class="finding-desc">${escapeHtml(finding.description ?? '')}</div>
      </td>
      <td class="suggestion-cell">
        ${escapeHtml(finding.suggestion ?? '-')}
      </td>
      <td class="action-cell">
        <div class="action-buttons">
          <label class="action-btn ${config.defaultAction === 'fix' ? 'selected' : ''}">
            <input type="radio" name="action-${id}" value="fix" ${config.defaultAction === 'fix' ? 'checked' : ''}>
            <span class="btn-fix">Fix</span>
          </label>
          <label class="action-btn ${config.defaultAction === 'skip' ? 'selected' : ''}">
            <input type="radio" name="action-${id}" value="skip" ${config.defaultAction === 'skip' ? 'checked' : ''}>
            <span class="btn-skip">Skip</span>
          </label>
          <label class="action-btn">
            <input type="radio" name="action-${id}" value="custom">
            <span class="btn-custom">Custom</span>
          </label>
        </div>
        <textarea class="custom-input" id="custom-${id}" placeholder="Enter custom fix logic..." style="display: none;"></textarea>
      </td>
    </tr>
  `;
}

function renderFindingsTable(data) {
  const findings = data.findings ?? [];
  if (findings.length === 0) {
    return '<div class="no-findings">No findings detected.</div>';
  }

  return `
    <table class="findings-table">
      <thead>
        <tr>
          <th>Severity</th>
          <th>File</th>
          <th>Issue</th>
          <th>Suggestion</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${findings.map(renderFindingRow).join('')}
      </tbody>
    </table>
  `;
}

function renderSections(data) {
  const sections = [];

  if (data.openQuestions?.length) {
    sections.push(`
      <div class="info-section">
        <h3>Open Questions</h3>
        <ul>${data.openQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
      </div>
    `);
  }

  if (data.residualRisk?.length) {
    sections.push(`
      <div class="info-section">
        <h3>Residual Risk</h3>
        <ul>${data.residualRisk.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      </div>
    `);
  }

  return sections.join('');
}

export function renderReviewHtml(data) {
  const reviewId = randomUUID();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
  <title>Claude Review Report</title>
  <style>
    :root {
      --red: #dc2626;
      --orange: #ea580c;
      --yellow: #ca8a04;
      --green: #16a34a;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #1e293b;
      --text-secondary: #64748b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 24px; }
    h2 { font-size: 18px; margin-bottom: 16px; }
    h3 { font-size: 16px; margin-bottom: 12px; }

    .overview-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .stat {
      padding: 12px 20px;
      background: var(--bg);
      border-radius: 8px;
      min-width: 100px;
      text-align: center;
    }
    .stat-number {
      display: block;
      font-size: 28px;
      font-weight: 700;
    }
    .stat-label {
      display: block;
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .target-info {
      margin-top: 16px;
      padding: 12px;
      background: var(--bg);
      border-radius: 8px;
      font-size: 14px;
    }

    .batch-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .batch-btn {
      padding: 8px 16px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--card);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    .batch-btn:hover {
      background: var(--bg);
      border-color: var(--text-secondary);
    }

    .findings-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .findings-table th {
      background: var(--bg);
      padding: 12px 16px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
    }
    .findings-table td {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .findings-table tr:last-child td { border-bottom: none; }
    .findings-table tr:hover { background: #f1f5f9; }

    .severity-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }
    .file-cell code {
      background: var(--bg);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 13px;
      word-break: break-all;
    }
    .finding-title { font-weight: 600; margin-bottom: 4px; }
    .finding-desc {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .suggestion-cell {
      font-size: 13px;
      max-width: 250px;
    }

    .action-buttons {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .action-btn {
      cursor: pointer;
    }
    .action-btn input { display: none; }
    .action-btn span {
      display: inline-block;
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 12px;
      transition: all 0.2s;
    }
    .action-btn input:checked + .btn-fix {
      background: var(--green);
      color: white;
      border-color: var(--green);
    }
    .action-btn input:checked + .btn-skip {
      background: var(--text-secondary);
      color: white;
      border-color: var(--text-secondary);
    }
    .action-btn input:checked + .btn-custom {
      background: var(--orange);
      color: white;
      border-color: var(--orange);
    }
    .action-btn span:hover { border-color: var(--text-secondary); }

    .custom-input {
      width: 100%;
      margin-top: 8px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      resize: vertical;
      min-height: 60px;
    }

    .info-section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .info-section ul {
      padding-left: 20px;
    }
    .info-section li {
      margin-bottom: 8px;
      font-size: 14px;
    }

    .no-findings {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      color: var(--text-secondary);
    }

    .confirm-bar {
      position: sticky;
      bottom: 0;
      background: var(--card);
      border-top: 1px solid var(--border);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
    }
    .confirm-btn {
      padding: 12px 32px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .confirm-btn:hover { background: #1d4ed8; }
    .summary-text {
      font-size: 14px;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Claude Review Report</h1>

    ${renderOverviewCard(data)}

    <div class="batch-actions">
      <button class="batch-btn" onclick="selectAll('fix')">Select All Fix</button>
      <button class="batch-btn" onclick="selectAll('skip')">Select All Skip</button>
      <button class="batch-btn" onclick="selectBySeverity('P0', 'fix')">P0/P1 → Fix</button>
      <button class="batch-btn" onclick="selectBySeverity('P3', 'skip')">P3 → Skip</button>
    </div>

    ${renderFindingsTable(data)}

    ${renderSections(data)}

    <div class="confirm-bar">
      <span class="summary-text" id="summary"></span>
      <button class="confirm-btn" onclick="confirmSelections()">Confirm & Export</button>
    </div>
  </div>

  <script>
    const reviewId = ${JSON.stringify(reviewId)};

    function updateSummary() {
      const rows = document.querySelectorAll('.finding-row');
      let fix = 0, skip = 0, custom = 0;
      rows.forEach(row => {
        const checked = row.querySelector('input:checked');
        if (checked) {
          if (checked.value === 'fix') fix++;
          else if (checked.value === 'skip') skip++;
          else if (checked.value === 'custom') custom++;
        }
      });
      document.getElementById('summary').textContent =
        \`\${fix} to fix, \${skip} to skip, \${custom} custom\`;
    }

    function selectAll(action) {
      document.querySelectorAll('.finding-row').forEach(row => {
        const radio = row.querySelector(\`input[value="\${action}"]\`);
        if (radio) {
          radio.checked = true;
          toggleCustomInput(radio);
        }
      });
      updateSummary();
    }

    function selectBySeverity(severity, action) {
      document.querySelectorAll(\`.finding-row[data-severity="\${severity}"]\`).forEach(row => {
        const radio = row.querySelector(\`input[value="\${action}"]\`);
        if (radio) {
          radio.checked = true;
          toggleCustomInput(radio);
        }
      });
      updateSummary();
    }

    function toggleCustomInput(radio) {
      const row = radio.closest('.finding-row');
      const id = row.dataset.id;
      const customInput = document.getElementById(\`custom-\${id}\`);
      if (customInput) {
        customInput.style.display = radio.value === 'custom' ? 'block' : 'none';
      }
    }

    document.querySelectorAll('.action-btn input').forEach(input => {
      input.addEventListener('change', (e) => {
        toggleCustomInput(e.target);
        updateSummary();
      });
    });

    function confirmSelections() {
      const selections = [];
      document.querySelectorAll('.finding-row').forEach(row => {
        const id = row.dataset.id;
        const checked = row.querySelector('input:checked');
        if (checked) {
          const selection = {
            findingId: id,
            action: checked.value,
          };
          if (checked.value === 'custom') {
            selection.customLogic = document.getElementById(\`custom-\${id}\`)?.value ?? '';
          }
          selections.push(selection);
        }
      });

      const result = {
        reviewId,
        timestamp: new Date().toISOString(),
        selections,
      };

      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`review-selections-\${reviewId.slice(0, 8)}.json\`;
      a.click();
      URL.revokeObjectURL(url);

      document.querySelector('.confirm-btn').textContent = 'Exported!';
      setTimeout(() => {
        document.querySelector('.confirm-btn').textContent = 'Confirm & Export';
      }, 2000);
    }

    updateSummary();
  </script>
</body>
</html>`;
}
