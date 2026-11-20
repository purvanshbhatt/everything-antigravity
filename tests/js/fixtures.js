'use strict';
/**
 * Fake credentials for scanner tests. None of these are real.
 * They are assembled from fragments at runtime so the repository itself never
 * contains a full credential-shaped string (keeps push protection and the CI
 * secret scan quiet while still exercising every detector).
 */
const join = (...parts) => parts.join('');

module.exports = Object.freeze({
  googleKey: join('AI', 'za', 'SyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW'),
  awsKey: join('AK', 'IA', 'Z7QWERTYUIOPASDF'),
  githubToken: join('gh', 'p_', 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789'),
  privateKey: join('-----BEGIN RSA ', 'PRIVATE KEY-----', '\nMIIEow...'),
  serviceAccount: join('{"type": "service_', 'account", "private_key": "-----BEGIN ', 'PRIVATE KEY-----\\nabc"}'),
  stripeKey: join('sk', '_live_', '51HqAbCdEfGhIjKlMnOpQrStUv'),
  slackToken: join('xo', 'xb-', '1234567890-abcdefghijkl'),
});
