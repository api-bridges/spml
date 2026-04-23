import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateSocketHandler } from '../../src/codegen/socket.js';
import { resetImports } from '../../src/codegen/imports.js';
import { compile } from '../../src/cli/index.js';

beforeEach(() => resetImports());

describe('generateSocketHandler()', () => {
  it('emits wss.on connection handler', () => {
    const node = { type: 'Socket', path: '/chat', event: 'message', body: [] };
    const output = generateSocketHandler(node);
    expect(output).toContain(`_wss.on('connection', (ws) => {`);
  });

  it('emits ws.on for the specified event', () => {
    const node = { type: 'Socket', path: '/chat', event: 'message', body: [] };
    const output = generateSocketHandler(node);
    expect(output).toContain(`ws.on('message', (message) => {`);
  });

  it('emits broadcast forEach when BroadcastNode is in body', () => {
    const node = {
      type: 'Socket',
      path: '/chat',
      event: 'message',
      body: [{ type: 'Broadcast', data: 'message' }],
    };
    const output = generateSocketHandler(node);
    expect(output).toContain('_wss.clients.forEach');
    expect(output).toContain('client.send(message.toString())');
  });

  it('emits readyState guard in broadcast', () => {
    const node = {
      type: 'Socket',
      path: '/chat',
      event: 'message',
      body: [{ type: 'Broadcast', data: 'message' }],
    };
    const output = generateSocketHandler(node);
    expect(output).toContain('client.readyState === WebSocket.OPEN');
  });

  it('emits a comment placeholder when body is empty', () => {
    const node = { type: 'Socket', path: '/chat', event: 'message', body: [] };
    const output = generateSocketHandler(node);
    expect(output).toContain('// handle message event');
  });

  it('matches snapshot', () => {
    const node = {
      type: 'Socket',
      path: '/chat',
      event: 'message',
      body: [{ type: 'Broadcast', data: 'message' }],
    };
    expect(generateSocketHandler(node)).toMatchSnapshot();
  });
});

describe('compile() — socket keyword', () => {
  it('emits http.createServer when socket is present', () => {
    const source = [
      'server port 3000',
      '',
      'socket /chat',
      '  on message',
      '    broadcast message',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain('http.createServer(app)');
  });

  it('imports http and ws when socket is present', () => {
    const source = [
      'server port 3000',
      '',
      'socket /chat',
      '  on message',
      '    broadcast message',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`import http from 'http'`);
    expect(output).toContain(`from 'ws'`);
  });

  it('uses _server.listen instead of app.listen when socket is present', () => {
    const source = [
      'server port 3000',
      '',
      'socket /chat',
      '  on message',
      '    broadcast message',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain('_server.listen(PORT');
    expect(output).not.toContain('app.listen(PORT');
  });

  it('still uses app.listen when no socket is present', () => {
    const source = ['server port 3000', '', 'route GET /health', '  return ok'].join('\n');
    const output = compile(source);
    expect(output).toContain('app.listen(PORT');
    expect(output).not.toContain('_server.listen');
  });

  it('emits the WebSocket connection handler in the output', () => {
    const source = [
      'server port 3000',
      '',
      'socket /chat',
      '  on message',
      '    broadcast message',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`_wss.on('connection'`);
    expect(output).toContain(`ws.on('message'`);
  });
});
