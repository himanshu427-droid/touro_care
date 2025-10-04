'use strict';
require('dotenv').config()
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

async function registerUser(orgArg, username = 'appUser', secret = 'appUserpw') {
  try {
    const org = (orgArg || 'org1').toLowerCase();
       const profilePath = path.resolve(__dirname,
     org === 'org1'
       ? process.env.ORG1_CONNECTION_PROFILE
       : process.env.ORG2_CONNECTION_PROFILE
   )
    const ccp = yaml.load(fs.readFileSync(profilePath, 'utf8'));

    const caInfo = Object.values(ccp.certificateAuthorities)[0];
    const caURL = caInfo.url;
    const ca = new FabricCAServices(caURL);

    const walletPath = path.resolve(__dirname, process.env.WALLET_PATH, org);
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const userExists = await wallet.get(username);
    if (userExists) { console.log(`User ${username} exists`); return; }

    const adminIdentity = await wallet.get('admin');
    if (!adminIdentity) { console.log('Admin identity not found. Run enrollAdmin first.'); return; }

    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');

    const secretReg = await ca.register({ affiliation: `${org}.department1`, enrollmentID: username, role: 'client' }, adminUser);
    const enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: secretReg });

    const x509Identity = {
      credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
      mspId: org === 'org1' ? 'Org1MSP' : 'Org2MSP',
      type: 'X.509'
    };
    await wallet.put(username, x509Identity);
    console.log(`Registered and enrolled user ${username} for ${org}`);
  } catch (err) {
    console.error('registerUser error:', err);
  }
}

registerUser(process.argv[2], process.argv[3], process.argv[4]);
