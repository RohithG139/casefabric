// Mock HR / identity / mail APIs for the process tasks of the emp case.
// No dependencies: runs on the plain node image.
//
//   POST /api/CreateEmployeeRecord  -> creates an employee, returns { employeeId }
//   POST /api/SendPIPNotice         -> records a PIP notice
//   POST /api/RevokeAccess          -> records an access revocation
//   POST /api/ArchiveRecords        -> archives an employee
//   GET  /api/calls                 -> every call received (for inspection)
//   GET  /api/employees             -> employees created / archived
//   GET  /health                    -> liveness check

const http = require('http');

const PORT = process.env.PORT || 8390;
const calls = [];
const employees = {};
let nextId = 1;

const handlers = {
    CreateEmployeeRecord(body) {
        const employeeId = `EMP-${String(nextId++).padStart(4, '0')}`;
        employees[employeeId] = { employeeId, ...body, status: 'active', createdAt: new Date().toISOString() };
        return { employeeId, status: 'created' };
    },
    SendPIPNotice(body) {
        if (!body.employeeEmail) return [400, { error: 'employeeEmail is required' }];
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
    req.on('end', () => {
        if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok' });
        if (req.method === 'GET' && req.url === '/api/calls') return send(res, 200, calls);
        if (req.method === 'GET' && req.url === '/api/employees') return send(res, 200, Object.values(employees));

        const name = req.method === 'POST' && req.url.startsWith('/api/') ? req.url.slice(5) : null;
        const handler = name && handlers[name];
        if (!handler) return send(res, 404, { error: `unknown endpoint ${req.method} ${req.url}` });

        const body = parse(raw);
        const result = handler(body);
        const [code, payload] = Array.isArray(result) ? result : [200, result];
        calls.push({ at: new Date().toISOString(), endpoint: name, request: body, status: code, response: payload });
        console.log(`${name} ${code} request=${JSON.stringify(body)} response=${JSON.stringify(payload)}`);
        send(res, code, payload);
    });
}).listen(PORT, () => console.log(`mock-api listening on ${PORT}`));
