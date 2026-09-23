/**
 * Corre antes de cada archivo de test e2e, antes de importar la app: los
 * tests usan una base aparte (la crea preparar-base.ts), nunca la de
 * desarrollo. ConfigModule no pisa variables que ya estén definidas.
 */
process.env.DB_NAME = process.env.DB_NAME_TEST || 'kontago_test';
process.env.NODE_ENV = 'test';
// Los cortes de día (ventas de hoy, vencimientos) son en hora de Ecuador.
process.env.TZ = process.env.TZ || 'America/Guayaquil';
// Sin correo de verdad durante los tests.
process.env.SMTP_HOST = '';
