// Pacotes CJS do ecossistema Nest (ex.: @nestjs/throttler, nestjs-pino) fazem require()
// de @nestjs/common/core, que no Nest 12 são ESM. O runtime do Jest só aceita esse
// require(esm) se o módulo ESM já estiver avaliado — então carregamos antes dos testes.
await import('@nestjs/common');
await import('@nestjs/core');
