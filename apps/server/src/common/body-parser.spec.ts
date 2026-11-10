import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request } from 'node:http';
import { AddressInfo } from 'node:net';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';

@Controller()
class ParserTestController {
  @Post('echo')
  echo(@Body() body: unknown) {
    return body;
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

describe('Nest default body parser', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ParserTestController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app?.close();
  });

  function send(body?: Buffer, encoding?: string, contentType = 'application/json') {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path: body ? '/echo' : '/health',
          method: body ? 'POST' : 'GET',
          agent: false,
          headers: body
            ? {
                'Content-Type': contentType,
                'Content-Length': body.length,
                ...(encoding ? { 'Content-Encoding': encoding } : {}),
              }
            : {},
        },
        (res) => {
          let responseBody = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            responseBody += chunk;
          });
          res.on('error', reject);
          res.on('end', () => resolve({ status: res.statusCode!, body: responseBody }));
        },
      );
      req.on('error', reject);
      req.setTimeout(2000, () => req.destroy(new Error('Body parser request timed out')));
      req.end(body);
    });
  }

  it.each([
    ['identity', (body: Buffer) => body],
    ['gzip', gzipSync],
    ['deflate', deflateSync],
    ['br', brotliCompressSync],
  ] as const)('parses %s JSON', async (encoding, compress) => {
    const body = { tempo: 120 };
    const response = await send(compress(Buffer.from(JSON.stringify(body))), encoding);
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual(body);
  });

  it('still parses URL-encoded form bodies', async () => {
    const response = await send(Buffer.from('tempo=120'), undefined, 'application/x-www-form-urlencoded');
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ tempo: '120' });
  });

  it('rejects malformed compressed data and remains healthy', async () => {
    expect((await send(Buffer.from('not a gzip frame'), 'gzip')).status).toBe(400);
    expect((await send()).status).toBe(200);
  });

  it('survives trailing bytes after a completed gzip frame', async () => {
    // GHSA-27r3-jxmh-p828: a decoder used to emit an uncaught error after parsing.
    // Use a real HTTP request so the large tail reaches the decoder in later chunks.
    const body = Buffer.concat([
      gzipSync(Buffer.from('{"tempo":120}')),
      Buffer.from([0]),
      Buffer.alloc(100 * 1024, 0x58),
    ]);
    const response = await send(body, 'gzip');
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ tempo: 120 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const health = await send();
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body)).toEqual({ status: 'ok' });
  });
});
