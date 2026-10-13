// Mock HR / identity / mail APIs for the process tasks of the emp case.
// No dependencies: runs on the plain node image.
//
//   POST /api/CreateEmployeeRecord  -> creates an employee, returns { employeeId }
//   POST /api/SendPIPNotice         -> mails the PIP notice via SMTP (mailcatcher)
//   POST /api/RevokeAccess          -> records an access revocation
//   POST /api/ArchiveRecords        -> archives an employee
//   GET  /api/calls                 -> every call received (for inspection)
//   GET  /api/employees             -> employees created / archived
//   GET  /health                    -> liveness check

const http = require('http');
const net = require('net');

const PORT = process.env.PORT || 8390;
const calls = [];
const employees = {};
let nextId = 1;

const SMTP_HOST = process.env.SMTP_HOST || 'mailcatcher';
const SMTP_PORT = Number(process.env.SMTP_PORT || 1025);
const MAIL_FROM = process.env.MAIL_FROM || 'hr@example.com';

// Minimal SMTP client: enough to hand one message to mailcatcher.
function sendMail({ to, subject, html }) {
    return new Promise((resolve, reject) => {
        const body = html.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
        const message = [
            `From: ${MAIL_FROM}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            body,
            '.',
        ].join('\r\n');
        const steps = ['EHLO mock-api', `MAIL FROM:<${MAIL_FROM}>`, `RCPT TO:<${to}>`, 'DATA', message, 'QUIT'];
        const socket = net.createConnection(SMTP_PORT, SMTP_HOST);
        let buffer = '';
        socket.setTimeout(10000, () => socket.destroy(new Error('SMTP timeout')));
        socket.on('error', reject);
        socket.on('close', () => (steps.length ? reject(new Error('SMTP connection closed early')) : resolve()));
        socket.on('data', chunk => {
            buffer += chunk;
            const lines = buffer.split('\r\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (line[3] === '-') continue; // multi-line reply, wait for the last line
                if (!/^[23]/.test(line)) return socket.destroy(new Error(`SMTP error: ${line}`));
                if (steps.length) socket.write(steps.shift() + '\r\n');
            }
        });
    });
}

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function pipNoticeHtml({ employeeName, noticeText, goals }) {
    return `<html><body style="font-family: Arial, Helvetica, sans-serif; font-size: 14px;">
<p>Dear ${escapeHtml(employeeName || 'colleague')},</p>
<p>${escapeHtml(noticeText)}</p>
<p><b>Your improvement goals</b></p>
<blockquote style="margin: 0 0 1em 0; padding-left: 8px; border-left: 3px solid #1a73e8;">${escapeHtml(goals)}</blockquote>
<p>Please open the task <b>Acknowledge PIP</b> in CaseFabric to confirm you have received this plan, or to dispute it. Your manager will hold a check-in with you every 14 days during the plan.</p>
<p>Kind regards,<br>HR Department</p>
</body></html>`;
}

const handlers = {
    CreateEmployeeRecord(body) {
        const employeeId = `EMP-${String(nextId++).padStart(4, '0')}`;
        employees[employeeId] = { employeeId, ...body, status: 'active', createdAt: new Date().toISOString() };
        return { employeeId, status: 'created' };
    },
    async SendPIPNotice(body) {
        if (!body.employeeEmail) return [400, { error: 'employeeEmail is required' }];
        try {
            await sendMail({
                to: body.employeeEmail,
                subject: 'Performance Improvement Plan: action required',
                html: pipNoticeHtml(body),
            });
        } catch (error) {
            return [502, { error: `mail not sent: ${error.message}` }];
        }
        return { status: 'sent', to: body.employeeEmail, sentAt: new Date().toISOString() };
    },
    RevokeAccess(body) {
        const employee = employees[body.employeeId];
        if (employee) employee.accessRevoked = true;
        return { status: 'revoked', employeeId: body.employeeId, effectiveOn: body.lastWorkingDay };
    },
    ArchiveRecords(body) {
        const employee = employees[body.employeeId];
        if (employee) employee.status = 'archived';
        return { status: 'archived', employeeId: body.employeeId };
    },
};

function send(res, code, payload) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

function parse(raw) {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return { raw };
    }
}

http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', async () => {
        if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok' });
        if (req.method === 'GET' && req.url === '/api/calls') return send(res, 200, calls);
        if (req.method === 'GET' && req.url === '/api/employees') return send(res, 200, Object.values(employees));

        const name = req.method === 'POST' && req.url.startsWith('/api/') ? req.url.slice(5) : null;
        const handler = name && handlers[name];
        if (!handler) return send(res, 404, { error: `unknown endpoint ${req.method} ${req.url}` });

        const body = parse(raw);
        const result = await handler(body);
        const [code, payload] = Array.isArray(result) ? result : [200, result];
        calls.push({ at: new Date().toISOString(), endpoint: name, request: body, status: code, response: payload });
        console.log(`${name} ${code} request=${JSON.stringify(body)} response=${JSON.stringify(payload)}`);
        send(res, code, payload);
    });
}).listen(PORT, () => console.log(`mock-api listening on ${PORT}`));
