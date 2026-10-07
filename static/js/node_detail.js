// ============ NODE DETAIL PAGE LOGIC ============

let nodeDetailLogs = [];
let nodeDetailPage = 1;
const nodeDetailPerPage = 100;

function loadNodeDetail(nodeId) {
    // Fetch node info
    fetch(`/api/nodes?sort=node_name&order=asc`)
        .then(response => response.json())
        .then(data => {
            const node = data.nodes.find(n => n.id === nodeId);
            if (node) renderNodeHeader(node);
        });

    // Fetch node logs
    fetch(`/api/logs?node_id=${nodeId}&per_page=${nodeDetailPerPage}&page=${nodeDetailPage}`)
        .then(response => response.json())
        .then(data => {
            nodeDetailLogs = data.logs;
            renderNodeTimeline(data.logs, data.total);
        });

    // Fetch node log stats
    fetch(`/api/logs/node/${nodeId}/stats`)
        .then(response => response.json())
        .then(data => renderNodeStats(data));
}

function renderNodeHeader(node) {
    const header = document.getElementById('nodeDetailHeader');
    if (!header) return;

    let statusClass = 'status-up';
    let statusEmoji = '🟢';
    if (node.status === 'Node Down') { statusClass = 'status-down'; statusEmoji = '🔴'; }
    else if (node.status === 'Warning') { statusClass = 'status-warning'; statusEmoji = '🟡'; }
    else if (node.status === 'Unknown') { statusClass = 'status-unknown'; statusEmoji = '⚪'; }

    header.innerHTML = `
        <div class="node-detail-info">
            <div class="node-detail-name">
                <span class="status-dot ${statusClass.replace('status-', 'dot-')}"></span>
                <h2>${escapeHtml(node.node_name)}</h2>
                <span class="status-badge ${statusClass}">${statusEmoji} ${node.status}</span>
            </div>
            <div class="node-detail-meta">
                <span><i class="fas fa-network-wired"></i> ${escapeHtml(node.ip_address)}</span>
                <span><i class="fas fa-tachometer-alt"></i> ${node.response_time_display}</span>
                <span><i class="fas fa-percent"></i> ${node.packet_loss_display}</span>
                <span><i class="far fa-clock"></i> Since: ${node.since_last_change}</span>
            </div>
        </div>
        <div class="node-detail-actions">
            <button class="btn btn-secondary" onclick="pingNodeFromDetail(${node.id})">
                <i class="fas fa-satellite-dish"></i> Ping Now
            </button>
            <button class="btn btn-secondary" onclick="location.href='/edit/${node.id}'">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-ghost" onclick="location.href='/'">
                <i class="fas fa-arrow-left"></i> Back
            </button>
        </div>
    `;
}

function renderNodeStats(stats) {
    const container = document.getElementById('nodeDetailStats');
    if (!container) return;

    container.innerHTML = `
        <div class="detail-stat-card">
            <div class="detail-stat-icon" style="background: var(--gradient-danger);">
                <i class="fas fa-arrow-down"></i>
            </div>
            <div class="detail-stat-info">
                <span class="detail-stat-value">${stats.total_down}</span>
                <span class="detail-stat-label">Total Down Events</span>
            </div>
        </div>
        <div class="detail-stat-card">
            <div class="detail-stat-icon" style="background: var(--gradient-success);">
                <i class="fas fa-arrow-up"></i>
            </div>
            <div class="detail-stat-info">
                <span class="detail-stat-value">${stats.total_up}</span>
                <span class="detail-stat-label">Total Up Events</span>
            </div>
        </div>
        <div class="detail-stat-card">
            <div class="detail-stat-icon" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);">
                <i class="fas fa-hourglass-half"></i>
            </div>
            <div class="detail-stat-info">
                <span class="detail-stat-value">${formatDurationDetail(stats.total_downtime)}</span>
                <span class="detail-stat-label">Total Downtime</span>
            </div>
        </div>
        <div class="detail-stat-card">
            <div class="detail-stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                <i class="fas fa-chart-line"></i>
            </div>
            <div class="detail-stat-info">
                <span class="detail-stat-value">${formatDurationDetail(stats.avg_downtime)}</span>
                <span class="detail-stat-label">Avg Downtime</span>
            </div>
        </div>
        <div class="detail-stat-card">
            <div class="detail-stat-icon" style="background: linear-gradient(135deg, #ef4444, #b91c1c);">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="detail-stat-info">
                <span class="detail-stat-value">${formatDurationDetail(stats.max_downtime)}</span>
                <span class="detail-stat-label">Max Downtime</span>
            </div>
        </div>
        <div class="detail-stat-card">
            <div class="detail-stat-icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">
                <i class="fas fa-percentage"></i>
            </div>
            <div class="detail-stat-info">
                <span class="detail-stat-value">${stats.availability}%</span>
                <span class="detail-stat-label">Availability</span>
            </div>
        </div>
    `;
}

function renderNodeTimeline(logs, total) {
    const container = document.getElementById('nodeTimeline');
    if (!container) return;

    // Update count
    const countEl = document.getElementById('timelineCount');
    if (countEl) countEl.textContent = `${total} events`;

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <i class="fas fa-check-circle"></i>
                <p>No downtime events recorded for this node</p>
            </div>
        `;
        return;
    }

    // Group into down/up pairs for timeline
    let html = '';
    let i = 0;

    while (i < logs.length) {
        const log = logs[i];

        if (log.status_change === 'Node Down' || log.status_change === 'Warning') {
            // Find matching UP event
            let matchedUp = null;
            if (i + 1 < logs.length && (logs[i + 1].status_change === 'Node Up')) {
                matchedUp = logs[i + 1];
                i += 2;
            } else {
                i++;
            }

            const isResolved = matchedUp ? true : false;
            const duration = matchedUp ? matchedUp.downtime_duration_display : 'Still Down';
            const downTime = log.timestamp_display;
            const upTime = matchedUp ? matchedUp.timestamp_display : '—';
            const severityClass = log.status_change === 'Node Down' ? 'down' : 'warning';

            html += `
                <div class="timeline-item timeline-${severityClass} ${!isResolved ? 'timeline-active' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="timeline-badge badge-down">
                                <i class="fas fa-arrow-down"></i> DOWN
                            </span>
                            ${!isResolved ? '<span class="timeline-badge badge-ongoing"><i class="fas fa-spinner fa-spin"></i> ONGOING</span>' : ''}
                            ${isResolved ? '<span class="timeline-badge badge-up"><i class="fas fa-arrow-up"></i> RECOVERED</span>' : ''}
                        </div>
                        <div class="timeline-body">
                            <div class="timeline-time-grid">
                                <div class="timeline-time-row">
                                    <span class="time-label"><i class="fas fa-arrow-down"></i> Went Down:</span>
                                    <span class="time-value">${downTime}</span>
                                </div>
                                <div class="timeline-time-row">
                                    <span class="time-label"><i class="fas fa-arrow-up"></i> Came Up:</span>
                                    <span class="time-value">${upTime}</span>
                                </div>
                                <div class="timeline-time-row">
                                    <span class="time-label"><i class="fas fa-hourglass-half"></i> Duration:</span>
                                    <span class="time-value duration-highlight ${!isResolved ? 'duration-active' : ''}">${duration}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Standalone UP event without matching DOWN
            html += `
                <div class="timeline-item timeline-up">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="timeline-badge badge-up">
                                <i class="fas fa-arrow-up"></i> UP
                            </span>
                        </div>
                        <div class="timeline-body">
                            <div class="timeline-time-grid">
                                <div class="timeline-time-row">
                                    <span class="time-label"><i class="far fa-clock"></i> Time:</span>
                                    <span class="time-value">${log.timestamp_display}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            i++;
        }
    }

    container.innerHTML = html;
}

function pingNodeFromDetail(nodeId) {
    updateStatusText('Pinging node...');
    fetch(`/api/nodes/${nodeId}/ping`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            updateStatusText(`Ping complete: ${data.ip_address} - ${data.status}`);
            loadNodeDetail(nodeId);
        });
}

function formatDurationDetail(seconds) {
    if (!seconds || seconds === 0) return '0s';
    seconds = Math.round(seconds);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}
