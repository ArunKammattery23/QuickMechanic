import Redis from 'ioredis';

export interface CallSession {
  id: string;
  caller: string;
  target: string;
  callerSocket: string;
  targetSocket: string;
  state: 'ringing' | 'active';
}

// Both participants must be reserved atomically across API instances.
const RESERVE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 'STALE_CALL' end
if redis.call('EXISTS', KEYS[3]) == 1 then return 'TARGET_BUSY' end
if redis.call('EXISTS', KEYS[2]) == 1 then return 'CALLER_BUSY' end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[3], ARGV[2], 'EX', ARGV[3])
return 'OK'`;

const CHANGE = `
local raw = redis.call('GET', KEYS[1])
if not raw or raw == 'ended' then return 'STALE_CALL' end
local s = cjson.decode(raw)
if redis.call('GET', KEYS[2]) ~= s.id or redis.call('GET', KEYS[3]) ~= s.id then return 'STALE_CALL' end
local caller = s.caller == ARGV[1] and s.callerSocket == ARGV[2]
local target = s.target == ARGV[1] and s.targetSocket == ARGV[2]
if not caller and not target then return 'INVALID_CALL' end
local op = ARGV[3]
if op == 'end' then
  redis.call('DEL', KEYS[2], KEYS[3])
  redis.call('SET', KEYS[1], 'ended', 'EX', 120)
  return raw
end
if op == 'answer' then
  if not target or s.state ~= 'ringing' then return 'INVALID_CALL' end
  s.state = 'active'
  raw = cjson.encode(s)
elseif op == 'refresh' then
  if s.state ~= 'active' then return raw end
elseif op == 'ice' then
  return raw
else
  return 'INVALID_CALL'
end
redis.call('SET', KEYS[1], raw, 'EX', ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[4])
redis.call('EXPIRE', KEYS[3], ARGV[4])
return raw`;

export class CallSessionStore {
  constructor(private readonly redis: Redis) {}
  private sessionKey(id: string) { return `calls:{calls}:session:${id}`; }
  private userKey(id: string) { return `calls:{calls}:user:${id}`; }
  private keys(s: CallSession) {
    return [this.sessionKey(s.id), this.userKey(s.caller), this.userKey(s.target)];
  }
  async reserve(s: CallSession): Promise<string> {
    return await this.redis.eval(RESERVE, 3, ...this.keys(s), JSON.stringify(s), s.id, 50) as string;
  }
  async get(id: string): Promise<CallSession | null> {
    const value = await this.redis.get(this.sessionKey(id));
    return value && value !== 'ended' ? JSON.parse(value) : null;
  }
  async forUser(id: string): Promise<CallSession | null> {
    const callId = await this.redis.get(this.userKey(id));
    return callId ? this.get(callId) : null;
  }
  async change(s: CallSession, user: string, socket: string, op: 'answer' | 'ice' | 'end' | 'refresh'): Promise<CallSession | string> {
    const result = await this.redis.eval(CHANGE, 3, ...this.keys(s), user, socket, op, 90) as string;
    return result.startsWith('{') ? JSON.parse(result) : result;
  }
}
