// ============ GLOBAL STATE ============
let currentSort = 'since_last_change';
let currentOrder = 'asc';
let selectedNodeId = null;
let contextNodeId = null;
let nodesData = [];
let pollIntervals = [];
let currentFilter = 'all';
let searchQuery = '';
let previousStatuses = {};
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false'; // Default: enabled
let audioContext = null;
let browserNotificationsEnabled = localStorage.getItem('browserNotifications') !== 'false';
let notificationPermission = 'default';

// ============ THEME MANAGEMENT ============
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    const icon = document.querySelector('.theme-toggle i');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// ============ LOAD NODES ============
function loadNodes() {
    fetch(`/api/nodes?sort=${currentSort}&order=${currentOrder}`)
        .then(response => response.json())
        .then(data => {
            nodesData = data.nodes;
            renderNodes(nodesData);
            updateLastUpdate();
            checkAndUpdateTabTitle();  // Update tab title with down count
        })
        .catch(error => {
            console.error('Error loading nodes:', error);
            updateStatusText('Error loading nodes');
        });
}

function updateLastUpdate() {
    const now = new Date();
    // Show Bangladesh time (UTC+6)
    const options = { timeZone: 'Asia/Dhaka', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const timeStr = now.toLocaleTimeString('en-GB', options);
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = timeStr;
}

// ============ FILTERING & SEARCH ============
function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderNodes(nodesData);
}

function filterNodes() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase();
    document.getElementById('searchClear').style.display = searchQuery ? 'block' : 'none';
    renderNodes(nodesData);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    searchQuery = '';
    document.getElementById('searchClear').style.display = 'none';
    renderNodes(nodesData);
}

function applyFiltersAndSearch(nodes) {
    let filtered = nodes;

    // Status filter
    if (currentFilter !== 'all') {
        const statusMap = {
            'up': 'Node Up',
            'down': 'Node Down',
            'warning': 'Warning',
            'unknown': 'Unknown'
        };
        filtered = filtered.filter(n => n.status === statusMap[currentFilter]);
    }

    // Search filter
    if (searchQuery) {
        filtered = filtered.filter(n =>
            n.node_name.toLowerCase().includes(searchQuery) ||
            n.ip_address.toLowerCase().includes(searchQuery)
        );
    }

    return filtered;
}

// ============ RENDER NODES TABLE ============
function renderNodes(nodes) {
    const tbody = document.getElementById('nodesBody');
    const filtered = applyFiltersAndSearch(nodes);

    // Update result count
    const countEl = document.getElementById('resultCount');
    if (countEl) {
        countEl.textContent = `Showing ${filtered.length} of ${nodes.length} nodes`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">
                    <div class="loading-spinner">
                        <i class="fas fa-search" style="color: var(--text-muted);"></i>
                        <p>No nodes match your criteria</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.forEach(node => {
        const isSelected = selectedNodeId === node.id;
        const isDown = node.status === 'Node Down';
        const isWarning = node.status === 'Warning';
        const isUnknown = node.status === 'Unknown';

        let dotClass = 'dot-up';
        let badgeClass = 'status-up';
        let rowClass = '';

        if (isDown) {
            dotClass = 'dot-down';
            badgeClass = 'status-down';
            rowClass = 'row-down';
        } else if (isWarning) {
            dotClass = 'dot-warning';
            badgeClass = 'status-warning';
            rowClass = 'row-warning';
        } else if (isUnknown) {
            dotClass = 'dot-unknown';
            badgeClass = 'status-unknown';
        }

        // Detect status change
        const previousStatus = previousStatuses[node.id];
        if (previousStatus && previousStatus !== node.status) {
            rowClass += ' new-status';

            // Play sound based on status change
            if (node.status === 'Node Down') {
                playNodeDownSound();
                showNotification(
                    `🔴 <strong>${escapeHtml(node.node_name)}</strong> is DOWN<br>
                    <small>${escapeHtml(node.ip_address)}</small>`,
                    'error'
                );
                sendDesktopNotification(
                    '🔴 Node DOWN',
                    `${node.node_name} (${node.ip_address}) is DOWN`,
                    '',
                    'down-' + node.id
                );
                showAlertBar(
                    `${escapeHtml(node.node_name)} (${escapeHtml(node.ip_address)}) is DOWN!`,
                    'down'
                );
            } else if (node.status === 'Node Up' && (previousStatus === 'Node Down' || previousStatus === 'Warning')) {
                playNodeUpSound();
                showNotification(
                    `🟢 <strong>${escapeHtml(node.node_name)}</strong> is UP<br>
                    <small>${escapeHtml(node.ip_address)}</small>`,
                    'success'
                );
                sendDesktopNotification(
                    '🟢 Node UP',
                    `${node.node_name} (${node.ip_address}) is UP`,
                    '',
                    'up-' + node.id
                );
                showAlertBar(
                    `${escapeHtml(node.node_name)} (${escapeHtml(node.ip_address)}) is back UP!`,
                    'up'
                );
            } else if (node.status === 'Warning') {
                playWarningSound();
                showNotification(
                    `🟡 <strong>${escapeHtml(node.node_name)}</strong> - Warning<br>
                    <small>${escapeHtml(node.ip_address)}</small>`,
                    'warning'
                );
                sendDesktopNotification(
                    '🟡 Warning',
                    `${node.node_name} (${node.ip_address}) - Warning`,
                    '',
                    'warn-' + node.id
                );
                showAlertBar(
                    `${escapeHtml(node.node_name)} (${escapeHtml(node.ip_address)}) - Warning`,
                    'warning'
                );
            }
        }
        previousStatuses[node.id] = node.status;

        if (isSelected) {
            rowClass += ' selected';
        }

        // Response time class
        let rtClass = 'metric-good';
        if (node.response_time > 100) rtClass = 'metric-warning';
        if (node.response_time > 500 || !node.response_time) rtClass = 'metric-bad';

        // Packet loss class
        let plClass = 'metric-good';
        if (node.packet_loss > 0) plClass = 'metric-warning';
        if (node.packet_loss >= 50) plClass = 'metric-bad';

        html += `
            <tr class="${rowClass}"
                data-id="${node.id}"
                onclick="selectNode(${node.id}, event)"
                ondblclick="editNode(${node.id})"
                oncontextmenu="showContextMenu(event, ${node.id})">
                <td class="col-status">
                    <span class="status-dot ${dotClass}"></span>
                </td>
                <td>
                    <div class="node-name-cell">
                        <span title="${escapeHtml(node.node_name)}">${escapeHtml(node.node_name)}</span>
                    </div>
                </td>
                <td><span class="ip-address">${escapeHtml(node.ip_address)}</span></td>
                <td><span class="metric-value ${rtClass}">${node.response_time_display}</span></td>
                <td><span class="metric-value ${plClass}">${node.packet_loss_display}</span></td>
                <td><span class="status-badge ${badgeClass}">${node.status}</span></td>
                <td><span class="time-ago"><i class="far fa-clock"></i> ${node.since_last_change}</span></td>
                <td class="col-actions">
                    <div class="row-actions">
                        <button class="row-action-btn ping" onclick="pingNode(${node.id}); event.stopPropagation();" title="Ping">
                            <i class="fas fa-satellite-dish"></i>
                        </button>
                        <button class="row-action-btn" onclick="editNode(${node.id}); event.stopPropagation();" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="row-action-btn delete" onclick="deleteNode(${node.id}, '${escapeHtml(node.node_name).replace(/'/g, "\\'")}'); event.stopPropagation();" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ============ SORTING ============
function initSorting() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const sortField = this.dataset.sort;

            if (currentSort === sortField) {
                currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort = sortField;
                currentOrder = 'asc';
            }

            document.querySelectorAll('th.sortable').forEach(header => {
                header.classList.remove('active-sort');
                const arrow = header.querySelector('.sort-arrow');
                if (arrow) arrow.textContent = '';
            });

            this.classList.add('active-sort');
            const arrow = this.querySelector('.sort-arrow');
            if (arrow) {
                arrow.textContent = currentOrder === 'asc' ? '▲' : '▼';
            }

            loadNodes();
        });
    });
}

// ============ NODE ACTIONS ============
function selectNode(nodeId, event) {
    if (event) event.stopPropagation();
    selectedNodeId = nodeId;
    document.querySelectorAll('#nodesBody tr').forEach(tr => {
        tr.classList.remove('selected');
    });
    const row = document.querySelector(`tr[data-id="${nodeId}"]`);
    if (row) row.classList.add('selected');
    hideContextMenu();
}

function editNode(nodeId) {
    window.location.href = `/node/${nodeId}`;
}

function pingNode(nodeId) {
    updateStatusText('Pinging node...');
    fetch(`/api/nodes/${nodeId}/ping`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            updateStatusText(`Ping complete: ${data.ip_address} - ${data.status}`);
            loadNodes();
        })
        .catch(error => updateStatusText('Ping failed'));
}

function deleteNode(nodeId, nodeName) {
    if (!confirm(`Are you sure you want to delete "${nodeName}"?`)) return;

    fetch('/api/nodes/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateStatusText(`Node "${nodeName}" deleted`);
            loadNodes();
            updateStats();
        }
    });
}

// ============ CONTEXT MENU ============
function showContextMenu(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    contextNodeId = nodeId;
    selectNode(nodeId, event);

    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';

    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        menu.style.left = (event.clientX - menuRect.width) + 'px';
    }
    if (menuRect.bottom > window.innerHeight) {
        menu.style.top = (event.clientY - menuRect.height) + 'px';
    }
}

function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) menu.style.display = 'none';
}

function editFromContext() { hideContextMenu(); if (contextNodeId) editNode(contextNodeId); }
function pingFromContext() { hideContextMenu(); if (contextNodeId) pingNode(contextNodeId); }
function deleteFromContext() {
    hideContextMenu();
    if (contextNodeId) {
        const node = nodesData.find(n => n.id === contextNodeId);
        deleteNode(contextNodeId, node ? node.node_name : 'Unknown');
    }
}

document.addEventListener('click', hideContextMenu);

// ============ TOOLBAR ACTIONS ============
function refreshAll() {
    const btn = document.getElementById('refreshBtn');
    const icon = btn.querySelector('i');
    icon.classList.add('spinning');
    updateStatusText('Refreshing all nodes...');

    fetch('/api/refresh', { method: 'POST' })
        .then(() => {
            setTimeout(() => {
                loadNodes();
                updateStats();
                icon.classList.remove('spinning');
                updateStatusText('Refresh complete');
            }, 2000);
        });
}

function pingSelected() {
    if (selectedNodeId) pingNode(selectedNodeId);
    else updateStatusText('No node selected');
}

// ============ STATS WITH ANIMATION ============
function updateStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            animateNumber('statTotal', data.total);
            animateNumber('statUp', data.up);
            animateNumber('statDown', data.down);
            animateNumber('statWarning', data.warning || 0);
            animateNumber('statUnknown', data.unknown);
        });
}

function animateNumber(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 500;
    const steps = 20;
    const stepValue = (target - current) / steps;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        const value = Math.round(current + stepValue * step);
        el.textContent = value;

        if (step >= steps) {
            el.textContent = target;
            clearInterval(interval);
        }
    }, duration / steps);
}

// ============ POLLING ============
function startPolling() {
    stopPolling();
    pollIntervals.push(setInterval(loadNodes, 5000));
    pollIntervals.push(setInterval(updateStats, 5000));
}

function stopPolling() {
    pollIntervals.forEach(id => clearInterval(id));
    pollIntervals = [];
}

document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopPolling();
    } else {
        loadNodes();
        updateStats();
        startPolling();
    }
});

// ============ UTILITIES ============
function updateStatusText(text) {
    const el = document.getElementById('statusText');
    if (el) el.textContent = text;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'F5') { e.preventDefault(); refreshAll(); }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    if (e.key === 'Escape') {
        clearSearch();
        document.getElementById('searchInput').blur();
    }
});

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function() {
    initSorting();
    loadNodes();
    updateStats();
    startPolling();

    // Initialize audio on first user interaction (browser policy)
    document.addEventListener('click', function initAudioOnce() {
        initAudio();
        requestNotificationPermission();
        document.removeEventListener('click', initAudioOnce);
    }, { once: true });

    // Update theme icon
    const savedTheme = localStorage.getItem('theme') || 'light';
    const icon = document.querySelector('.theme-toggle i');
    if (icon) icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    // Update sound icon
    const soundBtn = document.getElementById('soundToggle');
    if (soundBtn) {
        const soundIcon = soundBtn.querySelector('i');
        if (soundEnabled) {
            soundIcon.className = 'fas fa-volume-up';
            soundBtn.classList.remove('muted');
        } else {
            soundIcon.className = 'fas fa-volume-mute';
            soundBtn.classList.add('muted');
        }
    }

    // Update notification icon
    const notifBtn = document.getElementById('notifToggle');
    if (notifBtn) {
        const notifIcon = notifBtn.querySelector('i');
        if (browserNotificationsEnabled) {
            notifIcon.className = 'fas fa-bell';
            notifBtn.classList.remove('muted');
        } else {
            notifIcon.className = 'fas fa-bell-slash';
            notifBtn.classList.add('muted');
        }
    }

    // Auto-dismiss flash messages
    setTimeout(() => {
        document.querySelectorAll('.flash-msg').forEach(msg => {
            msg.style.transition = 'opacity 0.5s, transform 0.5s';
            msg.style.opacity = '0';
            msg.style.transform = 'translateX(100%)';
            setTimeout(() => msg.remove(), 500);
        });
    }, 5000);
});

function initAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio API not supported');
        }
    }
}

// Play tone using Web Audio API (no external files needed!)
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!soundEnabled) return;
    if (!audioContext) initAudio();
    if (!audioContext) return;

    try {
        // Resume context if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        // Smooth fade in/out to prevent clicking
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        console.error('Error playing tone:', e);
    }
}

// Play sequence of tones
function playSequence(notes) {
    if (!soundEnabled) return;
    notes.forEach((note, index) => {
        setTimeout(() => {
            playTone(note.freq, note.duration, note.type || 'sine', note.volume || 0.3);
        }, note.delay || index * 150);
    });
}

// ============ BROWSER DESKTOP NOTIFICATIONS ============

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('[NOTIFICATION] Browser does not support notifications');
        return;
    }
    if (Notification.permission === 'granted') {
        notificationPermission = 'granted';
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(permission) {
            notificationPermission = permission;
        });
    }
}

function sendDesktopNotification(title, body, icon, tag) {
    // Try browser notification
    if (browserNotificationsEnabled && ('Notification' in window) && Notification.permission === 'granted') {
        try {
            var options = {
                body: body,
                icon: icon || '',
                tag: tag || 'netmonitor-' + Date.now(),
                requireInteraction: false,
                silent: false
            };
            var notif = new Notification(title, options);
            setTimeout(function() { notif.close(); }, 8000);
            notif.onclick = function() {
                window.focus();
                notif.close();
            };
        } catch (e) {
            console.error('[NOTIFICATION] Error:', e);
        }
    }
}

// ============ TAB TITLE BLINKING (WORKS ALWAYS!) ============

let originalTitle = 'NetMonitor Pro';
let titleBlinkInterval = null;
let downNodesCount = 0;

function updateTabTitle(downCount) {
    downNodesCount = downCount;

    // Stop previous blink
    if (titleBlinkInterval) {
        clearInterval(titleBlinkInterval);
        titleBlinkInterval = null;
    }

    if (downCount > 0) {
        // Start blinking title
        let blink = true;
        titleBlinkInterval = setInterval(function() {
            if (blink) {
                document.title = '🔴 ' + downCount + ' NODE DOWN! - NetMonitor Pro';
            } else {
                document.title = '⚠️ ALERT: ' + downCount + ' nodes down - NetMonitor Pro';
            }
            blink = !blink;
        }, 1500);
    } else {
        // All good - normal title
        document.title = '✅ All Online - NetMonitor Pro';
        // After 3 seconds, reset to normal
        setTimeout(function() {
            document.title = originalTitle;
        }, 3000);
    }
}

// ============ URGENT IN-PAGE ALERT BAR ============

function showAlertBar(message, type) {
    // Remove existing alert bar
    let existing = document.getElementById('urgentAlertBar');
    if (existing) existing.remove();

    let bar = document.createElement('div');
    bar.id = 'urgentAlertBar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:12px 20px;text-align:center;font-size:14px;font-weight:600;font-family:Inter,sans-serif;animation:slideDown 0.3s ease;cursor:pointer;';

    if (type === 'down') {
        bar.style.background = 'linear-gradient(90deg, #dc2626, #ef4444)';
        bar.style.color = 'white';
        bar.innerHTML = '🔴 ' + message + ' &nbsp; <span style="text-decoration:underline;">Click to view</span>';
    } else if (type === 'up') {
        bar.style.background = 'linear-gradient(90deg, #059669, #10b981)';
        bar.style.color = 'white';
        bar.innerHTML = '🟢 ' + message;
    } else {
        bar.style.background = 'linear-gradient(90deg, #d97706, #f59e0b)';
        bar.style.color = 'white';
        bar.innerHTML = '🟡 ' + message;
    }

    bar.onclick = function() {
        window.focus();
        if (type === 'down') {
            setFilter('down');
        }
        bar.remove();
    };

    document.body.appendChild(bar);

    // Auto remove after 10s (except for down alerts)
    if (type !== 'down') {
        setTimeout(function() { if (bar.parentNode) bar.remove(); }, 10000);
    }
}

// Check down nodes and update tab title
function checkAndUpdateTabTitle() {
    if (!nodesData || nodesData.length === 0) return;

    let downCount = 0;
    nodesData.forEach(function(n) {
        if (n.status === 'Node Down') downCount++;
    });

    updateTabTitle(downCount);
}

// ============ NOTIFICATION SOUNDS ============

// Node DOWN - Alert sound (descending alarm)
function playNodeDownSound() {
    playSequence([
        { freq: 880, duration: 0.15, delay: 0, volume: 0.4 },
        { freq: 660, duration: 0.15, delay: 150, volume: 0.4 },
        { freq: 440, duration: 0.3, delay: 300, volume: 0.5 }
    ]);
}

// Node UP - Recovery sound (ascending happy chime)
function playNodeUpSound() {
    playSequence([
        { freq: 523.25, duration: 0.1, delay: 0, volume: 0.3 },   // C5
        { freq: 659.25, duration: 0.1, delay: 100, volume: 0.3 }, // E5
        { freq: 783.99, duration: 0.2, delay: 200, volume: 0.3 }  // G5
    ]);
}

// Warning sound
function playWarningSound() {
    playSequence([
        { freq: 600, duration: 0.1, delay: 0, volume: 0.3 },
        { freq: 600, duration: 0.1, delay: 200, volume: 0.3 }
    ]);
}

// Critical down (for important nodes - longer alarm)
function playCriticalDownSound() {
    playSequence([
        { freq: 880, duration: 0.2, delay: 0, volume: 0.5, type: 'square' },
        { freq: 440, duration: 0.2, delay: 250, volume: 0.5, type: 'square' },
        { freq: 880, duration: 0.2, delay: 500, volume: 0.5, type: 'square' },
        { freq: 440, duration: 0.4, delay: 750, volume: 0.5, type: 'square' }
    ]);
}

// Toggle browser desktop notifications on/off
function toggleBrowserNotifications() {
    browserNotificationsEnabled = !browserNotificationsEnabled;
    localStorage.setItem('browserNotifications', browserNotificationsEnabled);

    const btn = document.getElementById('notifToggle');
    const icon = btn.querySelector('i');

    if (browserNotificationsEnabled) {
        // Request permission
        requestNotificationPermission();
        icon.className = 'fas fa-bell';
        btn.classList.remove('muted');
        btn.title = 'Notifications: ON (click to disable)';
        showNotification('🔔 Desktop notifications enabled', 'success');
        // Test notification
        setTimeout(function() {
            sendDesktopNotification('✅ NetMonitor Pro', 'Desktop notifications are now enabled!', '', 'test');
        }, 1000);
    } else {
        icon.className = 'fas fa-bell-slash';
        btn.classList.add('muted');
        btn.title = 'Notifications: OFF (click to enable)';
        showNotification('🔕 Desktop notifications disabled', 'info');
    }
}

// Toggle sound on/off
function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('soundEnabled', soundEnabled);

    const btn = document.getElementById('soundToggle');
    const icon = btn.querySelector('i');

    if (soundEnabled) {
        icon.className = 'fas fa-volume-up';
        btn.classList.remove('muted');
        btn.title = 'Sound: ON (click to mute)';
        // Play test sound
        playNodeUpSound();
        showNotification('🔊 Sound notifications enabled', 'success');
    } else {
        icon.className = 'fas fa-volume-mute';
        btn.classList.add('muted');
        btn.title = 'Sound: OFF (click to unmute)';
        showNotification('🔇 Sound notifications muted', 'info');
    }
}

// Show in-app notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer') || createNotificationContainer();

    const notif = document.createElement('div');
    notif.className = `app-notification notif-${type}`;
    notif.innerHTML = `
        <div class="notif-icon">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        </div>
        <div class="notif-content">${message}</div>
        <button class="notif-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(notif);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => notif.remove(), 300);
    }, 5000);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
}

// ============ TEST NOTIFICATIONS ============
function testNotifications() {
    console.log('[TEST] Testing all notifications...');

    // 1. Check browser support
    if (!('Notification' in window)) {
        alert('❌ Your browser does NOT support notifications!');
        return;
    }

    // 2. Check current permission
    console.log('[TEST] Current permission:', Notification.permission);

    // 3. If permission not granted, request it
    if (Notification.permission !== 'granted') {
        console.log('[TEST] Requesting permission...');
        Notification.requestPermission().then(function(p) {
            console.log('[TEST] Permission result:', p);
            if (p === 'granted') {
                alert('✅ Permission granted! Click "Test Alerts" again.');
            } else {
                alert('❌ Permission denied: ' + p + '\n\nFix:\n1. Click 🔒 lock icon in address bar\n2. Site Settings → Notifications → Allow\n3. Refresh page');
            }
        });
        return;
    }

    // 4. Permission granted - send test
    doTestNotifications();
}

function doTestNotifications() {
    // Test DOWN
    console.log('[TEST] Sending DOWN notification...');
    sendDesktopNotification(
        '🔴 Node DOWN',
        'TEST-Node (192.168.1.1) is DOWN',
        '',
        'test-down'
    );
    playNodeDownSound();
    showNotification('🔴 <strong>TEST-Node</strong> is DOWN<br><small>192.168.1.1</small>', 'error');
    showAlertBar('TEST-Node (192.168.1.1) is DOWN!', 'down');
    updateTabTitle(3); // Simulate 3 down

    // Test UP after 5 seconds
    setTimeout(function() {
        console.log('[TEST] Sending UP notification...');
        sendDesktopNotification(
            '🟢 Node UP',
            'TEST-Node (192.168.1.1) is UP',
            '',
            'test-up'
        );
        playNodeUpSound();
        showNotification('🟢 <strong>TEST-Node</strong> is UP<br><small>192.168.1.1</small>', 'success');
        showAlertBar('TEST-Node (192.168.1.1) is back UP!', 'up');
        updateTabTitle(0); // All good
    }, 5000);

    showNotification('🔔 Test alerts sent! Watch the tab title + alert bar', 'info');
}
