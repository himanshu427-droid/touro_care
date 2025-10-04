'use strict';
const FabricCAServices = require('fabric-ca-client');
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

async function _loadCCP(org) {
      const profilePath = path.resolve(__dirname,
    org === 'org1'
      ? process.env.ORG1_CONNECTION_PROFILE
      : process.env.ORG2_CONNECTION_PROFILE
  )
  const ccp = yaml.load(fs.readFileSync(profilePath, 'utf8'));
  return ccp;
}

async function _getWallet(org) {
  const walletPath = path.resolve(__dirname, process.env.WALLET_PATH, org);
  return await Wallets.newFileSystemWallet(walletPath);
}


async function _connectGateway(org, identity) {
  const ccp = await _loadCCP(org);
  const wallet = await _getWallet(org);
  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity,
    discovery: { enabled: true, asLocalhost: true }
  });
  return gateway;
}

/**
 * submitTransaction: submit (invoke) transaction to chaincode
 * - org: 'Org1' or 'Org2'
 * - identity: wallet identity name to use for signing (e.g., 'appUser' or admin)
 */
async function submitTransaction(org, identity, fcn, ...args) {
  const gateway = await _connectGateway(org, identity);
  try {
    const network = await gateway.getNetwork(process.env.CHANNEL_NAME);
    const contract = network.getContract(process.env.CHAINCODE_NAME);
    const result = await contract.submitTransaction(fcn, ...args);
    logger.info(`Submitted tx ${fcn} by ${identity} on ${org}`);
    return result;
  } finally {
    
    gateway.disconnect();
  }
}

async function evaluateTransaction(org, identity, fcn, ...args) {
  const gateway = await _connectGateway(org, identity);
  try {
    const network = await gateway.getNetwork(process.env.CHANNEL_NAME);
    const contract = network.getContract(process.env.CHAINCODE_NAME);
    const result = await contract.evaluateTransaction(fcn, ...args);
    logger.info(`Evaluated tx ${fcn} by ${identity} on ${org}`);
    return result;
  } finally {
    gateway.disconnect();
  }
}
/**
 * generateWalletId: registers a new identity with Fabric CA
 * @param {string} org - 'Org1' or 'Org2'
 * @param {array} roles - e.g., ['tourist'], ['admin'], ['police']
 */
/**
 * generateWalletId: auto register and enroll a new identity for tourists or optionally for admin/police
 */
async function generateWalletId(org, roles) {
  try {
    const role = roles[0];
    const prefix = role === 'tourist' ? 't' : role === 'admin' ? 'admin' : role === 'police' ? 'police' : 'user';

    const ccp = await _loadCCP(org);
    const caInfo = Object.values(ccp.certificateAuthorities)[0];
    const ca = new FabricCAServices(caInfo.url, { trustedRoots: caInfo.tlsCACerts.pem, verify: false }, caInfo.caName);

    const wallet = await _getWallet(org);

    // Find next available walletId

  
    const walletId = `${prefix}_${Date.now()}`;


    // Admin identity must exist
    const adminIdentity = await wallet.get('admin');
    if (!adminIdentity) throw new Error(`Admin identity not found in ${org} wallet. Enroll admin first.`);

    // Get admin user context
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');

    // Register & enroll user
    const secret = await ca.register({
      affiliation: `${org.toLowerCase()}.department1`,
      enrollmentID: walletId,
      role: 'client',
      attrs: [
        { name: 'role', value: role, ecert: true },
        { name: 'org', value: org, ecert: true }
      ]
    }, adminUser);

    const enrollment = await ca.enroll({ enrollmentID: walletId, enrollmentSecret: secret });
    const identity = {
      credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
      mspId: org === 'org1' ? 'Org1MSP' : 'Org2MSP',
      type: 'X.509'
    };
   await wallet.put(`${walletId}`, identity); // wallet file

    logger.info(`Wallet ID generated: ${walletId}`);
    return walletId;

  } catch (err) {
    logger.error('Error generating wallet ID:', err);
    throw err;
  }
}

module.exports = { submitTransaction, evaluateTransaction,generateWalletId };
