'use strict';
require('dotenv').config();
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

async function enrollAdmin(orgArg) {
  try {
    const org = (orgArg || 'org1').toLowerCase();
    const profilePath = org === 'org1' ? process.env.ORG1_CONNECTION_PROFILE : process.env.ORG2_CONNECTION_PROFILE;
    const ccp = yaml.load(fs.readFileSync(profilePath, 'utf8'));

    const caInfo = Object.values(ccp.certificateAuthorities)[0];
    const caURL = caInfo.url;
    const ca = new FabricCAServices(caURL);

    const walletPath = path.join(process.cwd(), process.env.WALLET_PATH || './wallet', org);
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const identityLabel = 'admin';
    const identityExists = await wallet.get(identityLabel);
    if (identityExists) {
      console.log('Admin identity already exists in wallet');
      return;
    }

    const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
    const x509Identity = {
      credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
      mspId: org === 'org1' ? 'Org1MSP' : 'Org2MSP',
      type: 'X.509'
    };
    await wallet.put(identityLabel, x509Identity);
    console.log(`Enrolled admin for ${org}`);
  } catch (err) {
    console.error('enrollAdmin error:', err);
  }
}

enrollAdmin(process.argv[2]);
