import Redis from 'ioredis';
import { CallGateway } from './call.gateway';
import { CallSession, CallSessionStore } from './call-session.store';

const local = process.env.RUN_LOCAL_DB_TESTS === '1' ? describe : describe.skip;
local('Atomic call admission with real local Redis', () => {
  const prefix = `qm_calls_${Date.now()}:`;
  let redis: Redis, store: CallSessionStore, first: CallGateway, second: CallGateway;
  const emitted: {room: string; event: string; data: any}[] = [];
  const connected = new Set<string>();
  const access = { canContact: jest.fn(async () => true) };
  const client = (id: string, socket = id + '-device', role = 'CUSTOMER') => {
    connected.add(socket);
    return { id: socket, user: { sub: id, role }, connected: true } as any;
  };
  const data = (id = 'call-1', targetId = 'p1') => ({callId: id, targetId, offer: {sdp: 'offer', type: 'offer'}});
  const raw = (id: string, caller = 'c1', target = 'p1'): CallSession => ({id, caller, target,
    callerSocket: caller + '-device', targetSocket: target + '-device', state: 'ringing'});
  const keys = (s: CallSession) => [`calls:{calls}:session:${s.id}`, `calls:{calls}:user:${s.caller}`, `calls:{calls}:user:${s.target}`];
  async function clear() {
    const found = await redis.keys(prefix + '*');
    if (found.length) await redis.del(...found.map(key => key.slice(prefix.length)));
  }
  beforeAll(async () => {
    redis = new Redis({host: '127.0.0.1', port: 6379, keyPrefix: prefix, maxRetriesPerRequest: 1});
    await redis.ping();
  });
  beforeEach(async () => {
    await clear(); emitted.length = 0; connected.clear(); access.canContact.mockResolvedValue(true);
    store = new CallSessionStore(redis);
    const server = {
      in: (room: string) => ({fetchSockets: async () => [{id: room.slice(5) + '-device'}]}),
      to: (room: string) => ({emit: (event: string, data: any) => emitted.push({room, event, data})}),
      sockets: {allSockets: async () => connected},
    };
    first = new CallGateway(access as any, {getOrThrow: () => redis} as any);
    second = new CallGateway(access as any, {getOrThrow: () => redis} as any);
    first.server = server as any; second.server = server as any;
  });
  afterAll(async () => { if (redis) { await clear(); await redis.quit(); } });

  it('admits exactly one of 40 simultaneous callers across two gateway instances', async () => {
    const results = await Promise.all(Array.from({length: 40}, (_, i) =>
      (i % 2 ? first : second).offer(data(`race-${i}`), client(`c${i}`))));
    expect(results.filter(r => r.success)).toHaveLength(1);
    expect(results.filter(r => !r.success)).toEqual(Array(39).fill({success: false,
      code: 'TARGET_BUSY', message: 'Provider is busy—try again'}));
    expect(emitted.filter(e => e.event === 'incoming_call')).toHaveLength(1);
  });
  it('prevents the same customer reserving two providers at once', async () => {
    const c = client('c1');
    const results = await Promise.all([first.offer(data('one', 'p1'), c), second.offer(data('two', 'p2'), c)]);
    expect(results.filter(r => r.success)).toHaveLength(1);
    expect(results.find(r => !r.success)).toMatchObject({code: 'CALLER_BUSY'});
  });
  it('supports independent parallel calls with answers and ICE routed to their own devices', async () => {
    await Promise.all(Array.from({length: 100}, async (_, i) => {
      const c = client(`c${i}`), p = client(`p${i}`, undefined, 'MECHANIC'), id = `pair-${i}`;
      expect((await first.offer(data(id, p.user.sub), c)).success).toBe(true);
      expect((await second.answer({callId: id, targetId: c.user.sub, answer: {sdp: 'answer'}}, p)).success).toBe(true);
      expect((await first.candidate({callId: id, targetId: p.user.sub, candidate: {candidate: id}}, c)).success).toBe(true);
    }));
    expect(emitted).toHaveLength(300);
    for (let i = 0; i < 100; i++) {
      expect(emitted.filter(e => e.data.callId === `pair-${i}`).map(e => e.room)).toEqual([`p${i}-device`, `c${i}-device`, `p${i}-device`]);
    }
  });
  it('rejects unbound call IDs, users, target IDs and alternate devices', async () => {
    await first.offer(data(), client('c1'));
    for (const socket of [client('stranger'), client('c1', 'other-device'), client('p1', 'other-provider-device')]) {
      expect((await second.end({callId: 'call-1', targetId: socket.user.sub === 'c1' ? 'p1' : 'c1'}, socket)).success).toBe(false);
    }
    expect((await second.end({callId: 'wrong-call', targetId: 'p1'}, client('c1'))).success).toBe(false);
    expect((await second.end({callId: 'call-1', targetId: 'p2'}, client('c1'))).success).toBe(false);
    expect(await store.forUser('p1')).not.toBeNull();
    expect(emitted).toHaveLength(1);
  });
  it('allows only the selected recipient to answer once', async () => {
    await first.offer(data(), client('c1'));
    expect((await first.answer({callId: 'call-1', targetId: 'p1', answer: {sdp: 'x'}}, client('c1'))).success).toBe(false);
    const answer = {callId: 'call-1', targetId: 'c1', answer: {sdp: 'x'}};
    expect((await second.answer(answer, client('p1'))).success).toBe(true);
    expect((await second.answer(answer, client('p1'))).success).toBe(false);
  });
  it('keeps the active call unchanged when a second customer calls', async () => {
    await first.offer(data(), client('c1'));
    await second.answer({callId: 'call-1', targetId: 'c1', answer: {sdp: 'x'}}, client('p1'));
    expect(await second.offer(data('second-call'), client('c2'))).toMatchObject({code: 'TARGET_BUSY'});
    expect((await store.forUser('p1'))?.id).toBe('call-1');
    expect(emitted.filter(e => e.event === 'call_ended')).toHaveLength(0);
  });
  it('releases both participants and blocks stale messages from ending a later call', async () => {
    const c = client('c1'); await first.offer(data(), c);
    expect((await second.end(data(), c)).success).toBe(true);
    expect(await store.forUser('p1')).toBeNull();
    expect(await store.forUser('c1')).toBeNull();
    expect((await first.offer(data('later-call'), c)).success).toBe(true);
    expect((await first.end(data(), c)).success).toBe(false);
    expect((await store.forUser('p1'))?.id).toBe('later-call');
  });
  it('cleans up only the owning device on disconnect and permits retry', async () => {
    await first.offer(data(), client('c1'));
    await second.handleDisconnect(client('p1', 'other-device'));
    expect(await store.forUser('p1')).not.toBeNull();
    await second.handleDisconnect(client('p1'));
    expect(await store.forUser('p1')).toBeNull();
    expect((await first.offer(data('retry'), client('c2'))).success).toBe(true);
  });
  it('expires unanswered reservations and does not let old cleanup release a new call', async () => {
    const s = raw('timeout'); await store.reserve(s);
    for (const key of keys(s)) await redis.pexpire(key, 1);
    await new Promise(resolve => setTimeout(resolve, 10));
    const next = raw('next'); expect(await store.reserve(next)).toBe('OK');
    expect(await store.change(s, s.caller, s.callerSocket, 'end')).toBe('STALE_CALL');
    expect((await store.forUser('p1'))?.id).toBe('next');
  });
  it('renews active calls while both devices are connected, and releases disconnected calls', async () => {
    await first.offer(data(), client('c1')); const p = client('p1');
    await second.answer({callId: 'call-1', targetId: 'c1', answer: {sdp: 'x'}}, p);
    for (const key of keys(raw('call-1'))) await redis.expire(key, 5);
    await first.maintainCalls();
    for (const key of keys(raw('call-1'))) expect(await redis.ttl(key)).toBeGreaterThan(60);
    connected.delete(p.id); await first.maintainCalls();
    expect(await store.forUser('p1')).toBeNull();
    expect(emitted.some(e => e.event === 'call_ended' && e.data.reason === 'disconnected')).toBe(true);
  });
  it('does not renew ringing calls and rejects reused finished call IDs', async () => {
    await first.offer(data(), client('c1')); client('p1');
    for (const key of keys(raw('call-1'))) await redis.expire(key, 5);
    await first.maintainCalls();
    expect(await redis.ttl(keys(raw('call-1'))[0])).toBeLessThanOrEqual(5);
    await first.end(data(), client('c1'));
    expect(await first.offer(data(), client('c1'))).toMatchObject({code: 'STALE_CALL'});
  });
  it('rejects new answers after job access ends but still allows hangup', async () => {
    await first.offer(data(), client('c1')); access.canContact.mockResolvedValue(false);
    expect((await second.answer({callId: 'call-1', targetId: 'c1', answer: {sdp: 'x'}}, client('p1'))).success).toBe(false);
    expect((await first.end(data(), client('c1'))).success).toBe(true);
  });
});
