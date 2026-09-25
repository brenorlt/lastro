// Carregado antes de cada suíte e2e. O DATABASE_URL vem do .env local (banco do docker compose).
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.TRUST_PROXY = '1'; // os testes simulam IPs distintos via X-Forwarded-For
process.env.APP_URL = 'http://localhost:3100';
process.env.CORS_ORIGINS = 'http://localhost:3100';
process.env.MAIL_TRANSPORT = 'log';
process.env.AUTH_MAX_FAILED_ATTEMPTS = '5';
process.env.AUTH_LOCKOUT_MINUTES = '15';
process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = 'true';
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-0123456789abcdef012345678';
process.env.UPLOAD_DIR = `${process.env.TMPDIR ?? '/tmp'}/lastro-e2e-uploads`;
