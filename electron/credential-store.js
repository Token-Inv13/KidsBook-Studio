const keytar = require('keytar');

const SERVICE_NAME = 'KidsBookStudio';

const ACCOUNTS = {
  openai: 'OpenAI_API_Key',
  ideogram: 'Ideogram_API_Key'
};

const getAccountName = (provider) => {
  return ACCOUNTS[provider] || provider;
};

async function setSecret(provider, secret) {
  await keytar.setPassword(SERVICE_NAME, getAccountName(provider), secret);
}

async function getSecret(provider) {
  return keytar.getPassword(SERVICE_NAME, getAccountName(provider));
}

async function deleteSecret(provider) {
  return keytar.deletePassword(SERVICE_NAME, getAccountName(provider));
}

module.exports = {
  SERVICE_NAME,
  ACCOUNTS,
  deleteSecret,
  getSecret,
  setSecret
};
