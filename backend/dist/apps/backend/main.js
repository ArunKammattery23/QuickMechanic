/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const core_1 = __webpack_require__(1);
const app_module_1 = __webpack_require__(2);
const helmet_1 = __importDefault(__webpack_require__(79));
const express_rate_limit_1 = __webpack_require__(80);
const common_1 = __webpack_require__(3);
const redis_adapter_1 = __webpack_require__(81);
const config_1 = __webpack_require__(4);
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization, Idempotency-Key',
    });
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: false,
    }));
    app.use('/auth', (0, express_rate_limit_1.rateLimit)({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: 'Too many requests from this IP, please try again later.',
    }));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
    }));
    const configService = app.get(config_1.ConfigService);
    const redisUrl = configService.get('REDIS_URL') ||
        `redis://${configService.get('REDIS_HOST') || 'localhost'}:${configService.get('REDIS_PORT') || '6379'}`;
    const redisIoAdapter = new redis_adapter_1.RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis(redisUrl);
    app.useWebSocketAdapter(redisIoAdapter);
    await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("@nestjs/core");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppModule = void 0;
const common_1 = __webpack_require__(3);
const config_1 = __webpack_require__(4);
const core_1 = __webpack_require__(1);
const throttler_1 = __webpack_require__(5);
const schedule_1 = __webpack_require__(6);
const auth_module_1 = __webpack_require__(7);
const users_module_1 = __webpack_require__(28);
const location_module_1 = __webpack_require__(40);
const dispatch_module_1 = __webpack_require__(48);
const notifications_module_1 = __webpack_require__(61);
const services_module_1 = __webpack_require__(63);
const vehicles_module_1 = __webpack_require__(66);
const support_module_1 = __webpack_require__(69);
const database_module_1 = __webpack_require__(73);
const nestjs_redis_1 = __webpack_require__(43);
const http_throttler_guard_1 = __webpack_require__(78);
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
            }),
            nestjs_redis_1.RedisModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    const url = configService.get('REDIS_URL');
                    if (url) {
                        const useTls = url.startsWith('rediss://');
                        const host = (() => { try {
                            return new URL(url).hostname;
                        }
                        catch {
                            return undefined;
                        } })();
                        return {
                            config: {
                                ...(useTls && host ? { tls: { servername: host } } : {}),
                                ...(() => {
                                    const u = new URL(url);
                                    return {
                                        host: u.hostname,
                                        port: Number(u.port) || 6379,
                                        username: decodeURIComponent(u.username) || undefined,
                                        password: decodeURIComponent(u.password) || undefined,
                                    };
                                })(),
                            },
                        };
                    }
                    return {
                        config: {
                            host: configService.get('REDIS_HOST') || 'localhost',
                            port: Number(configService.get('REDIS_PORT')) || 6379,
                            password: configService.get('REDIS_PASSWORD') || undefined,
                            tls: configService.get('REDIS_TLS') === 'true' ? {} : undefined,
                        },
                    };
                },
            }),
            throttler_1.ThrottlerModule.forRoot([{
                    ttl: 60000,
                    limit: 120,
                }]),
            schedule_1.ScheduleModule.forRoot(),
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            location_module_1.LocationModule,
            dispatch_module_1.DispatchModule,
            notifications_module_1.NotificationsModule,
            services_module_1.ServicesModule,
            vehicles_module_1.VehiclesModule,
            support_module_1.SupportModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: http_throttler_guard_1.HttpThrottlerGuard,
            },
        ],
    })
], AppModule);


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("@nestjs/common");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("@nestjs/config");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("@nestjs/throttler");

/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("@nestjs/schedule");

/***/ }),
/* 7 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthModule = void 0;
const common_1 = __webpack_require__(3);
const auth_controller_1 = __webpack_require__(8);
const auth_service_1 = __webpack_require__(9);
const typeorm_1 = __webpack_require__(10);
const jwt_1 = __webpack_require__(21);
const adm_user_entity_1 = __webpack_require__(13);
const provider_user_entity_1 = __webpack_require__(14);
const cust_user_entity_1 = __webpack_require__(15);
const mechanic_profile_entity_1 = __webpack_require__(16);
const config_1 = __webpack_require__(4);
const jwt_auth_guard_1 = __webpack_require__(25);
const ws_jwt_guard_1 = __webpack_require__(26);
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                adm_user_entity_1.AdmUser,
                provider_user_entity_1.ProviderUser,
                cust_user_entity_1.CustUser,
                mechanic_profile_entity_1.MechanicProfile,
            ]),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const secret = config.get('JWT_SECRET');
                    if (!secret && config.get('NODE_ENV') === 'production') {
                        throw new Error('JWT_SECRET is required in production');
                    }
                    return {
                        secret: secret || 'super-secret-key-change-in-prod',
                        signOptions: { expiresIn: '7d' },
                    };
                },
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, jwt_auth_guard_1.JwtAuthGuard, ws_jwt_guard_1.WsJwtGuard],
        exports: [jwt_1.JwtModule, jwt_auth_guard_1.JwtAuthGuard, ws_jwt_guard_1.WsJwtGuard],
    })
], AuthModule);


/***/ }),
/* 8 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthController = void 0;
const common_1 = __webpack_require__(3);
const auth_service_1 = __webpack_require__(9);
const jwt_auth_guard_1 = __webpack_require__(25);
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async registerCustomer(body) {
        const result = await this.authService.registerCustomer(body);
        return { message: 'Customer registered successfully', data: result };
    }
    async registerMechanic(body) {
        const result = await this.authService.registerMechanic(body);
        return { message: 'Mechanic registered successfully (KYC Pending)', data: result };
    }
    async login(body) {
        const result = await this.authService.login(body);
        return { accessToken: result.accessToken, role: result.role };
    }
    async adminLogin(body) {
        return this.authService.adminLogin(body);
    }
    google(body) {
        return this.authService.googleAuthentication(body);
    }
    adminMe(req) { return this.authService.adminMe(req.user); }
    updateAdminMe(req, body) { return this.authService.updateAdminMe(req.user, body); }
    changeAdminPassword(req, body) { return this.authService.changeAdminPassword(req.user, body); }
    async forgotPassword(body) {
        return this.authService.forgotPassword(body.email);
    }
    async resetPassword(body) {
        return this.authService.resetPassword(body);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register/customer'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "registerCustomer", null);
__decorate([
    (0, common_1.Post)('register/mechanic'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "registerMechanic", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('admin-login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "adminLogin", null);
__decorate([
    (0, common_1.Post)('google'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "google", null);
__decorate([
    (0, common_1.Get)('admin/me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "adminMe", null);
__decorate([
    (0, common_1.Patch)('admin/me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "updateAdminMe", null);
__decorate([
    (0, common_1.Patch)('admin/me/password'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changeAdminPassword", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [typeof (_a = typeof auth_service_1.AuthService !== "undefined" && auth_service_1.AuthService) === "function" ? _a : Object])
], AuthController);


/***/ }),
/* 9 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthService = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const typeorm_2 = __webpack_require__(11);
const class_validator_1 = __webpack_require__(12);
const adm_user_entity_1 = __webpack_require__(13);
const provider_user_entity_1 = __webpack_require__(14);
const cust_user_entity_1 = __webpack_require__(15);
const mechanic_profile_entity_1 = __webpack_require__(16);
const google_auth_library_1 = __webpack_require__(20);
const jwt_1 = __webpack_require__(21);
const bcrypt = __importStar(__webpack_require__(22));
const crypto = __importStar(__webpack_require__(23));
const nodemailer = __importStar(__webpack_require__(24));
let AuthService = class AuthService {
    admUserRepository;
    providerUserRepository;
    custUserRepository;
    mechanicRepository;
    jwtService;
    transporter;
    googleClient = new google_auth_library_1.OAuth2Client();
    constructor(admUserRepository, providerUserRepository, custUserRepository, mechanicRepository, jwtService) {
        this.admUserRepository = admUserRepository;
        this.providerUserRepository = providerUserRepository;
        this.custUserRepository = custUserRepository;
        this.mechanicRepository = mechanicRepository;
        this.jwtService = jwtService;
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }
    async googleAuthentication(body) {
        const data = this.googleRequest(body);
        const identity = await this.verifyGoogleIdentity(data.idToken);
        const repository = data.accountType === 'CUSTOMER'
            ? this.custUserRepository
            : this.providerUserRepository;
        const linked = await repository.findOneBy({ googleSubject: identity.subject });
        if (linked)
            return this.googleSession(linked, data.accountType);
        const matches = await repository.find({
            where: { email: (0, typeorm_2.Raw)(alias => `LOWER(${alias}) = :googleEmail`, { googleEmail: identity.email }) },
            take: 2,
        });
        if (matches.length > 1) {
            throw new common_1.ConflictException({ code: 'ACCOUNT_EMAIL_AMBIGUOUS', message: 'More than one existing account uses this email. Contact support before linking Google.' });
        }
        if (matches[0]) {
            const existing = matches[0];
            if (existing.googleSubject) {
                throw this.googleLinkConflict();
            }
            if (!data.linkPassword) {
                throw new common_1.ConflictException({ code: 'ACCOUNT_LINK_REQUIRED', message: 'Enter the existing QuickMechanic password to link this Google account.' });
            }
            if (!await bcrypt.compare(data.linkPassword, existing.passwordHash)) {
                throw new common_1.UnauthorizedException({ code: 'ACCOUNT_LINK_PASSWORD_INVALID', message: 'The existing account password is incorrect.' });
            }
            try {
                const changed = await repository.update({
                    id: existing.id, email: existing.email, googleSubject: (0, typeorm_2.IsNull)(), passwordHash: existing.passwordHash,
                }, { googleSubject: identity.subject });
                if (!changed.affected) {
                    const current = await repository.findOneBy({ id: existing.id });
                    if (current?.googleSubject === identity.subject) {
                        return this.googleSession(current, data.accountType);
                    }
                    throw this.googleLinkConflict();
                }
            }
            catch (error) {
                if (this.isUniqueViolation(error))
                    throw this.googleLinkConflict();
                throw error;
            }
            existing.googleSubject = identity.subject;
            return this.googleSession(existing, data.accountType);
        }
        if (data.intent === 'login') {
            throw new common_1.NotFoundException({ code: 'GOOGLE_ACCOUNT_NOT_REGISTERED', message: 'No account is registered for this Google identity. Create an account first.' });
        }
        const phoneNumber = data.phoneNumber?.trim() ?? '';
        if (!/^\+?[1-9]\d{9,14}$/.test(phoneNumber) || identity.name.length < 2 || identity.name.length > 200) {
            throw new common_1.BadRequestException('A valid 10 to 15 digit mobile number and a name from Google are required');
        }
        if (data.accountType === 'PROVIDER' && !['Mechanic', 'Towing Fleet'].includes(data.providerType ?? '')) {
            throw new common_1.BadRequestException('Choose Mechanic or Towing Fleet for a new provider account');
        }
        const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12);
        const attributes = {
            email: identity.email, name: identity.name, googleSubject: identity.subject,
            phoneNumber, passwordHash,
        };
        const user = data.accountType === 'CUSTOMER'
            ? this.custUserRepository.create({ ...attributes, role: cust_user_entity_1.CustUserRole.CUSTOMER })
            : this.providerUserRepository.create({ ...attributes,
                role: data.providerType === 'Towing Fleet' ? provider_user_entity_1.ProviderUserRole.FLEET_DRIVER : provider_user_entity_1.ProviderUserRole.MECHANIC });
        try {
            if (data.accountType === 'PROVIDER') {
                await this.providerUserRepository.manager.transaction(async (manager) => {
                    await manager.getRepository(provider_user_entity_1.ProviderUser).save(user);
                    const profiles = manager.getRepository(mechanic_profile_entity_1.MechanicProfile);
                    await profiles.save(profiles.create({
                        user: user, kycStatus: mechanic_profile_entity_1.KycStatus.PENDING,
                        kycDocumentsVerified: false, isOnline: false,
                    }));
                });
            }
            else {
                await repository.save(user);
            }
        }
        catch (error) {
            if (this.isUniqueViolation(error)) {
                throw new common_1.ConflictException({ code: 'GOOGLE_SIGN_UP_CONFLICT', message: 'An account already uses this Google identity, email or mobile number. Sign in or contact support.' });
            }
            throw error;
        }
        return this.googleSession(user, data.accountType);
    }
    googleRequest(body) {
        if (!body || typeof body !== 'object')
            throw new common_1.BadRequestException('Invalid Google authentication request');
        const data = body;
        if (typeof data.idToken !== 'string' || !data.idToken.trim() || data.idToken.length > 16384 ||
            !['CUSTOMER', 'PROVIDER'].includes(data.accountType ?? '') ||
            !['login', 'signup'].includes(data.intent ?? '') ||
            (data.phoneNumber !== undefined && typeof data.phoneNumber !== 'string') ||
            (data.providerType !== undefined && !['Mechanic', 'Towing Fleet'].includes(data.providerType)) ||
            (data.linkPassword !== undefined && (typeof data.linkPassword !== 'string' || data.linkPassword.length > 256))) {
            throw new common_1.BadRequestException('A Google ID token, Customer or Provider account type, and login or signup intent are required');
        }
        return data;
    }
    async verifyGoogleIdentity(idToken) {
        const audience = process.env.GOOGLE_WEB_CLIENT_ID?.trim();
        if (!audience) {
            throw new common_1.ServiceUnavailableException({ code: 'GOOGLE_SIGN_IN_NOT_CONFIGURED', message: 'Google sign-in is not configured on this server.' });
        }
        try {
            const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
            const payload = ticket.getPayload();
            if (!payload || payload.aud !== audience || payload.email_verified !== true ||
                typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 || payload.sub.trim() !== payload.sub ||
                typeof payload.email !== 'string' || !(0, class_validator_1.isEmail)(payload.email)) {
                throw new Error('Invalid Google identity claims');
            }
            return {
                subject: payload.sub, email: payload.email.trim().toLowerCase(),
                name: typeof payload.name === 'string' ? payload.name.trim() : '',
            };
        }
        catch (_) {
            throw new common_1.UnauthorizedException({ code: 'GOOGLE_TOKEN_INVALID', message: 'Google sign-in could not be verified. Please sign in with Google again.' });
        }
    }
    async googleSession(user, accountType) {
        const allowedRoles = accountType === 'CUSTOMER' ? [cust_user_entity_1.CustUserRole.CUSTOMER]
            : [provider_user_entity_1.ProviderUserRole.MECHANIC, provider_user_entity_1.ProviderUserRole.FLEET_DRIVER];
        if (!allowedRoles.includes(user.role))
            throw new common_1.ForbiddenException('This account cannot use Google sign-in for the selected app');
        return {
            accessToken: await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role }),
            role: user.role,
        };
    }
    googleLinkConflict() {
        return new common_1.ConflictException({ code: 'ACCOUNT_LINK_CONFLICT', message: 'This account or Google identity has already been linked. Sign in again or contact support.' });
    }
    isUniqueViolation(error) {
        return error instanceof typeorm_2.QueryFailedError && error.driverError.code === '23505';
    }
    async registerCustomer(data) {
        this.validateRegistration(data);
        const existingUser = await this.custUserRepository.findOne({ where: { email: data.email } });
        if (existingUser)
            throw new common_1.ConflictException('Email already in use');
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = this.custUserRepository.create({
            name: data.name || 'Unknown User',
            email: data.email,
            passwordHash: hashedPassword,
            role: cust_user_entity_1.CustUserRole.CUSTOMER,
            phoneNumber: data.phoneNumber,
        });
        try {
            await this.custUserRepository.save(user);
        }
        catch (error) {
            this.registrationError(error);
        }
        return { id: user.id, email: user.email, role: user.role };
    }
    async registerMechanic(data) {
        this.validateRegistration(data);
        if (typeof data.phoneNumber !== 'string' || !/^\+?[1-9]\d{9,14}$/.test(data.phoneNumber.trim())) {
            throw new common_1.BadRequestException('A valid 10 to 15 digit mobile number is required for providers');
        }
        const existingUser = await this.providerUserRepository.findOne({ where: { email: data.email } });
        if (existingUser)
            throw new common_1.ConflictException('Email already in use');
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const role = data.type === 'Towing Fleet' ? provider_user_entity_1.ProviderUserRole.FLEET_DRIVER : provider_user_entity_1.ProviderUserRole.MECHANIC;
        const user = this.providerUserRepository.create({
            name: data.name || 'Unknown Mechanic',
            email: data.email,
            passwordHash: hashedPassword,
            role: role,
            phoneNumber: data.phoneNumber.trim(),
        });
        try {
            await this.providerUserRepository.manager.transaction(async (manager) => {
                await manager.getRepository(provider_user_entity_1.ProviderUser).save(user);
                const profiles = manager.getRepository(mechanic_profile_entity_1.MechanicProfile);
                await profiles.save(profiles.create({ user }));
            });
        }
        catch (error) {
            this.registrationError(error);
        }
        return { id: user.id, email: user.email, role: user.role };
    }
    validateRegistration(data) {
        if (!data || typeof data.email !== 'string' || !(0, class_validator_1.isEmail)(data.email) ||
            typeof data.password !== 'string' || !data.password || data.password.length > 256 ||
            typeof data.phoneNumber !== 'string' || !data.phoneNumber.trim() || data.phoneNumber.length > 64 ||
            (data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 200))) {
            throw new common_1.BadRequestException('A valid email, password and phone number are required');
        }
    }
    registrationError(error) {
        if (error instanceof typeorm_2.QueryFailedError && error.driverError.code === '23505') {
            throw new common_1.ConflictException('Email or phone number already in use');
        }
        throw error;
    }
    async findByIdentifier(repository, raw) {
        const identifier = typeof raw === 'string' ? raw.trim() : '';
        if (!identifier || identifier.length > 200)
            return null;
        const qb = repository.createQueryBuilder('u');
        if (identifier.includes('@')) {
            qb.where('LOWER(u.email) = :v', { v: identifier.toLowerCase() });
        }
        else if (/^\+?[\d\s-]{10,20}$/.test(identifier)) {
            const digits = identifier.replace(/\D/g, '');
            if (digits.length < 10)
                return null;
            qb.where(`RIGHT(regexp_replace(u."phoneNumber", '\\D', '', 'g'), 10) = :v`, { v: digits.slice(-10) });
        }
        else {
            qb.where('LOWER(u.username) = :v', { v: identifier.toLowerCase() });
        }
        const matches = await qb.take(2).getMany();
        return matches.length === 1 ? matches[0] : null;
    }
    async adminLogin(data) {
        if (typeof data?.password !== 'string')
            throw new common_1.UnauthorizedException('Invalid credentials');
        const user = await this.findByIdentifier(this.admUserRepository, data.identifier ?? data.email);
        if (!user || !await bcrypt.compare(data.password, user.passwordHash))
            throw new common_1.UnauthorizedException('Invalid credentials');
        return { accessToken: await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role }), role: user.role };
    }
    async currentAdmin(actor) {
        if (!['SUPER_ADMIN', 'MANAGER', 'CEO'].includes(actor.role))
            throw new common_1.ForbiddenException();
        const admin = await this.admUserRepository.findOneBy({ id: actor.sub });
        if (!admin || admin.role !== actor.role)
            throw new common_1.ForbiddenException('Admin account is no longer active');
        return admin;
    }
    async adminMe(actor) {
        const admin = await this.currentAdmin(actor);
        return { id: admin.id, name: admin.name, email: admin.email, role: admin.role, phoneNumber: admin.phoneNumber };
    }
    async updateAdminMe(actor, body) {
        const admin = await this.currentAdmin(actor);
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const phone = typeof body?.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
        if (name.length < 2 || name.length > 80 || (phone && !/^\+?[1-9]\d{9,14}$/.test(phone)))
            throw new common_1.BadRequestException('Enter a name of 2–80 characters and an optional valid mobile number');
        admin.name = name;
        admin.phoneNumber = phone || null;
        await this.admUserRepository.save(admin);
        return this.adminMe(actor);
    }
    async changeAdminPassword(actor, body) {
        const admin = await this.currentAdmin(actor);
        const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
        const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
        if (!currentPassword || newPassword.length < 8 || newPassword.length > 256)
            throw new common_1.BadRequestException('Current password and a new password of at least 8 characters are required');
        if (!await bcrypt.compare(currentPassword, admin.passwordHash))
            throw new common_1.UnauthorizedException('Current password is incorrect');
        if (currentPassword === newPassword)
            throw new common_1.BadRequestException('Choose a different new password');
        admin.passwordHash = await bcrypt.hash(newPassword, 12);
        await this.admUserRepository.save(admin);
        return { message: 'Password changed' };
    }
    async login(data) {
        const identifier = data?.identifier ?? data?.email;
        if (typeof identifier !== 'string' || typeof data?.password !== 'string' || !identifier.trim() || !data.password)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const repositories = data.accountType === 'CUSTOMER' ? [this.custUserRepository]
            : data.accountType === 'PROVIDER' ? [this.providerUserRepository]
                : [this.custUserRepository, this.providerUserRepository, this.admUserRepository];
        let user = null;
        for (const repository of repositories) {
            user = await this.findByIdentifier(repository, identifier);
            if (user)
                break;
        }
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const isMatch = await bcrypt.compare(data.password, user.passwordHash);
        if (!isMatch)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const payload = { sub: user.id, email: user.email, role: user.role };
        return {
            accessToken: await this.jwtService.signAsync(payload),
            role: user.role,
        };
    }
    async forgotPassword(email) {
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const response = { message: 'If an account exists for that email, a reset token has been sent.' };
        if (!normalizedEmail)
            return response;
        const account = await this.findAccountByEmail(normalizedEmail);
        if (!account)
            return response;
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = this.hashResetToken(resetToken);
        await account.repository.update(account.user.id, {
            resetToken: tokenHash, resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
        });
        const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
        if (!smtpConfigured && process.env.NODE_ENV !== 'production') {
            console.warn(`Password reset token for ${normalizedEmail}: ${resetToken}`);
            return response;
        }
        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: normalizedEmail,
                subject: 'QuickMechanic password reset',
                text: `Your QuickMechanic password reset token is: ${resetToken}\n\nThis token expires in 15 minutes. If you did not request this reset, you can ignore this email.`,
            });
        }
        catch (error) {
            await account.repository.update({ id: account.user.id, resetToken: tokenHash }, {
                resetToken: null, resetTokenExpiry: null,
            });
            console.error('Unable to send password reset email', error);
        }
        return response;
    }
    async resetPassword(data) {
        const token = typeof data?.token === 'string' ? data.token.trim() : '';
        const newPassword = typeof data?.newPassword === 'string' ? data.newPassword : '';
        if (!token || newPassword.length < 8) {
            throw new common_1.UnauthorizedException('Invalid or expired reset token, or password is shorter than 8 characters');
        }
        const tokenHash = this.hashResetToken(token);
        const account = await this.findAccountByResetToken(tokenHash);
        if (!account || !account.user.resetTokenExpiry || account.user.resetTokenExpiry.getTime() <= Date.now()) {
            throw new common_1.UnauthorizedException('Invalid or expired reset token');
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const changed = await account.repository.update({
            id: account.user.id, resetToken: tokenHash, resetTokenExpiry: (0, typeorm_2.MoreThan)(new Date()),
        }, { passwordHash, resetToken: null, resetTokenExpiry: null });
        if (!changed.affected)
            throw new common_1.UnauthorizedException('Invalid or expired reset token');
        return { message: 'Password reset successful' };
    }
    hashResetToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    async findAccountByEmail(email) {
        const repositories = [
            this.custUserRepository,
            this.providerUserRepository,
            this.admUserRepository,
        ];
        for (const repository of repositories) {
            const user = await repository.findOne({ where: { email } });
            if (user)
                return { repository, user };
        }
        return null;
    }
    async findAccountByResetToken(resetToken) {
        const repositories = [
            this.custUserRepository,
            this.providerUserRepository,
            this.admUserRepository,
        ];
        for (const repository of repositories) {
            const user = await repository.findOne({ where: { resetToken } });
            if (user)
                return { repository, user };
        }
        return null;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(adm_user_entity_1.AdmUser)),
    __param(1, (0, typeorm_1.InjectRepository)(provider_user_entity_1.ProviderUser)),
    __param(2, (0, typeorm_1.InjectRepository)(cust_user_entity_1.CustUser)),
    __param(3, (0, typeorm_1.InjectRepository)(mechanic_profile_entity_1.MechanicProfile)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object, typeof (_c = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _c : Object, typeof (_d = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _d : Object, typeof (_e = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _e : Object])
], AuthService);


/***/ }),
/* 10 */
/***/ ((module) => {

module.exports = require("@nestjs/typeorm");

/***/ }),
/* 11 */
/***/ ((module) => {

module.exports = require("typeorm");

/***/ }),
/* 12 */
/***/ ((module) => {

module.exports = require("class-validator");

/***/ }),
/* 13 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AdmUser = exports.AdmUserRole = void 0;
const typeorm_1 = __webpack_require__(11);
var AdmUserRole;
(function (AdmUserRole) {
    AdmUserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    AdmUserRole["MANAGER"] = "MANAGER";
    AdmUserRole["CEO"] = "CEO";
    AdmUserRole["DEVELOPER"] = "DEVELOPER";
})(AdmUserRole || (exports.AdmUserRole = AdmUserRole = {}));
let AdmUser = class AdmUser {
    id;
    name;
    email;
    username;
    passwordHash;
    role;
    phoneNumber;
    resetToken;
    resetTokenExpiry;
    createdAt;
    updatedAt;
};
exports.AdmUser = AdmUser;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AdmUser.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Unknown' }),
    __metadata("design:type", String)
], AdmUser.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], AdmUser.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, unique: true, nullable: true }),
    __metadata("design:type", Object)
], AdmUser.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AdmUser.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: AdmUserRole,
        default: AdmUserRole.MANAGER,
    }),
    __metadata("design:type", String)
], AdmUser.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', unique: true, nullable: true }),
    __metadata("design:type", Object)
], AdmUser.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AdmUser.prototype, "resetToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], AdmUser.prototype, "resetTokenExpiry", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], AdmUser.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_c = typeof Date !== "undefined" && Date) === "function" ? _c : Object)
], AdmUser.prototype, "updatedAt", void 0);
exports.AdmUser = AdmUser = __decorate([
    (0, typeorm_1.Entity)('ADM_USER')
], AdmUser);


/***/ }),
/* 14 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProviderUser = exports.ProviderUserRole = void 0;
const typeorm_1 = __webpack_require__(11);
var ProviderUserRole;
(function (ProviderUserRole) {
    ProviderUserRole["MECHANIC"] = "MECHANIC";
    ProviderUserRole["FLEET_DRIVER"] = "FLEET_DRIVER";
})(ProviderUserRole || (exports.ProviderUserRole = ProviderUserRole = {}));
let ProviderUser = class ProviderUser {
    id;
    name;
    email;
    username;
    googleSubject;
    passwordHash;
    role;
    phoneNumber;
    resetToken;
    resetTokenExpiry;
    createdAt;
    updatedAt;
};
exports.ProviderUser = ProviderUser;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProviderUser.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Unknown' }),
    __metadata("design:type", String)
], ProviderUser.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ProviderUser.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, unique: true, nullable: true }),
    __metadata("design:type", Object)
], ProviderUser.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Index)('UQ_PROVIDER_USER_googleSubject', { unique: true }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], ProviderUser.prototype, "googleSubject", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProviderUser.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ProviderUserRole,
        default: ProviderUserRole.MECHANIC,
    }),
    __metadata("design:type", String)
], ProviderUser.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ProviderUser.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProviderUser.prototype, "resetToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], ProviderUser.prototype, "resetTokenExpiry", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], ProviderUser.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_c = typeof Date !== "undefined" && Date) === "function" ? _c : Object)
], ProviderUser.prototype, "updatedAt", void 0);
exports.ProviderUser = ProviderUser = __decorate([
    (0, typeorm_1.Entity)('PROVIDER_USER')
], ProviderUser);


/***/ }),
/* 15 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CustUser = exports.CustUserRole = void 0;
const typeorm_1 = __webpack_require__(11);
var CustUserRole;
(function (CustUserRole) {
    CustUserRole["CUSTOMER"] = "CUSTOMER";
})(CustUserRole || (exports.CustUserRole = CustUserRole = {}));
let CustUser = class CustUser {
    id;
    name;
    email;
    username;
    googleSubject;
    passwordHash;
    role;
    phoneNumber;
    resetToken;
    resetTokenExpiry;
    createdAt;
    updatedAt;
};
exports.CustUser = CustUser;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CustUser.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Unknown' }),
    __metadata("design:type", String)
], CustUser.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], CustUser.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, unique: true, nullable: true }),
    __metadata("design:type", Object)
], CustUser.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Index)('UQ_CUST_USER_googleSubject', { unique: true }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], CustUser.prototype, "googleSubject", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CustUser.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: CustUserRole,
        default: CustUserRole.CUSTOMER,
    }),
    __metadata("design:type", String)
], CustUser.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], CustUser.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], CustUser.prototype, "resetToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], CustUser.prototype, "resetTokenExpiry", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], CustUser.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_c = typeof Date !== "undefined" && Date) === "function" ? _c : Object)
], CustUser.prototype, "updatedAt", void 0);
exports.CustUser = CustUser = __decorate([
    (0, typeorm_1.Entity)('CUST_USER')
], CustUser);


/***/ }),
/* 16 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MechanicProfile = exports.KycStatus = void 0;
const typeorm_1 = __webpack_require__(11);
const provider_user_entity_1 = __webpack_require__(14);
const service_type_entity_1 = __webpack_require__(17);
const vehicle_category_entity_1 = __webpack_require__(18);
const badge_entity_1 = __webpack_require__(19);
var KycStatus;
(function (KycStatus) {
    KycStatus["PENDING"] = "PENDING";
    KycStatus["APPROVED"] = "APPROVED";
    KycStatus["REJECTED"] = "REJECTED";
})(KycStatus || (exports.KycStatus = KycStatus = {}));
let MechanicProfile = class MechanicProfile {
    id;
    user;
    kycStatus;
    kycDocumentsVerified;
    isOnline;
    lastSeenAt;
    providedServices;
    supportedVehicles;
    reputationPoints;
    completedJobsCount;
    hasPremiumSubscription;
    fiveStarReviewsCount;
    earnedBadges;
    currentLocation;
    walletBalance;
    lastWithdrawalDate;
    distanceText;
    distanceValue;
};
exports.MechanicProfile = MechanicProfile;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MechanicProfile.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => provider_user_entity_1.ProviderUser),
    (0, typeorm_1.JoinColumn)(),
    __metadata("design:type", typeof (_a = typeof provider_user_entity_1.ProviderUser !== "undefined" && provider_user_entity_1.ProviderUser) === "function" ? _a : Object)
], MechanicProfile.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: KycStatus,
        default: KycStatus.PENDING,
    }),
    __metadata("design:type", String)
], MechanicProfile.prototype, "kycStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], MechanicProfile.prototype, "kycDocumentsVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], MechanicProfile.prototype, "isOnline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], MechanicProfile.prototype, "lastSeenAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => service_type_entity_1.ServiceType, { cascade: true, eager: true }),
    (0, typeorm_1.JoinTable)({
        name: 'mechanic_services',
        joinColumn: { name: 'mechanic_profile_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'service_type_id', referencedColumnName: 'id' },
    }),
    __metadata("design:type", Array)
], MechanicProfile.prototype, "providedServices", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => vehicle_category_entity_1.VehicleCategory, { cascade: true, eager: true }),
    (0, typeorm_1.JoinTable)({
        name: 'mechanic_vehicles',
        joinColumn: { name: 'mechanic_profile_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'vehicle_category_id', referencedColumnName: 'id' },
    }),
    __metadata("design:type", Array)
], MechanicProfile.prototype, "supportedVehicles", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 100 }),
    __metadata("design:type", Number)
], MechanicProfile.prototype, "reputationPoints", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MechanicProfile.prototype, "completedJobsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], MechanicProfile.prototype, "hasPremiumSubscription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MechanicProfile.prototype, "fiveStarReviewsCount", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => badge_entity_1.Badge),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], MechanicProfile.prototype, "earnedBadges", void 0);
__decorate([
    (0, typeorm_1.Index)({ spatial: true }),
    (0, typeorm_1.Column)({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    }),
    __metadata("design:type", String)
], MechanicProfile.prototype, "currentLocation", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MechanicProfile.prototype, "walletBalance", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", typeof (_c = typeof Date !== "undefined" && Date) === "function" ? _c : Object)
], MechanicProfile.prototype, "lastWithdrawalDate", void 0);
exports.MechanicProfile = MechanicProfile = __decorate([
    (0, typeorm_1.Entity)('mechanic_profiles')
], MechanicProfile);


/***/ }),
/* 17 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServiceType = void 0;
const typeorm_1 = __webpack_require__(11);
let ServiceType = class ServiceType {
    id;
    name;
    description;
    isActive;
    createdAt;
    updatedAt;
};
exports.ServiceType = ServiceType;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ServiceType.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ServiceType.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ServiceType.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ServiceType.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], ServiceType.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], ServiceType.prototype, "updatedAt", void 0);
exports.ServiceType = ServiceType = __decorate([
    (0, typeorm_1.Entity)('service_types')
], ServiceType);


/***/ }),
/* 18 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VehicleCategory = void 0;
const typeorm_1 = __webpack_require__(11);
let VehicleCategory = class VehicleCategory {
    id;
    group;
    name;
    description;
    isPremiumTier;
    isActive;
    createdAt;
    updatedAt;
};
exports.VehicleCategory = VehicleCategory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VehicleCategory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], VehicleCategory.prototype, "group", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], VehicleCategory.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], VehicleCategory.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], VehicleCategory.prototype, "isPremiumTier", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], VehicleCategory.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], VehicleCategory.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], VehicleCategory.prototype, "updatedAt", void 0);
exports.VehicleCategory = VehicleCategory = __decorate([
    (0, typeorm_1.Entity)('vehicle_categories')
], VehicleCategory);


/***/ }),
/* 19 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Badge = exports.BadgeCriteriaType = void 0;
const typeorm_1 = __webpack_require__(11);
var BadgeCriteriaType;
(function (BadgeCriteriaType) {
    BadgeCriteriaType["COMPLETED_JOBS"] = "COMPLETED_JOBS";
    BadgeCriteriaType["FIVE_STAR_REVIEWS"] = "FIVE_STAR_REVIEWS";
    BadgeCriteriaType["YEARS_ACTIVE"] = "YEARS_ACTIVE";
    BadgeCriteriaType["VERIFIED_KYC"] = "VERIFIED_KYC";
})(BadgeCriteriaType || (exports.BadgeCriteriaType = BadgeCriteriaType = {}));
let Badge = class Badge {
    id;
    name;
    description;
    icon;
    criteriaType;
    criteriaValue;
    createdAt;
};
exports.Badge = Badge;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Badge.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Badge.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Badge.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Badge.prototype, "icon", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: BadgeCriteriaType,
    }),
    __metadata("design:type", String)
], Badge.prototype, "criteriaType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], Badge.prototype, "criteriaValue", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], Badge.prototype, "createdAt", void 0);
exports.Badge = Badge = __decorate([
    (0, typeorm_1.Entity)('badges')
], Badge);


/***/ }),
/* 20 */
/***/ ((module) => {

module.exports = require("google-auth-library");

/***/ }),
/* 21 */
/***/ ((module) => {

module.exports = require("@nestjs/jwt");

/***/ }),
/* 22 */
/***/ ((module) => {

module.exports = require("bcryptjs");

/***/ }),
/* 23 */
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),
/* 24 */
/***/ ((module) => {

module.exports = require("nodemailer");

/***/ }),
/* 25 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JwtAuthGuard = void 0;
const common_1 = __webpack_require__(3);
const jwt_1 = __webpack_require__(21);
let JwtAuthGuard = class JwtAuthGuard {
    jwt;
    constructor(jwt) {
        this.jwt = jwt;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const header = req.headers.authorization;
        if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Missing token');
        }
        try {
            req.user = await this.jwt.verifyAsync(header.slice(7));
            if (!req.user.sub || !req.user.role)
                throw new Error('Missing identity');
            return true;
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _a : Object])
], JwtAuthGuard);


/***/ }),
/* 26 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WsJwtGuard = void 0;
const common_1 = __webpack_require__(3);
const jwt_1 = __webpack_require__(21);
const websockets_1 = __webpack_require__(27);
let WsJwtGuard = class WsJwtGuard {
    jwtService;
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    async canActivate(context) {
        try {
            const client = context.switchToWs().getClient();
            let token;
            const authHeader = client.handshake.headers.authorization;
            if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
                token = authHeader.split(' ')[1];
            }
            else if (client.handshake.auth && client.handshake.auth.token) {
                token = client.handshake.auth.token;
            }
            if (!token) {
                throw new common_1.UnauthorizedException('Missing token');
            }
            const payload = await this.jwtService.verifyAsync(token);
            if (!payload.sub || !payload.role)
                throw new Error('Missing identity');
            client.user = payload;
            return true;
        }
        catch (err) {
            throw new websockets_1.WsException('Invalid or expired token');
        }
    }
};
exports.WsJwtGuard = WsJwtGuard;
exports.WsJwtGuard = WsJwtGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _a : Object])
], WsJwtGuard);


/***/ }),
/* 27 */
/***/ ((module) => {

module.exports = require("@nestjs/websockets");

/***/ }),
/* 28 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UsersModule = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const adm_user_entity_1 = __webpack_require__(13);
const provider_user_entity_1 = __webpack_require__(14);
const cust_user_entity_1 = __webpack_require__(15);
const mechanic_profile_entity_1 = __webpack_require__(16);
const mechanic_pricing_entity_1 = __webpack_require__(29);
const service_request_entity_1 = __webpack_require__(30);
const invoice_entity_1 = __webpack_require__(31);
const vehicle_category_entity_1 = __webpack_require__(18);
const provider_kyc_submission_entity_1 = __webpack_require__(32);
const users_controller_1 = __webpack_require__(33);
const users_service_1 = __webpack_require__(35);
const auth_module_1 = __webpack_require__(7);
let UsersModule = class UsersModule {
};
exports.UsersModule = UsersModule;
exports.UsersModule = UsersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            typeorm_1.TypeOrmModule.forFeature([
                adm_user_entity_1.AdmUser,
                provider_user_entity_1.ProviderUser,
                cust_user_entity_1.CustUser,
                mechanic_profile_entity_1.MechanicProfile,
                mechanic_pricing_entity_1.MechanicPricing,
                service_request_entity_1.ServiceRequest,
                invoice_entity_1.Invoice,
                vehicle_category_entity_1.VehicleCategory,
                provider_kyc_submission_entity_1.ProviderKycSubmission,
            ]),
        ],
        controllers: [users_controller_1.UsersController],
        providers: [users_service_1.UsersService],
    })
], UsersModule);


/***/ }),
/* 29 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MechanicPricing = void 0;
const typeorm_1 = __webpack_require__(11);
const mechanic_profile_entity_1 = __webpack_require__(16);
const service_type_entity_1 = __webpack_require__(17);
const vehicle_category_entity_1 = __webpack_require__(18);
let MechanicPricing = class MechanicPricing {
    id;
    mechanicProfile;
    serviceType;
    vehicleCategory;
    price;
};
exports.MechanicPricing = MechanicPricing;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MechanicPricing.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => mechanic_profile_entity_1.MechanicProfile, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'mechanic_profile_id' }),
    __metadata("design:type", typeof (_a = typeof mechanic_profile_entity_1.MechanicProfile !== "undefined" && mechanic_profile_entity_1.MechanicProfile) === "function" ? _a : Object)
], MechanicPricing.prototype, "mechanicProfile", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => service_type_entity_1.ServiceType, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'service_type_id' }),
    __metadata("design:type", typeof (_b = typeof service_type_entity_1.ServiceType !== "undefined" && service_type_entity_1.ServiceType) === "function" ? _b : Object)
], MechanicPricing.prototype, "serviceType", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vehicle_category_entity_1.VehicleCategory, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'vehicle_category_id' }),
    __metadata("design:type", typeof (_c = typeof vehicle_category_entity_1.VehicleCategory !== "undefined" && vehicle_category_entity_1.VehicleCategory) === "function" ? _c : Object)
], MechanicPricing.prototype, "vehicleCategory", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], MechanicPricing.prototype, "price", void 0);
exports.MechanicPricing = MechanicPricing = __decorate([
    (0, typeorm_1.Entity)('mechanic_pricing'),
    (0, typeorm_1.Unique)(['mechanicProfile', 'serviceType', 'vehicleCategory'])
], MechanicPricing);


/***/ }),
/* 30 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServiceRequest = exports.JobStatus = void 0;
const typeorm_1 = __webpack_require__(11);
const cust_user_entity_1 = __webpack_require__(15);
const provider_user_entity_1 = __webpack_require__(14);
var JobStatus;
(function (JobStatus) {
    JobStatus["REQUESTED"] = "REQUESTED";
    JobStatus["ACCEPTED"] = "ACCEPTED";
    JobStatus["AWAITING_PAYMENT"] = "AWAITING_PAYMENT";
    JobStatus["PAYMENT_SECURED"] = "PAYMENT_SECURED";
    JobStatus["EN_ROUTE"] = "EN_ROUTE";
    JobStatus["AWAITING_CUSTOMER_CONFIRMATION"] = "AWAITING_CUSTOMER_CONFIRMATION";
    JobStatus["COMPLETED"] = "COMPLETED";
    JobStatus["CANCELLED"] = "CANCELLED";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
let ServiceRequest = class ServiceRequest {
    id;
    customer;
    mechanic;
    status;
    serviceType;
    vehicleCategoryId;
    autoQuotePreparedAt;
    routeDistanceMeters;
    breakdownLocation;
    distanceInKm;
    travelingCharge;
    serviceCharge;
    totalAmount;
    pricingRevision;
    commissionBps;
    commissionMinor;
    platformFeeMinor;
    providerNetMinor;
    paymentMode;
    completionOtp;
    customerRating;
    providerAcceptedAt;
    customerAcceptedAt;
    confirmedAt;
    completionRequestedAt;
    completedAt;
    cancellationReason;
    cancelledBy;
    razorpayLinkId;
    checkoutUrl;
    createdAt;
    updatedAt;
};
exports.ServiceRequest = ServiceRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ServiceRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => cust_user_entity_1.CustUser),
    __metadata("design:type", typeof (_a = typeof cust_user_entity_1.CustUser !== "undefined" && cust_user_entity_1.CustUser) === "function" ? _a : Object)
], ServiceRequest.prototype, "customer", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => provider_user_entity_1.ProviderUser, { nullable: true }),
    __metadata("design:type", typeof (_b = typeof provider_user_entity_1.ProviderUser !== "undefined" && provider_user_entity_1.ProviderUser) === "function" ? _b : Object)
], ServiceRequest.prototype, "mechanic", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: JobStatus,
        default: JobStatus.REQUESTED,
    }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ServiceRequest.prototype, "serviceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "vehicleCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "autoQuotePreparedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "routeDistanceMeters", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
    }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "breakdownLocation", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ServiceRequest.prototype, "distanceInKm", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ServiceRequest.prototype, "travelingCharge", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ServiceRequest.prototype, "serviceCharge", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ServiceRequest.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "pricingRevision", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ServiceRequest.prototype, "commissionBps", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: '0' }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "commissionMinor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: '0' }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "platformFeeMinor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "providerNetMinor", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'live' }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "paymentMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, length: 4 }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "completionOtp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "customerRating", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "providerAcceptedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "customerAcceptedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "confirmedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "completionRequestedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "cancellationReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "cancelledBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "razorpayLinkId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "checkoutUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_j = typeof Date !== "undefined" && Date) === "function" ? _j : Object)
], ServiceRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_k = typeof Date !== "undefined" && Date) === "function" ? _k : Object)
], ServiceRequest.prototype, "updatedAt", void 0);
exports.ServiceRequest = ServiceRequest = __decorate([
    (0, typeorm_1.Entity)('service_requests'),
    (0, typeorm_1.Index)('idx_provider_status', ['mechanic', 'status']),
    (0, typeorm_1.Index)('idx_provider_job_history', ['mechanic', 'createdAt', 'id']),
    (0, typeorm_1.Index)('idx_customer_job_history', ['customer', 'createdAt', 'id'])
], ServiceRequest);


/***/ }),
/* 31 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Invoice = exports.PaymentStatus = void 0;
const typeorm_1 = __webpack_require__(11);
const service_request_entity_1 = __webpack_require__(30);
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["PAID"] = "PAID";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
let Invoice = class Invoice {
    id;
    serviceRequest;
    baseFee;
    distanceCharge;
    platformCommission;
    weatherSurcharge;
    totalAmount;
    paymentStatus;
};
exports.Invoice = Invoice;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Invoice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => service_request_entity_1.ServiceRequest),
    (0, typeorm_1.JoinColumn)(),
    __metadata("design:type", typeof (_a = typeof service_request_entity_1.ServiceRequest !== "undefined" && service_request_entity_1.ServiceRequest) === "function" ? _a : Object)
], Invoice.prototype, "serviceRequest", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Invoice.prototype, "baseFee", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Invoice.prototype, "distanceCharge", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0.00 }),
    __metadata("design:type", Number)
], Invoice.prototype, "platformCommission", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0.00 }),
    __metadata("design:type", Number)
], Invoice.prototype, "weatherSurcharge", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Invoice.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    }),
    __metadata("design:type", String)
], Invoice.prototype, "paymentStatus", void 0);
exports.Invoice = Invoice = __decorate([
    (0, typeorm_1.Entity)('invoices')
], Invoice);


/***/ }),
/* 32 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProviderKycSubmission = void 0;
const typeorm_1 = __webpack_require__(11);
let ProviderKycSubmission = class ProviderKycSubmission {
    providerId;
    idType;
    address;
    secondaryPhone;
    frontImage;
    backImage;
    frontMime;
    backMime;
    submittedAt;
    reviewedAt;
    reviewedById;
};
exports.ProviderKycSubmission = ProviderKycSubmission;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], ProviderKycSubmission.prototype, "providerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 32 }),
    __metadata("design:type", String)
], ProviderKycSubmission.prototype, "idType", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 500 }),
    __metadata("design:type", String)
], ProviderKycSubmission.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 16 }),
    __metadata("design:type", String)
], ProviderKycSubmission.prototype, "secondaryPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bytea', select: false }),
    __metadata("design:type", typeof (_a = typeof Buffer !== "undefined" && Buffer) === "function" ? _a : Object)
], ProviderKycSubmission.prototype, "frontImage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bytea', select: false }),
    __metadata("design:type", typeof (_b = typeof Buffer !== "undefined" && Buffer) === "function" ? _b : Object)
], ProviderKycSubmission.prototype, "backImage", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 16 }),
    __metadata("design:type", String)
], ProviderKycSubmission.prototype, "frontMime", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 16 }),
    __metadata("design:type", String)
], ProviderKycSubmission.prototype, "backMime", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", typeof (_c = typeof Date !== "undefined" && Date) === "function" ? _c : Object)
], ProviderKycSubmission.prototype, "submittedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ProviderKycSubmission.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProviderKycSubmission.prototype, "reviewedById", void 0);
exports.ProviderKycSubmission = ProviderKycSubmission = __decorate([
    (0, typeorm_1.Entity)('provider_kyc_submissions')
], ProviderKycSubmission);


/***/ }),
/* 33 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UsersController = void 0;
const common_1 = __webpack_require__(3);
const platform_express_1 = __webpack_require__(34);
const jwt_auth_guard_1 = __webpack_require__(25);
const users_service_1 = __webpack_require__(35);
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    me(req) { return this.usersService.me(req.user); }
    updateMyMobile(req, phoneNumber) {
        if (!['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        return this.usersService.updateMyMobile(req.user.sub, phoneNumber);
    }
    myKyc(req) {
        if (!['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        return this.usersService.myKyc(req.user.sub);
    }
    submitMyKyc(req, body, files) {
        if (!['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        return this.usersService.submitMyKyc(req.user.sub, body, files);
    }
    async getPendingMechanics(req) {
        if (!['SUPER_ADMIN', 'MANAGER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        return this.usersService.getPendingKycMechanics();
    }
    async updateKycStatus(req, id, status, submittedAt) {
        if (!['SUPER_ADMIN', 'MANAGER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        return this.usersService.updateKycStatus(id, status, req.user.sub, submittedAt);
    }
    async kycDocument(req, id, side, response) {
        if (!['SUPER_ADMIN', 'MANAGER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        const image = await this.usersService.kycImage(id, side);
        response.setHeader('Content-Type', image.mime);
        response.setHeader('Cache-Control', 'no-store, private');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.send(image.bytes);
    }
    async toggleOnlineStatus(req, id, body) {
        if (req.user.sub !== id || !['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        if (typeof body.isOnline !== 'boolean' || (body.isOnline && (!Number.isFinite(body.lat) || !Number.isFinite(body.lng) || Math.abs(body.lat) > 90 || Math.abs(body.lng) > 180)))
            throw new common_1.BadRequestException('Valid online status and location required');
        return this.usersService.toggleOnlineStatus(id, body.isOnline, body.lat, body.lng);
    }
    async updateServicesProvided(req, id, services) {
        if (req.user.sub !== id || !['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        if (!Array.isArray(services) || !services.every(s => typeof s === 'string'))
            throw new common_1.BadRequestException('Service IDs are required');
        return this.usersService.updateServicesProvided(id, services);
    }
    async updateConfig(req, id, data) {
        if (req.user.sub !== id || !['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        return this.usersService.updateConfig(id, data);
    }
    async getConfig(id) {
        return this.usersService.getConfig(id);
    }
    async getDailyStats(id, req) {
        if (req.user.sub !== id && !['SUPER_ADMIN', 'MANAGER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        return this.usersService.getDailyStats(id);
    }
    async pendingRequests(id, req) {
        if (req.user.sub !== id || !['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role))
            throw new common_1.ForbiddenException();
        return this.usersService.pendingRequests(id);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('me/mobile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('phoneNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateMyMobile", null);
__decorate([
    (0, common_1.Get)('me/kyc'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "myKyc", null);
__decorate([
    (0, common_1.Post)('me/kyc'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }], { limits: { fileSize: 2 * 1024 * 1024, files: 2, fields: 3, parts: 8 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "submitMyKyc", null);
__decorate([
    (0, common_1.Get)('mechanics/pending'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getPendingMechanics", null);
__decorate([
    (0, common_1.Patch)('mechanics/:id/kyc'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('status')),
    __param(3, (0, common_1.Body)('submittedAt')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateKycStatus", null);
__decorate([
    (0, common_1.Get)('mechanics/:id/kyc/document/:side'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('side')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "kycDocument", null);
__decorate([
    (0, common_1.Patch)('mechanics/:id/status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "toggleOnlineStatus", null);
__decorate([
    (0, common_1.Patch)('mechanics/:id/services'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('services')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Array]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateServicesProvided", null);
__decorate([
    (0, common_1.Patch)('mechanics/:id/config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Get)('mechanics/:id/config'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Get)('mechanics/:id/stats/daily'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getDailyStats", null);
__decorate([
    (0, common_1.Get)('mechanics/:id/requests'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "pendingRequests", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [typeof (_a = typeof users_service_1.UsersService !== "undefined" && users_service_1.UsersService) === "function" ? _a : Object])
], UsersController);


/***/ }),
/* 34 */
/***/ ((module) => {

module.exports = require("@nestjs/platform-express");

/***/ }),
/* 35 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var UsersService_1;
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UsersService = void 0;
const performance_1 = __webpack_require__(36);
const provider_kyc_submission_entity_1 = __webpack_require__(32);
const provider_eligibility_1 = __webpack_require__(37);
const class_validator_1 = __webpack_require__(12);
const service_type_entity_1 = __webpack_require__(17);
const money_1 = __webpack_require__(38);
const common_1 = __webpack_require__(3);
const cust_user_entity_1 = __webpack_require__(15);
const mechanic_profile_entity_1 = __webpack_require__(16);
const payment_ledger_entity_1 = __webpack_require__(39);
const typeorm_1 = __webpack_require__(10);
const typeorm_2 = __webpack_require__(11);
const provider_user_entity_1 = __webpack_require__(14);
const mechanic_profile_entity_2 = __webpack_require__(16);
const mechanic_pricing_entity_1 = __webpack_require__(29);
const service_request_entity_1 = __webpack_require__(30);
const invoice_entity_1 = __webpack_require__(31);
const vehicle_category_entity_1 = __webpack_require__(18);
const typeorm_3 = __webpack_require__(11);
const common_2 = __webpack_require__(3);
let UsersService = UsersService_1 = class UsersService {
    usersRepository;
    mechanicRepository;
    pricingRepository;
    serviceRequestRepository;
    invoiceRepository;
    vehicleCategoryRepository;
    kycRepository;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(usersRepository, mechanicRepository, pricingRepository, serviceRequestRepository, invoiceRepository, vehicleCategoryRepository, kycRepository) {
        this.usersRepository = usersRepository;
        this.mechanicRepository = mechanicRepository;
        this.pricingRepository = pricingRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.invoiceRepository = invoiceRepository;
        this.vehicleCategoryRepository = vehicleCategoryRepository;
        this.kycRepository = kycRepository;
    }
    async getPendingKycMechanics() {
        const submissions = await this.kycRepository.find({ where: { reviewedAt: (0, typeorm_2.IsNull)() }, order: { submittedAt: 'ASC' }, take: 100 });
        if (!submissions.length)
            return [];
        const ids = submissions.map(s => s.providerId);
        const users = await this.usersRepository.findBy({ id: (0, typeorm_3.In)(ids) });
        const byId = new Map(users.map(user => [user.id, user]));
        return submissions.filter(s => byId.has(s.providerId)).map(s => ({
            id: s.providerId, name: byId.get(s.providerId).name,
            email: byId.get(s.providerId).email, phoneNumber: byId.get(s.providerId).phoneNumber,
            idType: s.idType, address: s.address, secondaryPhone: s.secondaryPhone,
            submittedAt: s.submittedAt, kycStatus: mechanic_profile_entity_1.KycStatus.PENDING,
        }));
    }
    async updateKycStatus(mechanicId, status, adminId, expectedSubmittedAt) {
        if (!Object.values(mechanic_profile_entity_1.KycStatus).includes(status))
            throw new common_1.BadRequestException('Invalid KYC status');
        return this.mechanicRepository.manager.transaction(async (manager) => {
            const profile = await manager.getRepository(mechanic_profile_entity_2.MechanicProfile).createQueryBuilder('profile')
                .innerJoinAndSelect('profile.user', 'user').where('user.id = :mechanicId', { mechanicId })
                .setLock('pessimistic_write').getOne();
            if (!profile)
                throw new common_1.NotFoundException('Provider not found');
            const submission = await manager.getRepository(provider_kyc_submission_entity_1.ProviderKycSubmission).findOneBy({ providerId: mechanicId });
            if (!submission || !expectedSubmittedAt || submission.submittedAt.toISOString() !== expectedSubmittedAt) {
                throw new common_1.BadRequestException('KYC submission changed. Refresh and review the latest photos.');
            }
            if (status === mechanic_profile_entity_1.KycStatus.APPROVED && (!submission || !(0, provider_eligibility_1.validProviderMobile)(profile.user.phoneNumber))) {
                throw new common_1.BadRequestException('A submitted ID card and valid mobile number are required before KYC approval');
            }
            profile.kycStatus = status;
            profile.kycDocumentsVerified = status === mechanic_profile_entity_1.KycStatus.APPROVED;
            if (status !== mechanic_profile_entity_1.KycStatus.APPROVED) {
                profile.isOnline = false;
                profile.lastSeenAt = null;
            }
            await manager.getRepository(mechanic_profile_entity_2.MechanicProfile).save(profile);
            if (submission)
                await manager.getRepository(provider_kyc_submission_entity_1.ProviderKycSubmission).update(mechanicId, {
                    reviewedAt: status === mechanic_profile_entity_1.KycStatus.PENDING ? null : new Date(),
                    reviewedById: status === mechanic_profile_entity_1.KycStatus.PENDING ? null : adminId,
                });
            return { success: true, message: 'KYC status updated' };
        });
    }
    imageMime(file) {
        const bytes = file?.buffer;
        if (!bytes || bytes.length < 1024 || bytes.length > 2 * 1024 * 1024)
            throw new common_1.BadRequestException('Each ID image must be 1 KB to 2 MB');
        const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const mime = jpeg ? 'image/jpeg' : png ? 'image/png' : null;
        if (!mime || file.mimetype !== mime)
            throw new common_1.BadRequestException('Upload JPEG or PNG ID photos only');
        return mime;
    }
    async submitMyKyc(providerId, fields, files) {
        const allowed = ['AADHAAR', 'DRIVING_LICENCE', 'VOTER_ID', 'PASSPORT', 'OTHER'];
        const idType = fields?.idType;
        const address = typeof fields?.address === 'string' ? fields.address.trim() : '';
        const secondaryPhone = typeof fields?.secondaryPhone === 'string' ? fields.secondaryPhone.trim() : '';
        if (!allowed.includes(idType) || address.length < 15 || address.length > 500 || !(0, provider_eligibility_1.validProviderMobile)(secondaryPhone)) {
            throw new common_1.BadRequestException('Select an ID type, enter a full address and a valid secondary number');
        }
        const front = files?.front?.[0], back = files?.back?.[0];
        const frontMime = this.imageMime(front), backMime = this.imageMime(back);
        return this.mechanicRepository.manager.transaction(async (manager) => {
            const profile = await manager.getRepository(mechanic_profile_entity_2.MechanicProfile).createQueryBuilder('profile')
                .innerJoinAndSelect('profile.user', 'user').where('user.id = :providerId', { providerId })
                .setLock('pessimistic_write').getOne();
            if (!profile)
                throw new common_1.NotFoundException('Provider not found');
            if (!(0, provider_eligibility_1.validProviderMobile)(profile.user.phoneNumber))
                throw new common_1.BadRequestException('Add your primary mobile number before submitting KYC');
            if (secondaryPhone === profile.user.phoneNumber)
                throw new common_1.BadRequestException('Secondary number must differ from primary mobile');
            if (profile.kycStatus === mechanic_profile_entity_1.KycStatus.APPROVED && profile.kycDocumentsVerified)
                throw new common_1.BadRequestException('Approved KYC cannot be replaced; contact support');
            await manager.getRepository(provider_kyc_submission_entity_1.ProviderKycSubmission).save({ providerId, idType, address, secondaryPhone,
                frontImage: front.buffer, backImage: back.buffer, frontMime, backMime,
                submittedAt: new Date(), reviewedAt: null, reviewedById: null });
            profile.kycStatus = mechanic_profile_entity_1.KycStatus.PENDING;
            profile.kycDocumentsVerified = false;
            profile.isOnline = false;
            profile.lastSeenAt = null;
            await manager.getRepository(mechanic_profile_entity_2.MechanicProfile).save(profile);
            return { success: true, message: 'KYC submitted for admin review' };
        });
    }
    async myKyc(providerId) {
        const submission = await this.kycRepository.findOneBy({ providerId });
        const profile = await this.mechanicRepository.findOneBy({ user: { id: providerId } });
        return { submitted: !!submission, status: profile?.kycStatus === mechanic_profile_entity_1.KycStatus.APPROVED && !profile.kycDocumentsVerified ? mechanic_profile_entity_1.KycStatus.PENDING : profile?.kycStatus ?? mechanic_profile_entity_1.KycStatus.PENDING,
            idType: submission?.idType ?? null, address: submission?.address ?? null,
            secondaryPhone: submission?.secondaryPhone ?? null, submittedAt: submission?.submittedAt ?? null };
    }
    async kycImage(providerId, side) {
        if (!['front', 'back'].includes(side))
            throw new common_1.BadRequestException('Invalid ID image side');
        const submission = await this.kycRepository.createQueryBuilder('kyc')
            .addSelect(side === 'front' ? 'kyc.frontImage' : 'kyc.backImage')
            .where('kyc.providerId = :providerId', { providerId }).getOne();
        if (!submission)
            throw new common_1.NotFoundException('KYC submission not found');
        return side === 'front' ? { bytes: submission.frontImage, mime: submission.frontMime } : { bytes: submission.backImage, mime: submission.backMime };
    }
    async updateMyMobile(providerId, mobile) {
        if (!(0, provider_eligibility_1.validProviderMobile)(mobile))
            throw new common_1.BadRequestException('Enter a valid 10 to 15 digit mobile number');
        const value = mobile.trim();
        let result;
        try {
            result = await this.usersRepository.update({ id: providerId }, { phoneNumber: value });
        }
        catch (error) {
            if (error instanceof typeorm_2.QueryFailedError && error.driverError.code === '23505') {
                throw new common_1.ConflictException('Mobile number is already in use');
            }
            throw error;
        }
        if (!result.affected)
            throw new common_1.NotFoundException('Provider not found');
        return { success: true, phoneNumber: value };
    }
    async me(actor) {
        const provider = ['MECHANIC', 'FLEET_DRIVER'].includes(actor.role);
        const user = provider ? await this.usersRepository.findOneBy({ id: actor.sub }) : await this.usersRepository.manager.getRepository(cust_user_entity_1.CustUser).findOneBy({ id: actor.sub });
        if (!user)
            throw new common_1.NotFoundException('Account not found');
        const profile = provider ? await this.mechanicRepository.findOneBy({ user: { id: actor.sub } }) : null;
        const stats = provider ? await this.getDailyStats(actor.sub) : null;
        return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, role: user.role,
            kycStatus: profile?.kycStatus === mechanic_profile_entity_1.KycStatus.APPROVED && !profile.kycDocumentsVerified ? mechanic_profile_entity_1.KycStatus.PENDING : profile?.kycStatus ?? mechanic_profile_entity_1.KycStatus.PENDING,
            earnedBadges: stats?.earnedBadges ?? [] };
    }
    async toggleOnlineStatus(mechanicId, isOnline, lat, lng) {
        const profile = await this.mechanicRepository.findOne({ where: { user: { id: mechanicId } }, relations: { user: true } });
        if (!profile) {
            throw new common_1.NotFoundException('Mechanic profile not found');
        }
        if (isOnline)
            (0, provider_eligibility_1.requireProviderEligibility)(profile, profile.user.phoneNumber);
        profile.isOnline = isOnline;
        profile.lastSeenAt = isOnline ? new Date() : null;
        if (isOnline && lat !== undefined && lng !== undefined) {
            profile.currentLocation = {
                type: 'Point',
                coordinates: [lng, lat],
            };
        }
        await this.mechanicRepository.update(profile.id, {
            isOnline, lastSeenAt: profile.lastSeenAt,
            ...(isOnline ? { currentLocation: profile.currentLocation } : {}),
        });
        return { success: true, message: `Mechanic ${mechanicId} online status set to ${isOnline}` };
    }
    async updateServicesProvided(mechanicId, serviceIds) {
        return this.updateConfig(mechanicId, { services: serviceIds });
    }
    async updateConfig(mechanicId, data) {
        if (!data || typeof data !== 'object' || Array.isArray(data))
            throw new common_1.BadRequestException('A configuration object is required');
        for (const ids of [data?.services, data?.vehicles]) {
            if (ids !== undefined && (!Array.isArray(ids) || ids.length > 200 || !ids.every(id => typeof id === 'string' && (0, class_validator_1.isUUID)(id)) || new Set(ids).size !== ids.length)) {
                throw new common_1.BadRequestException('Unique valid service and vehicle IDs are required');
            }
        }
        if (data?.pricing !== undefined) {
            if (!Array.isArray(data.pricing) || data.pricing.length > 1000)
                throw new common_1.BadRequestException('Invalid pricing list');
            const keys = new Set();
            for (const p of data.pricing) {
                if (!p || !(0, class_validator_1.isUUID)(p.serviceId) || !(0, class_validator_1.isUUID)(p.vehicleId))
                    throw new common_1.BadRequestException('Invalid pricing IDs');
                (0, money_1.minorUnits)(p.price);
                const key = p.serviceId + ':' + p.vehicleId;
                if (keys.has(key))
                    throw new common_1.BadRequestException('Duplicate service/vehicle price');
                keys.add(key);
            }
        }
        return this.mechanicRepository.manager.transaction(async (m) => {
            const profiles = m.getRepository(mechanic_profile_entity_2.MechanicProfile);
            const profile = await profiles.createQueryBuilder('p').where('p."userId" = :mechanicId', { mechanicId }).setLock('pessimistic_write').getOne();
            if (!profile)
                throw new common_1.NotFoundException('Mechanic profile not found');
            if (data.services !== undefined) {
                const selected = await m.getRepository(service_type_entity_1.ServiceType).findBy({ id: (0, typeorm_3.In)(data.services), isActive: true });
                if (selected.length !== data.services.length)
                    throw new common_1.BadRequestException('Unknown or inactive service');
                profile.providedServices = selected;
            }
            if (data.vehicles !== undefined) {
                const selected = await m.getRepository(vehicle_category_entity_1.VehicleCategory).findBy({ id: (0, typeorm_3.In)(data.vehicles), isActive: true });
                if (selected.length !== data.vehicles.length)
                    throw new common_1.BadRequestException('Unknown or inactive vehicle');
                if (selected.some(v => v.isPremiumTier) && !profile.hasPremiumSubscription)
                    throw new common_2.HttpException('Premium Subscription Required to service Luxury/Premium vehicles.', common_2.HttpStatus.FORBIDDEN);
                profile.supportedVehicles = selected;
            }
            await profiles.save(profile);
            if (data.pricing !== undefined) {
                const selected = await profiles.findOneOrFail({ where: { id: profile.id }, relations: { providedServices: true, supportedVehicles: true } });
                for (const price of data.pricing) {
                    if (!selected.providedServices.some(s => s.id === price.serviceId) || !selected.supportedVehicles.some(v => v.id === price.vehicleId))
                        throw new common_1.BadRequestException('Prices must refer to selected services and vehicles');
                }
                const prices = m.getRepository(mechanic_pricing_entity_1.MechanicPricing);
                await prices.delete({ mechanicProfile: { id: profile.id } });
                if (data.pricing.length)
                    await prices.save(data.pricing.map(p => prices.create({ mechanicProfile: { id: profile.id }, serviceType: { id: p.serviceId }, vehicleCategory: { id: p.vehicleId }, price: p.price })));
            }
            return { success: true };
        });
    }
    async getConfig(mechanicId) {
        const profile = await this.mechanicRepository.findOne({
            where: { user: { id: mechanicId } },
            relations: { providedServices: true, supportedVehicles: true }
        });
        if (!profile) {
            throw new common_1.NotFoundException('Mechanic profile not found');
        }
        const pricing = await this.pricingRepository.find({
            where: { mechanicProfile: { id: profile.id } },
            relations: { serviceType: true, vehicleCategory: true }
        });
        return {
            services: profile.providedServices.map(s => s.id),
            vehicles: profile.supportedVehicles.map(v => v.id),
            pricing: pricing.map(p => ({
                serviceId: p.serviceType.id,
                vehicleId: p.vehicleCategory.id,
                price: p.price
            }))
        };
    }
    async getDailyStats(mechanicId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const profile = await this.mechanicRepository.findOne({ where: { user: { id: mechanicId } } });
        const totalCompletedJobs = profile?.completedJobsCount || 0;
        const requestsReceived = await this.serviceRequestRepository.count({
            where: {
                mechanic: { id: mechanicId },
                createdAt: (0, typeorm_3.MoreThanOrEqual)(today),
            }
        });
        const requestsAccepted = await this.serviceRequestRepository
            .createQueryBuilder('sr')
            .where('sr.mechanicId = :mechanicId', { mechanicId })
            .andWhere('sr.createdAt >= :today', { today })
            .andWhere('sr.status NOT IN (:...excludedStatuses)', { excludedStatuses: [service_request_entity_1.JobStatus.REQUESTED, service_request_entity_1.JobStatus.CANCELLED] })
            .getCount();
        const earningsResult = await this.mechanicRepository.manager.getRepository(payment_ledger_entity_1.PaymentLedger).createQueryBuilder('entry')
            .leftJoin('entry.toAccount', 'account').select('COALESCE(SUM(entry."amountMinor"), 0)', 'total')
            .where('account.key = :key AND entry.kind = :kind AND entry."createdAt" >= :today', { key: 'provider:' + mechanicId, kind: 'PROVIDER_CREDIT', today }).getRawOne();
        const earnings = Number(earningsResult.total) / 100;
        const reviewStats = await this.serviceRequestRepository.createQueryBuilder('job')
            .select('COUNT(job."customerRating")', 'count').addSelect('COALESCE(AVG(job."customerRating"), 0)', 'average')
            .where('job."mechanicId" = :mechanicId AND job.status = :status', { mechanicId, status: service_request_entity_1.JobStatus.COMPLETED }).getRawOne();
        return {
            earnedBadges: (0, performance_1.performanceBadges)(totalCompletedJobs, Number(reviewStats.count), Number(reviewStats.average)),
            reviewCount: Number(reviewStats.count),
            averageRating: Number(reviewStats.average),
            isOnline: !!(profile?.isOnline && profile.lastSeenAt && profile.lastSeenAt.getTime() > Date.now() - 90000),
            requestsReceived,
            requestsAccepted,
            earnings,
            totalCompletedJobs,
            hasPremiumSubscription: profile?.hasPremiumSubscription || false,
            walletBalance: profile?.walletBalance ? Number(profile.walletBalance) : 0,
        };
    }
    async pendingRequests(mechanicId) {
        const jobs = await this.serviceRequestRepository.find({
            where: { mechanic: { id: mechanicId }, status: service_request_entity_1.JobStatus.REQUESTED, createdAt: (0, typeorm_3.MoreThanOrEqual)(new Date(Date.now() - 10 * 60000)) },
            relations: { customer: true }, order: { createdAt: 'ASC' }, take: 20,
        });
        return jobs.map(job => ({ jobId: job.id, serviceType: job.serviceType, customerId: job.customer.id,
            customerPhone: job.customer.phoneNumber, customerLng: job.breakdownLocation.coordinates[0], customerLat: job.breakdownLocation.coordinates[1] }));
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(provider_user_entity_1.ProviderUser)),
    __param(1, (0, typeorm_1.InjectRepository)(mechanic_profile_entity_2.MechanicProfile)),
    __param(2, (0, typeorm_1.InjectRepository)(mechanic_pricing_entity_1.MechanicPricing)),
    __param(3, (0, typeorm_1.InjectRepository)(service_request_entity_1.ServiceRequest)),
    __param(4, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __param(5, (0, typeorm_1.InjectRepository)(vehicle_category_entity_1.VehicleCategory)),
    __param(6, (0, typeorm_1.InjectRepository)(provider_kyc_submission_entity_1.ProviderKycSubmission)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object, typeof (_c = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _c : Object, typeof (_d = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _d : Object, typeof (_e = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _e : Object, typeof (_f = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _f : Object, typeof (_g = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _g : Object])
], UsersService);


/***/ }),
/* 36 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.performanceBadges = performanceBadges;
function performanceBadges(completed, reviews, average) {
    const badges = [];
    for (const [count, name] of [[10, 'Reliable Starter'], [100, 'Bronze Wrench'], [500, 'Silver Wrench'], [1000, 'Gold Wrench']]) {
        if (completed >= count)
            badges.push({ name, description: `${count} completed services` });
    }
    if (reviews >= 10 && average >= 4.5)
        badges.push({ name: 'Customer Favourite', description: 'At least 10 reviews and a 4.5+ average' });
    if (completed >= 100 && reviews >= 50 && average >= 4.8)
        badges.push({ name: 'Top Performer', description: '100 completed services, 50 reviews and a 4.8+ average' });
    return badges;
}


/***/ }),
/* 37 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.validProviderMobile = validProviderMobile;
exports.requireProviderEligibility = requireProviderEligibility;
const common_1 = __webpack_require__(3);
const mechanic_profile_entity_1 = __webpack_require__(16);
function validProviderMobile(value) {
    return typeof value === 'string' && /^\+?[1-9]\d{9,14}$/.test(value.trim());
}
function requireProviderEligibility(profile, phone) {
    if (!validProviderMobile(phone)) {
        throw new common_1.ForbiddenException('Add a valid mobile number in your provider profile before taking jobs.');
    }
    if (!profile || profile.kycStatus !== mechanic_profile_entity_1.KycStatus.APPROVED || !profile.kycDocumentsVerified) {
        throw new common_1.ForbiddenException('Complete KYC and wait for admin approval before taking jobs.');
    }
}


/***/ }),
/* 38 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.minorUnits = minorUnits;
exports.money = money;
exports.withdrawalWeek = withdrawalWeek;
const common_1 = __webpack_require__(3);
function minorUnits(value) {
    const text = String(value);
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(text))
        throw new common_1.BadRequestException('Invalid INR amount');
    const [whole, fraction = ''] = text.split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
function money(value) {
    const n = BigInt(value);
    return `${n / 100n}.${(n % 100n).toString().padStart(2, '0')}`;
}
function withdrawalWeek(now = new Date()) {
    const india = new Date(now.getTime() + 330 * 60000);
    const days = (india.getUTCDay() + 6) % 7;
    india.setUTCDate(india.getUTCDate() - days);
    india.setUTCHours(0, 0, 0, 0);
    return new Date(india.getTime() - 330 * 60000);
}


/***/ }),
/* 39 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JobEvent = exports.WithdrawalAllocation = exports.PaymentLedger = exports.WalletAccount = void 0;
const typeorm_1 = __webpack_require__(11);
const service_request_entity_1 = __webpack_require__(30);
let WalletAccount = class WalletAccount {
    id;
    key;
    currency;
    balanceMinor;
};
exports.WalletAccount = WalletAccount;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WalletAccount.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], WalletAccount.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'INR' }),
    __metadata("design:type", String)
], WalletAccount.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: '0' }),
    __metadata("design:type", String)
], WalletAccount.prototype, "balanceMinor", void 0);
exports.WalletAccount = WalletAccount = __decorate([
    (0, typeorm_1.Entity)('wallet_accounts')
], WalletAccount);
let PaymentLedger = class PaymentLedger {
    id;
    reference;
    fromAccount;
    toAccount;
    job;
    amountMinor;
    kind;
    currency;
    description;
    createdAt;
};
exports.PaymentLedger = PaymentLedger;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PaymentLedger.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], PaymentLedger.prototype, "reference", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => WalletAccount, { nullable: false, onDelete: 'RESTRICT' }),
    __metadata("design:type", WalletAccount)
], PaymentLedger.prototype, "fromAccount", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => WalletAccount, { nullable: false, onDelete: 'RESTRICT' }),
    __metadata("design:type", WalletAccount)
], PaymentLedger.prototype, "toAccount", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => service_request_entity_1.ServiceRequest, { nullable: true, onDelete: 'RESTRICT' }),
    __metadata("design:type", Object)
], PaymentLedger.prototype, "job", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }),
    __metadata("design:type", String)
], PaymentLedger.prototype, "amountMinor", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PaymentLedger.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'INR' }),
    __metadata("design:type", String)
], PaymentLedger.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PaymentLedger.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], PaymentLedger.prototype, "createdAt", void 0);
exports.PaymentLedger = PaymentLedger = __decorate([
    (0, typeorm_1.Entity)('payment_ledger'),
    (0, typeorm_1.Index)(['fromAccount', 'createdAt', 'id']),
    (0, typeorm_1.Index)(['toAccount', 'createdAt', 'id']),
    (0, typeorm_1.Index)(['job', 'createdAt', 'id'])
], PaymentLedger);
let WithdrawalAllocation = class WithdrawalAllocation {
    id;
    providerId;
    withdrawal;
    job;
    amountMinor;
};
exports.WithdrawalAllocation = WithdrawalAllocation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WithdrawalAllocation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], WithdrawalAllocation.prototype, "providerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => PaymentLedger, { nullable: false, onDelete: 'RESTRICT' }),
    __metadata("design:type", PaymentLedger)
], WithdrawalAllocation.prototype, "withdrawal", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => service_request_entity_1.ServiceRequest, { nullable: true, onDelete: 'RESTRICT' }),
    __metadata("design:type", Object)
], WithdrawalAllocation.prototype, "job", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }),
    __metadata("design:type", String)
], WithdrawalAllocation.prototype, "amountMinor", void 0);
exports.WithdrawalAllocation = WithdrawalAllocation = __decorate([
    (0, typeorm_1.Entity)('withdrawal_allocations'),
    (0, typeorm_1.Index)(['providerId', 'job'])
], WithdrawalAllocation);
let JobEvent = class JobEvent {
    id;
    job;
    type;
    actorId;
    details;
    createdAt;
};
exports.JobEvent = JobEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], JobEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => service_request_entity_1.ServiceRequest, { nullable: false, onDelete: 'RESTRICT' }),
    __metadata("design:type", typeof (_d = typeof service_request_entity_1.ServiceRequest !== "undefined" && service_request_entity_1.ServiceRequest) === "function" ? _d : Object)
], JobEvent.prototype, "job", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], JobEvent.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], JobEvent.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", typeof (_e = typeof Record !== "undefined" && Record) === "function" ? _e : Object)
], JobEvent.prototype, "details", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", typeof (_f = typeof Date !== "undefined" && Date) === "function" ? _f : Object)
], JobEvent.prototype, "createdAt", void 0);
exports.JobEvent = JobEvent = __decorate([
    (0, typeorm_1.Entity)('job_events'),
    (0, typeorm_1.Index)(['job', 'createdAt', 'id'])
], JobEvent);


/***/ }),
/* 40 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LocationModule = void 0;
const common_1 = __webpack_require__(3);
const location_gateway_1 = __webpack_require__(41);
const auth_module_1 = __webpack_require__(7);
const location_controller_1 = __webpack_require__(45);
const typeorm_1 = __webpack_require__(10);
const service_request_entity_1 = __webpack_require__(30);
const job_access_service_1 = __webpack_require__(44);
const call_config_controller_1 = __webpack_require__(47);
let LocationModule = class LocationModule {
};
exports.LocationModule = LocationModule;
exports.LocationModule = LocationModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, typeorm_1.TypeOrmModule.forFeature([service_request_entity_1.ServiceRequest])],
        controllers: [location_controller_1.LocationController, call_config_controller_1.CallConfigController],
        providers: [location_gateway_1.LocationGateway, job_access_service_1.JobAccessService],
        exports: [location_gateway_1.LocationGateway, job_access_service_1.JobAccessService],
    })
], LocationModule);


/***/ }),
/* 41 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LocationGateway = void 0;
const common_1 = __webpack_require__(3);
const websockets_1 = __webpack_require__(27);
const socket_io_1 = __webpack_require__(42);
const nestjs_redis_1 = __webpack_require__(43);
const jwt_1 = __webpack_require__(21);
const ws_jwt_guard_1 = __webpack_require__(26);
const job_access_service_1 = __webpack_require__(44);
let LocationGateway = class LocationGateway {
    jwt;
    access;
    server;
    redis;
    constructor(redisService, jwt, access) {
        this.jwt = jwt;
        this.access = access;
        this.redis = redisService.getOrThrow();
    }
    afterInit(server) {
        server.use(async (client, next) => {
            try {
                const token = client.handshake.auth?.token ||
                    client.handshake.headers.authorization?.split(' ')[1];
                const user = await this.jwt.verifyAsync(token);
                if (!user.sub || !user.role)
                    throw new Error('Missing identity');
                client.user = user;
                next();
            }
            catch {
                next(new Error('Invalid or expired token'));
            }
        });
    }
    handleConnection(client) {
        const user = client.user;
        if (!user) {
            client.disconnect(true);
            return;
        }
        client.join('user_' + user.sub);
        if (['MECHANIC', 'FLEET_DRIVER'].includes(user.role))
            client.join('tracking_' + user.sub);
        if (user.role === 'CUSTOMER')
            client.join('customer_' + user.sub);
    }
    async handleLocationUpdate(data, client) {
        const user = client.user;
        if (!['MECHANIC', 'FLEET_DRIVER'].includes(user.role) ||
            data.mechanicId !== user.sub)
            throw new websockets_1.WsException('Not your location');
        if (!Number.isFinite(data.lat) ||
            !Number.isFinite(data.lng) ||
            Math.abs(data.lat) > 90 ||
            Math.abs(data.lng) > 180)
            throw new websockets_1.WsException('Invalid coordinates');
        const observed = data.timestamp ? Date.parse(data.timestamp) : Date.now();
        if (!Number.isFinite(observed) ||
            observed < Date.now() - 120000 ||
            observed > Date.now() + 30000)
            throw new websockets_1.WsException('Stale location');
        const location = {
            mechanicId: user.sub,
            lat: data.lat,
            lng: data.lng,
            bearing: Number.isFinite(data.bearing) ? data.bearing : 0,
            accuracy: Number.isFinite(data.accuracy) && data.accuracy >= 0
                ? data.accuracy
                : null,
            timestamp: new Date(observed).toISOString(),
        };
        await this.redis.set('mechanic_loc:' + user.sub, JSON.stringify(location), 'EX', 600);
        await this.access.updatePresence(user.sub, data.lat, data.lng);
        for (const customer of await this.access.trackingCustomers(user.sub)) {
            this.server
                .to('customer_' + customer)
                .emit('mechanic_location_changed', location);
        }
        return { status: 'Location updated' };
    }
    async handleCustomerSubscription(data, client) {
        const user = client.user;
        if (user.role !== 'CUSTOMER' ||
            !(await this.access.canContact(user, data.mechanicId)))
            throw new websockets_1.WsException('No active job with this mechanic');
        const last = await this.redis.get('mechanic_loc:' + data.mechanicId);
        if (last)
            client.emit('mechanic_location_changed', JSON.parse(last));
        return { status: 'Subscribed' };
    }
};
exports.LocationGateway = LocationGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", typeof (_d = typeof socket_io_1.Server !== "undefined" && socket_io_1.Server) === "function" ? _d : Object)
], LocationGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('update_location'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_e = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], LocationGateway.prototype, "handleLocationUpdate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribe_to_mechanic'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_f = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _f : Object]),
    __metadata("design:returntype", Promise)
], LocationGateway.prototype, "handleCustomerSubscription", null);
exports.LocationGateway = LocationGateway = __decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [typeof (_a = typeof nestjs_redis_1.RedisService !== "undefined" && nestjs_redis_1.RedisService) === "function" ? _a : Object, typeof (_b = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _b : Object, typeof (_c = typeof job_access_service_1.JobAccessService !== "undefined" && job_access_service_1.JobAccessService) === "function" ? _c : Object])
], LocationGateway);


/***/ }),
/* 42 */
/***/ ((module) => {

module.exports = require("socket.io");

/***/ }),
/* 43 */
/***/ ((module) => {

module.exports = require("@liaoliaots/nestjs-redis");

/***/ }),
/* 44 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JobAccessService = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const typeorm_2 = __webpack_require__(11);
const mechanic_profile_entity_1 = __webpack_require__(16);
const service_request_entity_1 = __webpack_require__(30);
const ACTIVE_JOBS = [
    service_request_entity_1.JobStatus.REQUESTED,
    service_request_entity_1.JobStatus.ACCEPTED,
    service_request_entity_1.JobStatus.AWAITING_PAYMENT,
    service_request_entity_1.JobStatus.PAYMENT_SECURED,
    service_request_entity_1.JobStatus.EN_ROUTE,
    service_request_entity_1.JobStatus.AWAITING_CUSTOMER_CONFIRMATION,
];
let JobAccessService = class JobAccessService {
    jobs;
    constructor(jobs) {
        this.jobs = jobs;
    }
    async canContact(user, targetId) {
        if (!targetId || targetId === user.sub)
            return false;
        const customer = user.role === 'CUSTOMER';
        if (!customer && !['MECHANIC', 'FLEET_DRIVER'].includes(user.role))
            return false;
        return this.jobs.existsBy({
            customer: { id: customer ? user.sub : targetId },
            mechanic: { id: customer ? targetId : user.sub },
            status: (0, typeorm_2.In)(ACTIVE_JOBS),
        });
    }
    async trackingCustomers(mechanicId) {
        const jobs = await this.jobs.find({
            where: { mechanic: { id: mechanicId }, status: (0, typeorm_2.In)(ACTIVE_JOBS) },
            relations: { customer: true },
        });
        return [...new Set(jobs.map((job) => job.customer.id))];
    }
    async updatePresence(mechanicId, lat, lng) {
        await this.jobs.manager.getRepository(mechanic_profile_entity_1.MechanicProfile).update({ user: { id: mechanicId }, isOnline: true }, { lastSeenAt: new Date(), currentLocation: { type: 'Point', coordinates: [lng, lat] } });
    }
};
exports.JobAccessService = JobAccessService;
exports.JobAccessService = JobAccessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(service_request_entity_1.ServiceRequest)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object])
], JobAccessService);


/***/ }),
/* 45 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LocationController = exports.RouteRequestDto = void 0;
const common_1 = __webpack_require__(3);
const class_validator_1 = __webpack_require__(12);
const config_1 = __webpack_require__(4);
const jwt_auth_guard_1 = __webpack_require__(25);
const axios_1 = __importDefault(__webpack_require__(46));
class RouteRequestDto {
    mechanicLat;
    mechanicLng;
    customerLat;
    customerLng;
}
exports.RouteRequestDto = RouteRequestDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Min)(-90),
    (0, class_validator_1.Max)(90),
    __metadata("design:type", Number)
], RouteRequestDto.prototype, "mechanicLat", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Min)(-180),
    (0, class_validator_1.Max)(180),
    __metadata("design:type", Number)
], RouteRequestDto.prototype, "mechanicLng", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Min)(-90),
    (0, class_validator_1.Max)(90),
    __metadata("design:type", Number)
], RouteRequestDto.prototype, "customerLat", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Min)(-180),
    (0, class_validator_1.Max)(180),
    __metadata("design:type", Number)
], RouteRequestDto.prototype, "customerLng", void 0);
let LocationController = class LocationController {
    config;
    cache = new Map();
    pending = new Map();
    constructor(config) {
        this.config = config;
    }
    async getBreakdownRoute(body) {
        const key = [
            body.mechanicLat,
            body.mechanicLng,
            body.customerLat,
            body.customerLng,
        ].join(',');
        const cached = this.cache.get(key);
        if (cached && cached.expires > Date.now())
            return cached.value;
        const pending = this.pending.get(key);
        if (pending)
            return pending;
        const request = this.fetchRoute(body)
            .then((value) => {
            if (this.cache.size >= 500)
                this.cache.delete(this.cache.keys().next().value);
            this.cache.set(key, { expires: Date.now() + 30000, value });
            return value;
        })
            .finally(() => this.pending.delete(key));
        this.pending.set(key, request);
        return request;
    }
    async fetchRoute(body) {
        const { mechanicLat, mechanicLng, customerLat, customerLng } = body;
        try {
            const base = this.config.get('OSRM_BASE_URL') ||
                'https://router.project-osrm.org';
            const osrmUrl = `${base.replace(/\/$/, '')}/route/v1/driving/${mechanicLng},${mechanicLat};${customerLng},${customerLat}?overview=full&geometries=geojson&steps=true`;
            const response = await axios_1.default.get(osrmUrl, { timeout: 8000 });
            if (response.data &&
                response.data.routes &&
                response.data.routes.length > 0) {
                const route = response.data.routes[0];
                const distanceKM = Number((route.distance / 1000).toFixed(2));
                const durationMins = Math.round(route.duration / 60);
                return {
                    success: true,
                    distanceKM,
                    durationMins,
                    coordinates: route.geometry.coordinates,
                    distanceMeters: route.distance,
                    durationSeconds: route.duration,
                    steps: (route.legs || []).flatMap((leg) => (leg.steps || []).map((step) => ({
                        name: step.name,
                        distance: step.distance,
                        type: step.maneuver?.type,
                        modifier: step.maneuver?.modifier,
                        location: step.maneuver?.location,
                    }))),
                };
            }
            else {
                throw new common_1.HttpException('No route found', common_1.HttpStatus.NOT_FOUND);
            }
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            console.error('OSRM Routing Error:', error.message);
            throw new common_1.HttpException('Failed to fetch route from OSRM', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
};
exports.LocationController = LocationController;
__decorate([
    (0, common_1.Post)('get-breakdown-route'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RouteRequestDto]),
    __metadata("design:returntype", Promise)
], LocationController.prototype, "getBreakdownRoute", null);
exports.LocationController = LocationController = __decorate([
    (0, common_1.Controller)('api'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], LocationController);


/***/ }),
/* 46 */
/***/ ((module) => {

module.exports = require("axios");

/***/ }),
/* 47 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CallConfigController = void 0;
const common_1 = __webpack_require__(3);
const config_1 = __webpack_require__(4);
const crypto_1 = __webpack_require__(23);
const jwt_auth_guard_1 = __webpack_require__(25);
let CallConfigController = class CallConfigController {
    config;
    constructor(config) {
        this.config = config;
    }
    iceServers(req) {
        const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
        const urls = this.config
            .get('TURN_URLS')
            ?.split(',')
            .map((url) => url.trim())
            .filter(Boolean);
        const secret = this.config.get('TURN_SECRET');
        if (urls?.length && secret) {
            const username = `${Math.floor(Date.now() / 1000) + 3600}:${req.user.sub}`;
            iceServers.push({
                urls,
                username,
                credential: (0, crypto_1.createHmac)('sha1', secret)
                    .update(username)
                    .digest('base64'),
            });
        }
        return { iceServers, relayConfigured: iceServers.length > 1 };
    }
};
exports.CallConfigController = CallConfigController;
__decorate([
    (0, common_1.Get)('ice-servers'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallConfigController.prototype, "iceServers", null);
exports.CallConfigController = CallConfigController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('calls'),
    __metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], CallConfigController);


/***/ }),
/* 48 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DispatchModule = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const dispatch_service_1 = __webpack_require__(49);
const mechanic_profile_entity_1 = __webpack_require__(16);
const service_request_entity_1 = __webpack_require__(30);
const wallet_transaction_entity_1 = __webpack_require__(51);
const dispatch_controller_1 = __webpack_require__(56);
const location_module_1 = __webpack_require__(40);
const call_gateway_1 = __webpack_require__(57);
const auth_module_1 = __webpack_require__(7);
const razorpay_controller_1 = __webpack_require__(59);
const finance_controller_1 = __webpack_require__(60);
let DispatchModule = class DispatchModule {
};
exports.DispatchModule = DispatchModule;
exports.DispatchModule = DispatchModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([mechanic_profile_entity_1.MechanicProfile, service_request_entity_1.ServiceRequest, wallet_transaction_entity_1.WalletTransaction]),
            location_module_1.LocationModule,
            auth_module_1.AuthModule
        ],
        controllers: [dispatch_controller_1.DispatchController, razorpay_controller_1.RazorpayController, finance_controller_1.FinanceController],
        providers: [dispatch_service_1.DispatchService, call_gateway_1.CallGateway],
        exports: [dispatch_service_1.DispatchService],
    })
], DispatchModule);


/***/ }),
/* 49 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DispatchService_1;
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DispatchService = void 0;
const job_payments_service_1 = __webpack_require__(50);
const automatic_quote_1 = __webpack_require__(55);
const mechanic_pricing_entity_1 = __webpack_require__(29);
const pricing_1 = __webpack_require__(53);
const money_1 = __webpack_require__(38);
const performance_1 = __webpack_require__(36);
const provider_eligibility_1 = __webpack_require__(37);
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const typeorm_2 = __webpack_require__(11);
const schedule_1 = __webpack_require__(6);
const mechanic_profile_entity_1 = __webpack_require__(16);
const service_request_entity_1 = __webpack_require__(30);
const wallet_transaction_entity_1 = __webpack_require__(51);
const location_gateway_1 = __webpack_require__(41);
const cust_user_entity_1 = __webpack_require__(15);
let DispatchService = DispatchService_1 = class DispatchService {
    mechanicRepo;
    serviceRequestRepo;
    walletRepo;
    locationGateway;
    payments;
    autoQuotes;
    logger = new common_1.Logger(DispatchService_1.name);
    constructor(mechanicRepo, serviceRequestRepo, walletRepo, locationGateway) {
        this.mechanicRepo = mechanicRepo;
        this.serviceRequestRepo = serviceRequestRepo;
        this.walletRepo = walletRepo;
        this.locationGateway = locationGateway;
        this.payments = new job_payments_service_1.JobPaymentsService(serviceRequestRepo, locationGateway);
        this.autoQuotes = new automatic_quote_1.AutomaticQuoteService(serviceRequestRepo, this.payments, locationGateway);
    }
    calculateInvoice(baseFee, distanceInKm, ratePerKm, isSurge) {
        let total = baseFee + distanceInKm * ratePerKm;
        if (isSurge) {
            total = total * 1.5;
        }
        return total;
    }
    async findMechanicsWithDistance(lat, lng, radiusInKm = 20, serviceType, vehicleCategoryId) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
            throw new common_1.BadRequestException('Valid coordinates required');
        const radiusInMeters = radiusInKm * 1000;
        const { entities, raw } = await this.mechanicRepo
            .createQueryBuilder('mechanic')
            .leftJoinAndSelect('mechanic.user', 'user')
            .addSelect(`ST_Distance(mechanic."currentLocation"::geography, ST_MakePoint(:lng, :lat)::geography)`, 'distance')
            .where('mechanic.isOnline = :isOnline', { isOnline: true })
            .andWhere('mechanic."kycStatus" = :approvedKyc', { approvedKyc: 'APPROVED' })
            .andWhere('"user"."phoneNumber" ~ :mobilePattern', { mobilePattern: '^\\+?[1-9][0-9]{9,14}$' })
            .andWhere('mechanic."lastSeenAt" > :fresh', { fresh: new Date(Date.now() - 90000) })
            .andWhere(q => serviceType ? 'EXISTS ' + q.subQuery().select('1').from(mechanic_profile_entity_1.MechanicProfile, 'p').innerJoin('p.providedServices', 'provided').where('p.id = mechanic.id AND (provided.name = :serviceType OR CAST(provided.id AS text) = :serviceType)').getQuery() : '1=1', { serviceType })
            .andWhere(q => vehicleCategoryId ? 'EXISTS ' + q.subQuery().select('1').from(mechanic_pricing_entity_1.MechanicPricing, 'price').innerJoin('price.serviceType', 'ps').innerJoin('price.vehicleCategory', 'pv').innerJoin('price.mechanicProfile', 'pricedProfile').innerJoin('pricedProfile.supportedVehicles', 'supported').where('price.mechanic_profile_id = mechanic.id AND supported.id = pv.id AND CAST(pv.id AS text) = :vehicleCategoryId AND (ps.name = :serviceType OR CAST(ps.id AS text) = :serviceType) AND ps."isActive" = true AND pv."isActive" = true').getQuery() : '1=1', { vehicleCategoryId, serviceType })
            .andWhere('ST_DWithin(mechanic."currentLocation"::geography, ST_MakePoint(:lng, :lat)::geography, :radius)', { lng, lat, radius: radiusInMeters })
            .orderBy('ST_Distance(mechanic."currentLocation"::geography, ST_MakePoint(:lng, :lat)::geography)', 'ASC')
            .addSelect(q => q.select('AVG(review."customerRating")').from(service_request_entity_1.ServiceRequest, 'review').where('review."mechanicId" = "user".id AND review.status = :completed', { completed: service_request_entity_1.JobStatus.COMPLETED }), 'rating')
            .addSelect(q => q.select('COUNT(review."customerRating")').from(service_request_entity_1.ServiceRequest, 'review').where('review."mechanicId" = "user".id AND review.status = :completed', { completed: service_request_entity_1.JobStatus.COMPLETED }), 'reviewCount')
            .limit(50)
            .getRawAndEntities();
        return entities.map((entity, index) => {
            const distanceInMeters = parseFloat(raw[index].distance);
            const distanceInKm = (distanceInMeters / 1000).toFixed(1);
            entity.distanceText = `${distanceInKm} km`;
            entity.distanceValue = distanceInMeters;
            const rating = raw[index].rating == null ? null : Number(raw[index].rating);
            return { id: entity.id, user: { id: entity.user.id, name: entity.user.name, phoneNumber: entity.user.phoneNumber },
                currentLocation: entity.currentLocation, distanceText: entity.distanceText, distanceValue: entity.distanceValue,
                rating, reviewCount: Number(raw[index].reviewCount), completedJobsCount: entity.completedJobsCount,
                earnedBadges: (0, performance_1.performanceBadges)(entity.completedJobsCount, Number(raw[index].reviewCount), rating ?? 0) };
        });
    }
    async createServiceRequest(customerId, serviceType, lat, lng, mechanicId, vehicleCategoryId) {
        const assignedMechanic = await this.mechanicRepo.findOne({
            where: { user: { id: mechanicId } },
            relations: { user: true },
        });
        if (!assignedMechanic || !assignedMechanic.isOnline || !assignedMechanic.lastSeenAt || assignedMechanic.lastSeenAt.getTime() < Date.now() - 90000) {
            return {
                success: false,
                message: 'Selected mechanic is no longer available.',
            };
        }
        (0, provider_eligibility_1.requireProviderEligibility)(assignedMechanic, assignedMechanic.user.phoneNumber);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
            throw new common_1.BadRequestException('Valid breakdown location required');
        const request = this.serviceRequestRepo.create({
            customer: { id: customerId },
            mechanic: { id: assignedMechanic.user.id },
            serviceType,
            vehicleCategoryId: vehicleCategoryId ?? null,
            status: service_request_entity_1.JobStatus.REQUESTED,
            breakdownLocation: {
                type: 'Point',
                coordinates: [lng, lat],
            },
        });
        await this.serviceRequestRepo.manager.transaction(async (manager) => {
            await manager.getRepository(service_request_entity_1.ServiceRequest).save(request);
            await this.payments.event(manager, request, 'REQUESTED', customerId, { serviceType });
        });
        const customer = await this.serviceRequestRepo.manager.findOne(cust_user_entity_1.CustUser, {
            where: { id: customerId },
        });
        this.locationGateway.server
            .to(`tracking_${assignedMechanic.user.id}`)
            .emit('new_job_request', {
            jobId: request.id,
            serviceType,
            customerLat: lat,
            customerLng: lng,
            customerId: customerId,
            customerPhone: customer?.phoneNumber ?? 'Unknown',
        });
        return {
            success: true,
            message: 'Breakdown request submitted successfully.',
            assignedMechanic: { id: assignedMechanic.id, user: { id: assignedMechanic.user.id, name: assignedMechanic.user.name } },
            jobId: request.id,
        };
    }
    async acceptJob(jobId, mechanicId) {
        const job = await this.serviceRequestRepo.manager.transaction(async (manager) => {
            await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [mechanicId]);
            const jobs = manager.getRepository(service_request_entity_1.ServiceRequest);
            const candidate = await jobs.createQueryBuilder('job')
                .where('job.id = :jobId AND job."mechanicId" = :mechanicId', { jobId, mechanicId })
                .setLock('pessimistic_write').getOne();
            if (!candidate || candidate.status !== service_request_entity_1.JobStatus.REQUESTED)
                return null;
            const profile = await manager.getRepository(mechanic_profile_entity_1.MechanicProfile).findOne({ where: { user: { id: mechanicId } }, relations: { user: true } });
            (0, provider_eligibility_1.requireProviderEligibility)(profile, profile?.user.phoneNumber);
            const busy = await jobs.createQueryBuilder('job')
                .where('job."mechanicId" = :mechanicId', { mechanicId })
                .andWhere('job.status IN (:...states)', { states: [service_request_entity_1.JobStatus.ACCEPTED, service_request_entity_1.JobStatus.AWAITING_PAYMENT, service_request_entity_1.JobStatus.PAYMENT_SECURED, service_request_entity_1.JobStatus.EN_ROUTE, service_request_entity_1.JobStatus.AWAITING_CUSTOMER_CONFIRMATION] })
                .getCount();
            if (busy)
                return null;
            await jobs.update(candidate.id, { status: service_request_entity_1.JobStatus.ACCEPTED, providerAcceptedAt: new Date() });
            await this.payments.event(manager, candidate, 'PROVIDER_ACCEPTED', mechanicId);
            return jobs.findOne({ where: { id: candidate.id }, relations: { customer: true, mechanic: true } });
        });
        if (!job) {
            const active = await this.activeJob(mechanicId);
            return { success: false, activeJobId: active.job?.id,
                message: active.job ? 'You already have an active job. Open it to continue or cancel it before accepting another request.' : 'This request is no longer available.' };
        }
        this.locationGateway.server
            .to(`customer_${job.customer.id}`)
            .emit('job_accepted', {
            jobId: job.id,
            mechanicId: mechanicId,
            mechanicPhone: job.mechanic.phoneNumber ?? 'Unknown',
        });
        return { success: true, message: 'Job accepted successfully.' };
    }
    async activeJob(mechanicId) {
        const job = await this.serviceRequestRepo.createQueryBuilder('job')
            .select(['job.id', 'job.status', 'job.serviceType'])
            .where('job."mechanicId" = :mechanicId', { mechanicId })
            .andWhere('job.status IN (:...states)', { states: [service_request_entity_1.JobStatus.ACCEPTED, service_request_entity_1.JobStatus.AWAITING_PAYMENT, service_request_entity_1.JobStatus.PAYMENT_SECURED, service_request_entity_1.JobStatus.EN_ROUTE, service_request_entity_1.JobStatus.AWAITING_CUSTOMER_CONFIRMATION] })
            .orderBy('job."createdAt"', 'ASC').getOne();
        return { job: job || null };
    }
    async customerActiveJob(customerId) {
        const job = await this.serviceRequestRepo.createQueryBuilder('job')
            .leftJoinAndSelect('job.mechanic', 'mechanic')
            .where('job."customerId" = :customerId', { customerId })
            .andWhere('job.status NOT IN (:...closed)', { closed: [service_request_entity_1.JobStatus.COMPLETED, service_request_entity_1.JobStatus.CANCELLED] })
            .orderBy('job."createdAt"', 'DESC').getOne();
        if (!job)
            return { job: null };
        return { job: { id: job.id, status: job.status, mechanicId: job.mechanic?.id,
                mechanicPhone: job.mechanic?.phoneNumber, breakdownLocation: job.breakdownLocation } };
    }
    async handleSlaTimeouts() {
        const threshold = new Date(Date.now() - 10 * 60000);
        await this.serviceRequestRepo.manager.transaction(async (manager) => {
            const jobs = await manager.getRepository(service_request_entity_1.ServiceRequest).createQueryBuilder('job')
                .where('status = :status AND "providerAcceptedAt" < :threshold', { status: service_request_entity_1.JobStatus.ACCEPTED, threshold })
                .take(100).setLock('pessimistic_write').setOnLocked('skip_locked').getMany();
            for (const job of jobs) {
                await manager.getRepository(service_request_entity_1.ServiceRequest).update(job.id, { status: service_request_entity_1.JobStatus.CANCELLED, cancelledBy: 'SYSTEM', cancellationReason: 'Provider did not submit a quote within 10 minutes' });
                await this.payments.event(manager, job, 'EXPIRED', 'SYSTEM', { reason: 'Quote timeout; no payment captured' });
            }
        });
    }
    async sendQuote(jobId, mechanicId, distance, travelingCharge, serviceCharge, totalAmount, pricingRevision) {
        if (![distance, travelingCharge, serviceCharge, totalAmount].every((value) => Number.isFinite(value) && value >= 0) ||
            Math.abs(totalAmount - travelingCharge - serviceCharge) > 0.01) {
            throw new common_1.BadRequestException('Quote must contain non-negative amounts and a matching total');
        }
        const job = await this.serviceRequestRepo.findOne({
            where: { id: jobId, mechanic: { id: mechanicId } },
            relations: { customer: true },
        });
        if (!job || job.status !== service_request_entity_1.JobStatus.ACCEPTED) {
            return { success: false, message: 'Job not found or invalid status.' };
        }
        const changed = await this.serviceRequestRepo.manager.transaction(async (manager) => {
            const mode = await (0, pricing_1.ensurePaymentEnvironment)(manager);
            const policy = await (0, pricing_1.currentPolicy)(manager);
            if (pricingRevision !== undefined && policy.revision !== pricingRevision)
                throw new common_1.BadRequestException('Pricing changed. Refresh commission and review the total before sending.');
            const price = (0, pricing_1.calculateQuote)(totalAmount, policy.commissionBps, policy.platformFeeMinor);
            const changed = await manager.getRepository(service_request_entity_1.ServiceRequest).update({ id: jobId, status: service_request_entity_1.JobStatus.ACCEPTED }, {
                distanceInKm: distance, travelingCharge, serviceCharge, totalAmount: price.totalAmount,
                commissionBps: price.commissionBps, commissionMinor: price.commissionMinor,
                platformFeeMinor: price.platformFeeMinor, providerNetMinor: price.providerNetMinor,
                pricingRevision: policy.revision, paymentMode: mode, status: service_request_entity_1.JobStatus.AWAITING_PAYMENT,
            });
            if (changed.affected)
                await this.payments.event(manager, job, 'QUOTE_SENT', mechanicId, { totalAmount: price.totalAmount, currency: 'INR', paymentMode: mode });
            return { ...changed, price, mode };
        });
        if (!changed.affected)
            return { success: false, message: 'Job status changed. Refresh and try again.' };
        this.locationGateway.server
            .to(`customer_${job.customer.id}`)
            .emit('quote_received', {
            jobId: job.id,
            distanceInKm: distance,
            quotationAmount: changed.price.quotationAmount,
            platformFee: (0, money_1.money)(changed.price.platformFeeMinor),
            totalAmount: changed.price.totalAmount,
            paymentMode: changed.mode,
        });
        return { success: true, message: 'Quote sent successfully.' };
    }
    async mockPay(jobId, customerId) { return this.payments.pay(jobId, customerId, true); }
    async completeJob(jobId, mechanicId, otp) { return this.payments.requestCompletion(jobId, mechanicId); }
    async withdrawFunds(mechanicId, requestId = (__webpack_require__(23).randomUUID)()) { return this.payments.withdraw(mechanicId, requestId); }
    async cancelJob(jobId, actorId, role = 'MECHANIC', reason = 'Cancelled by provider') { return this.payments.cancel(jobId, { sub: actorId, role }, reason); }
    async rateJob(jobId, rating, customerId) {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5)
            throw new common_1.BadRequestException('Rating must be between 1 and 5');
        return this.serviceRequestRepo.manager.transaction(async (manager) => {
            const jobs = manager.getRepository(service_request_entity_1.ServiceRequest);
            await jobs.createQueryBuilder('job').where('job.id = :jobId', { jobId }).setLock('pessimistic_write').getOne();
            const job = await jobs.findOne({ where: { id: jobId, customer: { id: customerId } }, relations: { mechanic: true } });
            if (!job)
                throw new common_1.NotFoundException('Job not found');
            if (job.status !== service_request_entity_1.JobStatus.COMPLETED)
                throw new common_1.BadRequestException('Can only rate completed jobs');
            if (job.customerRating != null)
                return { success: false, message: 'This job has already been reviewed.' };
            const profiles = manager.getRepository(mechanic_profile_entity_1.MechanicProfile);
            const profile = await profiles.createQueryBuilder('profile').where('profile."userId" = :id', { id: job.mechanic.id }).setLock('pessimistic_write').getOne();
            if (!profile)
                throw new common_1.NotFoundException('Mechanic profile not found');
            const pointsEarned = (rating - 3) * 5;
            profile.reputationPoints = Math.max(0, profile.reputationPoints + pointsEarned);
            if (rating === 5)
                profile.fiveStarReviewsCount += 1;
            await profiles.save(profile);
            await jobs.update(jobId, { customerRating: rating });
            await this.payments.event(manager, job, 'CUSTOMER_REVIEWED', customerId, { rating });
            return { success: true, message: 'Rating submitted successfully', pointsEarned };
        });
    }
};
exports.DispatchService = DispatchService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DispatchService.prototype, "handleSlaTimeouts", null);
exports.DispatchService = DispatchService = DispatchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(mechanic_profile_entity_1.MechanicProfile)),
    __param(1, (0, typeorm_1.InjectRepository)(service_request_entity_1.ServiceRequest)),
    __param(2, (0, typeorm_1.InjectRepository)(wallet_transaction_entity_1.WalletTransaction)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object, typeof (_c = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _c : Object, typeof (_d = typeof location_gateway_1.LocationGateway !== "undefined" && location_gateway_1.LocationGateway) === "function" ? _d : Object])
], DispatchService);


/***/ }),
/* 50 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JobPaymentsService = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(11);
const payment_ledger_entity_1 = __webpack_require__(39);
const service_request_entity_1 = __webpack_require__(30);
const mechanic_profile_entity_1 = __webpack_require__(16);
const wallet_transaction_entity_1 = __webpack_require__(51);
const money_1 = __webpack_require__(38);
const razorpay_1 = __webpack_require__(52);
const pricing_1 = __webpack_require__(53);
class JobPaymentsService {
    jobs;
    gateway;
    constructor(jobs, gateway) {
        this.jobs = jobs;
        this.gateway = gateway;
    }
    async pricing() {
        await this.jobs.manager.transaction(pricing_1.ensurePaymentEnvironment);
        return { ...await (0, pricing_1.currentPolicy)(this.jobs.manager), paymentMode: (0, pricing_1.paymentMode)(), commissionModel: 'DEDUCT_FROM_QUOTE' };
    }
    async event(m, job, type, actorId, details = {}) {
        await m.getRepository(payment_ledger_entity_1.JobEvent).save({ job: { id: job.id }, type, actorId, details });
    }
    async lockedJob(m, id, actor) {
        await (0, pricing_1.ensurePaymentEnvironment)(m);
        await m.getRepository(service_request_entity_1.ServiceRequest).createQueryBuilder('job').where('job.id = :id', { id }).setLock('pessimistic_write').getOne();
        const job = await m.getRepository(service_request_entity_1.ServiceRequest).findOne({ where: { id }, relations: { customer: true, mechanic: true } });
        if (!job)
            throw new common_1.NotFoundException('Job not found');
        const owns = actor.role === 'CUSTOMER' ? job.customer.id === actor.sub : ['MECHANIC', 'FLEET_DRIVER'].includes(actor.role) && job.mechanic?.id === actor.sub;
        if (!owns)
            throw new common_1.ForbiddenException('Not your job');
        return job;
    }
    async accounts(m, keys) {
        const repo = m.getRepository(payment_ledger_entity_1.WalletAccount);
        const result = new Map();
        for (const key of [...new Set(keys)].sort()) {
            await repo.createQueryBuilder().insert().values({ key, balanceMinor: '0' }).orIgnore().execute();
            const account = await repo.createQueryBuilder('a').where('a.key = :key', { key }).setLock('pessimistic_write').getOneOrFail();
            result.set(key, account);
        }
        return result;
    }
    async transfer(m, reference, fromKey, toKey, amount, kind, jobId, description) {
        if (amount < 0n || fromKey === toKey)
            throw new common_1.BadRequestException('Invalid transfer');
        const accounts = await this.accounts(m, [fromKey, toKey]);
        const from = accounts.get(fromKey);
        const to = accounts.get(toKey);
        if (!fromKey.startsWith('external:') && BigInt(from.balanceMinor) < amount)
            throw new common_1.BadRequestException('Insufficient wallet funds');
        from.balanceMinor = (BigInt(from.balanceMinor) - amount).toString();
        to.balanceMinor = (BigInt(to.balanceMinor) + amount).toString();
        await m.getRepository(payment_ledger_entity_1.WalletAccount).save([from, to]);
        return m.getRepository(payment_ledger_entity_1.PaymentLedger).save({ reference, fromAccount: from, toAccount: to, amountMinor: amount.toString(), kind,
            job: jobId ? { id: jobId } : null, description });
    }
    async providerAccount(m, providerId) {
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [providerId]);
        const key = 'provider:' + providerId;
        const existing = await m.getRepository(payment_ledger_entity_1.WalletAccount).findOneBy({ key });
        if (!existing) {
            const profile = await m.getRepository(mechanic_profile_entity_1.MechanicProfile).findOneBy({ user: { id: providerId } });
            if (!profile)
                throw new common_1.NotFoundException('Provider wallet not found');
            const opening = (0, money_1.minorUnits)(profile.walletBalance);
            await this.transfer(m, 'opening:' + providerId, 'external:legacy:' + providerId, key, opening, 'OPENING_BALANCE', null, 'Legacy available balance imported; original job allocation unavailable');
        }
        return (await this.accounts(m, [key])).get(key);
    }
    async escrow(m, job) {
        const key = 'escrow:' + job.id;
        if (!await m.getRepository(payment_ledger_entity_1.WalletAccount).existsBy({ key })) {
            const legacy = await m.getRepository(wallet_transaction_entity_1.WalletTransaction).findOneBy({ serviceRequest: { id: job.id }, status: wallet_transaction_entity_1.WalletStatus.ESCROW });
            if (!legacy)
                throw new common_1.BadRequestException('Held payment not found');
            await this.transfer(m, 'legacy-hold:' + job.id, 'external:legacy:' + job.id, key, (0, money_1.minorUnits)(legacy.amount), 'LEGACY_HOLD', job.id, 'Imported existing held payment');
        }
        return key;
    }
    notify(job, event, details = {}) {
        for (const room of ['customer_' + job.customer.id, 'tracking_' + job.mechanic?.id]) {
            this.gateway.server.to(room).emit(event, { jobId: job.id, ...details });
        }
    }
    async pay(id, customerId, testFunding = false, simulationResult) {
        const result = await this.jobs.manager.transaction(async (m) => {
            const job = await this.lockedJob(m, id, { sub: customerId, role: 'CUSTOMER' });
            if (job.status !== service_request_entity_1.JobStatus.AWAITING_PAYMENT)
                return { success: false, message: 'Job is not awaiting acceptance/payment.' };
            const simulation = (0, pricing_1.paymentMode)() === 'simulation';
            if (simulation && !simulationResult)
                return { success: true, simulationRequired: true, message: 'TEST PAYMENT — no real money will be charged.' };
            if (simulation && simulationResult !== 'success')
                return { success: false, message: 'Test payment cancelled or failed. Job remains unpaid.' };
            if (job.paymentMode !== (0, pricing_1.paymentMode)())
                throw new common_1.BadRequestException('Job payment environment does not match this server');
            const amount = (0, money_1.minorUnits)(job.totalAmount);
            if (testFunding && process.env.NODE_ENV !== 'test')
                throw new common_1.BadRequestException('Test funding is disabled outside automated tests');
            const customerWallet = (await this.accounts(m, ['customer:' + customerId])).get('customer:' + customerId);
            const walletFunds = BigInt(customerWallet.balanceMinor);
            if (!testFunding && !simulation && walletFunds < amount) {
                if (!job.customerAcceptedAt) {
                    job.customerAcceptedAt = new Date();
                    await m.getRepository(service_request_entity_1.ServiceRequest).save(job);
                    await this.event(m, job, 'CUSTOMER_ACCEPTED', customerId, { amount: (0, money_1.money)(amount), currency: 'INR' });
                }
                return { success: true, checkoutRequired: true, message: 'Complete Razorpay checkout, then refresh this job.', job };
            }
            const walletUsed = walletFunds < amount ? walletFunds : amount;
            if (walletUsed > 0n)
                await this.transfer(m, 'wallet-hold:' + id, customerWallet.key, 'escrow:' + id, walletUsed, 'WALLET_PAYMENT', id, 'Customer wallet payment held pending completion approval');
            if (walletUsed < amount || amount === 0n)
                await this.transfer(m, 'hold:' + id, (simulation ? 'external:simulation:' : testFunding ? 'external:test:' : 'external:zero:') + id, 'escrow:' + id, amount - walletUsed, 'PAYMENT_HELD', id, simulation ? 'SIMULATED payment — no real money' : testFunding ? 'Automated test payment' : 'No-charge job confirmed');
            await m.getRepository(wallet_transaction_entity_1.WalletTransaction).save({ mechanic: { id: job.mechanic.id }, serviceRequest: { id }, amount: Number(job.totalAmount), status: wallet_transaction_entity_1.WalletStatus.ESCROW, description: 'Payment held in company escrow' });
            job.customerAcceptedAt = new Date();
            job.confirmedAt = new Date();
            job.status = service_request_entity_1.JobStatus.PAYMENT_SECURED;
            await m.getRepository(service_request_entity_1.ServiceRequest).save(job);
            await this.event(m, job, 'JOB_CONFIRMED', customerId, { amount: (0, money_1.money)(amount), currency: 'INR', paymentMode: simulation ? 'simulation' : testFunding ? 'TEST' : 'WALLET' });
            return { success: true, message: simulation ? 'TEST job confirmed. Simulated funds held until completion approval; no real charge.' : 'Job confirmed. Funds held until you confirm completion.', job };
        });
        if ('checkoutRequired' in result && result.checkoutRequired) {
            const checkout = await (0, razorpay_1.razorpayLink)(id, (0, money_1.minorUnits)(result.job.totalAmount));
            await this.jobs.update(id, { razorpayLinkId: checkout.id, checkoutUrl: checkout.url });
            return { success: true, checkoutUrl: checkout.url, message: result.message };
        }
        if (result.success && 'job' in result)
            this.notify(result.job, 'payment_secured');
        return { success: result.success, message: result.message, simulationRequired: 'simulationRequired' in result && result.simulationRequired };
    }
    async requestCompletion(id, providerId) {
        const result = await this.jobs.manager.transaction(async (m) => {
            const job = await this.lockedJob(m, id, { sub: providerId, role: 'MECHANIC' });
            if (![service_request_entity_1.JobStatus.PAYMENT_SECURED, service_request_entity_1.JobStatus.EN_ROUTE].includes(job.status))
                return { success: false, message: 'Job is not ready for completion.' };
            job.status = service_request_entity_1.JobStatus.AWAITING_CUSTOMER_CONFIRMATION;
            job.completionRequestedAt = new Date();
            await m.getRepository(service_request_entity_1.ServiceRequest).save(job);
            await this.event(m, job, 'COMPLETION_REQUESTED', providerId);
            return { success: true, message: 'Waiting for customer approval. Funds remain held.', job };
        });
        if (result.success && 'job' in result)
            this.notify(result.job, 'completion_requested');
        return { success: result.success, message: result.message };
    }
    async startJourney(id, providerId) {
        return this.jobs.manager.transaction(async (m) => {
            const job = await this.lockedJob(m, id, { sub: providerId, role: 'MECHANIC' });
            if (job.status !== service_request_entity_1.JobStatus.PAYMENT_SECURED)
                return { success: false, message: 'Job is not ready to start.' };
            await m.getRepository(service_request_entity_1.ServiceRequest).update(id, { status: service_request_entity_1.JobStatus.EN_ROUTE });
            await this.event(m, job, 'JOURNEY_STARTED', providerId);
            return { success: true, message: 'Journey started.' };
        });
    }
    async gatewayCaptured(payload) {
        if ((0, pricing_1.paymentMode)() === 'simulation')
            throw new common_1.BadRequestException('Real gateway callbacks are disabled in simulation mode');
        if (payload?.event !== 'payment_link.paid')
            return { received: true };
        const link = payload.payload?.payment_link?.entity;
        const payment = payload.payload?.payment?.entity;
        if (typeof link?.reference_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(link.reference_id))
            throw new common_1.BadRequestException('Invalid payment reference');
        if (!link || !payment || payment.status !== 'captured' || link.status !== 'paid' || link.currency !== 'INR' || payment.currency !== 'INR' || !Number.isSafeInteger(payment.amount) || payment.amount < 0 || typeof payment.id !== 'string')
            throw new common_1.BadRequestException('Invalid captured payment');
        const result = await this.jobs.manager.transaction(async (m) => {
            const found = await m.getRepository(service_request_entity_1.ServiceRequest).findOne({ where: { id: link.reference_id }, relations: { customer: true } });
            if (!found)
                throw new common_1.NotFoundException('Payment job not found');
            const job = await this.lockedJob(m, found.id, { sub: found.customer.id, role: 'CUSTOMER' });
            if (await m.getRepository(payment_ledger_entity_1.PaymentLedger).existsBy({ reference: 'razorpay:' + payment.id }))
                return { received: true };
            const amount = (0, money_1.minorUnits)(job.totalAmount);
            if (!job.customerAcceptedAt || BigInt(payment.amount) !== amount || link.amount !== payment.amount || link.amount_paid !== payment.amount || (job.razorpayLinkId && job.razorpayLinkId !== link.id))
                throw new common_1.BadRequestException('Payment does not match the accepted job');
            const canHold = job.status === service_request_entity_1.JobStatus.AWAITING_PAYMENT;
            await this.transfer(m, 'razorpay:' + payment.id, 'external:razorpay:' + payment.id, canHold ? 'escrow:' + job.id : 'customer:' + job.customer.id, amount, canHold ? 'PAYMENT_HELD' : 'LATE_PAYMENT_REFUND', job.id, canHold ? 'Verified Razorpay capture held pending customer completion approval' : 'Captured after job cancellation/payment; credited to customer wallet');
            if (canHold) {
                job.status = service_request_entity_1.JobStatus.PAYMENT_SECURED;
                job.confirmedAt = new Date();
                job.razorpayLinkId = link.id;
                await m.getRepository(service_request_entity_1.ServiceRequest).save(job);
                await m.getRepository(wallet_transaction_entity_1.WalletTransaction).save({ mechanic: { id: job.mechanic.id }, serviceRequest: { id: job.id }, amount: Number(job.totalAmount), status: wallet_transaction_entity_1.WalletStatus.ESCROW, description: 'Razorpay payment held in company escrow' });
            }
            await this.event(m, job, canHold ? 'JOB_CONFIRMED' : 'LATE_PAYMENT_REFUNDED', 'RAZORPAY', { paymentId: payment.id, amount: (0, money_1.money)(amount), currency: 'INR' });
            return { received: true, job, canHold };
        });
        if ('job' in result && result.canHold)
            this.notify(result.job, 'payment_secured');
        return { received: true };
    }
    async confirmCompletion(id, customerId) {
        const result = await this.jobs.manager.transaction(async (m) => {
            const job = await this.lockedJob(m, id, { sub: customerId, role: 'CUSTOMER' });
            if (job.status !== service_request_entity_1.JobStatus.AWAITING_CUSTOMER_CONFIRMATION)
                return { success: false, message: 'Job is not awaiting your completion approval.' };
            const account = await this.providerAccount(m, job.mechanic.id);
            const escrow = await this.escrow(m, job);
            const net = job.providerNetMinor == null ? (0, money_1.minorUnits)(job.totalAmount) : BigInt(job.providerNetMinor);
            const commission = BigInt(job.commissionMinor || '0');
            const fee = BigInt(job.platformFeeMinor || '0');
            if (net + commission + fee !== (0, money_1.minorUnits)(job.totalAmount))
                throw new common_1.BadRequestException('Job settlement does not balance');
            await this.transfer(m, 'release:' + id, escrow, account.key, net, 'PROVIDER_CREDIT', id, 'Customer confirmed completion; provider net earnings released');
            if (commission > 0n)
                await this.transfer(m, 'commission:' + id, escrow, 'company:commission', commission, 'COMPANY_COMMISSION', id, 'Commission at the quotation policy rate');
            if (fee > 0n)
                await this.transfer(m, 'platform-fee:' + id, escrow, 'company:platform-fee', fee, 'PLATFORM_FEE', id, 'Platform fee at quotation');
            job.status = service_request_entity_1.JobStatus.COMPLETED;
            job.completedAt = new Date();
            await m.getRepository(service_request_entity_1.ServiceRequest).save(job);
            const updated = await m.getRepository(payment_ledger_entity_1.WalletAccount).findOneByOrFail({ key: account.key });
            await m.getRepository(mechanic_profile_entity_1.MechanicProfile).increment({ user: { id: job.mechanic.id } }, 'completedJobsCount', 1);
            await m.getRepository(mechanic_profile_entity_1.MechanicProfile).update({ user: { id: job.mechanic.id } }, { walletBalance: Number((0, money_1.money)(updated.balanceMinor)) });
            await m.getRepository(wallet_transaction_entity_1.WalletTransaction).update({ serviceRequest: { id }, status: wallet_transaction_entity_1.WalletStatus.ESCROW }, { status: wallet_transaction_entity_1.WalletStatus.AVAILABLE, amount: Number((0, money_1.money)(net)) });
            await this.event(m, job, 'CUSTOMER_CONFIRMED_COMPLETION', customerId, { amount: String(job.totalAmount), currency: 'INR' });
            return { success: true, message: 'Completion confirmed. Funds released to provider.', job };
        });
        if (result.success && 'job' in result)
            this.notify(result.job, 'job_completed');
        return { success: result.success, message: result.message };
    }
    async cancel(id, actor, reason) {
        if (typeof reason !== 'string' || !reason.trim() || reason.length > 500)
            throw new common_1.BadRequestException('Cancellation reason is required (up to 500 characters)');
        const result = await this.jobs.manager.transaction(async (m) => {
            const job = await this.lockedJob(m, id, actor);
            if ([service_request_entity_1.JobStatus.COMPLETED, service_request_entity_1.JobStatus.CANCELLED].includes(job.status))
                return { success: false, message: 'Job is already completed or cancelled.' };
            let refunded = '0.00';
            if ([service_request_entity_1.JobStatus.PAYMENT_SECURED, service_request_entity_1.JobStatus.EN_ROUTE, service_request_entity_1.JobStatus.AWAITING_CUSTOMER_CONFIRMATION].includes(job.status)) {
                const escrow = await this.escrow(m, job);
                await this.transfer(m, 'refund:' + id, escrow, 'customer:' + job.customer.id, (0, money_1.minorUnits)(job.totalAmount), 'CUSTOMER_REFUND', id, 'Full cancellation refund to customer wallet');
                refunded = String(job.totalAmount);
                await m.getRepository(wallet_transaction_entity_1.WalletTransaction).update({ serviceRequest: { id }, status: wallet_transaction_entity_1.WalletStatus.ESCROW }, { status: wallet_transaction_entity_1.WalletStatus.CANCELLED });
            }
            job.status = service_request_entity_1.JobStatus.CANCELLED;
            job.cancelledBy = actor.sub;
            job.cancellationReason = reason.trim();
            await m.getRepository(service_request_entity_1.ServiceRequest).save(job);
            await this.event(m, job, 'CANCELLED', actor.sub, { reason: reason.trim(), refund: refunded, currency: 'INR' });
            return { success: true, message: `Job cancelled. INR ${refunded} refunded to customer wallet.`, job };
        });
        if (result.success && 'job' in result)
            this.notify(result.job, 'job_cancelled', { message: result.message });
        return { success: result.success, message: result.message };
    }
    async withdraw(providerId, requestId) {
        if (!/^[\w-]{8,100}$/.test(requestId))
            throw new common_1.BadRequestException('A stable withdrawal request ID is required');
        return this.jobs.manager.transaction(async (m) => {
            await (0, pricing_1.ensurePaymentEnvironment)(m);
            const account = await this.providerAccount(m, providerId);
            const ledger = m.getRepository(payment_ledger_entity_1.PaymentLedger);
            const previous = await ledger.findOneBy({ reference: `withdraw:${providerId}:${requestId}` });
            if (previous)
                return { success: true, message: 'Withdrawal already recorded.', transactionId: previous.id };
            const count = await ledger.countBy({ fromAccount: { id: account.id }, kind: 'WITHDRAWAL_REQUESTED', createdAt: (0, typeorm_1.MoreThanOrEqual)((0, money_1.withdrawalWeek)()) });
            const legacyCount = await m.getRepository(wallet_transaction_entity_1.WalletTransaction).count({ where: { mechanic: { id: providerId }, status: wallet_transaction_entity_1.WalletStatus.WITHDRAWN, createdAt: (0, typeorm_1.MoreThanOrEqual)((0, money_1.withdrawalWeek)()) } });
            if (count + legacyCount >= 5)
                return { success: false, message: 'Weekly limit reached: five withdrawals per Monday–Sunday week (India time).' };
            const amount = BigInt(account.balanceMinor);
            if (amount <= 0n)
                return { success: false, message: 'No available balance to withdraw.' };
            const transfer = await this.transfer(m, `withdraw:${providerId}:${requestId}`, account.key, 'payout:' + providerId, amount, 'WITHDRAWAL_REQUESTED', null, 'Withdrawal reserved for payout; bank transfer not yet processed');
            const credits = await ledger.createQueryBuilder('credit').leftJoinAndSelect('credit.job', 'job')
                .where('credit."toAccountId" = :accountId', { accountId: account.id })
                .andWhere(qb => 'credit."amountMinor" > COALESCE(' + qb.subQuery().select('SUM(a."amountMinor")').from(payment_ledger_entity_1.WithdrawalAllocation, 'a').where('a."providerId" = :providerId AND a."jobId" IS NOT DISTINCT FROM credit."jobId"').getQuery() + ', 0)', { providerId })
                .orderBy('credit.createdAt', 'ASC').addOrderBy('credit.id', 'ASC').getMany();
            const allocations = await m.getRepository(payment_ledger_entity_1.WithdrawalAllocation).createQueryBuilder('a').select('a."jobId"', 'jobId').addSelect('SUM(a."amountMinor")', 'amount').where('a."providerId" = :providerId', { providerId }).groupBy('a."jobId"').getRawMany();
            const used = new Map(allocations.map(a => [a.jobId ?? 'legacy', BigInt(a.amount)]));
            let remaining = amount;
            for (const credit of credits) {
                const key = credit.job?.id ?? 'legacy';
                const consumed = used.get(key) ?? 0n;
                const original = BigInt(credit.amountMinor);
                const available = original > consumed ? original - consumed : 0n;
                used.set(key, consumed > original ? consumed - original : 0n);
                const take = available > remaining ? remaining : available;
                if (take > 0n)
                    await m.getRepository(payment_ledger_entity_1.WithdrawalAllocation).save({ providerId, withdrawal: { id: transfer.id }, job: credit.job ? { id: credit.job.id } : null, amountMinor: take.toString() });
                remaining -= take;
                if (remaining === 0n)
                    break;
            }
            if (remaining !== 0n)
                throw new common_1.BadRequestException('Wallet allocation mismatch');
            await m.getRepository(mechanic_profile_entity_1.MechanicProfile).update({ user: { id: providerId } }, { walletBalance: 0, lastWithdrawalDate: new Date() });
            return { success: true, message: (0, pricing_1.paymentMode)() !== 'live' ? `TEST withdrawal: INR ${(0, money_1.money)(amount)} reserved. No bank transfer or real money.` : `INR ${(0, money_1.money)(amount)} reserved for withdrawal. Bank payout is pending.`, transactionId: transfer.id };
        });
    }
    async history(actor, before) {
        await this.jobs.manager.transaction(pricing_1.ensurePaymentEnvironment);
        const provider = ['MECHANIC', 'FLEET_DRIVER'].includes(actor.role);
        const key = (provider ? 'provider:' : 'customer:') + actor.sub;
        if (provider)
            await this.jobs.manager.transaction(m => this.providerAccount(m, actor.sub));
        const account = await this.jobs.manager.getRepository(payment_ledger_entity_1.WalletAccount).findOneBy({ key });
        const query = this.jobs.createQueryBuilder('job').where(provider ? 'job."mechanicId" = :id' : 'job."customerId" = :id', { id: actor.sub }).orderBy('job.createdAt', 'DESC').addOrderBy('job.id', 'DESC').take(21);
        if (before) {
            const cursor = await this.jobs.findOneBy({ id: before });
            if (!cursor)
                throw new common_1.BadRequestException('Invalid history cursor');
            query.andWhere('(job."createdAt", job.id) < (:created, :cursorId)', { created: cursor.createdAt, cursorId: cursor.id });
        }
        const rows = await query.getMany();
        const count = account ? await this.jobs.manager.getRepository(payment_ledger_entity_1.PaymentLedger).countBy({ fromAccount: { id: account.id }, kind: 'WITHDRAWAL_REQUESTED', createdAt: (0, typeorm_1.MoreThanOrEqual)((0, money_1.withdrawalWeek)()) }) : 0;
        const legacyCount = provider ? await this.jobs.manager.getRepository(wallet_transaction_entity_1.WalletTransaction).countBy({ mechanic: { id: actor.sub }, status: wallet_transaction_entity_1.WalletStatus.WITHDRAWN, createdAt: (0, typeorm_1.MoreThanOrEqual)((0, money_1.withdrawalWeek)()) }) : 0;
        return { paymentMode: (0, pricing_1.paymentMode)(), balance: (0, money_1.money)(account?.balanceMinor ?? '0'), currency: 'INR', withdrawalsRemaining: Math.max(0, 5 - count - legacyCount), jobs: rows.slice(0, 20).map(job => this.publicJob(job, provider)), nextCursor: rows.length > 20 ? rows[19].id : null };
    }
    async transactions(actor, before) {
        await this.jobs.manager.transaction(pricing_1.ensurePaymentEnvironment);
        const provider = ['MECHANIC', 'FLEET_DRIVER'].includes(actor.role);
        const key = (provider ? 'provider:' : 'customer:') + actor.sub;
        const q = this.jobs.manager.getRepository(payment_ledger_entity_1.PaymentLedger).createQueryBuilder('entry')
            .leftJoinAndSelect('entry.fromAccount', 'source').leftJoinAndSelect('entry.toAccount', 'destination').leftJoinAndSelect('entry.job', 'job')
            .where(provider ? '(source.key = :key OR destination.key = :key OR job."mechanicId" = :actorId)' : '(source.key = :key OR destination.key = :key OR job."customerId" = :actorId)', { key, actorId: actor.sub })
            .orderBy('entry.createdAt', 'DESC').addOrderBy('entry.id', 'DESC').take(21);
        if (!provider)
            q.andWhere('entry.kind NOT IN (:...internalKinds)', { internalKinds: ['PROVIDER_CREDIT', 'COMPANY_COMMISSION', 'PLATFORM_FEE'] });
        if (before) {
            const cursor = await this.jobs.manager.getRepository(payment_ledger_entity_1.PaymentLedger).findOneBy({ id: before });
            if (!cursor)
                throw new common_1.BadRequestException('Invalid transaction cursor');
            q.andWhere('(entry."createdAt", entry.id) < (:created, :cursorId)', { created: cursor.createdAt, cursorId: cursor.id });
        }
        const rows = await q.getMany();
        const transactions = await Promise.all(rows.slice(0, 20).map(async (row) => ({ id: row.id, jobId: row.job?.id ?? null, kind: row.kind, description: row.description, amount: (0, money_1.money)(row.amountMinor), currency: row.currency, direction: row.toAccount.key === key ? 'CREDIT' : row.fromAccount.key === key ? 'DEBIT' : 'JOB_PAYMENT', createdAt: row.createdAt,
            allocations: row.kind === 'WITHDRAWAL_REQUESTED' ? (await this.jobs.manager.getRepository(payment_ledger_entity_1.WithdrawalAllocation).find({ where: { withdrawal: { id: row.id } }, relations: { job: true } })).map(a => ({ jobId: a.job?.id ?? null, amount: (0, money_1.money)(a.amountMinor) })) : [] })));
        return { transactions, nextCursor: rows.length > 20 ? rows[19].id : null };
    }
    async detail(id, actor) {
        return this.jobs.manager.transaction(async (m) => {
            const job = await this.lockedJob(m, id, actor);
            const events = await m.getRepository(payment_ledger_entity_1.JobEvent).find({ where: { job: { id } }, order: { createdAt: 'ASC', id: 'ASC' } });
            const entries = await m.getRepository(payment_ledger_entity_1.PaymentLedger).find({ where: { job: { id } }, order: { createdAt: 'ASC', id: 'ASC' } });
            const provider = actor.role !== 'CUSTOMER';
            return { job: this.publicJob(job, provider), events: events.map(({ job: _, ...e }) => provider ? e : { id: e.id, type: e.type, createdAt: e.createdAt, details: {} }), payments: entries.filter(e => provider || !['PROVIDER_CREDIT', 'COMPANY_COMMISSION', 'PLATFORM_FEE'].includes(e.kind)).map(e => ({ id: e.id, kind: e.kind, amount: (0, money_1.money)(e.amountMinor), currency: e.currency, createdAt: e.createdAt })) };
        });
    }
    publicJob(job, provider) {
        const { customer, mechanic, completionOtp, commissionBps, commissionMinor, providerNetMinor, pricingRevision, travelingCharge, serviceCharge, ...safe } = job;
        const customerView = { ...safe, quotationAmount: (0, money_1.money)((0, money_1.minorUnits)(job.totalAmount) - BigInt(job.platformFeeMinor || '0')), platformFee: (0, money_1.money)(job.platformFeeMinor || '0') };
        return provider ? { ...customerView, commissionBps, commission: (0, money_1.money)(commissionMinor || '0'), providerNet: (0, money_1.money)(providerNetMinor ?? (0, money_1.minorUnits)(job.totalAmount)), travelingCharge, serviceCharge, pricingRevision } : customerView;
    }
}
exports.JobPaymentsService = JobPaymentsService;


/***/ }),
/* 51 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WalletTransaction = exports.WalletStatus = void 0;
const typeorm_1 = __webpack_require__(11);
const provider_user_entity_1 = __webpack_require__(14);
const service_request_entity_1 = __webpack_require__(30);
var WalletStatus;
(function (WalletStatus) {
    WalletStatus["ESCROW"] = "ESCROW";
    WalletStatus["AVAILABLE"] = "AVAILABLE";
    WalletStatus["WITHDRAWN"] = "WITHDRAWN";
    WalletStatus["CANCELLED"] = "CANCELLED";
})(WalletStatus || (exports.WalletStatus = WalletStatus = {}));
let WalletTransaction = class WalletTransaction {
    id;
    mechanic;
    serviceRequest;
    amount;
    status;
    description;
    createdAt;
    updatedAt;
};
exports.WalletTransaction = WalletTransaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WalletTransaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => provider_user_entity_1.ProviderUser, { onDelete: 'CASCADE' }),
    __metadata("design:type", typeof (_a = typeof provider_user_entity_1.ProviderUser !== "undefined" && provider_user_entity_1.ProviderUser) === "function" ? _a : Object)
], WalletTransaction.prototype, "mechanic", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => service_request_entity_1.ServiceRequest, { nullable: true, onDelete: 'SET NULL' }),
    __metadata("design:type", typeof (_b = typeof service_request_entity_1.ServiceRequest !== "undefined" && service_request_entity_1.ServiceRequest) === "function" ? _b : Object)
], WalletTransaction.prototype, "serviceRequest", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], WalletTransaction.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: WalletStatus,
        default: WalletStatus.ESCROW,
    }),
    __metadata("design:type", String)
], WalletTransaction.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WalletTransaction.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_c = typeof Date !== "undefined" && Date) === "function" ? _c : Object)
], WalletTransaction.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_d = typeof Date !== "undefined" && Date) === "function" ? _d : Object)
], WalletTransaction.prototype, "updatedAt", void 0);
exports.WalletTransaction = WalletTransaction = __decorate([
    (0, typeorm_1.Entity)('wallet_transactions')
], WalletTransaction);


/***/ }),
/* 52 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.verifyRazorpayWebhook = verifyRazorpayWebhook;
exports.razorpayLink = razorpayLink;
const common_1 = __webpack_require__(3);
const crypto_1 = __webpack_require__(23);
const pricing_1 = __webpack_require__(53);
function verifyRazorpayWebhook(raw, signature, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
    if (!secret)
        throw new common_1.ServiceUnavailableException('Payment verification is not configured');
    if (!raw || !signature || !/^[a-f0-9]{64}$/i.test(signature))
        throw new common_1.UnauthorizedException('Invalid webhook signature');
    const expected = (0, crypto_1.createHmac)('sha256', secret).update(raw).digest();
    if (!(0, crypto_1.timingSafeEqual)(expected, Buffer.from(signature, 'hex')))
        throw new common_1.UnauthorizedException('Invalid webhook signature');
}
async function razorpayLink(reference, amount) {
    const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret || !process.env.RAZORPAY_WEBHOOK_SECRET)
        throw new common_1.ServiceUnavailableException('Razorpay checkout is not configured yet. Please contact support.');
    const mode = (0, pricing_1.paymentMode)();
    if (mode === 'simulation' || !key.startsWith(mode === 'razorpay_test' ? 'rzp_test_' : 'rzp_live_'))
        throw new common_1.ServiceUnavailableException('Razorpay key does not match the configured payment environment');
    const headers = { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'), 'Content-Type': 'application/json' };
    async function api(path, body) {
        const response = await fetch('https://api.razorpay.com/v1/payment_links/' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
        if (!response.ok)
            throw new common_1.ServiceUnavailableException('Payment gateway unavailable. Retry to recover the existing checkout.');
        return response.json();
    }
    const found = await api('?reference_id=' + encodeURIComponent(reference));
    let link = found.payment_links?.[0];
    if (!link) {
        try {
            link = await api('', { reference_id: reference, amount: Number(amount), currency: 'INR', accept_partial: false,
                description: 'QuickMechanic job ' + reference, notes: { jobId: reference }, notify: { sms: false, email: false }, reminder_enable: false });
        }
        catch {
            link = (await api('?reference_id=' + encodeURIComponent(reference))).payment_links?.[0];
            if (!link)
                throw new common_1.ServiceUnavailableException('Checkout could not be created. Please retry.');
        }
    }
    if (link.amount !== Number(amount) || link.currency !== 'INR' || ['expired', 'cancelled'].includes(link.status))
        throw new common_1.BadRequestException('Checkout requires payment support review');
    const url = new URL(link.short_url);
    if (url.protocol !== 'https:' || !['rzp.io', 'razorpay.com'].some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)))
        throw new common_1.BadRequestException('Invalid checkout URL');
    return { id: String(link.id), url: url.toString() };
}


/***/ }),
/* 53 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.paymentMode = paymentMode;
exports.ensurePaymentEnvironment = ensurePaymentEnvironment;
exports.calculateQuote = calculateQuote;
exports.currentPolicy = currentPolicy;
exports.travelCharge = travelCharge;
const common_1 = __webpack_require__(3);
const pricing_policy_entity_1 = __webpack_require__(54);
const payment_ledger_entity_1 = __webpack_require__(39);
const wallet_transaction_entity_1 = __webpack_require__(51);
const mechanic_profile_entity_1 = __webpack_require__(16);
const money_1 = __webpack_require__(38);
function paymentMode() {
    const mode = process.env.PAYMENT_MODE || 'live';
    if (!['simulation', 'razorpay_test', 'live'].includes(mode))
        throw new common_1.BadRequestException('Invalid PAYMENT_MODE');
    return mode;
}
async function ensurePaymentEnvironment(m) {
    const mode = paymentMode();
    const repo = m.getRepository(pricing_policy_entity_1.PaymentEnvironment);
    let saved = await repo.findOneBy({ id: 1 });
    if (!saved) {
        await m.query('SELECT pg_advisory_xact_lock(73100921)');
        saved = await repo.findOneBy({ id: 1 });
        if (!saved) {
            if (mode !== 'live' && (await m.getRepository(payment_ledger_entity_1.PaymentLedger).count() || await m.getRepository(wallet_transaction_entity_1.WalletTransaction).count() || await m.getRepository(mechanic_profile_entity_1.MechanicProfile).createQueryBuilder('p').where('p."walletBalance" > 0').getCount())) {
                throw new common_1.BadRequestException('Use a separate empty payment database for test mode. Existing funds cannot be converted.');
            }
            saved = await repo.save({ id: 1, mode });
        }
    }
    if (saved.mode !== mode)
        throw new common_1.BadRequestException('Payment environment mismatch. Use a separate database when switching between simulated, gateway-test and live money.');
    return mode;
}
function calculateQuote(base, commissionBps, platformFeeMinor) {
    const baseMinor = (0, money_1.minorUnits)(base);
    if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000)
        throw new common_1.BadRequestException('Commission must be between 0 and 100 percent');
    const platform = BigInt(platformFeeMinor);
    if (platform !== 0n && (platform < 200n || platform > 500n))
        throw new common_1.BadRequestException('Platform fee must be disabled or between INR 2 and 5');
    const commission = (baseMinor * BigInt(commissionBps) + 5000n) / 10000n;
    const total = baseMinor + platform;
    if (total > 9999999999n)
        throw new common_1.BadRequestException('Quotation exceeds supported amount');
    return { providerNetMinor: (baseMinor - commission).toString(), commissionMinor: commission.toString(), platformFeeMinor: platform.toString(), commissionBps, quotationAmount: (0, money_1.money)(baseMinor), totalAmount: Number((0, money_1.money)(total)) };
}
async function currentPolicy(m) {
    return await m.getRepository(pricing_policy_entity_1.PricingPolicy).findOne({ where: {}, order: { revision: 'DESC' } }) ?? { revision: 0, commissionBps: 0, platformFeeMinor: '200', travelMinimumMinor: '5000', travelIncludedMeters: 2500, travelPerKmMinor: '800' };
}
function travelCharge(distanceMeters, policy) {
    if (!Number.isSafeInteger(distanceMeters) || distanceMeters < 0 || distanceMeters > 1000000)
        throw new common_1.BadRequestException('Invalid road distance');
    const extra = BigInt(Math.max(0, distanceMeters - policy.travelIncludedMeters));
    return BigInt(policy.travelMinimumMinor) + (extra * BigInt(policy.travelPerKmMinor) + 500n) / 1000n;
}


/***/ }),
/* 54 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PaymentEnvironment = exports.PricingPolicy = void 0;
const typeorm_1 = __webpack_require__(11);
let PricingPolicy = class PricingPolicy {
    revision;
    commissionBps;
    platformFeeMinor;
    travelMinimumMinor;
    travelIncludedMeters;
    travelPerKmMinor;
    changedBy;
    createdAt;
};
exports.PricingPolicy = PricingPolicy;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PricingPolicy.prototype, "revision", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], PricingPolicy.prototype, "commissionBps", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }),
    __metadata("design:type", String)
], PricingPolicy.prototype, "platformFeeMinor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: '5000' }),
    __metadata("design:type", String)
], PricingPolicy.prototype, "travelMinimumMinor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 2500 }),
    __metadata("design:type", Number)
], PricingPolicy.prototype, "travelIncludedMeters", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: '800' }),
    __metadata("design:type", String)
], PricingPolicy.prototype, "travelPerKmMinor", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PricingPolicy.prototype, "changedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], PricingPolicy.prototype, "createdAt", void 0);
exports.PricingPolicy = PricingPolicy = __decorate([
    (0, typeorm_1.Entity)('pricing_policies')
], PricingPolicy);
let PaymentEnvironment = class PaymentEnvironment {
    id;
    mode;
};
exports.PaymentEnvironment = PaymentEnvironment;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'integer' }),
    __metadata("design:type", Number)
], PaymentEnvironment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PaymentEnvironment.prototype, "mode", void 0);
exports.PaymentEnvironment = PaymentEnvironment = __decorate([
    (0, typeorm_1.Entity)('payment_environment')
], PaymentEnvironment);


/***/ }),
/* 55 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AutomaticQuoteService = void 0;
exports.savedServicePrice = savedServicePrice;
const common_1 = __webpack_require__(3);
const axios_1 = __importDefault(__webpack_require__(46));
const service_request_entity_1 = __webpack_require__(30);
const mechanic_profile_entity_1 = __webpack_require__(16);
const provider_eligibility_1 = __webpack_require__(37);
const mechanic_pricing_entity_1 = __webpack_require__(29);
const pricing_1 = __webpack_require__(53);
const money_1 = __webpack_require__(38);
async function savedServicePrice(m, providerId, service, vehicleId) {
    const q = m.getRepository(mechanic_pricing_entity_1.MechanicPricing).createQueryBuilder('price')
        .innerJoinAndSelect('price.serviceType', 'service').innerJoinAndSelect('price.vehicleCategory', 'vehicle')
        .innerJoin('price.mechanicProfile', 'profile')
        .innerJoin('profile.providedServices', 'offered')
        .innerJoin('profile.supportedVehicles', 'supported')
        .where('profile."userId" = :providerId', { providerId })
        .andWhere('offered.id = service.id AND supported.id = vehicle.id')
        .andWhere('(service.name = :service OR CAST(service.id AS text) = :service)', { service })
        .andWhere('service."isActive" = true AND vehicle."isActive" = true');
    if (vehicleId)
        q.andWhere('CAST(vehicle.id AS text) = :vehicleId', { vehicleId });
    const prices = await q.take(2).getMany();
    if (!prices.length)
        throw new common_1.BadRequestException('No saved price for this service and vehicle. Update Service Config before accepting this job.');
    (0, money_1.minorUnits)(prices[0].price);
    return prices[0];
}
class AutomaticQuoteService {
    jobs;
    payments;
    gateway;
    pending = new Map();
    constructor(jobs, payments, gateway) {
        this.jobs = jobs;
        this.payments = payments;
        this.gateway = gateway;
    }
    prepare(id, providerId) {
        const key = providerId + ':' + id;
        if (this.pending.has(key))
            return this.pending.get(key);
        const request = this.prepareOnce(id, providerId).finally(() => this.pending.delete(key));
        this.pending.set(key, request);
        return request;
    }
    view(job) {
        return { jobId: job.id, serviceType: job.serviceType, vehicleCategoryId: job.vehicleCategoryId,
            distanceInKm: job.distanceInKm, routeDistanceMeters: job.routeDistanceMeters, travelingCharge: job.travelingCharge,
            serviceCharge: job.serviceCharge, quotationAmount: (0, money_1.money)((0, money_1.minorUnits)(job.serviceCharge) + (0, money_1.minorUnits)(job.travelingCharge)),
            totalAmount: job.totalAmount, commissionBps: job.commissionBps, commission: (0, money_1.money)(job.commissionMinor),
            providerNet: (0, money_1.money)(job.providerNetMinor), platformFee: (0, money_1.money)(job.platformFeeMinor), paymentMode: job.paymentMode,
            pricingRevision: job.pricingRevision, preparedAt: job.autoQuotePreparedAt };
    }
    async prepareOnce(id, providerId) {
        await this.jobs.manager.transaction(pricing_1.ensurePaymentEnvironment);
        let job = await this.jobs.createQueryBuilder('job').where('job.id = :id AND job."mechanicId" = :providerId', { id, providerId }).getOne();
        if (!job)
            throw new common_1.NotFoundException('Job not found');
        if (job.autoQuotePreparedAt)
            return this.view(job);
        if (job.status === service_request_entity_1.JobStatus.REQUESTED) {
            await this.jobs.manager.transaction(async (m) => {
                await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [providerId]);
                const locked = await m.getRepository(service_request_entity_1.ServiceRequest).createQueryBuilder('j').where('j.id = :id AND j."mechanicId" = :providerId', { id, providerId }).setLock('pessimistic_write').getOne();
                if (!locked)
                    throw new common_1.NotFoundException('Job not found');
                if (locked.status === service_request_entity_1.JobStatus.REQUESTED) {
                    const eligible = await m.getRepository(mechanic_profile_entity_1.MechanicProfile).findOne({ where: { user: { id: providerId } }, relations: { user: true } });
                    (0, provider_eligibility_1.requireProviderEligibility)(eligible, eligible?.user.phoneNumber);
                    const busy = await m.getRepository(service_request_entity_1.ServiceRequest).createQueryBuilder('active')
                        .where('active."mechanicId" = :providerId', { providerId })
                        .andWhere('active.status IN (:...states)', { states: [service_request_entity_1.JobStatus.ACCEPTED, service_request_entity_1.JobStatus.AWAITING_PAYMENT, service_request_entity_1.JobStatus.PAYMENT_SECURED, service_request_entity_1.JobStatus.EN_ROUTE, service_request_entity_1.JobStatus.AWAITING_CUSTOMER_CONFIRMATION] })
                        .getCount();
                    if (busy)
                        throw new common_1.BadRequestException('You already have an active job. Finish or cancel it first.');
                    locked.status = service_request_entity_1.JobStatus.ACCEPTED;
                    locked.providerAcceptedAt = new Date();
                    await m.getRepository(service_request_entity_1.ServiceRequest).save(locked);
                    await this.payments.event(m, locked, 'PROVIDER_ACCEPTED', providerId, { source: 'QUOTE_PREPARE_RACE_RECOVERY' });
                }
            });
            job = await this.jobs.createQueryBuilder('job').where('job.id = :id AND job."mechanicId" = :providerId', { id, providerId }).getOne();
        }
        if (!job)
            throw new common_1.NotFoundException('Job not found');
        if (job.status !== service_request_entity_1.JobStatus.ACCEPTED)
            throw new common_1.BadRequestException('Job is no longer awaiting provider quotation');
        const profile = await this.jobs.manager.getRepository(mechanic_profile_entity_1.MechanicProfile).createQueryBuilder('profile').where('profile."userId" = :providerId', { providerId }).getOne();
        if (!profile)
            throw new common_1.NotFoundException('Provider profile not found. Sign in again or complete provider setup.');
        const origin = profile.currentLocation?.coordinates;
        const destination = job.breakdownLocation?.coordinates;
        if (!profile.lastSeenAt || profile.lastSeenAt.getTime() < Date.now() - 90000 || !validPoint(origin) || !validPoint(destination))
            throw new common_1.BadRequestException('Fresh provider GPS location is required. Keep location enabled and retry.');
        await savedServicePrice(this.jobs.manager, providerId, job.serviceType, job.vehicleCategoryId);
        let distance;
        try {
            const base = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
            const result = await axios_1.default.get(`${base}/route/v1/driving/${origin.join(',')};${destination.join(',')}?overview=false&steps=false`, { timeout: 8000 });
            const raw = result.data?.routes?.[0]?.distance;
            if (result.data?.code !== 'Ok' || typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0)
                throw new Error('No road route');
            distance = Math.round(raw);
        }
        catch {
            throw new common_1.ServiceUnavailableException('Road distance is unavailable. Retry to calculate travel; no estimated charge has been substituted.');
        }
        return this.jobs.manager.transaction(async (m) => {
            const locked = await m.getRepository(service_request_entity_1.ServiceRequest).createQueryBuilder('j').where('j.id = :id AND j."mechanicId" = :providerId', { id, providerId }).setLock('pessimistic_write').getOneOrFail();
            if (locked.autoQuotePreparedAt)
                return this.view(locked);
            if (locked.status !== service_request_entity_1.JobStatus.ACCEPTED)
                throw new common_1.BadRequestException('Job status changed. Refresh this job.');
            const price = await savedServicePrice(m, providerId, locked.serviceType, locked.vehicleCategoryId);
            const policy = await (0, pricing_1.currentPolicy)(m);
            const travel = (0, pricing_1.travelCharge)(distance, policy);
            const calculated = (0, pricing_1.calculateQuote)((0, money_1.money)((0, money_1.minorUnits)(price.price) + travel), policy.commissionBps, policy.platformFeeMinor);
            Object.assign(locked, { serviceCharge: Number(price.price), travelingCharge: Number((0, money_1.money)(travel)), distanceInKm: Number((distance / 1000).toFixed(2)),
                routeDistanceMeters: distance, vehicleCategoryId: price.vehicleCategory.id, autoQuotePreparedAt: new Date(), pricingRevision: policy.revision,
                commissionBps: calculated.commissionBps, commissionMinor: calculated.commissionMinor, platformFeeMinor: calculated.platformFeeMinor,
                providerNetMinor: calculated.providerNetMinor, totalAmount: calculated.totalAmount, paymentMode: await (0, pricing_1.ensurePaymentEnvironment)(m) });
            await m.getRepository(service_request_entity_1.ServiceRequest).save(locked);
            await this.payments.event(m, locked, 'AUTOMATIC_QUOTE_PREPARED', providerId, { routeDistanceMeters: distance, origin, destination, source: 'OSRM', servicePriceId: price.id, travelMinimumMinor: policy.travelMinimumMinor, travelIncludedMeters: policy.travelIncludedMeters, travelPerKmMinor: policy.travelPerKmMinor });
            return this.view(locked);
        });
    }
    async send(id, providerId) {
        await this.prepare(id, providerId);
        const result = await this.jobs.manager.transaction(async (m) => {
            const locked = await m.getRepository(service_request_entity_1.ServiceRequest).createQueryBuilder('j').where('j.id = :id AND j."mechanicId" = :providerId', { id, providerId }).setLock('pessimistic_write').getOneOrFail();
            if (locked.status === service_request_entity_1.JobStatus.AWAITING_PAYMENT)
                return { sent: false, job: locked };
            if (locked.status !== service_request_entity_1.JobStatus.ACCEPTED)
                throw new common_1.BadRequestException('Job is no longer awaiting a quotation');
            locked.status = service_request_entity_1.JobStatus.AWAITING_PAYMENT;
            await m.getRepository(service_request_entity_1.ServiceRequest).save(locked);
            await this.payments.event(m, locked, 'QUOTE_SENT', providerId, { totalAmount: locked.totalAmount, currency: 'INR' });
            return { sent: true, job: locked };
        });
        if (result.sent) {
            const job = await this.jobs.findOneOrFail({ where: { id }, relations: { customer: true } });
            this.gateway.server.to('customer_' + job.customer.id).emit('quote_received', { jobId: id, distanceInKm: job.distanceInKm, quotationAmount: (0, money_1.money)((0, money_1.minorUnits)(job.serviceCharge) + (0, money_1.minorUnits)(job.travelingCharge)), platformFee: (0, money_1.money)(job.platformFeeMinor), totalAmount: job.totalAmount, paymentMode: job.paymentMode });
        }
        return { success: true, message: 'Saved service price and calculated travel sent to customer.' };
    }
}
exports.AutomaticQuoteService = AutomaticQuoteService;
function validPoint(point) { return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90; }


/***/ }),
/* 56 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DispatchController = void 0;
const common_1 = __webpack_require__(3);
const dispatch_service_1 = __webpack_require__(49);
const jwt_auth_guard_1 = __webpack_require__(25);
let DispatchController = class DispatchController {
    dispatchService;
    constructor(dispatchService) {
        this.dispatchService = dispatchService;
    }
    identity(req, role) {
        const user = req.user;
        if (user.role !== role &&
            !(role === 'MECHANIC' && user.role === 'FLEET_DRIVER')) {
            throw new common_1.ForbiddenException('This action is not available for your role');
        }
        return user.sub;
    }
    async getNearbyMechanics(req, serviceType, lat, lng, vehicleCategoryId) {
        this.identity(req, 'CUSTOMER');
        const mechanics = await this.dispatchService.findMechanicsWithDistance(lat, lng, 20, serviceType, vehicleCategoryId);
        return { success: true, data: mechanics };
    }
    async requestMechanic(req, serviceType, lat, lng, mechanicId, vehicleCategoryId) {
        if (!mechanicId) {
            return { success: false, message: 'mechanicId is required' };
        }
        const customerId = this.identity(req, 'CUSTOMER');
        try {
            return await this.dispatchService.createServiceRequest(customerId, serviceType, lat, lng, mechanicId, vehicleCategoryId);
        }
        catch (err) {
            throw err;
        }
    }
    async acceptJob(req, jobId) {
        const mechanicId = this.identity(req, 'MECHANIC');
        try {
            return await this.dispatchService.acceptJob(jobId, mechanicId);
        }
        catch (err) {
            throw err;
        }
    }
    prepareQuote(req, jobId) {
        return this.dispatchService.autoQuotes.prepare(jobId, this.identity(req, 'MECHANIC'));
    }
    sendQuote(req, jobId) {
        return this.dispatchService.autoQuotes.send(jobId, this.identity(req, 'MECHANIC'));
    }
    async pricing(req) {
        this.identity(req, 'MECHANIC');
        return this.dispatchService.payments.pricing();
    }
    activeJob(req) {
        return this.dispatchService.activeJob(this.identity(req, 'MECHANIC'));
    }
    customerActiveJob(req) {
        return this.dispatchService.customerActiveJob(this.identity(req, 'CUSTOMER'));
    }
    async payJob(req, jobId, simulationResult) {
        const customerId = this.identity(req, 'CUSTOMER');
        return await this.dispatchService.payments.pay(jobId, customerId, false, simulationResult);
    }
    async completeJob(req, jobId, otp) {
        const mechanicId = this.identity(req, 'MECHANIC');
        return await this.dispatchService.completeJob(jobId, mechanicId, otp);
    }
    async withdrawFunds(req, requestId) {
        const mechanicId = this.identity(req, 'MECHANIC');
        if (!requestId)
            throw new common_1.ForbiddenException('Withdrawal request ID is required');
        return await this.dispatchService.withdrawFunds(mechanicId, requestId);
    }
    async cancelJob(req, jobId, reason) {
        const actor = req.user;
        return await this.dispatchService.cancelJob(jobId, actor.sub, actor.role, reason);
    }
    confirmCompletion(req, jobId) {
        return this.dispatchService.payments.confirmCompletion(jobId, this.identity(req, 'CUSTOMER'));
    }
    startJourney(req, jobId) {
        return this.dispatchService.payments.startJourney(jobId, this.identity(req, 'MECHANIC'));
    }
    history(req, before) {
        return this.dispatchService.payments.history(req.user, before);
    }
    transactions(req, before) {
        return this.dispatchService.payments.transactions(req.user, before);
    }
    detail(req, jobId) {
        return this.dispatchService.payments.detail(jobId, req.user);
    }
    async rateJob(req, jobId, rating) {
        const customerId = this.identity(req, 'CUSTOMER');
        return await this.dispatchService.rateJob(jobId, rating, customerId);
    }
};
exports.DispatchController = DispatchController;
__decorate([
    (0, common_1.Post)('nearby'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('serviceType')),
    __param(2, (0, common_1.Body)('lat')),
    __param(3, (0, common_1.Body)('lng')),
    __param(4, (0, common_1.Body)('vehicleCategoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, Number, String]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "getNearbyMechanics", null);
__decorate([
    (0, common_1.Post)('request'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('serviceType')),
    __param(2, (0, common_1.Body)('lat')),
    __param(3, (0, common_1.Body)('lng')),
    __param(4, (0, common_1.Body)('mechanicId')),
    __param(5, (0, common_1.Body)('vehicleCategoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, Number, String, String]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "requestMechanic", null);
__decorate([
    (0, common_1.Post)('job/:jobId/accept'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "acceptJob", null);
__decorate([
    (0, common_1.Post)('job/:jobId/prepare-quote'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "prepareQuote", null);
__decorate([
    (0, common_1.Post)('job/:jobId/send-quote'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "sendQuote", null);
__decorate([
    (0, common_1.Get)('pricing'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "pricing", null);
__decorate([
    (0, common_1.Get)('active-job'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "activeJob", null);
__decorate([
    (0, common_1.Get)('customer-active-job'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "customerActiveJob", null);
__decorate([
    (0, common_1.Post)('job/:jobId/confirm-payment'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __param(2, (0, common_1.Body)('simulationResult')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "payJob", null);
__decorate([
    (0, common_1.Post)('job/:jobId/complete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __param(2, (0, common_1.Body)('otp')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "completeJob", null);
__decorate([
    (0, common_1.Post)('mechanic/withdraw'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "withdrawFunds", null);
__decorate([
    (0, common_1.Post)('job/:jobId/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __param(2, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "cancelJob", null);
__decorate([
    (0, common_1.Post)('job/:jobId/confirm-completion'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "confirmCompletion", null);
__decorate([
    (0, common_1.Post)('job/:jobId/start'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "startJourney", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "history", null);
__decorate([
    (0, common_1.Get)('transactions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "transactions", null);
__decorate([
    (0, common_1.Get)('job/:jobId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DispatchController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)('job/:jobId/rate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __param(2, (0, common_1.Body)('rating')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", Promise)
], DispatchController.prototype, "rateJob", null);
exports.DispatchController = DispatchController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('dispatch'),
    __metadata("design:paramtypes", [typeof (_a = typeof dispatch_service_1.DispatchService !== "undefined" && dispatch_service_1.DispatchService) === "function" ? _a : Object])
], DispatchController);


/***/ }),
/* 57 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CallGateway_1;
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CallGateway = void 0;
const common_1 = __webpack_require__(3);
const websockets_1 = __webpack_require__(27);
const nestjs_redis_1 = __webpack_require__(43);
const socket_io_1 = __webpack_require__(42);
const ws_jwt_guard_1 = __webpack_require__(26);
const job_access_service_1 = __webpack_require__(44);
const call_session_store_1 = __webpack_require__(58);
let CallGateway = CallGateway_1 = class CallGateway {
    access;
    server;
    sessions;
    owned = new Map();
    timer;
    maintaining = false;
    logger = new common_1.Logger(CallGateway_1.name);
    constructor(access, redis) {
        this.access = access;
        this.sessions = new call_session_store_1.CallSessionStore(redis.getOrThrow());
    }
    afterInit() {
        this.timer = setInterval(() => {
            void this.maintainCalls().catch(() => this.logger.warn('Call lease maintenance unavailable'));
        }, 15000);
        this.timer.unref();
    }
    onModuleDestroy() { if (this.timer)
        clearInterval(this.timer); }
    failure(code, message = 'This call has ended. Please try again.') {
        return { success: false, code, message };
    }
    valid(data) {
        return typeof data?.callId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(data.callId)
            && typeof data.targetId === 'string' && data.targetId.length > 0 && data.targetId.length <= 128;
    }
    emit(s, fromCaller, event, payload) {
        this.server.to(fromCaller ? s.targetSocket : s.callerSocket).emit(event, {
            ...payload, callId: s.id, callerId: fromCaller ? s.caller : s.target,
        });
    }
    ended(s, reason) {
        this.emit(s, true, 'call_ended', { reason });
        this.emit(s, false, 'call_ended', { reason });
        this.owned.delete(s.id);
    }
    async offer(data, client) {
        const user = client.user;
        try {
            if (!this.valid(data) || !user || !(await this.access.canContact(user, data.targetId)))
                return this.failure('FORBIDDEN', 'No active job with this person');
            if (!data.offer || typeof data.offer.sdp !== 'string' || data.offer.sdp.length > 65536)
                return this.failure('INVALID_CALL', 'Invalid call offer');
            const targets = await this.server.in('user_' + data.targetId).fetchSockets();
            if (!targets.length)
                return this.failure('OFFLINE', 'The other person is offline');
            if (!client.connected)
                return this.failure('OFFLINE', 'You are offline. Reconnect and try again.');
            const targetSocket = targets.map(s => s.id).sort()[0];
            const session = { id: data.callId, caller: user.sub, target: data.targetId,
                callerSocket: client.id, targetSocket, state: 'ringing' };
            const result = await this.sessions.reserve(session);
            if (result === 'TARGET_BUSY')
                return this.failure(result, user.role === 'CUSTOMER' ? 'Provider is busy—try again' : 'Customer is busy—try again');
            if (result === 'CALLER_BUSY')
                return this.failure(result, 'You are already on a call');
            if (result !== 'OK')
                return this.failure(result);
            this.owned.set(session.id, session);
            if (!client.connected) {
                await this.sessions.change(session, user.sub, client.id, 'end');
                this.owned.delete(session.id);
                return this.failure('OFFLINE', 'You are offline. Reconnect and try again.');
            }
            this.emit(session, true, 'incoming_call', { offer: data.offer,
                callerName: String(data.callerName || 'Caller').slice(0, 100) });
            return { success: true };
        }
        catch {
            return this.failure('UNAVAILABLE', 'Calling is temporarily unavailable. Please try again.');
        }
    }
    async relay(client, data, op, event, payload) {
        const user = client.user;
        try {
            if (!this.valid(data) || !user)
                return this.failure('INVALID_CALL');
            const session = await this.sessions.get(data.callId);
            if (!session)
                return this.failure('STALE_CALL');
            const fromCaller = session.caller === user.sub;
            if ((fromCaller ? session.target : session.caller) !== data.targetId)
                return this.failure('INVALID_CALL');
            if (op === 'answer' && !(await this.access.canContact(user, data.targetId)))
                return this.failure('FORBIDDEN', 'No active job with this person');
            const result = await this.sessions.change(session, user.sub, client.id, op);
            if (typeof result === 'string')
                return this.failure(result);
            this.emit(result, fromCaller, event, payload);
            if (op === 'end')
                this.owned.delete(result.id);
            return { success: true };
        }
        catch {
            return this.failure('UNAVAILABLE', 'Calling is temporarily unavailable. Please try again.');
        }
    }
    answer(data, client) {
        if (!data?.answer || typeof data.answer.sdp !== 'string' || data.answer.sdp.length > 65536)
            return this.failure('INVALID_CALL');
        return this.relay(client, data, 'answer', 'call_answered', { answer: data.answer });
    }
    candidate(data, client) {
        if (!data?.candidate || typeof data.candidate.candidate !== 'string' || data.candidate.candidate.length > 8192)
            return this.failure('INVALID_CALL');
        return this.relay(client, data, 'ice', 'new_ice_candidate', { candidate: data.candidate });
    }
    end(data, client) {
        return this.relay(client, data, 'end', 'call_ended', { reason: data?.reason === 'busy' ? 'busy' : 'ended' });
    }
    async handleDisconnect(client) {
        const user = client.user;
        if (!user)
            return;
        try {
            const session = await this.sessions.forUser(user.sub);
            if (session && typeof await this.sessions.change(session, user.sub, client.id, 'end') !== 'string')
                this.ended(session, 'disconnected');
        }
        catch {
            this.logger.warn('Call disconnect cleanup unavailable; lease will expire');
        }
    }
    async maintainCalls() {
        if (this.maintaining || !this.owned.size)
            return;
        this.maintaining = true;
        try {
            const connected = await this.server.sockets.allSockets();
            const owned = [...this.owned.values()];
            for (let i = 0; i < owned.length; i += 100) {
                await Promise.all(owned.slice(i, i + 100).map(async (previous) => {
                    const current = await this.sessions.get(previous.id);
                    if (!current) {
                        this.ended(previous, 'expired');
                        return;
                    }
                    const alive = connected.has(current.callerSocket) && connected.has(current.targetSocket);
                    const result = await this.sessions.change(current, current.caller, current.callerSocket, alive ? 'refresh' : 'end');
                    if (!alive || typeof result === 'string')
                        this.ended(current, alive ? 'expired' : 'disconnected');
                }));
            }
        }
        finally {
            this.maintaining = false;
        }
    }
};
exports.CallGateway = CallGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", typeof (_c = typeof socket_io_1.Server !== "undefined" && socket_io_1.Server) === "function" ? _c : Object)
], CallGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('call_offer'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_d = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], CallGateway.prototype, "offer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('call_answer'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_e = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _e : Object]),
    __metadata("design:returntype", void 0)
], CallGateway.prototype, "answer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('ice_candidate'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_f = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], CallGateway.prototype, "candidate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('end_call'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_g = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _g : Object]),
    __metadata("design:returntype", void 0)
], CallGateway.prototype, "end", null);
exports.CallGateway = CallGateway = CallGateway_1 = __decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [typeof (_a = typeof job_access_service_1.JobAccessService !== "undefined" && job_access_service_1.JobAccessService) === "function" ? _a : Object, typeof (_b = typeof nestjs_redis_1.RedisService !== "undefined" && nestjs_redis_1.RedisService) === "function" ? _b : Object])
], CallGateway);


/***/ }),
/* 58 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CallSessionStore = void 0;
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
class CallSessionStore {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    sessionKey(id) { return `calls:{calls}:session:${id}`; }
    userKey(id) { return `calls:{calls}:user:${id}`; }
    keys(s) {
        return [this.sessionKey(s.id), this.userKey(s.caller), this.userKey(s.target)];
    }
    async reserve(s) {
        return await this.redis.eval(RESERVE, 3, ...this.keys(s), JSON.stringify(s), s.id, 50);
    }
    async get(id) {
        const value = await this.redis.get(this.sessionKey(id));
        return value && value !== 'ended' ? JSON.parse(value) : null;
    }
    async forUser(id) {
        const callId = await this.redis.get(this.userKey(id));
        return callId ? this.get(callId) : null;
    }
    async change(s, user, socket, op) {
        const result = await this.redis.eval(CHANGE, 3, ...this.keys(s), user, socket, op, 90);
        return result.startsWith('{') ? JSON.parse(result) : result;
    }
}
exports.CallSessionStore = CallSessionStore;


/***/ }),
/* 59 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RazorpayController = void 0;
const common_1 = __webpack_require__(3);
const dispatch_service_1 = __webpack_require__(49);
const razorpay_1 = __webpack_require__(52);
const throttler_1 = __webpack_require__(5);
let RazorpayController = class RazorpayController {
    dispatch;
    constructor(dispatch) {
        this.dispatch = dispatch;
    }
    async webhook(req, signature) {
        (0, razorpay_1.verifyRazorpayWebhook)(req.rawBody, signature);
        return { success: true };
    }
};
exports.RazorpayController = RazorpayController;
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(200),
    (0, throttler_1.SkipThrottle)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-razorpay-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RazorpayController.prototype, "webhook", null);
exports.RazorpayController = RazorpayController = __decorate([
    (0, common_1.Controller)('payments/razorpay'),
    __metadata("design:paramtypes", [typeof (_a = typeof dispatch_service_1.DispatchService !== "undefined" && dispatch_service_1.DispatchService) === "function" ? _a : Object])
], RazorpayController);


/***/ }),
/* 60 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FinanceController = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(11);
const jwt_auth_guard_1 = __webpack_require__(25);
const adm_user_entity_1 = __webpack_require__(13);
const provider_user_entity_1 = __webpack_require__(14);
const service_request_entity_1 = __webpack_require__(30);
const pricing_policy_entity_1 = __webpack_require__(54);
const payment_ledger_entity_1 = __webpack_require__(39);
const pricing_1 = __webpack_require__(53);
const money_1 = __webpack_require__(38);
let FinanceController = class FinanceController {
    db;
    constructor(db) {
        this.db = db;
    }
    async authorize(req) {
        const user = await this.db.getRepository(adm_user_entity_1.AdmUser).findOneBy({ id: req.user.sub });
        if (!user || !['SUPER_ADMIN', 'CEO'].includes(user.role))
            throw new common_1.ForbiddenException('Finance access requires a current super administrator or CEO account');
        await this.db.transaction(pricing_1.ensurePaymentEnvironment);
        return user;
    }
    async settings(req) {
        await this.authorize(req);
        const policy = await (0, pricing_1.currentPolicy)(this.db.manager);
        const history = await this.db.getRepository(pricing_policy_entity_1.PricingPolicy).find({ order: { revision: 'DESC' }, take: 20 });
        return { policy, history, paymentMode: (0, pricing_1.paymentMode)() };
    }
    async update(req, body) {
        const admin = await this.authorize(req);
        const bps = Number((0, money_1.minorUnits)(body.commissionPercent));
        const fee = (0, money_1.minorUnits)(body.platformFee);
        if (bps > 10000 || (fee !== 0n && (fee < 200n || fee > 500n)) || !Number.isInteger(body.expectedRevision))
            throw new common_1.BadRequestException('Enter commission 0–100%, platform fee INR 2–5 (or 0 to disable), and the current revision');
        return this.db.transaction(async (m) => {
            await m.query('SELECT pg_advisory_xact_lock(73100922)');
            const previous = await (0, pricing_1.currentPolicy)(m);
            if (previous.revision !== body.expectedRevision)
                throw new common_1.ConflictException('Another administrator changed pricing. Refresh and review before saving.');
            const minimum = body.travelMinimum === undefined ? BigInt(previous.travelMinimumMinor) : (0, money_1.minorUnits)(body.travelMinimum);
            const perKm = body.travelPerKm === undefined ? BigInt(previous.travelPerKmMinor) : (0, money_1.minorUnits)(body.travelPerKm);
            const included = body.travelIncludedKm === undefined ? previous.travelIncludedMeters : Number((0, money_1.minorUnits)(body.travelIncludedKm)) * 10;
            if (minimum > 100000000n || perKm > 10000000n || !Number.isSafeInteger(included) || included < 0 || included > 1000000)
                throw new common_1.BadRequestException('Invalid travel rates');
            return m.getRepository(pricing_policy_entity_1.PricingPolicy).save({ commissionBps: bps, platformFeeMinor: fee.toString(), travelMinimumMinor: minimum.toString(), travelIncludedMeters: included, travelPerKmMinor: perKm.toString(), changedBy: admin.id });
        });
    }
    async collections(req, after) {
        await this.authorize(req);
        if (after && !/^[0-9a-f-]{36}$/i.test(after))
            throw new common_1.BadRequestException('Invalid cursor');
        const providers = this.db.getRepository(provider_user_entity_1.ProviderUser).createQueryBuilder('p').select(['p.id', 'p.name', 'p.email']).orderBy('p.id', 'ASC').take(51);
        if (after)
            providers.where('p.id > :after', { after });
        const page = await providers.getMany();
        const rows = await Promise.all(page.slice(0, 50).map(async (p) => {
            const sums = await this.db.getRepository(service_request_entity_1.ServiceRequest).createQueryBuilder('j')
                .select('COUNT(*)', 'jobs')
                .addSelect(`COALESCE(SUM(CASE WHEN j.status IN ('PAYMENT_SECURED','EN_ROUTE','AWAITING_CUSTOMER_CONFIRMATION') THEN j."totalAmount" ELSE 0 END),0)`, 'held')
                .addSelect(`COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j."totalAmount" ELSE 0 END),0)`, 'completedCollections')
                .addSelect(`COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j."commissionMinor" ELSE 0 END),0)`, 'commissionMinor')
                .addSelect(`COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j."platformFeeMinor" ELSE 0 END),0)`, 'feeMinor')
                .where('j."mechanicId" = :id', { id: p.id }).getRawOne();
            const accounts = await this.db.getRepository(payment_ledger_entity_1.WalletAccount).createQueryBuilder('a').where('a.key IN (:...keys)', { keys: ['provider:' + p.id, 'payout:' + p.id] }).getMany();
            return { ...p, jobs: Number(sums.jobs), held: sums.held, completedCollections: sums.completedCollections, commission: (0, money_1.money)(sums.commissionMinor), platformFees: (0, money_1.money)(sums.feeMinor), available: (0, money_1.money)(accounts.find(a => a.key === 'provider:' + p.id)?.balanceMinor || '0'), payoutPending: (0, money_1.money)(accounts.find(a => a.key === 'payout:' + p.id)?.balanceMinor || '0') };
        }));
        const totals = await this.db.getRepository(payment_ledger_entity_1.PaymentLedger).createQueryBuilder('e').select('e.kind', 'kind').addSelect('SUM(e."amountMinor")', 'amountMinor').groupBy('e.kind').getRawMany();
        return { paymentMode: (0, pricing_1.paymentMode)(), providers: rows, totals: totals.map(r => ({ kind: r.kind, amount: (0, money_1.money)(r.amountMinor) })), nextCursor: page.length > 50 ? page[49].id : null };
    }
    async jobs(req, providerId, before) {
        await this.authorize(req);
        if (!/^[0-9a-f-]{36}$/i.test(providerId))
            throw new common_1.BadRequestException('Invalid provider');
        const q = this.db.getRepository(service_request_entity_1.ServiceRequest).createQueryBuilder('j').where('j."mechanicId" = :providerId', { providerId }).orderBy('j.createdAt', 'DESC').addOrderBy('j.id', 'DESC').take(51);
        if (before) {
            const cursor = await this.db.getRepository(service_request_entity_1.ServiceRequest).findOneBy({ id: before, mechanic: { id: providerId } });
            if (!cursor)
                throw new common_1.BadRequestException('Invalid cursor');
            q.andWhere('(j."createdAt", j.id) < (:createdAt, :before)', { createdAt: cursor.createdAt, before });
        }
        const jobs = await q.getMany();
        return { jobs: jobs.slice(0, 50).map(j => ({ id: j.id, status: j.status, createdAt: j.createdAt, totalAmount: j.totalAmount, commission: (0, money_1.money)(j.commissionMinor), commissionPercent: j.commissionBps / 100, platformFee: (0, money_1.money)(j.platformFeeMinor), providerNet: (0, money_1.money)(j.providerNetMinor ?? (0, money_1.minorUnits)(j.totalAmount)), pricingRevision: j.pricingRevision, paymentMode: j.paymentMode })), nextCursor: jobs.length > 50 ? jobs[49].id : null };
    }
};
exports.FinanceController = FinanceController;
__decorate([
    (0, common_1.Get)('settings'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "settings", null);
__decorate([
    (0, common_1.Post)('settings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('collections'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('after')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "collections", null);
__decorate([
    (0, common_1.Get)('jobs'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('providerId')),
    __param(2, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "jobs", null);
exports.FinanceController = FinanceController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('admin/finance'),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_1.DataSource !== "undefined" && typeorm_1.DataSource) === "function" ? _a : Object])
], FinanceController);


/***/ }),
/* 61 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NotificationsModule = void 0;
const common_1 = __webpack_require__(3);
const notifications_service_1 = __webpack_require__(62);
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        providers: [notifications_service_1.NotificationsService],
        exports: [notifications_service_1.NotificationsService],
    })
], NotificationsModule);


/***/ }),
/* 62 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NotificationsService = void 0;
const common_1 = __webpack_require__(3);
let NotificationsService = class NotificationsService {
    async sendPushNotificationToMechanic(mechanicId, jobDetails) {
        console.log(`[FCM] Push sent to Mechanic ${mechanicId}: New Job Request!`);
        return true;
    }
    async sendSmsReceipt(phoneNumber, invoiceId, amount) {
        console.log(`[Twilio] SMS sent to ${phoneNumber}: Your invoice ${invoiceId} for ₹${amount} is ready.`);
        return true;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);


/***/ }),
/* 63 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServicesModule = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const service_type_entity_1 = __webpack_require__(17);
const services_service_1 = __webpack_require__(64);
const services_controller_1 = __webpack_require__(65);
let ServicesModule = class ServicesModule {
};
exports.ServicesModule = ServicesModule;
exports.ServicesModule = ServicesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([service_type_entity_1.ServiceType])],
        controllers: [services_controller_1.ServicesController],
        providers: [services_service_1.ServicesService],
        exports: [services_service_1.ServicesService],
    })
], ServicesModule);


/***/ }),
/* 64 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ServicesService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServicesService = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const typeorm_2 = __webpack_require__(11);
const service_type_entity_1 = __webpack_require__(17);
let ServicesService = ServicesService_1 = class ServicesService {
    serviceTypeRepository;
    logger = new common_1.Logger(ServicesService_1.name);
    constructor(serviceTypeRepository) {
        this.serviceTypeRepository = serviceTypeRepository;
    }
    async onModuleInit() {
        await this.seedDefaultServices();
    }
    async seedDefaultServices() {
        const defaultServices = [
            { name: 'Flat Tire', description: 'Patch or replace flat tires.' },
            { name: 'Battery Jump Start', description: 'Jump start a dead battery.' },
            { name: 'Fuel Delivery', description: 'Delivery of emergency fuel.' },
            { name: 'Towing', description: 'Tow vehicle to nearest safe location or garage.' },
            { name: 'Lockout / Key Retrieval', description: 'Unlock car doors.' },
            { name: 'General Engine Diagnostics', description: 'Check engine light diagnostics.' },
            { name: 'Unknown Trouble', description: 'General inspection for unidentified issues.' },
        ];
        for (const service of defaultServices) {
            const existing = await this.serviceTypeRepository.findOne({ where: { name: service.name } });
            if (!existing) {
                const newService = this.serviceTypeRepository.create(service);
                await this.serviceTypeRepository.save(newService);
                this.logger.log(`Seeded default service: ${service.name}`);
            }
        }
    }
    async getAllServices() {
        return this.serviceTypeRepository.find({ where: { isActive: true }, order: { name: 'ASC' } });
    }
};
exports.ServicesService = ServicesService;
exports.ServicesService = ServicesService = ServicesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(service_type_entity_1.ServiceType)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object])
], ServicesService);


/***/ }),
/* 65 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServicesController = void 0;
const common_1 = __webpack_require__(3);
const services_service_1 = __webpack_require__(64);
let ServicesController = class ServicesController {
    servicesService;
    constructor(servicesService) {
        this.servicesService = servicesService;
    }
    async getAllServices() {
        return this.servicesService.getAllServices();
    }
};
exports.ServicesController = ServicesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ServicesController.prototype, "getAllServices", null);
exports.ServicesController = ServicesController = __decorate([
    (0, common_1.Controller)('services'),
    __metadata("design:paramtypes", [typeof (_a = typeof services_service_1.ServicesService !== "undefined" && services_service_1.ServicesService) === "function" ? _a : Object])
], ServicesController);


/***/ }),
/* 66 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VehiclesModule = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const vehicle_category_entity_1 = __webpack_require__(18);
const vehicles_service_1 = __webpack_require__(67);
const vehicles_controller_1 = __webpack_require__(68);
let VehiclesModule = class VehiclesModule {
};
exports.VehiclesModule = VehiclesModule;
exports.VehiclesModule = VehiclesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([vehicle_category_entity_1.VehicleCategory])],
        controllers: [vehicles_controller_1.VehiclesController],
        providers: [vehicles_service_1.VehiclesService],
        exports: [vehicles_service_1.VehiclesService],
    })
], VehiclesModule);


/***/ }),
/* 67 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VehiclesService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VehiclesService = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const typeorm_2 = __webpack_require__(11);
const vehicle_category_entity_1 = __webpack_require__(18);
let VehiclesService = VehiclesService_1 = class VehiclesService {
    vehicleCategoryRepository;
    logger = new common_1.Logger(VehiclesService_1.name);
    constructor(vehicleCategoryRepository) {
        this.vehicleCategoryRepository = vehicleCategoryRepository;
    }
    async onModuleInit() {
        await this.seedDefaultVehicleCategories();
    }
    async seedDefaultVehicleCategories() {
        const defaultCategories = [
            { group: '2 Wheeler', name: 'Standard Bike / Scooter', description: 'Regular two-wheelers', isPremiumTier: false },
            { group: '2 Wheeler', name: 'Premium / Superbike', description: 'High-end motorcycles', isPremiumTier: true },
            { group: '3 Wheeler', name: 'Auto Rickshaw', description: 'Three-wheeler transport', isPremiumTier: false },
            { group: '4 Wheeler', name: 'Standard Car (Hatchback/Sedan)', description: 'Everyday cars', isPremiumTier: false },
            { group: '4 Wheeler', name: 'SUV / MUV', description: 'Large passenger vehicles', isPremiumTier: false },
            { group: '4 Wheeler', name: 'Luxury / Premium Car', description: 'High-end or imported cars requiring special care', isPremiumTier: true },
            { group: 'Commercial', name: 'Light Commercial / Pickup', description: 'Delivery vans and small trucks', isPremiumTier: false },
            { group: 'Commercial', name: 'Heavy Duty Truck / Bus', description: 'Large commercial transport', isPremiumTier: false },
        ];
        for (const category of defaultCategories) {
            const existing = await this.vehicleCategoryRepository.findOne({
                where: { group: category.group, name: category.name }
            });
            if (!existing) {
                const newCategory = this.vehicleCategoryRepository.create(category);
                await this.vehicleCategoryRepository.save(newCategory);
                this.logger.log(`Seeded vehicle category: [${category.group}] ${category.name}`);
            }
            else if (existing.isPremiumTier !== category.isPremiumTier) {
                existing.isPremiumTier = category.isPremiumTier;
                await this.vehicleCategoryRepository.save(existing);
            }
        }
    }
    async getAllVehicleCategories() {
        return this.vehicleCategoryRepository.find({
            where: { isActive: true },
            order: { group: 'ASC', name: 'ASC' }
        });
    }
};
exports.VehiclesService = VehiclesService;
exports.VehiclesService = VehiclesService = VehiclesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(vehicle_category_entity_1.VehicleCategory)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object])
], VehiclesService);


/***/ }),
/* 68 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VehiclesController = void 0;
const common_1 = __webpack_require__(3);
const vehicles_service_1 = __webpack_require__(67);
let VehiclesController = class VehiclesController {
    vehiclesService;
    constructor(vehiclesService) {
        this.vehiclesService = vehiclesService;
    }
    async getAllVehicleCategories() {
        return this.vehiclesService.getAllVehicleCategories();
    }
};
exports.VehiclesController = VehiclesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VehiclesController.prototype, "getAllVehicleCategories", null);
exports.VehiclesController = VehiclesController = __decorate([
    (0, common_1.Controller)('vehicle-categories'),
    __metadata("design:paramtypes", [typeof (_a = typeof vehicles_service_1.VehiclesService !== "undefined" && vehicles_service_1.VehiclesService) === "function" ? _a : Object])
], VehiclesController);


/***/ }),
/* 69 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SupportModule = void 0;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const support_ticket_entity_1 = __webpack_require__(70);
const service_request_entity_1 = __webpack_require__(30);
const adm_user_entity_1 = __webpack_require__(13);
const auth_module_1 = __webpack_require__(7);
const support_controller_1 = __webpack_require__(71);
const support_service_1 = __webpack_require__(72);
let SupportModule = class SupportModule {
};
exports.SupportModule = SupportModule;
exports.SupportModule = SupportModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, typeorm_1.TypeOrmModule.forFeature([support_ticket_entity_1.SupportTicket, support_ticket_entity_1.SupportMessage, service_request_entity_1.ServiceRequest, adm_user_entity_1.AdmUser])],
        controllers: [support_controller_1.SupportController], providers: [support_service_1.SupportService],
    })
], SupportModule);


/***/ }),
/* 70 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SupportMessage = exports.SupportTicket = void 0;
const typeorm_1 = __webpack_require__(11);
let SupportTicket = class SupportTicket {
    id;
    requesterId;
    requesterRole;
    subject;
    category;
    status;
    jobId;
    assignedAdminId;
    createdAt;
    updatedAt;
};
exports.SupportTicket = SupportTicket;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SupportTicket.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], SupportTicket.prototype, "requesterId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], SupportTicket.prototype, "requesterRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], SupportTicket.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], SupportTicket.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'OPEN' }),
    __metadata("design:type", String)
], SupportTicket.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SupportTicket.prototype, "jobId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SupportTicket.prototype, "assignedAdminId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], SupportTicket.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], SupportTicket.prototype, "updatedAt", void 0);
exports.SupportTicket = SupportTicket = __decorate([
    (0, typeorm_1.Entity)('support_tickets'),
    (0, typeorm_1.Index)(['requesterRole', 'requesterId', 'createdAt'])
], SupportTicket);
let SupportMessage = class SupportMessage {
    id;
    ticketId;
    senderId;
    senderRole;
    body;
    createdAt;
};
exports.SupportMessage = SupportMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SupportMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], SupportMessage.prototype, "ticketId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], SupportMessage.prototype, "senderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], SupportMessage.prototype, "senderRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 4000 }),
    __metadata("design:type", String)
], SupportMessage.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_c = typeof Date !== "undefined" && Date) === "function" ? _c : Object)
], SupportMessage.prototype, "createdAt", void 0);
exports.SupportMessage = SupportMessage = __decorate([
    (0, typeorm_1.Entity)('support_messages'),
    (0, typeorm_1.Index)(['ticketId', 'createdAt'])
], SupportMessage);


/***/ }),
/* 71 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SupportController = void 0;
const common_1 = __webpack_require__(3);
const jwt_auth_guard_1 = __webpack_require__(25);
const support_service_1 = __webpack_require__(72);
let SupportController = class SupportController {
    support;
    constructor(support) {
        this.support = support;
    }
    bot(question) { return (0, support_service_1.supportAnswer)(question); }
    create(req, body) { return this.support.create(req.user, body); }
    mine(req) { return this.support.listMine(req.user); }
    admin(req, status) { return this.support.listAdmin(req.user, status); }
    detail(req, id) { return this.support.detail(req.user, id); }
    reply(req, id, message) { return this.support.reply(req.user, id, message); }
    status(req, id, status) { return this.support.updateStatus(req.user, id, status); }
};
exports.SupportController = SupportController;
__decorate([
    (0, common_1.Post)('bot'),
    __param(0, (0, common_1.Body)('question')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "bot", null);
__decorate([
    (0, common_1.Post)('tickets'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('tickets'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "mine", null);
__decorate([
    (0, common_1.Get)('admin/tickets'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "admin", null);
__decorate([
    (0, common_1.Get)('tickets/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)('tickets/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('message')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "reply", null);
__decorate([
    (0, common_1.Patch)('admin/tickets/:id/status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "status", null);
exports.SupportController = SupportController = __decorate([
    (0, common_1.Controller)('support'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [typeof (_a = typeof support_service_1.SupportService !== "undefined" && support_service_1.SupportService) === "function" ? _a : Object])
], SupportController);


/***/ }),
/* 72 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SupportService = void 0;
exports.supportAnswer = supportAnswer;
const common_1 = __webpack_require__(3);
const typeorm_1 = __webpack_require__(10);
const typeorm_2 = __webpack_require__(11);
const support_ticket_entity_1 = __webpack_require__(70);
const service_request_entity_1 = __webpack_require__(30);
const adm_user_entity_1 = __webpack_require__(13);
const adminRoles = ['SUPER_ADMIN', 'MANAGER', 'CEO'];
const userRoles = ['CUSTOMER', 'MECHANIC', 'FLEET_DRIVER'];
const categories = ['JOB', 'PAYMENT', 'KYC', 'ACCOUNT', 'APP', 'OTHER'];
const statuses = [
    'OPEN',
    'IN_PROGRESS',
    'WAITING_FOR_USER',
    'RESOLVED',
    'CLOSED',
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function supportAnswer(question) {
    if (typeof question !== 'string' || !question.trim() || question.length > 500)
        throw new common_1.BadRequestException('Enter a question (up to 500 characters)');
    const q = question
        .toLowerCase()
        .replace(/[^a-z0-9+ ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const has = (...terms) => terms.some((term) => q.includes(term));
    let answer = null;
    if (has('dummy payment', 'test payment', 'razorpay', 'cashfree', 'payment method', 'payment gateway')) {
        answer =
            'The app may use a demo payment flow during testing. A demo success confirms the test job flow only; it does not mean a real bank or wallet transfer occurred. Check Wallet and history for recorded transactions, and create a Payment ticket if anything looks incorrect.';
    }
    else if (has('refund', 'money back', 'cancel', 'cancellation')) {
        answer =
            'If a job is cancelled before the customer confirms completion, the held payment is returned to the customer wallet. If the wallet does not update, create a Payment ticket and include the Job ID.';
    }
    else if (has('withdraw', 'withdrawal', 'payout', 'wallet', 'earnings', 'payment', 'pay')) {
        answer =
            'Open Settings → Wallet and history to review transactions. Provider earnings are released after the customer confirms completion, minus the configured provider commission. Providers can request up to five withdrawals per Monday–Sunday week. For a missing transaction, create a Payment ticket with the Job ID.';
    }
    else if (has('kyc', 'identity', 'verify', 'verification', 'document', 'id card', 'aadhaar', 'licence', 'license', 'passport')) {
        answer =
            'Providers submit the front and back of a government ID, full address and secondary phone in Profile → Identity verification. The submission stays saved during admin review; upload again only if it is rejected. Admin approval is required before taking jobs.';
    }
    else if (has('route', 'map', 'location', 'gps', 'distance', 'directions')) {
        answer =
            'Allow precise location access and keep GPS and internet enabled. Reopen the active job to refresh the route. If the route or distance is still wrong, create a Job ticket and include the Job ID.';
    }
    else if (has('call', 'calling', 'phone', 'audio', 'microphone', 'hear')) {
        answer =
            'Allow the requested phone and microphone permissions, and confirm both phones have internet access. If the in-app call still fails, create an App ticket with the Job ID.';
    }
    else if (has('login', 'sign in', 'signin', 'password', '401', 'account', 'otp', 'code')) {
        answer =
            'Use the customer or provider app that matches your account and sign in with its registered email or phone. Check your connection and try again. If sign-in still fails, create an Account ticket. Never share a password or one-time code.';
    }
    else if (has('service config', 'service configuration', 'services not visible', 'pricing', 'price', 'go online', 'online', 'commission', 'provider profile')) {
        answer =
            'Providers need to select at least one service and save its price in Service configuration before going online. The provider can review the commission while setting prices; customers see the final quotation, not a separate commission line. If configuration does not load, refresh and create an App ticket if it continues.';
    }
    else if (has('available service', 'available services', 'what services', 'service type', 'services list', 'services do you offer')) {
        answer =
            'Choose a service that matches your vehicle issue from the customer home screen, confirm your pickup location and send the request. Nearby online providers who offer that service can respond.';
    }
    else if (has('platform fee', 'travel fee', 'travel charge', 'distance charge', 'per km', 'quotation amount', 'commission')) {
        answer =
            'Customers see the final quotation and any platform fee before confirming payment. Travel is calculated from route distance using current admin pricing rules. Provider commission is shown to the provider while setting service prices, not as a separate customer charge.';
    }
    else if (has('no provider', 'provider not found', 'nobody accepted', 'request failed', 'request not sent', 'send request')) {
        answer =
            'Check location permission and confirm your pickup point, then retry. If a previous request may still be active, open Active job and check its status before sending another. If no provider is found, try again shortly or create a Job ticket.';
    }
    else if (has('rating', 'review', 'badge', 'performance')) {
        answer =
            'Customers can rate and review a provider after a completed job. Provider badges reflect verified profile details and service performance and update as eligible reviews and completed jobs are recorded.';
    }
    else if (has('profile', 'mobile number', 'phone number', 'change number', 'edit details')) {
        answer =
            'Open Profile or Settings to review your account details. Providers must keep a valid mobile number and complete KYC before accepting jobs. Create an Account ticket if you cannot update a detail.';
    }
    else if (has('complete', 'completion', 'finished', 'done')) {
        answer =
            'After the provider marks the job complete, the customer must confirm completion in the app. That confirmation finalizes the job and releases the provider earnings from escrow according to the configured commission.';
    }
    else if (has('ticket', 'support', 'help', 'agent', 'human')) {
        answer =
            'Choose “Raise a support ticket”, select the closest issue type and explain what happened. Add the Job ID when relevant. Open the ticket later from this page to see its status and replies.';
    }
    else if (has('job', 'request', 'booking', 'mechanic', 'provider', 'accept', 'quotation', 'quote')) {
        answer =
            'After a customer sends a request, the provider reviews and accepts it. The customer then reviews the quotation and payment and confirms the job. Check Active job for its current status; if a job is stuck or missing, create a Job ticket with its Job ID.';
    }
    const suggestedCategory = has('refund', 'payment', 'wallet', 'withdraw', 'payout', 'pay')
        ? 'PAYMENT'
        : has('kyc', 'identity', 'verification', 'document')
            ? 'KYC'
            : has('job', 'booking', 'request', 'quotation', 'quote')
                ? 'JOB'
                : has('login', 'password', 'account', 'otp', '401')
                    ? 'ACCOUNT'
                    : 'OTHER';
    return {
        answer: answer ??
            'I could not find a reliable answer for that question. Please create a support ticket and our team will review it.',
        canCreateTicket: true,
        suggestedCategory,
    };
}
let SupportService = class SupportService {
    tickets;
    messages;
    jobs;
    admins;
    db;
    constructor(tickets, messages, jobs, admins, db) {
        this.tickets = tickets;
        this.messages = messages;
        this.jobs = jobs;
        this.admins = admins;
        this.db = db;
    }
    assertUser(user) {
        if (!userRoles.includes(user.role) || !uuid.test(user.sub))
            throw new common_1.ForbiddenException();
    }
    async assertAdmin(user) {
        if (!adminRoles.includes(user.role) || !uuid.test(user.sub))
            throw new common_1.ForbiddenException();
        const admin = await this.admins.findOneBy({ id: user.sub });
        if (!admin || admin.role !== user.role)
            throw new common_1.ForbiddenException('Admin access requires a current administrator account');
    }
    text(value, label, max) {
        if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
            throw new common_1.BadRequestException(`${label} is required (up to ${max} characters)`);
        return value.trim();
    }
    async create(user, body) {
        this.assertUser(user);
        const subject = this.text(body?.subject, 'Subject', 120);
        const message = this.text(body?.message, 'Message', 4000);
        const category = this.text(body?.category, 'Category', 32).toUpperCase();
        if (!categories.includes(category))
            throw new common_1.BadRequestException('Invalid category');
        const jobId = body?.jobId ? this.text(body.jobId, 'Job ID', 36) : null;
        if (jobId) {
            if (!uuid.test(jobId))
                throw new common_1.BadRequestException('Invalid Job ID');
            const job = await this.jobs.findOne({
                where: { id: jobId },
                relations: { customer: true, mechanic: true },
            });
            if (!job ||
                (user.role === 'CUSTOMER'
                    ? job.customer?.id !== user.sub
                    : job.mechanic?.id !== user.sub))
                throw new common_1.BadRequestException('Job ID is not linked to your account');
        }
        return this.db.transaction(async (manager) => {
            const ticket = await manager.save(support_ticket_entity_1.SupportTicket, manager.create(support_ticket_entity_1.SupportTicket, {
                requesterId: user.sub,
                requesterRole: user.role,
                subject,
                category,
                status: 'OPEN',
                jobId,
            }));
            await manager.save(support_ticket_entity_1.SupportMessage, manager.create(support_ticket_entity_1.SupportMessage, {
                ticketId: ticket.id,
                senderId: user.sub,
                senderRole: user.role,
                body: message,
            }));
            return ticket;
        });
    }
    async listMine(user) {
        this.assertUser(user);
        return this.tickets.find({
            where: { requesterId: user.sub, requesterRole: user.role },
            order: { updatedAt: 'DESC' },
            take: 100,
        });
    }
    async listAdmin(user, status) {
        await this.assertAdmin(user);
        if (status && !statuses.includes(status))
            throw new common_1.BadRequestException('Invalid status');
        return this.tickets.find({
            where: status ? { status } : {},
            order: { updatedAt: 'DESC' },
            take: 100,
        });
    }
    async detail(user, id) {
        if (!uuid.test(id))
            throw new common_1.BadRequestException('Invalid ticket ID');
        const ticket = await this.tickets.findOneBy({ id });
        if (!ticket)
            throw new common_1.NotFoundException('Ticket not found');
        if (adminRoles.includes(user.role))
            await this.assertAdmin(user);
        else if (ticket.requesterId !== user.sub ||
            ticket.requesterRole !== user.role)
            throw new common_1.NotFoundException('Ticket not found');
        return {
            ticket,
            messages: await this.messages.find({
                where: { ticketId: id },
                order: { createdAt: 'ASC', id: 'ASC' },
                take: 500,
            }),
        };
    }
    async reply(user, id, body) {
        const text = this.text(body, 'Message', 4000);
        const { ticket } = await this.detail(user, id);
        if (ticket.status === 'CLOSED')
            throw new common_1.BadRequestException('This ticket is closed');
        const admin = adminRoles.includes(user.role);
        if (!admin)
            this.assertUser(user);
        return this.db.transaction(async (manager) => {
            const message = await manager.save(support_ticket_entity_1.SupportMessage, manager.create(support_ticket_entity_1.SupportMessage, {
                ticketId: id,
                senderId: user.sub,
                senderRole: user.role,
                body: text,
            }));
            await manager.update(support_ticket_entity_1.SupportTicket, { id }, {
                status: admin ? 'WAITING_FOR_USER' : 'OPEN',
                assignedAdminId: admin ? user.sub : ticket.assignedAdminId,
                updatedAt: new Date(),
            });
            return message;
        });
    }
    async updateStatus(user, id, value) {
        await this.assertAdmin(user);
        const status = this.text(value, 'Status', 20).toUpperCase();
        if (!statuses.includes(status))
            throw new common_1.BadRequestException('Invalid status');
        await this.detail(user, id);
        await this.tickets.update({ id }, { status, assignedAdminId: user.sub });
        return this.detail(user, id);
    }
};
exports.SupportService = SupportService;
exports.SupportService = SupportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(support_ticket_entity_1.SupportTicket)),
    __param(1, (0, typeorm_1.InjectRepository)(support_ticket_entity_1.SupportMessage)),
    __param(2, (0, typeorm_1.InjectRepository)(service_request_entity_1.ServiceRequest)),
    __param(3, (0, typeorm_1.InjectRepository)(adm_user_entity_1.AdmUser)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object, typeof (_c = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _c : Object, typeof (_d = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _d : Object, typeof (_e = typeof typeorm_2.DataSource !== "undefined" && typeorm_2.DataSource) === "function" ? _e : Object])
], SupportService);


/***/ }),
/* 73 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DatabaseModule = void 0;
const payment_ledger_entity_1 = __webpack_require__(39);
const provider_kyc_submission_entity_1 = __webpack_require__(32);
const support_ticket_entity_1 = __webpack_require__(70);
const common_1 = __webpack_require__(3);
const pricing_policy_entity_1 = __webpack_require__(54);
const typeorm_1 = __webpack_require__(10);
const config_1 = __webpack_require__(4);
const fs = __importStar(__webpack_require__(74));
const path = __importStar(__webpack_require__(75));
const adm_user_entity_1 = __webpack_require__(13);
const provider_user_entity_1 = __webpack_require__(14);
const cust_user_entity_1 = __webpack_require__(15);
const mechanic_profile_entity_1 = __webpack_require__(16);
const service_request_entity_1 = __webpack_require__(30);
const invoice_entity_1 = __webpack_require__(31);
const service_type_entity_1 = __webpack_require__(17);
const vehicle_category_entity_1 = __webpack_require__(18);
const mechanic_pricing_entity_1 = __webpack_require__(29);
const wallet_transaction_entity_1 = __webpack_require__(51);
const badge_entity_1 = __webpack_require__(19);
const reputation_rule_entity_1 = __webpack_require__(76);
const reputation_log_entity_1 = __webpack_require__(77);
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    let ssl = false;
                    if (configService.get('DB_SSL') === 'true') {
                        const caInline = configService.get('DB_CA_CERT');
                        const caPath = configService.get('DB_CA_PATH');
                        if (caInline && caInline.includes('BEGIN CERTIFICATE')) {
                            ssl = { rejectUnauthorized: true, ca: caInline.replace(/\\n/g, '\n') };
                        }
                        else if (caPath) {
                            const resolved = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
                            try {
                                ssl = { rejectUnauthorized: true, ca: fs.readFileSync(resolved, 'utf8') };
                            }
                            catch {
                                ssl = { rejectUnauthorized: false };
                            }
                        }
                        else {
                            ssl = { rejectUnauthorized: false };
                        }
                    }
                    return {
                        type: 'postgres',
                        host: configService.get('DB_HOST') || 'localhost',
                        port: Number(configService.get('DB_PORT')) || 5432,
                        username: configService.get('DB_USER') || 'postgres',
                        password: configService.get('DB_PASSWORD') || 'password123',
                        database: configService.get('DB_NAME') || 'QuickMechanic',
                        ssl,
                        entities: [pricing_policy_entity_1.PricingPolicy, pricing_policy_entity_1.PaymentEnvironment, payment_ledger_entity_1.WalletAccount, payment_ledger_entity_1.PaymentLedger, payment_ledger_entity_1.WithdrawalAllocation, payment_ledger_entity_1.JobEvent, provider_kyc_submission_entity_1.ProviderKycSubmission, support_ticket_entity_1.SupportTicket, support_ticket_entity_1.SupportMessage, adm_user_entity_1.AdmUser, provider_user_entity_1.ProviderUser, cust_user_entity_1.CustUser, mechanic_profile_entity_1.MechanicProfile, service_request_entity_1.ServiceRequest, invoice_entity_1.Invoice, service_type_entity_1.ServiceType, vehicle_category_entity_1.VehicleCategory, mechanic_pricing_entity_1.MechanicPricing, wallet_transaction_entity_1.WalletTransaction, badge_entity_1.Badge, reputation_rule_entity_1.ReputationRule, reputation_log_entity_1.ReputationLog],
                        synchronize: configService.get('NODE_ENV') !== 'production',
                        autoLoadEntities: true,
                    };
                },
            }),
        ],
    })
], DatabaseModule);


/***/ }),
/* 74 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 75 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 76 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ReputationRule = void 0;
const typeorm_1 = __webpack_require__(11);
let ReputationRule = class ReputationRule {
    id;
    action;
    badgeTier;
    pointDeduction;
    description;
    createdAt;
    updatedAt;
};
exports.ReputationRule = ReputationRule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReputationRule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], ReputationRule.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ReputationRule.prototype, "badgeTier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ReputationRule.prototype, "pointDeduction", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ReputationRule.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], ReputationRule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], ReputationRule.prototype, "updatedAt", void 0);
exports.ReputationRule = ReputationRule = __decorate([
    (0, typeorm_1.Entity)('reputation_rules')
], ReputationRule);


/***/ }),
/* 77 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ReputationLog = void 0;
const typeorm_1 = __webpack_require__(11);
const mechanic_profile_entity_1 = __webpack_require__(16);
let ReputationLog = class ReputationLog {
    id;
    mechanicId;
    mechanic;
    action;
    pointsChanged;
    reason;
    createdAt;
};
exports.ReputationLog = ReputationLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReputationLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ReputationLog.prototype, "mechanicId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => mechanic_profile_entity_1.MechanicProfile),
    (0, typeorm_1.JoinColumn)({ name: 'mechanicId' }),
    __metadata("design:type", typeof (_a = typeof mechanic_profile_entity_1.MechanicProfile !== "undefined" && mechanic_profile_entity_1.MechanicProfile) === "function" ? _a : Object)
], ReputationLog.prototype, "mechanic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], ReputationLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ReputationLog.prototype, "pointsChanged", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ReputationLog.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], ReputationLog.prototype, "createdAt", void 0);
exports.ReputationLog = ReputationLog = __decorate([
    (0, typeorm_1.Entity)('reputation_logs')
], ReputationLog);


/***/ }),
/* 78 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HttpThrottlerGuard = void 0;
const common_1 = __webpack_require__(3);
const jwt_1 = __webpack_require__(21);
const throttler_1 = __webpack_require__(5);
let HttpThrottlerGuard = class HttpThrottlerGuard extends throttler_1.ThrottlerGuard {
    jwt;
    async getTracker(req) {
        try {
            const token = req.headers?.authorization?.replace(/^Bearer /, '');
            const user = await this.jwt.verifyAsync(token);
            if (user.sub)
                return 'user:' + user.sub;
        }
        catch { }
        return req.ip;
    }
    canActivate(context) {
        return context.getType() === 'http'
            ? super.canActivate(context)
            : Promise.resolve(true);
    }
};
exports.HttpThrottlerGuard = HttpThrottlerGuard;
__decorate([
    (0, common_1.Inject)(jwt_1.JwtService),
    __metadata("design:type", typeof (_a = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _a : Object)
], HttpThrottlerGuard.prototype, "jwt", void 0);
exports.HttpThrottlerGuard = HttpThrottlerGuard = __decorate([
    (0, common_1.Injectable)()
], HttpThrottlerGuard);


/***/ }),
/* 79 */
/***/ ((module) => {

module.exports = require("helmet");

/***/ }),
/* 80 */
/***/ ((module) => {

module.exports = require("express-rate-limit");

/***/ }),
/* 81 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = __webpack_require__(82);
const redis_adapter_1 = __webpack_require__(83);
const redis_1 = __webpack_require__(84);
const common_1 = __webpack_require__(3);
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    adapterConstructor;
    clients = [];
    logger = new common_1.Logger(RedisIoAdapter.name);
    async connectToRedis(redisUrl) {
        const useTls = redisUrl.startsWith('rediss://');
        const hostname = (() => { try {
            return new URL(redisUrl).hostname;
        }
        catch {
            return undefined;
        } })();
        const socket = useTls && hostname
            ? { tls: true, servername: hostname, rejectUnauthorized: true }
            : undefined;
        const pubClient = (0, redis_1.createClient)({ url: redisUrl, socket });
        const subClient = pubClient.duplicate();
        this.clients = [pubClient, subClient];
        for (const client of [pubClient, subClient])
            client.on('error', () => this.logger.error('Redis socket adapter connection error'));
        try {
            await Promise.all([pubClient.connect(), subClient.connect()]);
        }
        catch (error) {
            await this.dispose();
            throw error;
        }
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
    async dispose() {
        await Promise.all(this.clients.map(async (client) => {
            if (client.isOpen)
                await client.close();
        }));
        this.clients = [];
        await super.dispose();
    }
}
exports.RedisIoAdapter = RedisIoAdapter;


/***/ }),
/* 82 */
/***/ ((module) => {

module.exports = require("@nestjs/platform-socket.io");

/***/ }),
/* 83 */
/***/ ((module) => {

module.exports = require("@socket.io/redis-adapter");

/***/ }),
/* 84 */
/***/ ((module) => {

module.exports = require("redis");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	
/******/ })()
;