import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import axios from 'axios';

export class RouteRequestDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  mechanicLat: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  mechanicLng: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  customerLat: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  customerLng: number;
}

@Controller('api')
@UseGuards(JwtAuthGuard)
export class LocationController {
  private readonly cache = new Map<string, { expires: number; value: any }>();
  private readonly pending = new Map<string, Promise<any>>();
  constructor(private readonly config: ConfigService) {}
  @Post('get-breakdown-route')
  async getBreakdownRoute(@Body() body: RouteRequestDto) {
    const key = [
      body.mechanicLat,
      body.mechanicLng,
      body.customerLat,
      body.customerLng,
    ].join(',');
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = this.fetchRoute(body)
      .then((value) => {
        if (this.cache.size >= 500)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { expires: Date.now() + 30000, value });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async fetchRoute(body: RouteRequestDto) {
    const { mechanicLat, mechanicLng, customerLat, customerLng } = body;

    try {
      const base =
        this.config.get<string>('OSRM_BASE_URL') ||
        'https://router.project-osrm.org';
      const osrmUrl = `${base.replace(/\/$/, '')}/route/v1/driving/${mechanicLng},${mechanicLat};${customerLng},${customerLat}?overview=full&geometries=geojson&steps=true`;
      const response = await axios.get(osrmUrl, { timeout: 8000 });

      if (
        response.data &&
        response.data.routes &&
        response.data.routes.length > 0
      ) {
        const route = response.data.routes[0];

        // Convert distance to KM (from meters) and round to 2 decimal places
        const distanceKM = Number((route.distance / 1000).toFixed(2));

        // Convert duration to minutes (from seconds) and round to 0 decimal places
        const durationMins = Math.round(route.duration / 60);

        return {
          success: true,
          distanceKM,
          durationMins,
          coordinates: route.geometry.coordinates,
          distanceMeters: route.distance,
          durationSeconds: route.duration,
          steps: (route.legs || []).flatMap((leg: any) =>
            (leg.steps || []).map((step: any) => ({
              name: step.name,
              distance: step.distance,
              type: step.maneuver?.type,
              modifier: step.maneuver?.modifier,
              location: step.maneuver?.location,
            })),
          ),
        };
      } else {
        throw new HttpException('No route found', HttpStatus.NOT_FOUND);
      }
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      console.error('OSRM Routing Error:', error.message);
      throw new HttpException(
        'Failed to fetch route from OSRM',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
