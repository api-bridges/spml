import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateJob } from '../../src/codegen/jobs.js';
import { resetImports } from '../../src/codegen/imports.js';
import { compile } from '../../src/cli/index.js';

beforeEach(() => resetImports());

describe('generateJob()', () => {
  it('emits cron.schedule with the provided cron expression', () => {
    const node = { type: 'Job', schedule: '0 0 * * *', body: [] };
    const output = generateJob(node);
    expect(output).toContain(`cron.schedule('0 0 * * *', async () => {`);
  });

  it('emits closing brace', () => {
    const node = { type: 'Job', schedule: '0 0 * * *', body: [] };
    const output = generateJob(node);
    expect(output).toContain('});');
  });

  it('emits a placeholder comment when body is empty', () => {
    const node = { type: 'Job', schedule: '*/5 * * * *', body: [] };
    const output = generateJob(node);
    expect(output).toContain('// scheduled task body');
  });

  it('emits node type comments for body nodes', () => {
    const node = {
      type: 'Job',
      schedule: '0 0 * * *',
      body: [{ type: 'Delete' }, { type: 'Find' }],
    };
    const output = generateJob(node);
    expect(output).toContain('// Delete');
    expect(output).toContain('// Find');
  });

  it('matches snapshot for daily at midnight', () => {
    const node = { type: 'Job', schedule: '0 0 * * *', body: [] };
    expect(generateJob(node)).toMatchSnapshot();
  });

  it('matches snapshot for every 5 minutes', () => {
    const node = { type: 'Job', schedule: '*/5 * * * *', body: [] };
    expect(generateJob(node)).toMatchSnapshot();
  });
});

describe('schedule shorthand → cron expression (via compile())', () => {
  it('daily at midnight compiles to 0 0 * * *', () => {
    const source = [
      'server port 3000',
      '',
      'job daily at midnight',
      '  delete Session by expiredAt',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`cron.schedule('0 0 * * *'`);
  });

  it('daily at noon compiles to 0 12 * * *', () => {
    const source = [
      'server port 3000',
      '',
      'job daily at noon',
      '  delete Session by expiredAt',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`cron.schedule('0 12 * * *'`);
  });

  it('weekly compiles to 0 0 * * 0', () => {
    const source = [
      'server port 3000',
      '',
      'job weekly',
      '  find all User',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`cron.schedule('0 0 * * 0'`);
  });

  it('every 5 minutes compiles to */5 * * * *', () => {
    const source = [
      'server port 3000',
      '',
      'job every 5 minutes',
      '  delete TempFile by createdAt',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`cron.schedule('*/5 * * * *'`);
  });

  it('every 2 hours compiles to 0 */2 * * *', () => {
    const source = [
      'server port 3000',
      '',
      'job every 2 hours',
      '  delete OldLog by createdAt',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`cron.schedule('0 */2 * * *'`);
  });

  it('every 30 seconds compiles to */30 * * * * *', () => {
    const source = [
      'server port 3000',
      '',
      'job every 30 seconds',
      '  delete TempFile by createdAt',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`cron.schedule('*/30 * * * * *'`);
  });

  it('imports node-cron when job is present', () => {
    const source = [
      'server port 3000',
      '',
      'job daily at midnight',
      '  delete Session by expiredAt',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`from 'node-cron'`);
  });

  it('does not import node-cron when no job is present', () => {
    const source = [
      'server port 3000',
      '',
      'route GET /health',
      '  return ok',
    ].join('\n');
    const output = compile(source);
    expect(output).not.toContain('node-cron');
  });

  it('daily (no at) compiles to 0 0 * * *', () => {
    const source = [
      'server port 3000',
      '',
      'job daily',
      '  delete Session by expiredAt',
    ].join('\n');
    const output = compile(source);
    expect(output).toContain(`cron.schedule('0 0 * * *'`);
  });
});
