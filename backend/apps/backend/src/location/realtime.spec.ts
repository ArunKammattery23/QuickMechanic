import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { LocationGateway } from './location.gateway';
import { CallGateway } from '../dispatch/call.gateway';
import { LocationController } from './location.controller';
import axios from 'axios';

describe('Authenticated calls and tracking', () => {
  const jwt = new JwtService({ secret: 'test-only-secret' });
  const user = { sub: 'customer-1', role: 'CUSTOMER' };
  const token = jwt.sign(user);
  const access = { canContact: jest.fn(), trackingCustomers: jest.fn(), updatePresence: jest.fn() };
  const redis = { set: jest.fn(), get: jest.fn(), eval: jest.fn().mockResolvedValue('OK') };
  const location = new LocationGateway(
    { getOrThrow: () => redis } as any,
    jwt,
    access as any,
  );
  beforeEach(() => jest.clearAllMocks());

  it('accepts the same signed token for HTTP and WebSocket guards', async () => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    expect(
      await new JwtAuthGuard(jwt).canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as any),
    ).toBe(true);
    const socket = { handshake: { headers: {}, auth: { token } } };
    expect(
      await new WsJwtGuard(jwt).canActivate({
        switchToWs: () => ({ getClient: () => socket }),
      } as any),
    ).toBe(true);
  });
  it('rejects forged HTTP identities', async () => {
    const forged = new JwtService({ secret: 'wrong-secret' }).sign(user);
    await expect(
      new JwtAuthGuard(jwt).canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: `Bearer ${forged}` },
          }),
        }),
      } as any),
    ).rejects.toThrow('Invalid or expired token');
  });
  it('rejects forged socket handshakes before room membership', async () => {
    let middleware: any;
    location.afterInit({
      use: (fn: any) => {
        middleware = fn;
      },
    } as any);
    const next = jest.fn();
    await middleware(
      { handshake: { auth: { token: 'forged' }, headers: {} } },
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
  it('joins private rooms only after identity verification', () => {
    const client = { user, join: jest.fn() };
    location.handleConnection(client as any);
    expect(client.join.mock.calls).toEqual([
      ['user_customer-1'],
      ['customer_customer-1'],
    ]);
  });
  it('does not let customers spoof mechanic GPS', async () => {
    await expect(
      location.handleLocationUpdate(
        { mechanicId: 'mechanic-1', lat: 12, lng: 77 },
        { user } as any,
      ),
    ).rejects.toThrow();
    expect(redis.set).not.toHaveBeenCalled();
  });
  it('rejects tracking subscriptions without an active job', async () => {
    access.canContact.mockResolvedValue(false);
    await expect(
      location.handleCustomerSubscription({ mechanicId: 'other' }, {
        user,
      } as any),
    ).rejects.toThrow();
    expect(redis.get).not.toHaveBeenCalled();
  });
  it('sends GPS only to current job customers, using the verified mechanic id', async () => {
    access.trackingCustomers.mockResolvedValue(['customer-1']);
    const emit = jest.fn(),
      to = jest.fn(() => ({ emit }));
    location.server = { to } as any;
    await location.handleLocationUpdate(
      { mechanicId: 'mechanic-1', lat: 12, lng: 77 },
      { user: { sub: 'mechanic-1', role: 'MECHANIC' } } as any,
    );
    expect(to).toHaveBeenCalledWith('customer_customer-1');
    expect(emit).toHaveBeenCalledWith(
      'mechanic_location_changed',
      expect.objectContaining({ mechanicId: 'mechanic-1' }),
    );
  });
  it('routes call offers by verified identity, ignoring caller-supplied roles', async () => {
    access.canContact.mockResolvedValue(true);
    const calls = new CallGateway(access as any, { getOrThrow: () => redis } as any),
      emit = jest.fn();
    calls.server = {
      in: () => ({ fetchSockets: async () => [{ id: 'provider-device' }] }),
      to: jest.fn(() => ({ emit })),
    } as any;
    expect(
      await calls.offer(
        {
          targetId: 'mechanic-1',
          callerRole: 'MECHANIC',
          callId: 'call-1',
          offer: { sdp: 'offer' },
        },
        { user, id: 'customer-device', connected: true } as any,
      ),
    ).toEqual({ success: true });
    expect(calls.server.to).toHaveBeenCalledWith('provider-device');
    expect(emit).toHaveBeenCalledWith(
      'incoming_call',
      expect.objectContaining({ callerId: 'customer-1', callId: 'call-1' }),
    );
  });
  it('reports offline recipients instead of pretending to ring', async () => {
    access.canContact.mockResolvedValue(true);
    const calls = new CallGateway(access as any, { getOrThrow: () => redis } as any);
    calls.server = { in: () => ({ fetchSockets: async () => [] }) } as any;
    expect(
      await calls.offer({ targetId: 'mechanic-1', callId: 'call-1', offer: { sdp: 'test' } }, {
        user,
      } as any),
    ).toMatchObject({ success: false, code: 'OFFLINE', message: 'The other person is offline' });
  });
  it('blocks signaling to people outside the caller’s active job', async () => {
    access.canContact.mockResolvedValue(false);
    const calls = new CallGateway(access as any, { getOrThrow: () => redis } as any);
    expect(
      await calls.offer({ targetId: 'other', callId: 'call-1' }, {
        user,
      } as any),
    ).toMatchObject({ success: false });
  });
});

describe('Road routes', () => {
  afterEach(() => jest.restoreAllMocks());
  it('uses the configured router and returns road geometry, travel time and directions', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        routes: [
          {
            distance: 2300,
            duration: 420,
            geometry: {
              coordinates: [
                [77, 12],
                [77.1, 12.1],
              ],
            },
            legs: [
              {
                steps: [
                  {
                    name: 'Main Road',
                    distance: 100,
                    maneuver: {
                      type: 'turn',
                      modifier: 'left',
                      location: [77, 12],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const controller = new LocationController({
      get: () => 'http://local-router:5000',
    } as any);
    const result = await controller.getBreakdownRoute({
      mechanicLat: 12,
      mechanicLng: 77,
      customerLat: 12.1,
      customerLng: 77.1,
    });
    expect(get.mock.calls[0][0]).toContain(
      'http://local-router:5000/route/v1/driving/77,12;77.1,12.1',
    );
    expect(result).toMatchObject({
      distanceMeters: 2300,
      durationSeconds: 420,
      coordinates: [
        [77, 12],
        [77.1, 12.1],
      ],
      steps: [{ modifier: 'left' }],
    });
  });
  it('returns a route error rather than fabricating a straight-line route', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('offline'));
    const controller = new LocationController({
      get: () => 'http://local-router:5000',
    } as any);
    await expect(
      controller.getBreakdownRoute({
        mechanicLat: 12,
        mechanicLng: 77,
        customerLat: 12.1,
        customerLng: 77.1,
      }),
    ).rejects.toThrow('Failed to fetch route');
  });
});
